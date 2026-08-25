import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriversService } from './drivers.service';
import { DriversController } from './drivers.controller';
import { Driver } from './entities/driver.entity';
import { DriverWalletTransaction } from './entities/driver-wallet-transaction.entity';
import { DeliveryOrder } from '../orders/entities/order.entity';
import { TrackingModule } from '../tracking/tracking.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Driver, DriverWalletTransaction, DeliveryOrder]),
    TrackingModule,
  ],
  controllers: [DriversController],
  providers: [DriversService],
  exports: [DriversService, TypeOrmModule],
})
export class DriversModule {}
