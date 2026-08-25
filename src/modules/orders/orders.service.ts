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

  async getAllOrders(status?: OrderStatus, tenantId?: string) {
    const query = this.orderRepo.createQueryBuilder('order').orderBy('order.createdAt', 'DESC');
    if (status) query.andWhere('order.status = :status', { status });
    if (tenantId) query.andWhere('order.tenantId = :tenantId', { tenantId });
    return query.getMany();
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
}
