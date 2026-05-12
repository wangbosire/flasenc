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
import { MenuItemsController } from './menu/menu-items.controller';
import { MenuItemsService } from './menu/menu-items.service';

@Module({
  imports: [DatabaseModule, HttpCoreModule, AdminAuthModule],
  controllers: [
    AdminController,
    ContentEntitlementsController,
    PlatformContentsController,
    AuditLogsController,
    MenuItemsController,
  ],
  providers: [
    AdminService,
    ContentEntitlementsService,
    PlatformContentsService,
    AuditLogsService,
    MenuItemsService,
  ],
})
export class AdminModule {}
