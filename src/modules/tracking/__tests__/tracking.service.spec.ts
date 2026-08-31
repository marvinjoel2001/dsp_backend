import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TrackingService } from '../tracking.service';
import { Driver } from '../../drivers/entities/driver.entity';

describe('TrackingService (Write-Behind High-Concurrency Telemetry)', () => {
  let service: TrackingService;

  const mockRedisPipeline = {
    geoadd: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    sadd: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  };

  const mockRedis = {
    pipeline: jest.fn().mockReturnValue(mockRedisPipeline),
    geoadd: jest.fn().mockResolvedValue(1),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(JSON.stringify({
      driverId: 'drv-1',
      lat: -17.7833,
      lng: -63.1821,
      heading: 90,
      speed: 35,
    })),
    zrem: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(1),
    georadius: jest.fn().mockResolvedValue([['drv-1', '1.2']]),
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
  };

  const mockDriverRepo = {
    query: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: 'drv-1', currentLat: -17.7833, currentLng: -63.1821 }),
  };

  beforeEach(async () => {
    mockDriverRepo.query.mockClear();
    mockRedis.pipeline.mockClear();
    mockRedisPipeline.geoadd.mockClear();
    mockRedisPipeline.set.mockClear();
    mockRedisPipeline.sadd.mockClear();
    mockRedisPipeline.exec.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrackingService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(null),
          },
        },
        {
          provide: getRepositoryToken(Driver),
          useValue: mockDriverRepo,
        },
      ],
    }).compile();

    service = module.get<TrackingService>(TrackingService);
    // Inject mock redis client
    (service as any).redisClient = mockRedis;
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should update driver location in Redis without calling SQL directly (Zero SQL hot path)', async () => {
    await service.updateDriverLocation('drv-1', -17.7833, -63.1821, 90, 35);

    expect(mockRedis.pipeline).toHaveBeenCalled();
    expect(mockRedisPipeline.geoadd).toHaveBeenCalledWith('active_drivers', -63.1821, -17.7833, 'drv-1');
    expect(mockRedisPipeline.set).toHaveBeenCalled();
    expect(mockRedisPipeline.sadd).toHaveBeenCalledWith('drivers:dirty_locations', 'drv-1');
    expect(mockRedisPipeline.exec).toHaveBeenCalled();

    // SQL query should NOT be called on ping
    expect(mockDriverRepo.query).not.toHaveBeenCalled();
  });

  it('should batch flush dirty locations to database in a single SQL query', async () => {
    await service.updateDriverLocation('drv-1', -17.7833, -63.1821, 90, 35);
    await service.updateDriverLocation('drv-2', -17.7950, -63.1700, 180, 20);

    // Trigger flush
    await service.flushDirtyLocationsToDatabase();

    expect(mockDriverRepo.query).toHaveBeenCalledTimes(1);
    const sqlArg = mockDriverRepo.query.mock.calls[0][0];
    expect(sqlArg).toContain('UPDATE drivers AS d');
    expect(sqlArg).toContain('FROM (VALUES');
  });

  it('should return live location from Redis cache first', async () => {
    const loc = await service.getDriverLiveLocation('drv-1');
    expect(loc).toEqual({
      lat: -17.7833,
      lng: -63.1821,
      heading: 90,
      speed: 35,
    });
    expect(mockRedis.get).toHaveBeenCalledWith('driver:telemetry:drv-1');
  });

  it('should remove driver from active GEO and dirty set on removeDriverLocation', async () => {
    await service.removeDriverLocation('drv-1');
    expect(mockRedis.zrem).toHaveBeenCalledWith('active_drivers', 'drv-1');
    expect(mockRedis.del).toHaveBeenCalledWith('driver:telemetry:drv-1');
    expect(mockRedis.srem).toHaveBeenCalledWith('drivers:dirty_locations', 'drv-1');
  });
});
