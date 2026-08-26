import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

// Application Modules
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { OrdersModule } from './modules/orders/orders.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { DispatchModule } from './modules/dispatch/dispatch.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { SeedModule } from './modules/seed/seed.module';

// Entities
import { Tenant } from './modules/tenants/entities/tenant.entity';
import { Driver } from './modules/drivers/entities/driver.entity';
import { DriverWalletTransaction } from './modules/drivers/entities/driver-wallet-transaction.entity';
import { Quote } from './modules/quotes/entities/quote.entity';
import { DeliveryOrder } from './modules/orders/entities/order.entity';
import { OrderStatusLog } from './modules/orders/entities/order-status-log.entity';
import { WebhookDelivery } from './modules/webhooks/entities/webhook-delivery.entity';

import { AppController } from './app.controller';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.development'],
    }),

    // PostgreSQL TypeORM Setup (Soporta DATABASE_URL de Render / Neon / Supabase o variables individuales)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        const isSsl =
          configService.get<string>('DB_SSL', 'false') === 'true' ||
          (databaseUrl && !databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1'));

        return {
          type: 'postgres',
          ...(databaseUrl
            ? { url: databaseUrl }
            : {
                host: configService.get<string>('DB_HOST', 'localhost'),
                port: parseInt(configService.get<string>('DB_PORT', '5432'), 10),
                username: configService.get<string>('DB_USERNAME', 'postgres'),
                password: configService.get<string>('DB_PASSWORD', 'postgres'),
                database: configService.get<string>('DB_DATABASE', 'open_dsp_db'),
              }),
          ssl: isSsl ? { rejectUnauthorized: false } : false,
          entities: [
            Tenant,
            Driver,
            DriverWalletTransaction,
            Quote,
            DeliveryOrder,
            OrderStatusLog,
            WebhookDelivery,
          ],
          synchronize: configService.get<string>('DB_SYNCHRONIZE', 'true') === 'true',
          logging: configService.get<string>('DB_LOGGING', 'false') === 'true',
        };
      },
      inject: [ConfigService],
    }),

    // BullMQ Redis Setup (Soporta REDIS_URL de Render Redis / Upstash / Redis Cloud o host/port)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (redisUrl) {
          try {
            const parsed = new URL(redisUrl);
            return {
              connection: {
                host: parsed.hostname,
                port: parseInt(parsed.port || '6379', 10),
                username: parsed.username || undefined,
                password: parsed.password || undefined,
                tls: parsed.protocol === 'rediss:' ? { rejectUnauthorized: false } : undefined,
              },
            };
          } catch {
            return {
              connection: {
                host: configService.get<string>('REDIS_HOST', 'localhost'),
                port: parseInt(configService.get<string>('REDIS_PORT', '6379'), 10),
                password: configService.get<string>('REDIS_PASSWORD', undefined),
              },
            };
          }
        }

        return {
          connection: {
            host: configService.get<string>('REDIS_HOST', 'localhost'),
            port: parseInt(configService.get<string>('REDIS_PORT', '6379'), 10),
            password: configService.get<string>('REDIS_PASSWORD', undefined),
          },
        };
      },
      inject: [ConfigService],
    }),

    // Domain Modules
    AuthModule,
    TenantsModule,
    QuotesModule,
    OrdersModule,
    TrackingModule,
    DispatchModule,
    WebhooksModule,
    DriversModule,
    SeedModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

