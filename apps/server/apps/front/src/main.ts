import { NestFactory } from '@nestjs/core';
import { setupHttpSwagger } from '@app/http';
import { FrontModule } from './front.module';

async function bootstrap() {
  const app = await NestFactory.create(FrontModule);
  app.setGlobalPrefix('api/v1');
  setupHttpSwagger(app, {
    title: 'Flasenc C 端 API（front）',
    description:
      '全局 HTTP 前缀 `/api/v1`。鉴权为 Member JWT（`Authorization: Bearer`）。',
  });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
