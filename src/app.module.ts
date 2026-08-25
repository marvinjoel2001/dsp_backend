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

// Entities
import { Tenant } from './modules/tenants/entities/tenant.entity';
import { Driver } from './modules/drivers/entities/driver.entity';
import { DriverWalletTransaction } from './modules/drivers/entities/driver-wallet-transaction.entity';
import { Quote } from './modules/quotes/entities/quote.entity';
import { DeliveryOrder } from './modules/orders/entities/order.entity';
import { OrderStatusLog } from './modules/orders/entities/order-status-log.entity';
import { WebhookDelivery } from './modules/webhooks/entities/webhook-delivery.entity';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.development'],
    }),

    // PostgreSQL TypeORM Setup
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: parseInt(configService.get<string>('DB_PORT', '5432'), 10),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_DATABASE', 'open_dsp_db'),
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
      }),
      inject: [ConfigService],
    }),

    // BullMQ Redis Setup
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: parseInt(configService.get<string>('REDIS_PORT', '6379'), 10),
          password: configService.get<string>('REDIS_PASSWORD', undefined),
        },
      }),
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
  ],
})
export class AppModule {}
