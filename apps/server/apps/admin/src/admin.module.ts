import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/database';
import { HttpCoreModule } from '@app/http';
import { AdminAuthModule } from './auth/admin-auth.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuditLogsController } from './audit/audit-logs.controller';
import { AuditLogsService } from './audit/audit-logs.service';
import { PlatformContentsController } from './contents/platform-contents.controller';
import { PlatformContentsService } from './contents/platform-contents.service';
import { ContentEntitlementsController } from './entitlements/content-entitlements.controller';
import { ContentEntitlementsService } from './entitlements/content-entitlements.service';

@Module({
  imports: [DatabaseModule, HttpCoreModule, AdminAuthModule],
  controllers: [
    AdminController,
    ContentEntitlementsController,
    PlatformContentsController,
    AuditLogsController,
  ],
  providers: [
    AdminService,
    ContentEntitlementsService,
    PlatformContentsService,
    AuditLogsService,
  ],
})
export class AdminModule {}
