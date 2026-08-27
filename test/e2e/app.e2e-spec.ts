import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppController } from '../../src/app.controller';
import { createTestingApp } from '../test-helper';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [AppController],
    });
    const testApp = await createTestingApp(moduleBuilder);
    app = testApp.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET / should return 200 with service welcome info', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(200);

    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('service', 'Chiringuito DSP Backend API');
    expect(res.body).toHaveProperty('version', '1.0.0');
    expect(res.body).toHaveProperty('docs', '/api/docs');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /health should return 200 with healthcheck metrics', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.body).toHaveProperty('status', 'healthy');
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
    expect(res.body).toHaveProperty('timestamp');
  });
});
