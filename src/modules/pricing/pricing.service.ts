import { Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { PricingConfig, DistanceBracket } from './entities/pricing-config.entity';
import { CreatePricingConfigDto, SimulateQuoteDto } from './dto/pricing.dto';

export interface PriceCalculationResult {
  basePrice: number;
  surgeMultiplier: number;
  totalPrice: number;
  driverPayout: number;
  platformFee: number;
  appliedConfigId?: string;
  appliedConfigName: string;
  vehicleType: string;
  matchedBracket?: DistanceBracket;
  distanceKm: number;
  durationMinutes: number;
}

@Injectable()
export class PricingService implements OnModuleInit {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    @InjectRepository(PricingConfig)
    private readonly pricingRepo: Repository<PricingConfig>,
  ) {}

  async onModuleInit() {
    await this.seedDefaultPricing();
  }

  /**
   * Inicializa tarifas por defecto si la base de datos está vacía
   */
  async seedDefaultPricing() {
    try {
      const count = await this.pricingRepo.count();
      if (count === 0) {
        this.logger.log('Sembrando tarifas por defecto por tramos de kilómetros...');
        const defaults: Partial<PricingConfig>[] = [
          {
            dspPartnerId: undefined,
            vehicleType: 'MOTORCYCLE',
            name: 'Tarifa Estándar Motocicleta (Urbana)',
            baseFare: 8.0,
            baseDistanceKm: 2.0,
            perKmBeyondBase: 2.5,
            perMinuteRate: 0.25,
            driverPayoutPercentage: 80.0,
            minPrice: 8.0,
            brackets: [
              { fromKm: 0, toKm: 2, price: 8.0, driverPayout: 6.4 },
              { fromKm: 2, toKm: 4, price: 12.0, driverPayout: 9.6 },
              { fromKm: 4, toKm: 7, price: 18.0, driverPayout: 14.4 },
              { fromKm: 7, toKm: 12, price: 28.0, driverPayout: 22.4 },
              { fromKm: 12, toKm: 20, price: 42.0, driverPayout: 33.6 },
            ],
            isActive: true,
          },
          {
            dspPartnerId: undefined,
            vehicleType: 'BICYCLE',
            name: 'Tarifa Estándar Bicicleta / E-Bike (Radio Corto)',
            baseFare: 6.0,
            baseDistanceKm: 1.5,
            perKmBeyondBase: 2.0,
            perMinuteRate: 0.2,
            driverPayoutPercentage: 85.0,
            minPrice: 6.0,
            brackets: [
              { fromKm: 0, toKm: 1.5, price: 6.0, driverPayout: 5.1 },
              { fromKm: 1.5, toKm: 3.5, price: 10.0, driverPayout: 8.5 },
              { fromKm: 3.5, toKm: 6.0, price: 15.0, driverPayout: 12.75 },
            ],
            isActive: true,
          },
          {
            dspPartnerId: undefined,
            vehicleType: 'CAR',
            name: 'Tarifa Automóvil / Paquetería Pesada',
            baseFare: 15.0,
            baseDistanceKm: 3.0,
            perKmBeyondBase: 3.5,
            perMinuteRate: 0.4,
            driverPayoutPercentage: 80.0,
            minPrice: 15.0,
            brackets: [
              { fromKm: 0, toKm: 3, price: 15.0, driverPayout: 12.0 },
              { fromKm: 3, toKm: 6, price: 25.0, driverPayout: 20.0 },
              { fromKm: 6, toKm: 10, price: 38.0, driverPayout: 30.4 },
              { fromKm: 10, toKm: 20, price: 60.0, driverPayout: 48.0 },
            ],
            isActive: true,
          },
        ];

        for (const item of defaults) {
          const config = this.pricingRepo.create(item);
          await this.pricingRepo.save(config);
        }
        this.logger.log('Tarifas por defecto sembradas exitosamente.');
      }
    } catch (e) {
      this.logger.warn(`Aviso al sembrar tarifas iniciales: ${e}`);
    }
  }

  async findAll(dspPartnerId?: string): Promise<PricingConfig[]> {
    const qb = this.pricingRepo.createQueryBuilder('p')
      .leftJoinAndSelect('p.dspPartner', 'dspPartner')
      .orderBy('p.vehicleType', 'ASC')
      .addOrderBy('p.createdAt', 'DESC');

    if (dspPartnerId) {
      // Si se filtra por DSP, retornar las reglas específicas del DSP y las globales
      qb.where('p.dspPartnerId = :dspPartnerId OR p.dspPartnerId IS NULL', { dspPartnerId });
    }

    return qb.getMany();
  }

  async findById(id: string): Promise<PricingConfig> {
    const config = await this.pricingRepo.findOne({
      where: { id },
      relations: ['dspPartner'],
    });
    if (!config) {
      throw new NotFoundException(`Configuración de tarifa con ID ${id} no encontrada`);
    }
    return config;
  }

  async create(dto: CreatePricingConfigDto): Promise<PricingConfig> {
    const entity = this.pricingRepo.create({
      ...dto,
      brackets: dto.brackets || [],
    });
    return this.pricingRepo.save(entity);
  }

  async update(id: string, dto: Partial<CreatePricingConfigDto>): Promise<PricingConfig> {
    const config = await this.findById(id);
    Object.assign(config, dto);
    return this.pricingRepo.save(config);
  }

  async delete(id: string): Promise<{ success: boolean }> {
    const config = await this.findById(id);
    await this.pricingRepo.remove(config);
    return { success: true };
  }

  /**
   * Motor Central de Cálculo de Tarifas por Tramos
   */
  async calculatePrice(params: {
    distanceKm: number;
    durationMinutes?: number;
    vehicleType?: string;
    dspPartnerId?: string;
    surgeMultiplier?: number;
  }): Promise<PriceCalculationResult> {
    const distanceKm = Math.max(0.1, params.distanceKm);
    const durationMinutes = params.durationMinutes || Math.ceil(distanceKm * 2.4 + 5);
    const vehicleType = (params.vehicleType || 'MOTORCYCLE').toUpperCase();
    const surge = params.surgeMultiplier && params.surgeMultiplier > 1 ? params.surgeMultiplier : 1.0;

    // 1. Buscar regla en orden de prioridad:
    // Prioridad 1: Regla activa del DSP específico para ese vehículo
    // Prioridad 2: Regla activa del DSP para 'ALL'
    // Prioridad 3: Regla activa Global (Super Admin) para ese vehículo (dspPartnerId IS NULL)
    // Prioridad 4: Regla activa Global para 'ALL' o fallback (dspPartnerId IS NULL)
    let config: PricingConfig | null = null;

    if (params.dspPartnerId) {
      config = await this.pricingRepo.findOne({
        where: {
          dspPartnerId: params.dspPartnerId,
          vehicleType,
          isActive: true,
        },
      });

      if (!config) {
        config = await this.pricingRepo.findOne({
          where: {
            dspPartnerId: params.dspPartnerId,
            vehicleType: 'ALL',
            isActive: true,
          },
        });
      }
    }

    if (!config) {
      config = await this.pricingRepo.findOne({
        where: {
          dspPartnerId: IsNull(),
          vehicleType,
          isActive: true,
        },
      });
    }

    if (!config) {
      config = await this.pricingRepo.findOne({
        where: {
          dspPartnerId: IsNull(),
          vehicleType: 'ALL',
          isActive: true,
        },
      });
    }

    // 2. Si no hay ninguna regla en BD, usar valores de contingencia por defecto
    if (!config) {
      const baseFare = 8.0;
      const perKm = 2.5;
      const rawPrice = (baseFare + Math.max(0, distanceKm - 2.0) * perKm) * surge;
      const totalPrice = parseFloat(Math.max(rawPrice, baseFare).toFixed(2));
      const driverPayout = parseFloat((totalPrice * 0.8).toFixed(2));
      return {
        basePrice: totalPrice,
        surgeMultiplier: surge,
        totalPrice,
        driverPayout,
        platformFee: parseFloat((totalPrice - driverPayout).toFixed(2)),
        appliedConfigName: 'Tarifa Base Contingencia (Fallback)',
        vehicleType,
        distanceKm,
        durationMinutes,
      };
    }

    // 3. Evaluar tramos de distancia (Distance Brackets)
    let calculatedBasePrice = 0;
    let calculatedDriverPayout = 0;
    let matchedBracket: DistanceBracket | undefined;

    const brackets = (config.brackets || []).sort((a, b) => a.fromKm - b.fromKm);

    if (brackets.length > 0) {
      // Buscar el tramo correspondiente
      matchedBracket = brackets.find(
        (b) => distanceKm >= Number(b.fromKm) && distanceKm < Number(b.toKm),
      );

      if (matchedBracket) {
        calculatedBasePrice = Number(matchedBracket.price);
        calculatedDriverPayout = Number(matchedBracket.driverPayout);
      } else {
        // Supera el último tramo: tomar el precio del último tramo + km excedentes
        const lastBracket = brackets[brackets.length - 1];
        if (distanceKm >= Number(lastBracket.toKm)) {
          const excessKm = distanceKm - Number(lastBracket.toKm);
          const excessPrice = excessKm * Number(config.perKmBeyondBase);
          calculatedBasePrice = Number(lastBracket.price) + excessPrice;

          const payoutPct = (Number(config.driverPayoutPercentage) || 80.0) / 100.0;
          calculatedDriverPayout = Number(lastBracket.driverPayout) + (excessPrice * payoutPct);
        } else {
          // Menor que el primer tramo
          calculatedBasePrice = Number(brackets[0].price);
          calculatedDriverPayout = Number(brackets[0].driverPayout);
        }
      }
    } else {
      // Fórmula estándar sin tramos específicos
      const baseFare = Number(config.baseFare);
      const baseKm = Number(config.baseDistanceKm);
      const perKm = Number(config.perKmBeyondBase);
      const perMin = Number(config.perMinuteRate || 0);

      const excessKm = Math.max(0, distanceKm - baseKm);
      calculatedBasePrice = baseFare + (excessKm * perKm) + (durationMinutes * perMin);

      const payoutPct = (Number(config.driverPayoutPercentage) || 80.0) / 100.0;
      calculatedDriverPayout = calculatedBasePrice * payoutPct;
    }

    // 4. Aplicar multiplicador de alta demanda (Surge) y límites mínimos/máximos
    const minPrice = Number(config.minPrice || 5.0);
    const rawTotal = calculatedBasePrice * surge;
    let finalTotal = Math.max(rawTotal, minPrice);

    if (config.maxPrice && config.maxPrice > 0) {
      finalTotal = Math.min(finalTotal, Number(config.maxPrice));
    }

    finalTotal = parseFloat(finalTotal.toFixed(2));

    // Ajustar proporcionalmente el pago al conductor
    let finalPayout = calculatedDriverPayout * (finalTotal / Math.max(1, calculatedBasePrice));
    finalPayout = parseFloat(Math.min(finalPayout, finalTotal * 0.95).toFixed(2));
    const platformFee = parseFloat((finalTotal - finalPayout).toFixed(2));

    return {
      basePrice: parseFloat(calculatedBasePrice.toFixed(2)),
      surgeMultiplier: surge,
      totalPrice: finalTotal,
      driverPayout: finalPayout,
      platformFee,
      appliedConfigId: config.id,
      appliedConfigName: config.name,
      vehicleType: config.vehicleType,
      matchedBracket,
      distanceKm,
      durationMinutes,
    };
  }

  async simulate(dto: SimulateQuoteDto): Promise<PriceCalculationResult> {
    return this.calculatePrice({
      distanceKm: dto.distanceKm,
      durationMinutes: dto.durationMinutes,
      vehicleType: dto.vehicleType,
      dspPartnerId: dto.dspPartnerId,
      surgeMultiplier: dto.surgeMultiplier,
    });
  }
}
