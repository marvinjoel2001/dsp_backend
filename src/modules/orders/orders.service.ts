import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { DeliveryOrder, OrderStatus } from './entities/order.entity';
import { OrderStatusLog } from './entities/order-status-log.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { QuotesService } from '../quotes/quotes.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { Driver } from '../drivers/entities/driver.entity';
import { DriverWalletTransaction } from '../drivers/entities/driver-wallet-transaction.entity';
import { CryptoUtil } from '../../common/utils/crypto.util';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(DeliveryOrder)
    private readonly orderRepo: Repository<DeliveryOrder>,
    @InjectRepository(OrderStatusLog)
    private readonly logRepo: Repository<OrderStatusLog>,
    @InjectRepository(Driver)
    private readonly driverRepo: Repository<Driver>,
    @InjectRepository(DriverWalletTransaction)
    private readonly walletTxRepo: Repository<DriverWalletTransaction>,
    private readonly quotesService: QuotesService,
    private readonly webhooksService: WebhooksService,
    @Inject(forwardRef(() => DispatchService))
    private readonly dispatchService: DispatchService,
  ) {}

  async createOrder(tenantId: string, dto: CreateOrderDto) {
    let pickupAddress = dto.pickupAddress;
    let pickupLat = dto.pickupLat;
    let pickupLng = dto.pickupLng;
    let dropoffAddress = dto.dropoffAddress;
    let dropoffLat = dto.dropoffLat;
    let dropoffLng = dto.dropoffLng;
    let price = 5.0;
    let driverPayout = 4.0;
    let quoteId: string | null = null;

    if (dto.quoteId) {
      const quote = await this.quotesService.validateQuoteActive(dto.quoteId);
      quoteId = quote.id;
      pickupAddress = quote.pickupAddress;
      pickupLat = quote.pickupLat;
      pickupLng = quote.pickupLng;
      dropoffAddress = quote.dropoffAddress;
      dropoffLat = quote.dropoffLat;
      dropoffLng = quote.dropoffLng;
      price = Number(quote.totalPrice);
      driverPayout = Number(quote.driverPayout);
    } else if (pickupAddress && pickupLat && pickupLng && dropoffAddress && dropoffLat && dropoffLng) {
      const tempQuote = await this.quotesService.calculateAndCreateQuote(tenantId, {
        pickupAddress,
        pickupLat,
        pickupLng,
        dropoffAddress,
        dropoffLat,
        dropoffLng,
      });
      quoteId = tempQuote.id;
      price = Number(tempQuote.totalPrice);
      driverPayout = Number(tempQuote.driverPayout);
    } else {
      throw new BadRequestException('Se requiere quoteId previo o las coordenadas completas de recogida y entrega (pickup y dropoff).');
    }

    const orderId = `ord_${crypto.randomBytes(4).toString('hex')}`;
    const trackingToken = CryptoUtil.generateTrackingToken();

    const order = this.orderRepo.create({
      id: orderId,
      tenantId,
      quoteId: quoteId || undefined,
      merchantReference: dto.merchantReference || `REF-${Math.floor(1000 + Math.random() * 9000)}`,
      status: OrderStatus.CREATED,
      pickupAddress,
      pickupLat,
      pickupLng,
      dropoffAddress,
      dropoffLat,
      dropoffLng,
      price,
      driverPayout,
      packageNotes: dto.packageNotes || null,
      trackingToken,
    });

    const savedOrder = await this.orderRepo.save(order);

    // Guardar auditoría inicial
    await this.logRepo.save(
      this.logRepo.create({
        orderId: savedOrder.id,
        previousStatus: null,
        newStatus: OrderStatus.CREATED,
        changedBy: 'MERCHANT',
        metadata: { tenantId, initialPrice: price },
      }),
    );

    // Disparar Webhook order.created
    await this.webhooksService.enqueueWebhookEvent(tenantId, savedOrder.id, 'order.created', {
      order_id: savedOrder.id,
      merchant_reference: savedOrder.merchantReference,
      status: savedOrder.status,
      pickup_address: savedOrder.pickupAddress,
      dropoff_address: savedOrder.dropoffAddress,
      tracking_url: `https://dsp.openplatform.com/track/${savedOrder.trackingToken}`,
    });

    // Iniciar matchmaking geoespacial en background
    this.dispatchService.matchAndDispatch(savedOrder.id).catch((err) => {
      this.logger.error(`Error en auto-despacho de orden ${savedOrder.id}: ${err.message}`);
    });

    return savedOrder;
  }

  async updateOrderStatus(
    orderId: string,
    dto: UpdateOrderStatusDto,
    changedBy: 'DRIVER' | 'MERCHANT' | 'SYSTEM' | 'ADMIN' = 'DRIVER',
  ) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`La orden #${orderId} no fue encontrada.`);
    }

    const previousStatus = order.status;
    order.status = dto.status;

    if (dto.proofPhotoUrl) order.proofPhotoUrl = dto.proofPhotoUrl;
    if (dto.signatureSvg) order.signatureSvg = dto.signatureSvg;

    // Acreditación en la billetera del conductor al entregar
    if (dto.status === OrderStatus.DELIVERED && order.driverId) {
      const driver = await this.driverRepo.findOne({ where: { id: order.driverId } });
      if (driver) {
        driver.walletBalance = Number(driver.walletBalance) + Number(order.driverPayout);
        await this.driverRepo.save(driver);

        await this.walletTxRepo.save(
          this.walletTxRepo.create({
            driverId: driver.id,
            amount: order.driverPayout,
            type: 'PAYOUT',
            referenceId: order.id,
            description: `Pago por entrega de orden #${order.id}`,
          }),
        );
      }
    }

    const saved = await this.orderRepo.save(order);

    // Registro de auditoría inmutable
    await this.logRepo.save(
      this.logRepo.create({
        orderId: saved.id,
        previousStatus,
        newStatus: dto.status,
        changedBy,
        metadata: { notes: dto.notes, photo: !!dto.proofPhotoUrl, signature: !!dto.signatureSvg },
      }),
    );

    // Enviar Webhook correspondiente
    const eventNameMap: Record<string, string> = {
      [OrderStatus.ARRIVED_AT_PICKUP]: 'order.arrived_pickup',
      [OrderStatus.IN_TRANSIT]: 'order.in_transit',
      [OrderStatus.DELIVERED]: 'order.delivered',
      [OrderStatus.CANCELLED]: 'order.cancelled',
    };

    const webhookEvent = eventNameMap[dto.status];
    if (webhookEvent) {
      let driverInfo: any = undefined;
      if (order.driverId) {
        const driver = await this.driverRepo.findOne({ where: { id: order.driverId } });
        if (driver) {
          driverInfo = {
            id: driver.id,
            name: driver.fullName,
            phone: driver.phone,
            vehicle_type: driver.vehicleType,
            vehicle_plate: driver.vehiclePlate,
          };
        }
      }

      await this.webhooksService.enqueueWebhookEvent(order.tenantId, order.id, webhookEvent, {
        order_id: order.id,
        merchant_reference: order.merchantReference,
        status: order.status,
        driver: driverInfo,
        tracking_url: `https://dsp.openplatform.com/track/${order.trackingToken}`,
        proof_photo_url: order.proofPhotoUrl,
      });
    }

    return saved;
  }

  async getAllOrders(status?: OrderStatus, tenantId?: string, delegatedDspId?: string) {
    const query = this.orderRepo.createQueryBuilder('order').orderBy('order.createdAt', 'DESC');
    if (status) query.andWhere('order.status = :status', { status });
    if (tenantId) query.andWhere('order.tenantId = :tenantId', { tenantId });
    if (delegatedDspId) query.andWhere('order.delegatedDspId = :delegatedDspId', { delegatedDspId });
    return query.getMany();
  }

  async delegateOrderToDsp(orderId: string, dspPartnerId: string, dspPayout?: number) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Orden no encontrada');

    order.delegatedDspId = dspPartnerId;
    order.dspStatus = 'OFFERED';
    order.delegatedAt = new Date();
    if (dspPayout !== undefined) {
      order.dspPayout = dspPayout;
    }

    const saved = await this.orderRepo.save(order);

    await this.logRepo.save(
      this.logRepo.create({
        orderId: order.id,
        previousStatus: order.status,
        newStatus: order.status,
        changedBy: 'ADMIN',
        metadata: { reason: `Orden delegada a la Asociación/DSP #${dspPartnerId}` },
      }),
    );

    return saved;
  }

  async dspAcceptOrder(orderId: string, dspPartnerId: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Orden no encontrada');
    if (order.delegatedDspId && order.delegatedDspId !== dspPartnerId) {
      throw new BadRequestException('Esta orden no está delegada a tu asociación');
    }

    order.dspStatus = 'ACCEPTED';
    const saved = await this.orderRepo.save(order);

    await this.logRepo.save(
      this.logRepo.create({
        orderId: order.id,
        previousStatus: order.status,
        newStatus: order.status,
        changedBy: 'ADMIN',
        metadata: { reason: `Orden aceptada por la Asociación/DSP` },
      }),
    );

    return saved;
  }

  async dspAssignDriver(orderId: string, dspPartnerId: string, driverId: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Orden no encontrada');
    if (order.delegatedDspId && order.delegatedDspId !== dspPartnerId) {
      throw new BadRequestException('Esta orden no está delegada a tu asociación');
    }

    const driver = await this.driverRepo.findOne({ where: { id: driverId } });
    if (!driver || !driver.isActive) {
      throw new BadRequestException('El conductor no es válido o está inactivo');
    }

    const previousStatus = order.status;
    order.driverId = driver.id;
    order.status = OrderStatus.ASSIGNED;
    order.dspStatus = 'ASSIGNED';
    const saved = await this.orderRepo.save(order);

    await this.logRepo.save(
      this.logRepo.create({
        orderId: order.id,
        previousStatus,
        newStatus: OrderStatus.ASSIGNED,
        changedBy: 'ADMIN',
        metadata: { reason: `Asignado por la Asociación/DSP a ${driver.fullName}` },
      }),
    );

    return saved;
  }

  async getOrderById(id: string) {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Orden no encontrada');

    const logs = await this.logRepo.find({
      where: { orderId: id },
      order: { createdAt: 'ASC' },
    });

    let driver: Driver | null = null;
    if (order.driverId) {
      driver = await this.driverRepo.findOne({ where: { id: order.driverId } });
    }

    return { ...order, logs, driver };
  }

  async getPublicTracking(trackingToken: string) {
    const order = await this.orderRepo.findOne({ where: { trackingToken } });
    if (!order) throw new NotFoundException('Información de seguimiento no encontrada');

    let driver: Partial<Driver> | null = null;
    if (order.driverId) {
      const d = await this.driverRepo.findOne({ where: { id: order.driverId } });
      if (d) {
        driver = {
          fullName: d.fullName,
          phone: d.phone,
          vehicleType: d.vehicleType,
          vehiclePlate: d.vehiclePlate,
          currentLat: d.currentLat,
          currentLng: d.currentLng,
          rating: d.rating,
        };
      }
    }

    return {
      orderId: order.id,
      merchantReference: order.merchantReference,
      status: order.status,
      pickupAddress: order.pickupAddress,
      pickupLat: order.pickupLat,
      pickupLng: order.pickupLng,
      dropoffAddress: order.dropoffAddress,
      dropoffLat: order.dropoffLat,
      dropoffLng: order.dropoffLng,
      createdAt: order.createdAt,
      driver,
    };
  }

  async forceOrderStatus(
    orderId: string,
    dto: {
      status: OrderStatus;
      reason: string;
      creditDriver?: boolean;
      proofPhotoUrl?: string;
      signatureSvg?: string;
    },
  ) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Orden no encontrada');

    const previousStatus = order.status;
    order.status = dto.status;

    if (dto.proofPhotoUrl) order.proofPhotoUrl = dto.proofPhotoUrl;
    if (dto.signatureSvg) order.signatureSvg = dto.signatureSvg;

    // Si se fuerza a DELIVERED y se desea acreditar al conductor
    if (dto.status === OrderStatus.DELIVERED && order.driverId && dto.creditDriver !== false) {
      const driver = await this.driverRepo.findOne({ where: { id: order.driverId } });
      if (driver) {
        driver.walletBalance = Number(driver.walletBalance) + Number(order.driverPayout);
        await this.driverRepo.save(driver);

        await this.walletTxRepo.save(
          this.walletTxRepo.create({
            driverId: driver.id,
            amount: order.driverPayout,
            type: 'PAYOUT',
            referenceId: order.id,
            description: `Pago forzado por soporte/admin por entrega #${order.id}`,
          }),
        );
      }
    }

    const saved = await this.orderRepo.save(order);

    // Auditoría inmutable con motivo del operador
    await this.logRepo.save(
      this.logRepo.create({
        orderId: saved.id,
        previousStatus,
        newStatus: dto.status,
        changedBy: 'ADMIN',
        metadata: {
          forced: true,
          reason: dto.reason,
          proofPhotoUrl: dto.proofPhotoUrl,
          creditDriver: dto.creditDriver,
        },
      }),
    );

    // Reenviar Webhook a la tienda
    await this.resendWebhook(order.id);

    return saved;
  }

  async resendWebhook(orderId: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Orden no encontrada');

    const eventNameMap: Record<string, string> = {
      [OrderStatus.CREATED]: 'order.created',
      [OrderStatus.SEARCHING_DRIVER]: 'order.created',
      [OrderStatus.ASSIGNED]: 'order.assigned',
      [OrderStatus.ARRIVED_AT_PICKUP]: 'order.arrived_pickup',
      [OrderStatus.IN_TRANSIT]: 'order.in_transit',
      [OrderStatus.DELIVERED]: 'order.delivered',
      [OrderStatus.CANCELLED]: 'order.cancelled',
    };

    const webhookEvent = eventNameMap[order.status] || 'order.updated';

    let driverInfo: any = undefined;
    if (order.driverId) {
      const driver = await this.driverRepo.findOne({ where: { id: order.driverId } });
      if (driver) {
        driverInfo = {
          id: driver.id,
          name: driver.fullName,
          phone: driver.phone,
          vehicle_type: driver.vehicleType,
          vehicle_plate: driver.vehiclePlate,
        };
      }
    }

    return this.webhooksService.enqueueWebhookEvent(order.tenantId, order.id, webhookEvent, {
      order_id: order.id,
      merchant_reference: order.merchantReference,
      status: order.status,
      driver: driverInfo,
      tracking_url: `https://dsp.openplatform.com/track/${order.trackingToken}`,
      proof_photo_url: order.proofPhotoUrl,
    });
  }

  async getStuckOrders() {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const fortyMinutesAgo = new Date(now.getTime() - 40 * 60 * 1000);

    const searchingStuck = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.status = :s1 AND o.createdAt <= :limit', {
        s1: OrderStatus.SEARCHING_DRIVER,
        limit: tenMinutesAgo,
      })
      .getMany();

    const transitStuck = await this.orderRepo
      .createQueryBuilder('o')
      .where('(o.status = :s2 OR o.status = :s3) AND o.updatedAt <= :limit', {
        s2: OrderStatus.ASSIGNED,
        s3: OrderStatus.IN_TRANSIT,
        limit: fortyMinutesAgo,
      })
      .getMany();

    return {
      searchingStuck,
      transitStuck,
      totalStuck: searchingStuck.length + transitStuck.length,
    };
  }
}
