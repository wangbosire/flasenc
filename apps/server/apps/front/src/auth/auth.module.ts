import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JWT_ACCESS_TTL_SECONDS } from '@app/http';
import { jwtSecretFromEnv } from '@app/shared';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: jwtSecretFromEnv(),
      signOptions: { expiresIn: JWT_ACCESS_TTL_SECONDS },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, OptionalJwtAuthGuard],
  exports: [JwtModule, JwtAuthGuard, OptionalJwtAuthGuard, AuthService],
})
export class AuthModule {}
