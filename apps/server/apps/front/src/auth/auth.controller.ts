import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { AuthedRequest } from './jwt-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from './auth.service';

/** 注册：邮箱 + 密码；密码长度与产品一致，由 Zod 在边界截断非法输入。 */
const registerBodySchema = z.object({
  email: z.string().email().max(320).describe('注册邮箱；与登录共用格式校验。'),
  password: z
    .string()
    .min(8)
    .max(128)
    .describe('密码；最小 8、最大 128 字符。'),
});

/** 登录与注册 body 形状相同，复用 schema 避免两处 drift。 */
const loginBodySchema = registerBodySchema;

/** 刷新：仅携带 refresh JWT；`.strict()` 拒绝多余字段，减少注入面。 */
const refreshBodySchema = z
  .object({
    refreshToken: z
      .string()
      .min(1)
      .max(8192)
      .describe('上一轮登录/刷新下发的 refresh JWT；轮换后旧值失效。'),
  })
  .strict();

/** 微信小程序 **`wx.login` / `uni.login`** 返回的 **`code`**（一次性）。 */
const wechatMiniProgramLoginBodySchema = z
  .object({
    code: z
      .string()
      .min(6)
      .max(256)
      .describe(
        '`wx.login` / `uni.login` 返回的一次性 `code`，用于换 openid。',
      ),
  })
  .strict();

/**
 * 当前会员资料 PATCH：昵称与密码变更的**互斥与成对规则**在 Zod 层先挡一层，与 Service 事务一致。
 *
 * - **改密**：`currentPassword` 与 `newPassword` 必须**同时出现或同时不出现**；只传一半直接 422。
 * - **至少一项变更**：不允许空 PATCH；必须带 `displayName` 或（成对密码字段）。
 */
const patchAuthMeBodySchema = z
  .object({
    currentPassword: z
      .string()
      .min(1)
      .max(128)
      .optional()
      .describe('改密时与 `newPassword` 成对出现：当前密码。'),
    newPassword: z
      .string()
      .min(8)
      .max(128)
      .optional()
      .describe('改密时与 `currentPassword` 成对出现：新密码。'),
    displayName: z
      .union([z.string().max(64), z.null()])
      .optional()
      .describe('展示昵称；传 `null` 表示清空。与改密字段至少改一项。'),
  })
  .strict()
  .superRefine((v, ctx) => {
    const pwdHalf =
      (v.currentPassword !== undefined) !== (v.newPassword !== undefined);
    if (pwdHalf) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '改密须同时提供 currentPassword 与 newPassword',
        path: ['currentPassword'],
      });
    }
    const hasPwd =
      v.currentPassword !== undefined && v.newPassword !== undefined;
    const hasDisplay = v.displayName !== undefined;
    if (!hasPwd && !hasDisplay) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          '至少需要提供 displayName 或（currentPassword 与 newPassword）',
        path: ['displayName'],
      });
    }
  });

/** DTO：会员注册请求体（邮箱 + 密码）；与 `POST .../auth/register` 入参一致。 */
class RegisterBodyDto extends createZodDto(registerBodySchema) {}

/** DTO：邮箱密码登录请求体；与注册字段形状相同，避免两套 schema 漂移。 */
class LoginBodyDto extends createZodDto(loginBodySchema) {}

/** DTO：刷新会话请求体，仅含 `refreshToken`。 */
class RefreshBodyDto extends createZodDto(refreshBodySchema) {}

/** DTO：微信小程序 `code` 换票登录请求体。 */
class WeChatMiniProgramLoginBodyDto extends createZodDto(
  wechatMiniProgramLoginBodySchema,
) {}

/**
 * DTO：当前会员资料 PATCH（昵称与/或改密）。
 * 业务约束（改密成对、至少一项变更）见 schema 内 `superRefine`。
 */
class PatchAuthMeBodyDto extends createZodDto(patchAuthMeBodySchema) {}

/**
 * C 端会员认证：注册、登录、刷新、微信换票、读/改当前资料。
 * 除「读我」「改我」外均为匿名可调用；敏感路由由 {@link JwtAuthGuard} 保护。
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** 创建 `MemberUser` 并返回基础资料（不含 token 细节见 Service）。 */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '会员注册（邮箱 + 密码）' })
  /**
   * @param body 邮箱与密码；成功返回 `memberId` 等基础资料（不含 token 时见 Service）。
   */
  register(@Body() body: RegisterBodyDto): Promise<{
    memberId: string;
    email: string;
    displayName: string | null;
  }> {
    return this.authService.register(body);
  }

  /** 校验密码后签发 access + refresh（具体字段形状见 Service / 规范）。 */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '会员登录（邮箱 + 密码，返回双 token）' })
  /** @param body 邮箱与密码，与注册字段形状相同。 */
  login(@Body() body: LoginBodyDto) {
    return this.authService.login(body);
  }

  /**
   * 微信 `jscode2session` 换 openid 后 upsert 会员并签发双 token。
   * 若未配置 `WECHAT_MINI_PROGRAM_*` 环境变量，Service 层返回 **503**（见实现）。
   */
  @Post('wechat/mini-program')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '微信小程序 code 换 openid 并签发双 token',
    description:
      '依赖环境变量 WECHAT_MINI_PROGRAM_APPID / WECHAT_MINI_PROGRAM_SECRET。',
  })
  /** @param body 含微信小程序 `code`。 */
  loginWeChatMiniProgram(@Body() body: WeChatMiniProgramLoginBodyDto) {
    return this.authService.loginWeChatMiniProgram(body);
  }

  /** 校验 refresh 后轮换一对新 token，旧 refresh 失效（防重放由 Service 保证）。 */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '使用 refreshToken 轮换 access + refresh' })
  /** @param body 仅含 `refreshToken`。 */
  refresh(@Body() body: RefreshBodyDto) {
    return this.authService.refresh(body);
  }

  /** 依赖 access JWT：`sub` → `memberId`。 */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '当前会员资料（须 access token）' })
  /** @param req 已由 {@link JwtAuthGuard} 注入 `memberId`。 */
  me(@Req() req: AuthedRequest): Promise<{
    memberId: string;
    email: string;
    displayName: string | null;
  }> {
    return this.authService.getMe(req.memberId);
  }

  /**
   * 部分更新资料与/或密码；业务规则与审计写入见 {@link AuthService.patchMe}。
   * `displayName` 可传 `null` 清空昵称（与 Zod union 对齐）。
   */
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '更新昵称与/或密码',
    description:
      '改密须同时传 currentPassword 与 newPassword；可与 displayName 同 PATCH；至少一项变更。',
  })
  /**
   * @param req 当前会员上下文。
   * @param body 昵称与/或成对密码字段；约束见 schema `superRefine`。
   */
  patchMe(
    @Req() req: AuthedRequest,
    @Body() body: PatchAuthMeBodyDto,
  ): Promise<{
    memberId: string;
    email: string;
    displayName: string | null;
  }> {
    return this.authService.patchMe(req.memberId, body);
  }
}
