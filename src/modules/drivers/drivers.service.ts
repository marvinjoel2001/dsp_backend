import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver, DriverVerificationStatus } from './entities/driver.entity';
import { DriverWalletTransaction } from './entities/driver-wallet-transaction.entity';
import { DeliveryOrder, OrderStatus } from '../orders/entities/order.entity';
import { TrackingService } from '../tracking/tracking.service';

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

  async getAllDrivers() {
    return this.driverRepo.find({ order: { createdAt: 'DESC' } });
  }

  async getDriverById(id: string) {
    const driver = await this.driverRepo.findOne({ where: { id } });
    if (!driver) throw new NotFoundException('Conductor no encontrado.');
    return driver;
  }

  async updateProfile(id: string, data: Partial<Driver>) {
    const driver = await this.getDriverById(id);
    if (data.fullName) driver.fullName = data.fullName;
    if (data.phone) driver.phone = data.phone;
    if (data.vehicleType) driver.vehicleType = data.vehicleType;
    if (data.vehiclePlate) driver.vehiclePlate = data.vehiclePlate;
    if (data.avatarUrl) driver.avatarUrl = data.avatarUrl;
    return this.driverRepo.save(driver);
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
      currency: 'USD',
      transactions,
    };
  }
}
