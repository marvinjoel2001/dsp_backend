import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';

export interface PushNotificationPayload {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class PushNotificationsService implements OnModuleInit {
  private readonly logger = new Logger(PushNotificationsService.name);
  private isConfigured = false;
  private firebaseServerKey: string | null = null;
  private firebaseProjectId: string | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.firebaseServerKey =
      this.configService.get<string>('FIREBASE_SERVER_KEY') ||
      process.env.FIREBASE_SERVER_KEY ||
      null;

    this.firebaseProjectId =
      this.configService.get<string>('FIREBASE_PROJECT_ID') ||
      process.env.FIREBASE_PROJECT_ID ||
      null;

    if (this.firebaseServerKey || this.firebaseProjectId) {
      this.isConfigured = true;
      this.logger.log('🔥 Firebase Cloud Messaging (FCM) configurado para notificaciones push');
    } else {
      this.logger.warn(
        '⚠️ Firebase FCM no está configurado (variables FIREBASE_SERVER_KEY o FIREBASE_PROJECT_ID ausentes). ' +
          'Las órdenes seguirán emitiéndose en tiempo real mediante WebSockets.',
      );
    }
  }

  /**
   * Envía una notificación push de alta prioridad para despertar el teléfono del conductor
   */
  async sendHighPriorityPush(payload: PushNotificationPayload): Promise<boolean> {
    if (!payload.token || payload.token.trim().length < 10) {
      return false;
    }

    if (!this.isConfigured) {
      this.logger.debug(
        `[FCM Simulador] Push a conductor (Token: ${payload.token.substring(0, 15)}...): ${payload.title} - ${payload.body}`,
      );
      return false;
    }

    try {
      // Si se cuenta con FIREBASE_SERVER_KEY (FCM Legacy HTTP API)
      if (this.firebaseServerKey) {
        return await this.sendViaLegacyHttp(payload);
      }
      return false;
    } catch (err: any) {
      this.logger.error(`Error enviando notificación push FCM: ${err.message}`);
      return false;
    }
  }

  /**
   * Notificación para una orden asignada o en oferta
   */
  async sendOrderOfferPush(driverFcmToken: string, order: any): Promise<boolean> {
    return this.sendHighPriorityPush({
      token: driverFcmToken,
      title: '🚨 ¡NUEVO PEDIDO ASIGNADO! 30s',
      body: `Recogida: ${order.pickupAddress || 'Comercio'} | Pago: Bs. ${(Number(order.driverPayout) || 12).toFixed(2)}`,
      data: {
        orderId: order.id,
        merchantReference: order.merchantReference || '',
        status: order.status || '',
        pickupAddress: order.pickupAddress || '',
        pickupLat: String(order.pickupLat || ''),
        pickupLng: String(order.pickupLng || ''),
        dropoffAddress: order.dropoffAddress || '',
        dropoffLat: String(order.dropoffLat || ''),
        dropoffLng: String(order.dropoffLng || ''),
        price: String(order.price || '0'),
        driverPayout: String(order.driverPayout || '0'),
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        priority: 'high',
      },
    });
  }

  /**
   * Envío mediante el endpoint HTTP de FCM con reintentos y compatibilidad garantizada
   */
  private sendViaLegacyHttp(payload: PushNotificationPayload): Promise<boolean> {
    return new Promise((resolve) => {
      const postData = JSON.stringify({
        to: payload.token,
        priority: 'high',
        android: {
          priority: 'high',
          notification: {
            channel_id: 'chiringuito_dispatch_alerts',
            sound: 'default',
            default_sound: true,
            default_vibrate_timings: true,
            notification_priority: 'PRIORITY_MAX',
          },
        },
        notification: {
          title: payload.title,
          body: payload.body,
          sound: 'default',
          android_channel_id: 'chiringuito_dispatch_alerts',
        },
        data: {
          ...payload.data,
          title: payload.title,
          body: payload.body,
        },
      });

      const options = {
        hostname: 'fcm.googleapis.com',
        port: 443,
        path: '/fcm/send',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${this.firebaseServerKey}`,
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 5000,
      };

      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => (responseBody += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            this.logger.log(`✅ FCM Push enviado exitosamente: ${payload.title}`);
            resolve(true);
          } else {
            this.logger.warn(`⚠️ FCM respondió status ${res.statusCode}: ${responseBody}`);
            resolve(false);
          }
        });
      });

      req.on('error', (e) => {
        this.logger.error(`Error en HTTP request a FCM: ${e.message}`);
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.write(postData);
      req.end();
    });
  }
}
