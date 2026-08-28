import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { TrackingService } from './tracking.service';
import { LocationPingDto } from './dto/location-ping.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/tracking',
})
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TrackingGateway.name);

  constructor(private readonly trackingService: TrackingService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to /tracking: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from /tracking: ${client.id}`);
  }

  /**
   * High-throughput location ping sent by Driver App every 5-10 seconds
   */
  @SubscribeMessage('tracking:ping')
  async handleLocationPing(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LocationPingDto,
  ) {
    const { driverId, lat, lng, heading = 0, speed = 0, orderId } = data;

    // 1. Update Redis GEO spatial index
    await this.trackingService.updateDriverLocation(driverId, lat, lng, heading, speed);

    const pingPayload = {
      driverId,
      lat,
      lng,
      heading,
      speed,
      orderId,
      timestamp: new Date().toISOString(),
    };

    // 2. Broadcast to global fleet stream for Admin Portal Live Map
    this.server.emit('fleet:driver_location', pingPayload);

    // 3. Broadcast to specific order room if driver is on active delivery
    if (orderId) {
      this.server.to(`order:${orderId}`).emit('order:location_update', pingPayload);
    }

    return { received: true, timestamp: Date.now() };
  }

  /**
   * Room subscription for merchant, customer, or admin tracking a specific order
   */
  @SubscribeMessage('order:subscribe')
  handleOrderSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ) {
    if (data?.orderId) {
      client.join(`order:${data.orderId}`);
      this.logger.log(`Socket ${client.id} joined room order:${data.orderId}`);
      return { subscribed: true, room: `order:${data.orderId}` };
    }
  }

  @SubscribeMessage('order:unsubscribe')
  handleOrderUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ) {
    if (data?.orderId) {
      client.leave(`order:${data.orderId}`);
      return { unsubscribed: true };
    }
  }

  /**
   * Conductor se une a su canal privado y al canal de conductores en línea
   */
  @SubscribeMessage('driver:join')
  handleDriverJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { driverId: string },
  ) {
    if (data?.driverId) {
      client.join(`driver:${data.driverId}`);
      client.join('drivers:online');
      this.logger.log(`Conductor ${data.driverId} suscrito a canal privado y drivers:online`);
      return { joined: true, driverId: data.driverId };
    }
  }

  @SubscribeMessage('driver:leave')
  handleDriverLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { driverId: string },
  ) {
    if (data?.driverId) {
      client.leave(`driver:${data.driverId}`);
      client.leave('drivers:online');
      return { left: true };
    }
  }

  /**
   * Envía oferta de orden a un conductor específico y al canal de conductores activos
   */
  emitOrderOffer(driverId: string, orderPayload: any) {
    if (!this.server) return;
    this.server.to(`driver:${driverId}`).emit('order:offer', orderPayload);
    this.server.to('drivers:online').emit('order:broadcast', orderPayload);
  }

  /**
   * Emisión global de nueva orden disponible
   */
  emitOrderBroadcast(orderPayload: any) {
    if (!this.server) return;
    this.server.to('drivers:online').emit('order:broadcast', orderPayload);
    this.server.emit('order:new', orderPayload);
  }
}
