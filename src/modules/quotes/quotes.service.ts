import { Injectable, BadRequestException, NotFoundException, Optional, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Quote } from './entities/quote.entity';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { GeoUtil } from '../../common/utils/geo.util';
import { PricingService } from '../pricing/pricing.service';
import { TrackingService } from '../tracking/tracking.service';

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    @InjectRepository(Quote)
    private readonly quoteRepository: Repository<Quote>,
    private readonly configService: ConfigService,
    private readonly pricingService: PricingService,
    @Optional()
    private readonly trackingService?: TrackingService,
  ) {}

  async calculateAndCreateQuote(tenantId: string, dto: CreateQuoteDto): Promise<Quote> {
    const distanceKm = GeoUtil.haversineDistanceKm(
      dto.pickupLat,
      dto.pickupLng,
      dto.dropoffLat,
      dto.dropoffLng,
    );

    if (distanceKm > 50) {
      throw new BadRequestException('La distancia calculada supera el radio máximo permitido de entrega (50 km)');
    }

    const durationMinutes = GeoUtil.estimateDurationMinutes(distanceKm);
    const ttlMinutes = parseInt(this.configService.get<string>('QUOTE_TTL_MINUTES', '15'), 10);

    // Calcular precio mediante el motor dinámico de tramos de tarifas (Resolución O(1) en RAM)
    const pricing = await this.pricingService.calculatePrice({
      distanceKm,
      durationMinutes,
      vehicleType: dto.vehicleType || 'MOTORCYCLE',
      dspPartnerId: dto.dspPartnerId,
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
      currency: 'BOB', // Moneda oficial bolivianos
      expiresAt,
    });

    const savedQuote = await this.quoteRepository.save(quote);

    // Guardar en caché Redis para validación instantánea en < 1ms al crear la orden
    if (this.trackingService) {
      try {
        const redis = this.trackingService.getRedis();
        await redis.set(
          `quote:${savedQuote.id}`,
          JSON.stringify(savedQuote),
          'EX',
          ttlMinutes * 60,
        );
      } catch (_) {}
    }

    return savedQuote;
  }

  async getQuoteById(quoteId: string): Promise<Quote> {
    if (this.trackingService) {
      try {
        const redis = this.trackingService.getRedis();
        const cached = await redis.get(`quote:${quoteId}`);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (_) {}
    }

    const quote = await this.quoteRepository.findOne({ where: { id: quoteId } });
    if (!quote) {
      throw new NotFoundException('Cotización no encontrada');
    }
    return quote;
  }

  async validateQuoteActive(quoteId: string): Promise<Quote> {
    const quote = await this.getQuoteById(quoteId);
    if (new Date() > new Date(quote.expiresAt)) {
      throw new BadRequestException('La cotización ha expirado (vigencia de 15 min). Por favor genere una nueva cotización.');
    }
    return quote;
  }
}
