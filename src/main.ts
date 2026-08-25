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
  const config = new DocumentBuilder()
    .setTitle('OpenDSP Core API')
    .setDescription(
      'Generic Delivery Service Provider (DSP) Engine — B2B Integrations, Matchmaking Dispatch, Real-Time Geo Tracking, and BullMQ HMAC Webhooks',
    )
    .setVersion('1.0.0')
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'x-api-key')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`🚀 OpenDSP Core Backend is running at http://localhost:${port}`);
  logger.log(`📚 Swagger OpenAPI Documentation available at http://localhost:${port}/api/docs`);
  logger.log(`⚡ WebSocket Tracking Gateway listening on namespace /tracking`);
}

bootstrap();
