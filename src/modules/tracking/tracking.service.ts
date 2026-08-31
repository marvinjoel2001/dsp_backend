import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver } from '../drivers/entities/driver.entity';
import Redis from 'ioredis';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);
  private redisClient: Redis;

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @InjectRepository(Driver)
    private readonly driverRepo?: Repository<Driver>,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL') || process.env.REDIS_URL;

    if (redisUrl) {
      this.redisClient = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
      });
    } else {
      const host = this.configService.get<string>('REDIS_HOST') || process.env.REDIS_HOST || 'localhost';
      const port = parseInt(this.configService.get<string>('REDIS_PORT') || process.env.REDIS_PORT || '6379', 10);
      const password = this.configService.get<string>('REDIS_PASSWORD') || process.env.REDIS_PASSWORD || '';

      this.redisClient = new Redis({
        host,
        port,
        password: password || undefined,
        lazyConnect: true,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
    }

    // Prevenir caídas por eventos de error no capturados en reconexión
    this.redisClient.on('error', (err) => {
      this.logger.warn(`Redis tracking warning: ${err.message}`);
    });

    this.redisClient.connect().catch((err) => {
      this.logger.warn(`Redis connection deferred: ${err.message}`);
    });
  }

  getRedis(): Redis {
    return this.redisClient;
  }

  /**
   * Updates driver position in Redis GEO set and saves state
   */
  async updateDriverLocation(
    driverId: string,
    lat: number,
    lng: number,
    heading = 0,
    speed = 0,
  ): Promise<void> {
    try {
      // Redis GEO format: GEOADD key longitude latitude member
      await this.redisClient.geoadd('active_drivers', lng, lat, driverId);

      // Save full telemetry metadata with 60s TTL
      const telemetry = JSON.stringify({
        driverId,
        lat,
        lng,
        heading,
        speed,
        updatedAt: new Date().toISOString(),
      });
      await this.redisClient.set(`driver:telemetry:${driverId}`, telemetry, 'EX', 60);

      // Sincronizar en base de datos relational para persistencia duradera
      if (this.driverRepo) {
        this.driverRepo.update(driverId, {
          currentLat: lat,
          currentLng: lng,
        }).catch((e) => this.logger.warn(`Driver DB coord update defer: ${e.message}`));
      }
    } catch (err: any) {
      this.logger.error(`Error updating driver GEO: ${err.message}`);
    }
  }

  /**
   * Removes driver from active GEO search when going offline
   */
  async removeDriverLocation(driverId: string): Promise<void> {
    try {
      await this.redisClient.zrem('active_drivers', driverId);
      await this.redisClient.del(`driver:telemetry:${driverId}`);
    } catch (err: any) {
      this.logger.error(`Error removing driver GEO: ${err.message}`);
    }
  }

  /**
   * Find nearby online drivers within radius in kilometers
   */
  async findNearbyDrivers(
    lat: number,
    lng: number,
    radiusKm = 5.0,
  ): Promise<Array<{ driverId: string; distanceKm: number }>> {
    try {
      // GEORADIUS active_drivers <lng> <lat> <radius> km WITHDIST ASC
      const rawResults: any = await this.redisClient.georadius(
        'active_drivers',
        lng,
        lat,
        radiusKm,
        'km',
        'WITHDIST',
        'ASC',
      );

      if (!Array.isArray(rawResults)) {
        return [];
      }

      return rawResults.map(([driverId, distance]) => ({
        driverId,
        distanceKm: parseFloat(distance),
      }));
    } catch (err: any) {
      this.logger.error(`Error querying GEORADIUS: ${err.message}`);
      return [];
    }
  }
}
