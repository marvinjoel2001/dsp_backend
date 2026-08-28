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
import { SettlementsModule } from './modules/settlements/settlements.module';
import { SeedModule } from './modules/seed/seed.module';

import { DspPartnersModule } from './modules/dsp-partners/dsp-partners.module';

// Entities
import { Tenant } from './modules/tenants/entities/tenant.entity';
import { Driver } from './modules/drivers/entities/driver.entity';
import { DriverWalletTransaction } from './modules/drivers/entities/driver-wallet-transaction.entity';
import { DriverWithdrawal } from './modules/settlements/entities/driver-withdrawal.entity';
import { MerchantSettlement } from './modules/settlements/entities/merchant-settlement.entity';
import { Quote } from './modules/quotes/entities/quote.entity';
import { DeliveryOrder } from './modules/orders/entities/order.entity';
import { OrderStatusLog } from './modules/orders/entities/order-status-log.entity';
import { WebhookDelivery } from './modules/webhooks/entities/webhook-delivery.entity';
import { DspPartner } from './modules/dsp-partners/entities/dsp-partner.entity';

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
        const databaseUrl =
          configService.get<string>('DATABASE_URL') || process.env.DATABASE_URL;
        const isSsl =
          configService.get<string>('DB_SSL', 'false') === 'true' ||
          (databaseUrl &&
            !databaseUrl.includes('localhost') &&
            !databaseUrl.includes('127.0.0.1'));

        return {
          type: 'postgres',
          ...(databaseUrl
            ? { url: databaseUrl }
            : {
                host: configService.get<string>('DB_HOST') || process.env.DB_HOST || 'localhost',
                port: parseInt(configService.get<string>('DB_PORT') || process.env.DB_PORT || '5432', 10),
                username: configService.get<string>('DB_USERNAME') || process.env.DB_USERNAME || 'postgres',
                password: configService.get<string>('DB_PASSWORD') || process.env.DB_PASSWORD || 'postgres',
                database: configService.get<string>('DB_DATABASE') || process.env.DB_DATABASE || 'open_dsp_db',
              }),
          ssl: isSsl ? { rejectUnauthorized: false } : false,
          extra: isSsl ? { ssl: { rejectUnauthorized: false } } : undefined,
          entities: [
            Tenant,
            Driver,
            DriverWalletTransaction,
            DriverWithdrawal,
            MerchantSettlement,
            Quote,
            DeliveryOrder,
            OrderStatusLog,
            WebhookDelivery,
            DspPartner,
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
        const redisUrl = configService.get<string>('REDIS_URL') || process.env.REDIS_URL;
        if (redisUrl) {
          try {
            const parsed = new URL(redisUrl);
            return {
              connection: {
                host: parsed.hostname,
                port: parseInt(parsed.port || '6379', 10),
                username: parsed.username || undefined,
                password: parsed.password || undefined,
                maxRetriesPerRequest: null,
                enableReadyCheck: false,
                tls: parsed.protocol === 'rediss:' ? { rejectUnauthorized: false } : undefined,
              },
            };
          } catch {
            // fallback
          }
        }

        return {
          connection: {
            host: configService.get<string>('REDIS_HOST') || process.env.REDIS_HOST || 'localhost',
            port: parseInt(configService.get<string>('REDIS_PORT') || process.env.REDIS_PORT || '6379', 10),
            password: configService.get<string>('REDIS_PASSWORD') || process.env.REDIS_PASSWORD || undefined,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
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
    SettlementsModule,
    SeedModule,
    DspPartnersModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

