import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JWT_ACCESS_TTL_SECONDS } from '@app/http';
import { jwtSecretFromEnv } from '@app/shared';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: jwtSecretFromEnv(),
      signOptions: { expiresIn: JWT_ACCESS_TTL_SECONDS },
    }),
  ],
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminJwtAuthGuard],
  exports: [JwtModule, AdminJwtAuthGuard, AdminAuthService],
})
export class AdminAuthModule {}
