import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DispatchService } from './dispatch.service';
import { DispatchController } from './dispatch.controller';
import { DeliveryOrder } from '../orders/entities/order.entity';
import { OrderStatusLog } from '../orders/entities/order-status-log.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { TrackingModule } from '../tracking/tracking.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeliveryOrder, OrderStatusLog, Driver]),
    TrackingModule,
    WebhooksModule,
  ],
  controllers: [DispatchController],
  providers: [DispatchService],
  exports: [DispatchService],
})
export class DispatchModule {}
