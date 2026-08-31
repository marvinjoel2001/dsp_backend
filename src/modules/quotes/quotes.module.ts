import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';
import { Quote } from './entities/quote.entity';
import { TenantsModule } from '../tenants/tenants.module';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [TypeOrmModule.forFeature([Quote]), TenantsModule, PricingModule],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService, TypeOrmModule],
})
export class QuotesModule {}
