import {
  Injectable,
  Logger,
  Optional,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver } from '../drivers/entities/driver.entity';
import Redis from 'ioredis';

interface BufferedLocation {
  driverId: string;
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  timestamp: Date;
}

@Injectable()
export class TrackingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrackingService.name);
  private redisClient: Redis;

  // Buffer en memoria para absorción instantánea de pings a alta concurrencia
  private readonly memoryLocationBuffer = new Map<string, BufferedLocation>();
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;

  // Intervalo de persistencia en BD Relacional (30 segundos por defecto)
  private readonly flushIntervalMs: number;

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @InjectRepository(Driver)
    private readonly driverRepo?: Repository<Driver>,
  ) {
    this.flushIntervalMs = parseInt(
      this.configService.get<string>('LOCATION_DB_FLUSH_INTERVAL_MS', '30000'),
      10,
    );

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

    this.redisClient.on('error', (err) => {
      this.logger.warn(`Redis tracking warning: ${err.message}`);
    });

    this.redisClient.connect().catch((err) => {
      this.logger.warn(`Redis connection deferred: ${err.message}`);
    });
  }

  onModuleInit() {
    // Iniciar temporizador de persistencia por lotes en segundo plano (Write-Behind)
    this.flushTimer = setInterval(() => {
      this.flushDirtyLocationsToDatabase().catch((err) => {
        this.logger.error(`Error en flush periódico de ubicaciones: ${err.message}`);
      });
    }, this.flushIntervalMs);

    this.logger.log(
      `🚀 Motor Write-Behind de Telemetría activo (Intervalo de flush BD: ${this.flushIntervalMs / 1000}s)`,
    );
  }

  async onModuleDestroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    // Guardar cualquier ubicación pendiente antes del apagado del servidor
    await this.flushDirtyLocationsToDatabase();
  }

  getRedis(): Redis {
    return this.redisClient;
  }

  /**
   * HOT PATH: Absorbe la posición del repartidor en Redis en < 2ms (Zero SQL Queries)
   * Diseñado para soportar 1000+ conductores enviando telemetría continua sin colapsar PostgreSQL
   */
  async updateDriverLocation(
    driverId: string,
    lat: number,
    lng: number,
    heading = 0,
    speed = 0,
  ): Promise<void> {
    try {
      const now = new Date();

      // 1. Pipeline atómico en Redis: GEO + Telemetría + Dirty Set
      const pipeline = this.redisClient.pipeline();

      // Índice espacial geoespacial para búsqueda ultrarrápida (GEORADIUS)
      pipeline.geoadd('active_drivers', lng, lat, driverId);

      // Metadata de telemetría completa con TTL de 120s
      const telemetry = JSON.stringify({
        driverId,
        lat,
        lng,
        heading,
        speed,
        updatedAt: now.toISOString(),
      });
      pipeline.set(`driver:telemetry:${driverId}`, telemetry, 'EX', 120);

      // Marcar conductor en el conjunto de cambios pendientes de persistencia
      pipeline.sadd('drivers:dirty_locations', driverId);

      await pipeline.exec();

      // 2. Almacenar en el buffer local de memoria de este nodo
      this.memoryLocationBuffer.set(driverId, {
        driverId,
        lat,
        lng,
        heading,
        speed,
        timestamp: now,
      });
    } catch (err: any) {
      this.logger.error(`Error updating driver GEO: ${err.message}`);
    }
  }

  /**
   * FLUSH POR LOTES (Write-Behind Batch Worker):
   * Agrupa cientos de pings y ejecuta UNA sola consulta SQL masiva hacia PostgreSQL
   */
  async flushDirtyLocationsToDatabase(): Promise<void> {
    if (this.isFlushing || !this.driverRepo) return;
    if (this.memoryLocationBuffer.size === 0) return;

    this.isFlushing = true;
    const startTime = Date.now();

    try {
      // Extraer y vaciar el buffer local
      const entriesToFlush = Array.from(this.memoryLocationBuffer.values());
      this.memoryLocationBuffer.clear();

      if (entriesToFlush.length === 0) {
        this.isFlushing = false;
        return;
      }

      // Procesar en chunks de 200 conductores por transacción SQL para no saturar memoria
      const chunkSize = 200;
      for (let i = 0; i < entriesToFlush.length; i += chunkSize) {
        const chunk = entriesToFlush.slice(i, i + chunkSize);

        // Construir consulta masiva: UPDATE drivers AS d SET currentLat = c.lat, currentLng = c.lng FROM (VALUES ...)
        const valuesClauses: string[] = [];
        const queryParams: any[] = [];
        let paramIndex = 1;

        for (const item of chunk) {
          valuesClauses.push(`($${paramIndex}::uuid, $${paramIndex + 1}::double precision, $${paramIndex + 2}::double precision)`);
          queryParams.push(item.driverId, item.lat, item.lng);
          paramIndex += 3;
        }

        const rawSql = `
          UPDATE drivers AS d
          SET "currentLat" = c.lat,
              "currentLng" = c.lng,
              "updatedAt" = NOW()
          FROM (VALUES ${valuesClauses.join(', ')}) AS c(id, lat, lng)
          WHERE d.id = c.id;
        `;

        await this.driverRepo.query(rawSql, queryParams);
      }

      // Limpiar dirty set en Redis
      const driverIds = entriesToFlush.map((e) => e.driverId);
      if (driverIds.length > 0) {
        await this.redisClient.srem('drivers:dirty_locations', ...driverIds).catch(() => {});
      }

      const elapsed = Date.now() - startTime;
      this.logger.debug(
        `⚡ [Write-Behind Flush] Sincronizadas ${entriesToFlush.length} ubicaciones de conductores en BD (${elapsed}ms)`,
      );
    } catch (err: any) {
      this.logger.error(`Error en flush masivo a PostgreSQL: ${err.message}`);
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Obtiene la telemetría en tiempo real de un conductor (Primero consulta Redis)
   */
  async getDriverLiveLocation(driverId: string): Promise<{ lat: number; lng: number; heading?: number; speed?: number } | null> {
    try {
      const cached = await this.redisClient.get(`driver:telemetry:${driverId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          lat: parsed.lat,
          lng: parsed.lng,
          heading: parsed.heading,
          speed: parsed.speed,
        };
      }
    } catch (_) {}

    // Fallback a base de datos si no está en Redis
    if (this.driverRepo) {
      const d = await this.driverRepo.findOne({
        where: { id: driverId },
        select: ['id', 'currentLat', 'currentLng'],
      });
      if (d && d.currentLat && d.currentLng) {
        return { lat: d.currentLat, lng: d.currentLng };
      }
    }

    return null;
  }

  /**
   * Retira al conductor del índice GEO al pasar a estado offline / ocupado
   */
  async removeDriverLocation(driverId: string): Promise<void> {
    try {
      this.memoryLocationBuffer.delete(driverId);
      await this.redisClient.zrem('active_drivers', driverId);
      await this.redisClient.del(`driver:telemetry:${driverId}`);
      await this.redisClient.srem('drivers:dirty_locations', driverId);
    } catch (err: any) {
      this.logger.error(`Error removing driver GEO: ${err.message}`);
    }
  }

  /**
   * Búsqueda geoespacial optimizada de conductores dentro de un radio en kilómetros
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

