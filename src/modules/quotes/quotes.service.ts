import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Quote } from './entities/quote.entity';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { GeoUtil } from '../../common/utils/geo.util';

@Injectable()
export class QuotesService {
  constructor(
    @InjectRepository(Quote)
    private readonly quoteRepository: Repository<Quote>,
    private readonly configService: ConfigService,
  ) {}

  async calculateAndCreateQuote(tenantId: string, dto: CreateQuoteDto): Promise<Quote> {
    const distanceKm = GeoUtil.haversineDistanceKm(
      dto.pickupLat,
      dto.pickupLng,
      dto.dropoffLat,
      dto.dropoffLng,
    );

    if (distanceKm > 50) {
      throw new BadRequestException('Distance exceeds maximum allowed delivery radius (50 km)');
    }

    const durationMinutes = GeoUtil.estimateDurationMinutes(distanceKm);

    const baseFare = parseFloat(this.configService.get<string>('BASE_FARE', '2.50'));
    const perKmRate = parseFloat(this.configService.get<string>('PER_KM_RATE', '1.20'));
    const perMinuteRate = parseFloat(this.configService.get<string>('PER_MINUTE_RATE', '0.25'));
    const ttlMinutes = parseInt(this.configService.get<string>('QUOTE_TTL_MINUTES', '15'), 10);

    const pricing = GeoUtil.calculateQuotePrice(distanceKm, durationMinutes, {
      baseFare,
      perKmRate,
      perMinuteRate,
      surgeMultiplier: dto.surgeMultiplier || 1.0,
    });

    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const quote = this.quoteRepository.create({
      tenantId,
      pickupAddress: dto.pickupAddress,
      pickupLat: dto.pickupLat,
      pickupLng: dto.pickupLng,
      dropoffAddress: dto.dropoffAddress,
      dropoffLat: dto.dropoffLat,
      dropoffLng: dto.dropoffLng,
      distanceKm,
      durationMinutes,
      basePrice: pricing.basePrice,
      surgeMultiplier: pricing.surgeMultiplier,
      totalPrice: pricing.totalPrice,
      driverPayout: pricing.driverPayout,
      currency: 'USD',
      expiresAt,
    });

    return this.quoteRepository.save(quote);
  }

  async getQuoteById(quoteId: string): Promise<Quote> {
    const quote = await this.quoteRepository.findOne({ where: { id: quoteId } });
    if (!quote) {
      throw new NotFoundException('Quote not found');
    }
    return quote;
  }

  async validateQuoteActive(quoteId: string): Promise<Quote> {
    const quote = await this.getQuoteById(quoteId);
    if (new Date() > new Date(quote.expiresAt)) {
      throw new BadRequestException('Quote has expired. Please generate a new quote.');
    }
    return quote;
  }
}
