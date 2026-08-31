import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrackingService } from '../tracking/tracking.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { DeliveryOrder, OrderStatus } from '../orders/entities/order.entity';
import { OrderStatusLog } from '../orders/entities/order-status-log.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { TrackingGateway } from '../tracking/tracking.gateway';

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    @InjectRepository(DeliveryOrder)
    private readonly orderRepo: Repository<DeliveryOrder>,
    @InjectRepository(OrderStatusLog)
    private readonly logRepo: Repository<OrderStatusLog>,
    @InjectRepository(Driver)
    private readonly driverRepo: Repository<Driver>,
    private readonly trackingService: TrackingService,
    private readonly trackingGateway: TrackingGateway,
    private readonly webhooksService: WebhooksService,
  ) {}

  async matchAndDispatch(orderId: string): Promise<{ matched: boolean; candidatesCount: number }> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`La orden #${orderId} no fue encontrada.`);
    }

    if (order.status !== OrderStatus.CREATED && order.status !== OrderStatus.SEARCHING_DRIVER) {
      return { matched: false, candidatesCount: 0 };
    }

    order.status = OrderStatus.SEARCHING_DRIVER;
    await this.orderRepo.save(order);

    // Buscar conductores online cercanos mediante Redis GEO (radio de 5km)
    const candidates = await this.trackingService.findNearbyDrivers(
      order.pickupLat,
      order.pickupLng,
      5.0,
    );

    this.logger.log(`Se encontraron ${candidates.length} conductores en línea dentro de 5km para la orden ${orderId}`);

    if (candidates.length === 0) {
      // Si no hay candidatos exclusivos por GPS, emitir como orden disponible general
      this.trackingGateway.emitOrderBroadcast(order);
      return { matched: false, candidatesCount: 0 };
    }

    // Bloqueo atómico de 30 segundos en Redis para la oferta
    const topCandidate = candidates[0];
    const redis = this.trackingService.getRedis();
    const lockKey = `order:lock:${orderId}`;
    const acquired = await redis.set(lockKey, topCandidate.driverId, 'EX', 30, 'NX');

    if (acquired) {
      this.logger.log(`Orden ${orderId} ofertada al conductor ${topCandidate.driverId} (bloqueo atómico 30s)`);
      this.trackingGateway.emitOrderOffer(topCandidate.driverId, order);
    } else {
      this.trackingGateway.emitOrderBroadcast(order);
    }

    return { matched: true, candidatesCount: candidates.length };
  }

  async acceptOffer(orderId: string, driverId: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }

    const driver = await this.driverRepo.findOne({ where: { id: driverId } });
    if (!driver || !driver.isActive) {
      throw new BadRequestException('El conductor no es válido o está inactivo.');
    }

    // Aceptación idempotente: si ya está asignada a este conductor, confirmar de inmediato
    if (
      order.driverId === driverId &&
      (order.status === OrderStatus.ASSIGNED ||
        order.status === OrderStatus.ARRIVED_AT_PICKUP ||
        order.status === OrderStatus.IN_TRANSIT)
    ) {
      return {
        success: true,
        exito: true,
        mensaje: 'Pedido previamente aceptado por el conductor.',
        order,
        driver: { id: driver.id, fullName: driver.fullName, phone: driver.phone },
      };
    }

    if (
      order.status !== OrderStatus.CREATED &&
      order.status !== OrderStatus.SEARCHING_DRIVER &&
      order.status !== OrderStatus.ASSIGNED
    ) {
      throw new ConflictException(`El pedido no puede ser aceptado. Estado actual: ${order.status}`);
    }

    // Asignación atómica
    const previousStatus = order.status;
    order.driverId = driverId;
    order.status = OrderStatus.ASSIGNED;
    await this.orderRepo.save(order);

    // Liberar candado de Redis
    const redis = this.trackingService.getRedis();
    await redis.del(`order:lock:${orderId}`);

    // Registro de auditoría
    await this.logRepo.save(
      this.logRepo.create({
        orderId,
        previousStatus,
        newStatus: OrderStatus.ASSIGNED,
        changedBy: 'DRIVER',
        metadata: { driverId, driverName: driver.fullName },
      }),
    );

    // Enviar Webhook order.assigned al comercio
    await this.webhooksService.enqueueWebhookEvent(order.tenantId, order.id, 'order.assigned', {
      order_id: order.id,
      merchant_reference: order.merchantReference,
      status: order.status,
      driver: {
        id: driver.id,
        name: driver.fullName,
        phone: driver.phone,
        vehicle_type: driver.vehicleType,
        vehicle_plate: driver.vehiclePlate,
      },
      pickup_address: order.pickupAddress,
      dropoff_address: order.dropoffAddress,
      tracking_url: `${process.env.TRACKING_BASE_URL || 'https://dsp-admin-pi.vercel.app'}/track/${order.trackingToken}`,
    });

    return {
      success: true,
      exito: true,
      mensaje: 'Pedido asignado y aceptado con éxito.',
      order,
      driver: { id: driver.id, fullName: driver.fullName, phone: driver.phone },
    };
  }

  async manualAssign(orderId: string, driverId: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Orden no encontrada');

    const driver = await this.driverRepo.findOne({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Conductor no encontrado');

    const previousStatus = order.status;
    order.driverId = driverId;
    order.status = OrderStatus.ASSIGNED;
    await this.orderRepo.save(order);

    await this.logRepo.save(
      this.logRepo.create({
        orderId,
        previousStatus,
        newStatus: OrderStatus.ASSIGNED,
        changedBy: 'ADMIN',
        metadata: { driverId, manual: true },
      }),
    );

    await this.webhooksService.enqueueWebhookEvent(order.tenantId, order.id, 'order.assigned', {
      order_id: order.id,
      merchant_reference: order.merchantReference,
      status: order.status,
      driver: {
        id: driver.id,
        name: driver.fullName,
        phone: driver.phone,
        vehicle_type: driver.vehicleType,
        vehicle_plate: driver.vehiclePlate,
      },
    });

    return order;
  }
}
