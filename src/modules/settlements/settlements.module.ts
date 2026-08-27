import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettlementsService } from './settlements.service';
import { SettlementsController } from './settlements.controller';
import { DriverWithdrawal } from './entities/driver-withdrawal.entity';
import { MerchantSettlement } from './entities/merchant-settlement.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { DeliveryOrder } from '../orders/entities/order.entity';
import { DriverWalletTransaction } from '../drivers/entities/driver-wallet-transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DriverWithdrawal,
      MerchantSettlement,
      Driver,
      Tenant,
      DeliveryOrder,
      DriverWalletTransaction,
    ]),
  ],
  controllers: [SettlementsController],
  providers: [SettlementsService],
  exports: [SettlementsService],
})
export class SettlementsModule {}
