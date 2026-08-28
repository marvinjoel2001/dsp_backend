import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DspPartner } from './entities/dsp-partner.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { DeliveryOrder } from '../orders/entities/order.entity';
import { DspPartnersService } from './dsp-partners.service';
import { DspPartnersController } from './dsp-partners.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DspPartner, Driver, DeliveryOrder])],
  controllers: [DspPartnersController],
  providers: [DspPartnersService],
  exports: [DspPartnersService, TypeOrmModule],
})
export class DspPartnersModule {}
