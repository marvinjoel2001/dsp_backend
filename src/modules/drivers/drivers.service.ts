import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Driver, DriverVerificationStatus, VehicleType } from './entities/driver.entity';
import { DriverWalletTransaction } from './entities/driver-wallet-transaction.entity';
import { DeliveryOrder, OrderStatus } from '../orders/entities/order.entity';
import { TrackingService } from '../tracking/tracking.service';
import { CreateDriverAdminDto } from './dto/create-driver-admin.dto';

@Injectable()
export class DriversService {
  constructor(
    @InjectRepository(Driver)
    private readonly driverRepo: Repository<Driver>,
    @InjectRepository(DriverWalletTransaction)
    private readonly walletTxRepo: Repository<DriverWalletTransaction>,
    @InjectRepository(DeliveryOrder)
    private readonly orderRepo: Repository<DeliveryOrder>,
    private readonly trackingService: TrackingService,
  ) {}

  async getAllDrivers(dspPartnerId?: string) {
    if (dspPartnerId) {
      return this.driverRepo.find({
        where: { dspPartnerId },
        order: { isOnline: 'DESC', createdAt: 'DESC' },
      });
    }
    return this.driverRepo.find({ order: { isOnline: 'DESC', createdAt: 'DESC' } });
  }

  async createDriverFromAdmin(dto: CreateDriverAdminDto, forcedDspPartnerId?: string) {
    const cleanPhone = dto.phone.trim();
    const cleanEmail = dto.email.trim().toLowerCase();

    const existing = await this.driverRepo.findOne({
      where: [{ email: cleanEmail }, { phone: cleanPhone }],
    });
    if (existing) {
      throw new ConflictException('Ya existe un conductor registrado con este correo o teléfono.');
    }

    const hashedPassword = await bcrypt.hash(dto.password || '123456', 10);
    const assignedDspId = forcedDspPartnerId || dto.dspPartnerId || null;

    const driver = this.driverRepo.create({
      fullName: dto.fullName.trim(),
      phone: cleanPhone,
      email: cleanEmail,
      password: hashedPassword,
      ciNumber: dto.ciNumber?.trim() || null,
      homeAddress: dto.homeAddress?.trim() || null,
      vehicleType: dto.vehicleType || VehicleType.MOTORCYCLE,
      vehiclePlate: dto.vehiclePlate?.trim().toUpperCase() || 'S/P',
      dspPartnerId: assignedDspId,
      verificationStatus: DriverVerificationStatus.VERIFIED,
      isOnline: false,
      isActive: true,
      rating: 5.0,
      walletBalance: 0.0,
    });

    const saved = await this.driverRepo.save(driver);
    const { password, ...data } = saved;
    return data;
  }

  async getDriverById(id: string) {
    const driver = await this.driverRepo.findOne({ where: { id } });
    if (!driver) throw new NotFoundException('Conductor no encontrado.');
    return driver;
  }

  async updateProfile(id: string, data: any) {
    const driver = await this.getDriverById(id);
    if (data.fullName !== undefined) driver.fullName = data.fullName.trim();
    if (data.phone !== undefined) driver.phone = data.phone.trim();
    if (data.email !== undefined) driver.email = data.email.trim().toLowerCase();
    if (data.ciNumber !== undefined) driver.ciNumber = data.ciNumber ? data.ciNumber.trim() : null;
    if (data.homeAddress !== undefined) driver.homeAddress = data.homeAddress ? data.homeAddress.trim() : null;
    if (data.vehicleType !== undefined) driver.vehicleType = data.vehicleType;
    if (data.vehiclePlate !== undefined) driver.vehiclePlate = data.vehiclePlate ? data.vehiclePlate.trim().toUpperCase() : '';
    if (data.avatarUrl !== undefined) driver.avatarUrl = data.avatarUrl;
    if (data.dspPartnerId !== undefined) driver.dspPartnerId = data.dspPartnerId || null;
    if (data.password) {
      driver.password = await bcrypt.hash(data.password, 10);
    }
    const saved = await this.driverRepo.save(driver);
    const { password, ...safeData } = saved;
    return safeData;
  }

  async toggleActiveStatus(id: string) {
    const driver = await this.getDriverById(id);
    driver.isActive = !driver.isActive;
    // Si se bloquea / desactiva, forzarlo a offline
    if (!driver.isActive) {
      driver.isOnline = false;
      await this.trackingService.removeDriverLocation(id);
    }
    const saved = await this.driverRepo.save(driver);
    const { password, ...safeData } = saved;
    return safeData;
  }

  async deleteDriver(id: string) {
    const driver = await this.getDriverById(id);
    // Desvincular órdenes activas o históricas
    await this.orderRepo.update({ driverId: id }, { driverId: undefined });
    // Limpiar transacciones de billetera
    await this.walletTxRepo.delete({ driverId: id });
    // Retirar de Redis si estuviera en línea
    await this.trackingService.removeDriverLocation(id);
    // Eliminar registro
    await this.driverRepo.delete(id);
    return { success: true, message: `Conductor ${driver.fullName} eliminado exitosamente.` };
  }

  async uploadDocuments(id: string, docs: {
    idCardUrl?: string;
    licenseUrl?: string;
    soatUrl?: string;
    vehiclePhotoUrl?: string;
  }) {
    const driver = await this.getDriverById(id);
    if (docs.idCardUrl) driver.idCardUrl = docs.idCardUrl;
    if (docs.licenseUrl) driver.licenseUrl = docs.licenseUrl;
    if (docs.soatUrl) driver.soatUrl = docs.soatUrl;
    if (docs.vehiclePhotoUrl) driver.vehiclePhotoUrl = docs.vehiclePhotoUrl;
    driver.verificationStatus = DriverVerificationStatus.PENDING;
    return this.driverRepo.save(driver);
  }

  async updateVerificationStatus(id: string, status: DriverVerificationStatus) {
    const driver = await this.getDriverById(id);
    driver.verificationStatus = status;
    return this.driverRepo.save(driver);
  }

  async toggleOnlineStatus(driverId: string, isOnline: boolean) {
    const driver = await this.getDriverById(driverId);
    
    // Si no está verificado, no se permite conectar ni recibir órdenes
    if (isOnline && driver.verificationStatus !== DriverVerificationStatus.VERIFIED) {
      if (driver.verificationStatus === DriverVerificationStatus.REJECTED) {
        throw new BadRequestException('Tu cuenta ha sido rechazada por el equipo de operaciones. Revisa tus documentos.');
      }
      throw new BadRequestException(
        'Tu cuenta está en proceso de validación por la central (usualmente tarda unos minutos). No puedes recibir órdenes hasta ser aprobado.',
      );
    }

    driver.isOnline = isOnline;
    const saved = await this.driverRepo.save(driver);

    if (!isOnline) {
      await this.trackingService.removeDriverLocation(driverId);
    }

    return saved;
  }

  async getAvailableFeedForDriver(driverId: string) {
    const availableOrders = await this.orderRepo.find({
      where: [
        { status: OrderStatus.CREATED },
        { status: OrderStatus.SEARCHING_DRIVER },
      ],
      order: { createdAt: 'DESC' },
      take: 20,
    });

    return availableOrders;
  }

  async getActiveOrderForDriver(driverId: string) {
    const activeOrder = await this.orderRepo.findOne({
      where: [
        { driverId, status: OrderStatus.ASSIGNED },
        { driverId, status: OrderStatus.ARRIVED_AT_PICKUP },
        { driverId, status: OrderStatus.IN_TRANSIT },
      ],
      order: { updatedAt: 'DESC' },
    });

    return activeOrder || null;
  }

  async getDriverWallet(driverId: string) {
    const driver = await this.getDriverById(driverId);
    const transactions = await this.walletTxRepo.find({
      where: { driverId },
      order: { createdAt: 'DESC' },
    });

    return {
      balance: driver.walletBalance,
      currency: 'BOB',
      transactions,
    };
  }

  async adjustDriverBalance(
    driverId: string,
    dto: {
      amount: number;
      type: 'BONUS' | 'PENALTY' | 'PAYOUT';
      description: string;
    },
  ) {
    const driver = await this.getDriverById(driverId);
    driver.walletBalance = Number(driver.walletBalance) + Number(dto.amount);
    await this.driverRepo.save(driver);

    const tx = this.walletTxRepo.create({
      driverId,
      amount: Number(dto.amount),
      type: dto.type || 'BONUS',
      referenceId: `ADJ-${Date.now().toString().slice(-6)}`,
      description: dto.description || 'Ajuste manual de tesorería por soporte',
    });
    const savedTx = await this.walletTxRepo.save(tx);

    return {
      driver,
      transaction: savedTx,
    };
  }
}
