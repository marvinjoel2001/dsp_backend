import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { DeliveryOrder } from '../orders/entities/order.entity';
import { WebhookDelivery } from '../webhooks/entities/webhook-delivery.entity';
import { DspPartner } from '../dsp-partners/entities/dsp-partner.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, Driver, DeliveryOrder, WebhookDelivery, DspPartner]),
  ],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
