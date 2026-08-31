import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PricingService } from '../pricing.service';
import { PricingConfig } from '../entities/pricing-config.entity';

describe('PricingService', () => {
  let service: PricingService;

  const mockBrackets = [
    { fromKm: 0, toKm: 2, price: 8.0, driverPayout: 6.4 },
    { fromKm: 2, toKm: 4, price: 12.0, driverPayout: 9.6 },
    { fromKm: 4, toKm: 7, price: 18.0, driverPayout: 14.4 },
  ];

  const mockGlobalMotorcycleConfig: Partial<PricingConfig> = {
    id: 'cfg-moto-global',
    dspPartnerId: undefined,
    vehicleType: 'MOTORCYCLE',
    name: 'Tarifa Estándar Motocicleta',
    baseFare: 8.0,
    baseDistanceKm: 2.0,
    perKmBeyondBase: 2.5,
    perMinuteRate: 0.25,
    driverPayoutPercentage: 80.0,
    minPrice: 8.0,
    brackets: mockBrackets,
    isActive: true,
  };

  const mockRepo = {
    count: jest.fn().mockResolvedValue(1),
    find: jest.fn().mockResolvedValue([mockGlobalMotorcycleConfig]),
    findOne: jest.fn().mockImplementation(({ where }) => {
      if (where.vehicleType === 'MOTORCYCLE') {
        return Promise.resolve(mockGlobalMotorcycleConfig);
      }
      return Promise.resolve(null);
    }),
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: 'cfg-new', ...entity })),
    remove: jest.fn().mockResolvedValue({}),
    createQueryBuilder: jest.fn().mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([mockGlobalMotorcycleConfig]),
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingService,
        {
          provide: getRepositoryToken(PricingConfig),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<PricingService>(PricingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculatePrice', () => {
    it('should correctly evaluate distance in the second bracket (3.5 km)', async () => {
      const result = await service.calculatePrice({
        distanceKm: 3.5,
        vehicleType: 'MOTORCYCLE',
      });

      expect(result.totalPrice).toBe(12.0);
      expect(result.driverPayout).toBe(9.6);
      expect(result.platformFee).toBe(2.4);
      expect(result.matchedBracket?.fromKm).toBe(2);
      expect(result.matchedBracket?.toKm).toBe(4);
    });

    it('should calculate excess rate beyond the last bracket (8.0 km)', async () => {
      const result = await service.calculatePrice({
        distanceKm: 8.0,
        vehicleType: 'MOTORCYCLE',
      });

      // Last bracket is 4-7km (price: 18, driverPayout: 14.4).
      // Excess is 1 km * 2.5 = 2.5. Base = 18 + 2.5 = 20.5
      expect(result.totalPrice).toBe(20.5);
      expect(result.driverPayout).toBe(16.4); // 14.4 + 2.5 * 0.8
    });

    it('should apply surge multiplier correctly', async () => {
      const result = await service.calculatePrice({
        distanceKm: 1.5,
        vehicleType: 'MOTORCYCLE',
        surgeMultiplier: 1.5,
      });

      // 1.5 km matches 0-2km bracket (price: 8.0). With surge 1.5 => 12.0
      expect(result.totalPrice).toBe(12.0);
      expect(result.driverPayout).toBe(9.6);
    });
  });
});
