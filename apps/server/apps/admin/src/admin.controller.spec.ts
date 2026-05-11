import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

describe('AdminController', () => {
  let adminController: AdminController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [AdminService],
    }).compile();

    adminController = app.get<AdminController>(AdminController);
  });

  describe('root', () => {
    it('应返回服务标识与问候', () => {
      expect(adminController.getHello()).toEqual({
        service: 'admin',
        message: 'Hello World!',
      });
    });
  });
});
