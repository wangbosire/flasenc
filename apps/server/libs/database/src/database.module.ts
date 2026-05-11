import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { PrismaService } from './prisma.service';

/** 全局注册：各业务模块可直接注入 `PrismaService`，无需重复 `imports`。 */
@Global()
@Module({
  providers: [PrismaService, AuditLogService],
  exports: [PrismaService, AuditLogService],
})
export class DatabaseModule {}
