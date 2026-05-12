import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { AdminAuthService } from './admin-auth.service';

/** 平台用户（`users` 表）邮箱密码登录；须 `platformAdmin` 才发管理 token（见 Service）。 */
const loginBodySchema = z.object({
  email: z.string().email().max(320).describe('平台用户登录邮箱。'),
  password: z.string().min(8).max(128).describe('登录密码。'),
});

/** 与 C 端 refresh 形状一致，但密钥与签发逻辑在 AdminAuthService 分离。 */
const refreshBodySchema = z
  .object({
    refreshToken: z
      .string()
      .min(1)
      .max(8192)
      .describe('管理端 refresh JWT；轮换后旧值失效。'),
  })
  .strict();

/** DTO：管理端平台用户邮箱密码登录请求体。 */
class AdminLoginBodyDto extends createZodDto(loginBodySchema) {}

/** DTO：管理端刷新双 token 请求体，仅含 `refreshToken`。 */
class AdminRefreshBodyDto extends createZodDto(refreshBodySchema) {}

/**
 * 管理端会话：无 Guard，错误次数与审计由 Service 控制。
 */
@ApiTags('AdminAuth')
@Controller('auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  /** 校验 `User` + bcrypt + `platformAdmin`，签发双 token。 */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '平台用户登录（邮箱 + 密码）' })
  /** @param body 邮箱与密码；须具备 `platformAdmin` 才签发 token（见 Service）。 */
  login(@Body() body: AdminLoginBodyDto) {
    return this.adminAuthService.login(body);
  }

  /** refresh 轮换；失败映射 `AUTH_REFRESH_INVALID` 等（见过滤器与 Service）。 */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '使用 refreshToken 轮换平台 access + refresh' })
  /** @param body 仅含 `refreshToken`。 */
  refresh(@Body() body: AdminRefreshBodyDto) {
    return this.adminAuthService.refresh(body);
  }
}
