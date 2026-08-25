import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver } from './entities/driver.entity';
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
    if (!driver) throw new NotFoundException('Driver not found');
    return driver;
  }

  async toggleOnlineStatus(driverId: string, isOnline: boolean) {
    const driver = await this.getDriverById(driverId);
    driver.isOnline = isOnline;
    const saved = await this.driverRepo.save(driver);

    if (!isOnline) {
      await this.trackingService.removeDriverLocation(driverId);
    }

    return saved;
  }

  async getAvailableFeedForDriver(driverId: string) {
    // Return all unassigned orders ready for pickup
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
