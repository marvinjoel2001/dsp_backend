import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DriverWithdrawal, WithdrawalStatus } from './entities/driver-withdrawal.entity';
import { MerchantSettlement } from './entities/merchant-settlement.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { DeliveryOrder, OrderStatus } from '../orders/entities/order.entity';
import { DriverWalletTransaction } from '../drivers/entities/driver-wallet-transaction.entity';

@Injectable()
export class SettlementsService {
  constructor(
    @InjectRepository(DriverWithdrawal)
    private readonly withdrawalRepo: Repository<DriverWithdrawal>,
    @InjectRepository(MerchantSettlement)
    private readonly merchantSettlementRepo: Repository<MerchantSettlement>,
    @InjectRepository(Driver)
    private readonly driverRepo: Repository<Driver>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(DeliveryOrder)
    private readonly orderRepo: Repository<DeliveryOrder>,
    @InjectRepository(DriverWalletTransaction)
    private readonly walletTxRepo: Repository<DriverWalletTransaction>,
  ) {}

  // 1. Conductor solicita retiro de fondos
  async createWithdrawalRequest(
    driverId: string,
    dto: {
      amount: number;
      method: 'BANK_TRANSFER' | 'QR_PAYMENT';
      accountHolder: string;
      accountNumberOrPhone: string;
      qrPhotoUrl?: string;
    },
  ) {
    const driver = await this.driverRepo.findOne({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Conductor no encontrado.');

    const amount = Number(dto.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestException('Monto de retiro inválido.');
    }

    if (Number(driver.walletBalance) < amount) {
      throw new BadRequestException(
        `Saldo insuficiente. Tu saldo actual es de Bs. ${Number(driver.walletBalance).toFixed(2)}.`,
      );
    }

    // Descontar del saldo del conductor
    driver.walletBalance = Number(driver.walletBalance) - amount;
    await this.driverRepo.save(driver);

    // Crear registro de retiro pendiente
    const withdrawal = this.withdrawalRepo.create({
      driverId,
      amount,
      method: dto.method,
      accountHolder: dto.accountHolder,
      accountNumberOrPhone: dto.accountNumberOrPhone,
      qrPhotoUrl: dto.qrPhotoUrl,
      status: WithdrawalStatus.PENDING,
    });
    const savedWithdrawal = await this.withdrawalRepo.save(withdrawal);

    // Registrar transacción en billetera
    const tx = this.walletTxRepo.create({
      driverId,
      amount: -amount,
      type: 'WITHDRAWAL',
      referenceId: savedWithdrawal.id,
      description: `Solicitud de retiro vía ${dto.method === 'BANK_TRANSFER' ? 'Cuenta Bancaria' : 'QR Simple'} (${dto.accountNumberOrPhone})`,
    });
    await this.walletTxRepo.save(tx);

    return savedWithdrawal;
  }

  // 2. Obtener todas las solicitudes de retiro para el Admin
  async getAllWithdrawals(status?: WithdrawalStatus) {
    const where = status ? { status } : {};
    const withdrawals = await this.withdrawalRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });

    // Enriquecer con datos del conductor
    const driverIds = [...new Set(withdrawals.map((w) => w.driverId))];
    const drivers = driverIds.length > 0 ? await this.driverRepo.findByIds(driverIds) : [];
    const driverMap = new Map(drivers.map((d) => [d.id, d]));

    return withdrawals.map((w) => {
      const driver = driverMap.get(w.driverId);
      return {
        ...w,
        driver: driver
          ? {
              id: driver.id,
              fullName: driver.fullName,
              phone: driver.phone,
              email: driver.email,
              ciNumber: driver.ciNumber,
              vehicleType: driver.vehicleType,
              avatarUrl: driver.avatarUrl,
            }
          : null,
      };
    });
  }

  // 3. Admin registra que ya le pagó al repartidor
  async payDriverWithdrawal(
    id: string,
    dto: { paymentReference?: string; adminNotes?: string },
  ) {
    const withdrawal = await this.withdrawalRepo.findOne({ where: { id } });
    if (!withdrawal) throw new NotFoundException('Solicitud de retiro no encontrada.');

    withdrawal.status = WithdrawalStatus.PAID;
    withdrawal.paymentReference = dto.paymentReference || `TRANS-${Date.now().toString().slice(-6)}`;
    withdrawal.adminNotes = dto.adminNotes;
    withdrawal.paidAt = new Date();

    return this.withdrawalRepo.save(withdrawal);
  }

  // 4. Admin rechaza retiro y reintegra fondos al conductor
  async rejectDriverWithdrawal(id: string, reason: string) {
    const withdrawal = await this.withdrawalRepo.findOne({ where: { id } });
    if (!withdrawal) throw new NotFoundException('Solicitud de retiro no encontrada.');
    if (withdrawal.status === WithdrawalStatus.PAID) {
      throw new BadRequestException('No se puede rechazar un retiro ya pagado.');
    }

    withdrawal.status = WithdrawalStatus.REJECTED;
    withdrawal.adminNotes = reason;
    await this.withdrawalRepo.save(withdrawal);

    // Reembolsar saldo
    const driver = await this.driverRepo.findOne({ where: { id: withdrawal.driverId } });
    if (driver) {
      driver.walletBalance = Number(driver.walletBalance) + Number(withdrawal.amount);
      await this.driverRepo.save(driver);

      const tx = this.walletTxRepo.create({
        driverId: driver.id,
        amount: Number(withdrawal.amount),
        type: 'BONUS',
        referenceId: withdrawal.id,
        description: `Reembolso por retiro rechazado: ${reason}`,
      });
      await this.walletTxRepo.save(tx);
    }

    return withdrawal;
  }

  // 5. Resumen de Liquidación y Cobranza a Comercios (Merchants / Tenants)
  async getMerchantSettlementSummary() {
    const tenants = await this.tenantRepo.find({ order: { name: 'ASC' } });
    const allOrders = await this.orderRepo.find();
    const allSettlements = await this.merchantSettlementRepo.find();

    return tenants.map((tenant) => {
      const tenantOrders = allOrders.filter((o) => o.tenantId === tenant.id);
      const deliveredOrders = tenantOrders.filter((o) => o.status === OrderStatus.DELIVERED);

      const totalGMV = deliveredOrders.reduce((sum, o) => sum + Number(o.price || 0), 0);
      const totalDriverPayouts = deliveredOrders.reduce((sum, o) => sum + Number(o.driverPayout || 0), 0);
      const totalCommission = deliveredOrders.reduce(
        (sum, o) => sum + (Number(o.price || 0) - Number(o.driverPayout || 0)),
        0,
      );

      const tenantSettlements = allSettlements.filter((s) => s.tenantId === tenant.id);
      const totalPaid = tenantSettlements.reduce((sum, s) => sum + Number(s.amountPaid || 0), 0);
      const pendingBalance = Math.max(0, totalCommission - totalPaid);

      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantEmail: tenant.email,
        webhookUrl: tenant.webhookUrl,
        totalOrders: tenantOrders.length,
        deliveredOrdersCount: deliveredOrders.length,
        totalGMV: Number(totalGMV.toFixed(2)),
        totalDriverPayouts: Number(totalDriverPayouts.toFixed(2)),
        totalCommissionOwed: Number(totalCommission.toFixed(2)), // Lo que el comercio debe a DSP
        totalPaidByMerchant: Number(totalPaid.toFixed(2)), // Lo que ya pagó
        pendingBalance: Number(pendingBalance.toFixed(2)), // Saldo pendiente
        status: pendingBalance <= 0 ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'PENDING',
        lastSettlementDate: tenantSettlements.length > 0 ? tenantSettlements[tenantSettlements.length - 1].createdAt : null,
      };
    });
  }

  // 6. Registrar cobro / liquidación pagada por un comercio
  async recordMerchantPayment(
    tenantId: string,
    dto: {
      amountPaid: number;
      method: 'QR_SIMPLE' | 'BANK_TRANSFER' | 'CASH';
      paymentReference?: string;
      ordersCount?: number;
      notes?: string;
    },
  ) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Comercio no encontrado.');

    const settlement = this.merchantSettlementRepo.create({
      tenantId,
      amountPaid: Number(dto.amountPaid),
      method: dto.method || 'QR_SIMPLE',
      paymentReference: dto.paymentReference || `REC-${Date.now().toString().slice(-6)}`,
      ordersCount: dto.ordersCount || 0,
      notes: dto.notes,
    });

    return this.merchantSettlementRepo.save(settlement);
  }

  // 7. Listar órdenes detalladas de un comercio para auditoría e informes
  async getMerchantOrders(tenantId: string) {
    return this.orderRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  // 8. Métricas Financieras Globales para el Dashboard
  async getDashboardFinancialMetrics() {
    const [drivers, orders, withdrawals, settlements] = await Promise.all([
      this.driverRepo.find(),
      this.orderRepo.find(),
      this.withdrawalRepo.find(),
      this.merchantSettlementRepo.find(),
    ]);

    const totalDrivers = drivers.length;
    const verifiedDrivers = drivers.filter((d) => d.verificationStatus === 'verified').length;
    const onlineDrivers = drivers.filter((d) => d.isOnline).length;

    const deliveredOrders = orders.filter((o) => o.status === OrderStatus.DELIVERED);
    const totalGMV = deliveredOrders.reduce((acc, curr) => acc + Number(curr.price || 0), 0);
    const totalPlatformCommission = deliveredOrders.reduce(
      (acc, curr) => acc + (Number(curr.price || 0) - Number(curr.driverPayout || 0)),
      0,
    );

    // Pagos a Repartidores
    const pendingWithdrawals = withdrawals.filter((w) => w.status === WithdrawalStatus.PENDING);
    const pendingDriversDebt = pendingWithdrawals.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

    const paidWithdrawals = withdrawals.filter((w) => w.status === WithdrawalStatus.PAID);
    const totalPaidToDrivers = paidWithdrawals.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

    // Cobranza a Comercios
    const totalCollectedFromMerchants = settlements.reduce((acc, curr) => acc + Number(curr.amountPaid || 0), 0);
    const totalOwedByMerchants = Math.max(0, totalPlatformCommission - totalCollectedFromMerchants);

    return {
      totalDrivers,
      verifiedDrivers,
      onlineDrivers,
      totalOrders: orders.length,
      deliveredOrders: deliveredOrders.length,
      totalGMV: Number(totalGMV.toFixed(2)),
      totalPlatformCommission: Number(totalPlatformCommission.toFixed(2)),
      pendingDriversDebt: Number(pendingDriversDebt.toFixed(2)), // Cuentas por pagar a drivers
      totalPaidToDrivers: Number(totalPaidToDrivers.toFixed(2)),
      totalOwedByMerchants: Number(totalOwedByMerchants.toFixed(2)), // Cuentas por cobrar a tiendas
      totalCollectedFromMerchants: Number(totalCollectedFromMerchants.toFixed(2)),
    };
  }
}
