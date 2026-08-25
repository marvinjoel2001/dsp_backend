import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { DeliveryOrder } from './entities/order.entity';
import { OrderStatusLog } from './entities/order-status-log.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { DriverWalletTransaction } from '../drivers/entities/driver-wallet-transaction.entity';
import { QuotesModule } from '../quotes/quotes.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { DispatchModule } from '../dispatch/dispatch.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeliveryOrder,
      OrderStatusLog,
      Driver,
      DriverWalletTransaction,
    ]),
    QuotesModule,
    WebhooksModule,
    TenantsModule,
    forwardRef(() => DispatchModule),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService, TypeOrmModule],
})
export class OrdersModule {}
