import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = module.get<AppController>(AppController);
  });

  describe('getRoot', () => {
    it('should return welcome status and docs path', () => {
      const result = appController.getRoot();
      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('service', 'Chiringuito DSP Backend API');
      expect(result).toHaveProperty('version', '1.0.0');
      expect(result).toHaveProperty('docs', '/api/docs');
      expect(result).toHaveProperty('timestamp');
    });
  });

  describe('getHealth', () => {
    it('should return healthy status and uptime', () => {
      const result = appController.getHealth();
      expect(result).toHaveProperty('status', 'healthy');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(result).toHaveProperty('timestamp');
    });
  });
});
