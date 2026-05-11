import { NestFactory } from '@nestjs/core';
import { setupHttpSwagger } from '@app/http';
import { AdminModule } from './admin.module';

async function bootstrap() {
  const app = await NestFactory.create(AdminModule);
  app.setGlobalPrefix('admin/v1');
  setupHttpSwagger(app, {
    title: 'Flasenc 管理端 API（admin）',
    description:
      '全局 HTTP 前缀 `/admin/v1`。写接口须平台用户 JWT（`Authorization: Bearer`）。',
  });
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
