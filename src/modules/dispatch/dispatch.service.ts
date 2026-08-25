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
    private readonly webhooksService: WebhooksService,
  ) {}

  /**
   * Runs matchmaking search for an order and notifies candidate driver
   */
  async matchAndDispatch(orderId: string): Promise<{ matched: boolean; candidatesCount: number }> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.status !== OrderStatus.CREATED && order.status !== OrderStatus.SEARCHING_DRIVER) {
      return { matched: false, candidatesCount: 0 };
    }

    order.status = OrderStatus.SEARCHING_DRIVER;
    await this.orderRepo.save(order);

    // 1. Find nearby online drivers via Redis GEO
    const candidates = await this.trackingService.findNearbyDrivers(
      order.pickupLat,
      order.pickupLng,
      5.0, // 5km search radius
    );

    this.logger.log(`Found ${candidates.length} online drivers within 5km for order ${orderId}`);

    if (candidates.length === 0) {
      return { matched: false, candidatesCount: 0 };
    }

    // In a full queue, we offer to candidates[0] with a 30-sec redis atomic lock
    const topCandidate = candidates[0];
    const redis = this.trackingService.getRedis();

    // Redis SET NX with 30-second TTL prevents multi-driver race conditions
    const lockKey = `order:lock:${orderId}`;
    const acquired = await redis.set(lockKey, topCandidate.driverId, 'EX', 30, 'NX');

    if (acquired) {
      this.logger.log(`Order ${orderId} offered to driver ${topCandidate.driverId} (30s lock)`);
    }

    return { matched: true, candidatesCount: candidates.length };
  }

  /**
   * Driver accepts an order offer (atomic verification)
   */
  async acceptOffer(orderId: string, driverId: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.CREATED && order.status !== OrderStatus.SEARCHING_DRIVER) {
      throw new ConflictException(`Order cannot be accepted. Current status: ${order.status}`);
    }

    const driver = await this.driverRepo.findOne({ where: { id: driverId } });
    if (!driver || !driver.isActive) {
      throw new BadRequestException('Driver is not valid or inactive');
    }

    // Atomic assignment
    const previousStatus = order.status;
    order.driverId = driverId;
    order.status = OrderStatus.ASSIGNED;
    await this.orderRepo.save(order);

    // Release offer lock
    const redis = this.trackingService.getRedis();
    await redis.del(`order:lock:${orderId}`);

    // Audit trail
    await this.logRepo.save(
      this.logRepo.create({
        orderId,
        previousStatus,
        newStatus: OrderStatus.ASSIGNED,
        changedBy: 'DRIVER',
        metadata: { driverId, driverName: driver.fullName },
      }),
    );

    // Trigger Outbound Webhook to Merchant
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
      tracking_url: `https://dsp.openplatform.com/track/${order.trackingToken}`,
    });

    return {
      success: true,
      order,
      driver: { id: driver.id, fullName: driver.fullName, phone: driver.phone },
    };
  }

  /**
   * Manual driver dispatch override by Dispatcher/Admin
   */
  async manualAssign(orderId: string, driverId: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const driver = await this.driverRepo.findOne({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Driver not found');

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
