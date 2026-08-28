# Documento de Requerimientos Funcionales (FRD)
## Proyecto: `dsp_backend` — Núcleo de Despacho, APIs y Gateway OpenDSP

---

## 1. Información General y Propósito del Sistema

El proyecto **`dsp_backend`** es el motor central de servicios del ecosistema OpenDSP, desarrollado con **NestJS 10**, **TypeScript**, **TypeORM**, **PostgreSQL** y **Redis**. Proporciona una arquitectura modular de alto rendimiento para el despacho automatizado de última milla, APIs públicas B2B para comercios externos, WebSockets bidireccionales para telemetría satelital y control de liquidaciones financieras en Bolivianos.

### Objetivos Clave:
1. **Despacho Geoespacial Ultrarrápido**: Algoritmo de emparejamiento inteligente basado en comandos geoespaciales de Redis (`GEORADIUS` / `GEOSEARCH`) dentro de un radio de 5 km.
2. **Arquitectura Multi-Actor y Multi-Rol**: Soporte nativo para Super Administradores, Asociaciones Externas de Motos (*DSP Partners*), Comercios remitentes (*Tenants*) y Conductores (*Drivers*).
3. **Gateway de Telemetría Satelital**: Servidor WebSocket en tiempo real para rastreo de posición, control de rumbos, alertas de órdenes con audio/vibración y suscripciones de clientes.
4. **Delegación de Pedidos**: Capacidad transaccional de transferir pedidos entre diferentes flotas y asociaciones con trazabilidad completa de eventos.

---

## 2. Matriz de Roles y Seguridad del Backend (RBAC)

La API protege sus rutas mediante el guardián global de roles y estrategias JWT (`RolesGuard` y `JwtAuthGuard`):

| Rol en Backend | Descripción y Privilegios Principales |
| :--- | :--- |
| `SUPER_ADMIN` | Acceso irrestricto a todos los endpoints del sistema, gestión de asociaciones DSP, configuración de comisiones globales y auditoría general. |
| `DSP_EXTERNAL` | Acceso a endpoints de gestión de su flota asignada, aceptación de pedidos delegados y registro administrativo de sus propios motorizados. |
| `DRIVER` | Acceso a endpoints de la app móvil: perfil, cambio de estado de turno (*Online/Offline*), aceptación y avance de órdenes, consulta de billetera y solicitud de retiros. |
| `TENANT` | Comercios B2B que crean órdenes a través de API Keys públicas (`X-API-Key`) o credenciales de portal. |

---

## 3. Catálogo de Módulos y Requerimientos Funcionales

---

### Módulo 3.1: Autenticación y Autorización (`AuthModule`)
- **Controlador**: [`src/modules/auth/auth.controller.ts`](file:///c:/Users/marvin/Documents/marvin/dsp/dsp_backend/src/modules/auth/auth.controller.ts)
- **Servicio**: [`src/modules/auth/auth.service.ts`](file:///c:/Users/marvin/Documents/marvin/dsp/dsp_backend/src/modules/auth/auth.service.ts)
- **Funcionalidades**:
  - `POST /v1/auth/login`: Autenticación para operadores de panel (`SUPER_ADMIN` y `DSP_EXTERNAL`). Emite JWT con claims de usuario, rol y `dspPartnerId` si corresponde.
  - `POST /v1/auth/driver-login`: Autenticación optimizada para la app de repartidores. Valida número de teléfono o correo y contraseña cifrada con Bcrypt. Retorna datos del conductor, estado de verificación documental y token de sesión.
  - `POST /v1/auth/register`: Alta de usuarios del sistema con validación de roles y unicidad de correo.

---

### Módulo 3.2: Asociaciones DSP y Flotas Delegadas (`DspPartnersModule`)
- **Controlador**: [`src/modules/dsp-partners/dsp-partners.controller.ts`](file:///c:/Users/marvin/Documents/marvin/dsp/dsp_backend/src/modules/dsp-partners/dsp-partners.controller.ts)
- **Servicio**: [`src/modules/dsp-partners/dsp-partners.service.ts`](file:///c:/Users/marvin/Documents/marvin/dsp/dsp_backend/src/modules/dsp-partners/dsp-partners.service.ts)
- **Entidad**: [`src/modules/dsp-partners/entities/dsp-partner.entity.ts`](file:///c:/Users/marvin/Documents/marvin/dsp/dsp_backend/src/modules/dsp-partners/entities/dsp-partner.entity.ts)
- **Funcionalidades**:
  - `POST /v1/dsp-partners`: Registro de una nueva asociación de motos o sub-empresa de reparto. Recibe razón social, NIT, contacto, teléfono y porcentaje de comisión. Crea paralelamente el usuario operador con rol `DSP_EXTERNAL`.
  - `GET /v1/dsp-partners`: Listado de asociaciones registradas con estadísticas de conductores activos y pedidos atendidos (exclusivo para `SUPER_ADMIN`).
  - `GET /v1/dsp-partners/:id`: Consulta individual de detalle y métricas operativas.
  - `PATCH /v1/dsp-partners/:id`: Modificación de datos de contacto, comisión pactada o suspensión del servicio.

---

### Módulo 3.3: Conductores y Auditoría Documental (`DriversModule`)
- **Controlador**: [`src/modules/drivers/drivers.controller.ts`](file:///c:/Users/marvin/Documents/marvin/dsp/dsp_backend/src/modules/drivers/drivers.controller.ts)
- **Servicio**: [`src/modules/drivers/drivers.service.ts`](file:///c:/Users/marvin/Documents/marvin/dsp/dsp_backend/src/modules/drivers/drivers.service.ts)
- **Entidad**: [`src/modules/drivers/entities/driver.entity.ts`](file:///c:/Users/marvin/Documents/marvin/dsp/dsp_backend/src/modules/drivers/entities/driver.entity.ts)
- **Funcionalidades**:
  - `POST /v1/drivers/register`: Registro integral desde la app móvil con datos personales, vehículo, URLs de fotos de Cloudinary (CI, Licencia, SOAT) y firma de contrato. Estado inicial: `PENDING_REVIEW`.
  - `POST /v1/drivers/admin-create`: Registro exprés desde el panel administrativo (`SUPER_ADMIN` o `DSP_EXTERNAL`). Crea la cuenta directamente asociada al `dspPartnerId` correspondiente, omitiendo la necesidad de pasar por el onboarding móvil.
  - `GET /v1/drivers`: Listado de conductores. Si el solicitante es `DSP_EXTERNAL`, la consulta se filtra automáticamente para devolver únicamente los miembros de su asociación.
  - `PATCH /v1/drivers/:id/status`: Auditoría administrativa para aprobar (`VERIFIED`/`ACTIVE`) o rechazar (`REJECTED`) los documentos del conductor.
  - `PATCH /v1/drivers/:id/online`: Conmutador de disponibilidad operativa (*Online / Offline*). Al conectarse, se registra en Redis GEO; al desconectarse, se retira de la bolsa de despacho.
  - `GET /v1/drivers/:id/wallet`: Consulta en tiempo real del saldo disponible en Bolivianos (`Bs.`), desglose de carreras del día y transacciones recientes.

---

### Módulo 3.4: Gestión y Delegación de Órdenes (`OrdersModule`)
- **Controlador**: [`src/modules/orders/orders.controller.ts`](file:///c:/Users/marvin/Documents/marvin/dsp/dsp_backend/src/modules/orders/orders.controller.ts)
- **Servicio**: [`src/modules/orders/orders.service.ts`](file:///c:/Users/marvin/Documents/marvin/dsp/dsp_backend/src/modules/orders/orders.service.ts)
- **Entidad**: [`src/modules/orders/entities/order.entity.ts`](file:///c:/Users/marvin/Documents/marvin/dsp/dsp_backend/src/modules/orders/entities/order.entity.ts)
- **Funcionalidades**:
  - `POST /v1/orders`: Creación de orden por parte de comercios B2B. Calcula tarifas según distancia euclidiana/routing, comisiones y asigna estado `SEARCHING_DRIVER`.
  - `GET /v1/orders`: Consulta de órdenes. Aplica filtro de seguridad por rol: el Super Admin visualiza todo el sistema; el usuario `DSP_EXTERNAL` solo visualiza las órdenes donde `delegatedDspId == user.dspPartnerId`.
  - `PATCH /v1/orders/:id/delegate`: Endpoint de **Delegación a Terceros**. Permite al Super Admin transferir un pedido huérfano o de alta demanda a una asociación específica, fijando `delegatedDspId` y disparando la notificación a dicha entidad.
  - `POST /v1/orders/:id/accept`: El conductor acepta la oferta de viaje. Actualiza estado a `ASSIGNED`, asocia el `driverId` y bloquea la orden para otros postulantes.
  - `PATCH /v1/orders/:id/status`: Avance de las fases del viaje (`ARRIVED_AT_PICKUP`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED`).
  - `GET /v1/orders/feed/:driverId`: Consulta de órdenes disponibles cercanas para la lista de despacho de la app móvil.

---

### Módulo 3.5: Despacho Geoespacial Inteligente (`DispatchModule`)
- **Servicio**: [`src/modules/dispatch/dispatch.service.ts`](file:///c:/Users/marvin/Documents/marvin/dsp/dsp_backend/src/modules/dispatch/dispatch.service.ts)
- **Funcionalidades**:
  - **Emparejamiento por Proximidad (Redis GEO)**:
    - Indexa continuamente las coordenadas de conductores activos (`GEOADD drivers:locations <lng> <lat> <driverId>`).
    - Al ingresar un pedido, ejecuta búsqueda en anillo concéntrico de hasta **5.0 km** alrededor del punto de recogida (*Pickup*).
  - **Emisión en Tiempo Real**:
    - Inyecta `TrackingGateway` para emitir la oferta directa `order:offer` a la sala privada del conductor más óptimo.
    - Si el conductor no responde en la ventana de **30 segundos**, la orden se retransmite a la flota en general mediante `order:broadcast`.

---

### Módulo 3.6: Gateway de Telemetría y WebSockets (`TrackingModule`)
- **Gateway**: [`src/modules/tracking/tracking.gateway.ts`](file:///c:/Users/marvin/Documents/marvin/dsp/dsp_backend/src/modules/tracking/tracking.gateway.ts)
- **Namespace**: `/tracking`
- **Funcionalidades y Eventos**:
  - `@SubscribeMessage('driver:join')`: Une al repartidor autenticado a su sala privada `driver:${driverId}` y al canal grupal `drivers:online`.
  - `@SubscribeMessage('driver:leave')`: Retira al conductor de las salas activas.
  - `@SubscribeMessage('tracking:ping')`: Recibe coordenadas satelitales (latitud, longitud, rumbo, velocidad, batería y orden activa) cada 5 segundos. Actualiza Redis GEO y retransmite a los paneles de administración y a los clientes que siguen su pedido.
  - `@SubscribeMessage('order:subscribe')`: Permite al cliente final o al comercio escuchar las actualizaciones de trayecto en vivo de su pedido específico (`order:location_update`).
  - `emitOrderOffer(driverId, order)`: Despacha la oferta con datos completos para activar el ringtone y la vibración en la app móvil.
  - `emitOrderBroadcast(order)`: Emite a todos los conductores disponibles conectados.

---

### Módulo 3.7: Liquidaciones y Retiro de Fondos (`SettlementsModule`)
- **Funcionalidades**:
  - `POST /v1/settlements/withdrawals/request`:
    - Valida que el conductor cuente con saldo suficiente en `driver.walletBalance`.
    - Verifica el monto mínimo de retiro (Bs. 10.00).
    - Descuenta temporalmente el saldo o genera una retención transaccional.
    - Registra la solicitud con estado `PENDING` indicando la modalidad (Transferencia bancaria o QR Simple).
  - `GET /v1/settlements/withdrawals`: Visualización de solicitudes pendientes para que administración ejecute el pago bancario y marque como `APPROVED`.

---

## 4. Reglas de Negocio Centrales

1. **Moneda y Tarifación**:
   - Todas las tarifas, comisiones y saldos se manejan en **Bolivianos (`Bs.` - BOB)** con precisión decimal a 2 dígitos.
2. **Exclusividad de Asignación de Pedido**:
   - Una vez que un conductor acepta un pedido (`POST /v1/orders/:id/accept`), una transacción atómica bloquea la orden para prevenir condiciones de carrera con otros conductores.
3. **Persistencia y Resiliencia**:
   - Si la conexión WebSocket se interrumpe, el cliente almacena las coordenadas en memoria local y las descarga en ráfaga (*flush*) una vez restablecido el enlace.

---

## 5. Requisitos No Funcionales y Arquitectura

- **Framework**: NestJS 10.x con TypeScript 5.
- **Base de Datos**: PostgreSQL 15 / SQLite (para tests E2E y desarrollo local rápido).
- **Caché y Mensajería Rápida**: Redis 7 (GeoJSON, colas y almacén de presencia volátil).
- **WebSockets**: Engine.IO / Socket.IO con adaptadores de Redis para escalabilidad horizontal en múltiples instancias.
- **Calidad de Código**: 100% tipado con DTOs validados mediante `class-validator` y `class-transformer`.
- **Cobertura de Pruebas**: 8 suites de pruebas de extremo a extremo (*E2E*) automatizadas con Jest y Supertest (61 pruebas aprobadas).
