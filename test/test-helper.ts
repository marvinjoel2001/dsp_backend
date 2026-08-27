import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

export async function createTestingApp(moduleBuilder: TestingModuleBuilder): Promise<{ app: INestApplication; module: TestingModule }> {
  const module = await moduleBuilder.compile();
  const app = module.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  await app.init();
  return { app, module };
}
