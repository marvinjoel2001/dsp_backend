import { Test, TestingModule } from '@nestjs/testing';
import { PricingController } from '../pricing.controller';
import { PricingService } from '../pricing.service';
import { CreatePricingConfigDto, SimulateQuoteDto } from '../dto/pricing.dto';

describe('PricingController', () => {
  let controller: PricingController;
  let service: PricingService;

  const mockPricingConfig = {
    id: 'cfg-123',
    dspPartnerId: null,
    vehicleType: 'MOTORCYCLE',
    name: 'Tarifa Estándar Motocicleta',
    baseFare: 8.0,
    baseDistanceKm: 2.0,
    perKmBeyondBase: 2.5,
    perMinuteRate: 0.25,
    driverPayoutPercentage: 80.0,
    minPrice: 8.0,
    brackets: [
      { fromKm: 0, toKm: 2, price: 8.0, driverPayout: 6.4 },
      { fromKm: 2, toKm: 4, price: 12.0, driverPayout: 9.6 },
    ],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPricingService = {
    findAll: jest.fn().mockResolvedValue([mockPricingConfig]),
    findById: jest.fn().mockResolvedValue(mockPricingConfig),
    create: jest.fn().mockResolvedValue(mockPricingConfig),
    update: jest.fn().mockResolvedValue({ ...mockPricingConfig, baseFare: 10.0 }),
    delete: jest.fn().mockResolvedValue({ success: true }),
    simulate: jest.fn().mockResolvedValue({
      basePrice: 12.0,
      surgeMultiplier: 1.0,
      totalPrice: 12.0,
      driverPayout: 9.6,
      platformFee: 2.4,
      appliedConfigId: 'cfg-123',
      appliedConfigName: 'Tarifa Estándar Motocicleta',
      vehicleType: 'MOTORCYCLE',
      distanceKm: 3.5,
      durationMinutes: 13,
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PricingController],
      providers: [
        {
          provide: PricingService,
          useValue: mockPricingService,
        },
      ],
    }).compile();

    controller = module.get<PricingController>(PricingController);
    service = module.get<PricingService>(PricingService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should list all pricing configs (GET /v1/pricing)', async () => {
    const result = await controller.getPricingConfigs();
    expect(result).toEqual([mockPricingConfig]);
    expect(service.findAll).toHaveBeenCalled();
  });

  it('should get pricing by id (GET /v1/pricing/:id)', async () => {
    const result = await controller.getPricingById('cfg-123');
    expect(result).toEqual(mockPricingConfig);
    expect(service.findById).toHaveBeenCalledWith('cfg-123');
  });

  it('should create pricing config (POST /v1/pricing)', async () => {
    const dto: CreatePricingConfigDto = {
      vehicleType: 'MOTORCYCLE',
      name: 'Nueva Tarifa',
      baseFare: 8.0,
      baseDistanceKm: 2.0,
      perKmBeyondBase: 2.5,
      driverPayoutPercentage: 80.0,
      minPrice: 8.0,
      brackets: [],
    };
    const user = { role: 'ADMIN' };
    const result = await controller.createPricing(dto, user);
    expect(result).toEqual(mockPricingConfig);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('should update pricing config (PUT /v1/pricing/:id)', async () => {
    const dto = { baseFare: 10.0 };
    const result = await controller.updatePricing('cfg-123', dto);
    expect(result.baseFare).toBe(10.0);
    expect(service.update).toHaveBeenCalledWith('cfg-123', dto);
  });

  it('should delete pricing config (DELETE /v1/pricing/:id)', async () => {
    const result = await controller.deletePricing('cfg-123');
    expect(result).toEqual({ success: true });
    expect(service.delete).toHaveBeenCalledWith('cfg-123');
  });

  it('should simulate quote (POST /v1/pricing/simulate)', async () => {
    const dto: SimulateQuoteDto = {
      distanceKm: 3.5,
      vehicleType: 'MOTORCYCLE',
    };
    const result = await controller.simulatePricing(dto);
    expect(result.totalPrice).toBe(12.0);
    expect(result.driverPayout).toBe(9.6);
    expect(service.simulate).toHaveBeenCalledWith(dto);
  });
});
