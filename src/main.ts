import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('OpenDSP-Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Global Middlewares & CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger OpenAPI Documentation
  const swaggerDescription = `
# 🚀 OpenDSP Core — Guía Completa de Integración y API REST

Bienvenido a la documentación oficial de **OpenDSP (Open Delivery Service Provider)**. Esta plataforma proporciona una solución integral para servicios de entrega de última milla, cotizaciones dinámicas, asignación inteligente de repartidores (matchmaking) por geolocalización, auditoría inmutable de estados y notificaciones seguras mediante Webhooks.

---

## 🔐 1. Autenticación y Encabezados Requeridos

La API soporta dos métodos de autenticación según el tipo de cliente:

### A. Comercios y Clientes B2B (API Key)
Para crear cotizaciones, solicitar envíos y consultar el estado de entregas:
- **Header:** \`x-api-key: dsp_live_xxxxxx\`
- **Generación:** Se obtiene al registrar una tienda (\`POST /v1/tenants\`) o desde el Panel de Administración.

### B. Encabezado de Idempotencia (Recomendado para creación de órdenes)
Para evitar la duplicación de órdenes en caso de reintentos de red:
- **Header:** \`idempotency-key: <uuid-v4-único>\`
- Si se reenvía una solicitud con la misma clave dentro de su ventana de tiempo, el sistema devolverá la orden creada previamente sin duplicar cobros ni conductores.

### C. Administradores y Repartidores Móviles (JWT Bearer Token)
Para la App móvil del repartidor y el Panel de Control:
- **Header:** \`Authorization: Bearer <jwt_access_token>\`
- **Obtención:** Mediante \`POST /v1/auth/login\`.

---

## 📦 2. Flujo Típico de Integración para un Comercio

\`\`\`mermaid
sequenceDiagram
    participant C as Comercio (API)
    participant DSP as OpenDSP Engine
    participant D as Repartidor (App)

    C->>DSP: 1. POST /v1/quotes (Coordenadas origen y destino)
    DSP-->>C: Cotización generada (Precio, Distancia, TTL 15 min)
    C->>DSP: 2. POST /v1/orders (quoteId o datos directos + idempotency-key)
    DSP-->>C: Orden creada (Status: CREATED)
    DSP->>DSP: Matchmaking Geoespacial Redis (Radio 5km)
    DSP-->>D: Notificación de Despacho (Oferta con candado 30s)
    D->>DSP: 3. POST /v1/dispatch/accept
    DSP->>C: Webhook HTTP POST: order.assigned (HMAC SHA-256)
    D->>DSP: 4. PATCH /v1/orders/:id/status (IN_TRANSIT -> DELIVERED con POD)
    DSP->>C: Webhook HTTP POST: order.delivered (Con foto y firma)
\`\`\`

---

## 🔔 3. Webhooks y Verificación de Firmas HMAC SHA-256

Cada vez que cambia el estado de un pedido, OpenDSP envía un \`POST\` al \`webhookUrl\` registrado para el comercio.

### Encabezados enviados en cada Webhook:
- \`Content-Type: application/json\`
- \`x-dsp-signature: <firma_hmac_hex>\`
- \`x-dsp-timestamp: <iso_timestamp>\`

### Ejemplo de Verificación en Node.js (Express):
\`\`\`javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedSignature));
}
\`\`\`

### Catálogo de Eventos Webhook:
- \`order.created\`: Orden registrada en el sistema.
- \`order.assigned\`: Conductor asignado exitosamente (incluye datos y vehículo del repartidor).
- \`order.arrived_pickup\`: Conductor en el punto de recogida.
- \`order.in_transit\`: Pedido en ruta hacia el cliente final.
- \`order.delivered\`: Pedido entregado exitosamente (incluye URL de foto y firma POD).
- \`order.cancelled\`: Pedido cancelado.

---

## 🛰️ 4. WebSocket Gateway en Tiempo Real (\`/tracking\`)

Para telemetría en vivo, conectarse al namespace: \`ws://<host>:<port>/tracking\`

### Eventos de WebSocket:
1. **Conductor (Emite):**
   - Evento: \`tracking:ping\`
   - Payload: \`{ driverId: "...", lat: -17.78, lng: -63.18, heading: 90, speed: 40, orderId: "..." }\`
2. **Panel de Control / Admin (Escucha):**
   - Evento: \`fleet:driver_location\`
3. **Cliente / Comercio (Suscripción a pedido específico):**
   - Emitir para unirse: \`order:subscribe\` con \`{ orderId: "ord_xxx" }\`
   - Escuchar: \`order:location_update\` con la posición en tiempo real del repartidor.
`;

  const config = new DocumentBuilder()
    .setTitle('OpenDSP Core API — Motor de Despacho y Entregas de Última Milla')
    .setDescription(swaggerDescription)
    .setVersion('1.0.0')
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header', description: 'Clave de API para comercios B2B' }, 'x-api-key')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Token JWT para Administrador y Repartidores' })
    .addTag('Quotes (Cotizaciones Dinámicas)', 'Cálculo de tarifas en tiempo real basado en distancia, duración y demanda')
    .addTag('Orders (Ciclo de Vida de Pedidos)', 'Creación, actualización de estados, auditoría y seguimiento público')
    .addTag('Dispatch (Asignación y Matchmaking)', 'Algoritmo de búsqueda por proximidad geográfica y aceptación de pedidos')
    .addTag('Drivers (Conductores y Flota)', 'Gestión de conductores, estado online/offline, feed de pedidos y billetera')
    .addTag('Tenants (Comercios y Clientes B2B)', 'Administración de comercios, generación de API Keys y configuración de Webhooks')
    .addTag('Webhooks (Gestor de Envíos y DLQ)', 'Consulta de logs de entrega, cola de reintentos BullMQ y verificador de firma HMAC')
    .addTag('Auth (Autenticación)', 'Inicio de sesión y registro de conductores con generación de tokens JWT')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Documentación API OpenDSP',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`🚀 OpenDSP Core Backend iniciado en http://localhost:${port}`);
  logger.log(`📚 Documentación Swagger OpenAPI disponible en http://localhost:${port}/api/docs`);
  logger.log(`⚡ Gateway de Seguimiento WebSocket activo en namespace /tracking`);
}

bootstrap();
