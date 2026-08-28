import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Driver, VehicleType, DriverVerificationStatus } from '../drivers/entities/driver.entity';
import { DeliveryOrder, OrderStatus } from '../orders/entities/order.entity';
import { WebhookDelivery, WebhookDeliveryStatus } from '../webhooks/entities/webhook-delivery.entity';
import { DspPartner } from '../dsp-partners/entities/dsp-partner.entity';
import { CryptoUtil } from '../../common/utils/crypto.util';

import * as bcrypt from 'bcrypt';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Driver)
    private readonly driverRepo: Repository<Driver>,
    @InjectRepository(DeliveryOrder)
    private readonly orderRepo: Repository<DeliveryOrder>,
    @InjectRepository(WebhookDelivery)
    private readonly webhookRepo: Repository<WebhookDelivery>,
    @InjectRepository(DspPartner)
    private readonly dspPartnerRepo: Repository<DspPartner>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedInitialData();
  }

  async seedInitialData() {
    try {
      this.logger.log('🌱 Verificando y sembrando datos iniciales en Chiringuito DSP...');

      const defaultPassword = await bcrypt.hash('admin123', 10);

      // 1. Sembrar Tenant por defecto
      const defaultTenantId = 'e7b92f34-1182-4bc9-93e1-23d9b04f7a11';
      let tenant = await this.tenantRepo.findOne({ where: { id: defaultTenantId } });
      if (!tenant) {
        const apiKey = 'dsp_live_chiringuito123';
        const apiKeyHash = CryptoUtil.hashApiKey(apiKey);
        const apiKeyMasked = `${apiKey.substring(0, 12)}...${apiKey.substring(apiKey.length - 4)}`;
        const webhookSecret = 'whsec_chiringuito_secret_123';

        tenant = this.tenantRepo.create({
          id: defaultTenantId,
          name: 'Restaurante El Chiringuito Central',
          email: 'contacto@chiringuito.com',
          apiKeyHash,
          apiKeyMasked,
          webhookUrl: 'https://webhook.site/demo-chiringuito-dsp',
          webhookSecret,
          isActive: true,
        });
        await this.tenantRepo.save(tenant);
        this.logger.log(`✅ Tenant sembrado: ${tenant.name} (${tenant.id})`);
      }

      // 2. Sembrar Asociación de Motos / DSP Partner por defecto
      const defaultDspId = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
      let dsp = await this.dspPartnerRepo.findOne({ where: { id: defaultDspId } });
      if (!dsp) {
        dsp = this.dspPartnerRepo.create({
          id: defaultDspId,
          name: 'Asociación Motos Los Rápidos',
          code: 'DSP-RAPIDOS',
          email: 'motos@dsp.com',
          password: defaultPassword,
          contactName: 'Don Carlos Mendoza',
          contactPhone: '+591 71234567',
          city: 'Santa Cruz',
          payoutPerOrder: 5.0,
          isActive: true,
        });
        await this.dspPartnerRepo.save(dsp);
        this.logger.log(`✅ Asociación DSP sembrada: ${dsp.name} (motos@dsp.com / admin123)`);
      }

      // 3. Sembrar Conductor por defecto
      const defaultDriverId = 'c8716b1e-6240-4b2a-8c01-7faef83151cf';
      let driver = await this.driverRepo.findOne({ where: { id: defaultDriverId } });
      if (!driver) {
        driver = this.driverRepo.create({
          id: defaultDriverId,
          fullName: 'Alex Repartidor',
          phone: '+591 70001234',
          email: 'driver@dsp.com',
          password: defaultPassword,
          vehicleType: VehicleType.MOTORCYCLE,
          vehiclePlate: '1234-XYZ',
          isOnline: true,
          isActive: true,
          verificationStatus: DriverVerificationStatus.VERIFIED,
          walletBalance: 120.0,
          currentLat: -17.7833,
          currentLng: -63.1821,
          rating: 4.9,
          dspPartnerId: defaultDspId,
        });
        await this.driverRepo.save(driver);
        this.logger.log(`✅ Conductor sembrado: ${driver.fullName} (${driver.id})`);
      }

      // Conductor secundario
      const driver2Id = 'd9827c2f-7351-4c3b-9d12-8abfe94262de';
      let driver2 = await this.driverRepo.findOne({ where: { id: driver2Id } });
      if (!driver2) {
        driver2 = this.driverRepo.create({
          id: driver2Id,
          fullName: 'Carlos E-Bike',
          phone: '+591 71112233',
          email: 'carlos@dsp.com',
          password: defaultPassword,
          vehicleType: VehicleType.BICYCLE,
          vehiclePlate: 'E-BIKE-01',
          isOnline: true,
          isActive: true,
          verificationStatus: DriverVerificationStatus.VERIFIED,
          walletBalance: 85.5,
          currentLat: -17.778,
          currentLng: -63.189,
          rating: 4.8,
        });
        await this.driverRepo.save(driver2);
        this.logger.log(`✅ Conductor 2 sembrado: ${driver2.fullName}`);
      }

      // 3. Sembrar Órdenes de prueba vinculadas a la App y Admin
      let order1 = await this.orderRepo.findOne({ where: { id: '434567' } });
      if (!order1) {
        order1 = this.orderRepo.create({
          id: '434567',
          tenantId: tenant.id,
          driverId: driver.id,
          merchantReference: 'CHIRINGUITO-001',
          status: OrderStatus.ASSIGNED,
          pickupAddress: 'Restaurante El Chiringuito Central, Calle Charcas #120',
          pickupLat: -17.7833,
          pickupLng: -63.1821,
          dropoffAddress: 'Av. Las Palmas #420, Condominio El Bosque',
          dropoffLat: -17.795,
          dropoffLng: -63.17,
          price: 54.0,
          driverPayout: 43.2,
          packageNotes: 'Tocar timbre 3B al llegar',
          trackingToken: 'track-434567',
        });
        await this.orderRepo.save(order1);
        this.logger.log(`✅ Orden 434567 sembrada (ASSIGNED)`);
      }

      let order2 = await this.orderRepo.findOne({ where: { id: '434566' } });
      if (!order2) {
        order2 = this.orderRepo.create({
          id: '434566',
          tenantId: tenant.id,
          merchantReference: 'CHIRINGUITO-002',
          status: OrderStatus.CREATED,
          pickupAddress: 'Av. San Martín #150, Equipetrol',
          pickupLat: -17.778,
          pickupLng: -63.189,
          dropoffAddress: 'Calle Beni #67, Centro',
          dropoffLat: -17.791,
          dropoffLng: -63.175,
          price: 72.0,
          driverPayout: 57.6,
          packageNotes: 'Entregar en recepción',
          trackingToken: 'track-434566',
        });
        await this.orderRepo.save(order2);
        this.logger.log(`✅ Orden 434566 sembrada (CREATED)`);
      }

      // 4. Sembrar Webhook inicial para la Consola del Admin
      const webhookCount = await this.webhookRepo.count();
      if (webhookCount === 0) {
        const payload = {
          event: 'order.assigned',
          timestamp: new Date().toISOString(),
          data: {
            order_id: '434567',
            merchant_reference: 'CHIRINGUITO-001',
            status: 'ASSIGNED',
            driver: {
              id: driver.id,
              name: driver.fullName,
              phone: driver.phone,
              vehicle_type: driver.vehicleType,
              vehicle_plate: driver.vehiclePlate,
            },
            pickup_address: order1.pickupAddress,
            dropoff_address: order1.dropoffAddress,
          },
        };

        const signature = CryptoUtil.signWebhookPayload(payload, tenant.webhookSecret);

        const initialDelivery = this.webhookRepo.create({
          tenantId: tenant.id,
          orderId: '434567',
          eventType: 'order.assigned',
          payload,
          signature,
          status: WebhookDeliveryStatus.SUCCESS,
          httpStatusCode: 200,
          responseBody: '{"status":"ok","received":true}',
          attempts: 1,
        });

        await this.webhookRepo.save(initialDelivery);
        this.logger.log(`✅ Webhook inicial registrado en base de datos`);
      }

      this.logger.log('🎉 Sembrado inicial completado con éxito.');
    } catch (err) {
      this.logger.error(`Error en sembrado inicial: ${err.message}`, err.stack);
    }
  }
}
