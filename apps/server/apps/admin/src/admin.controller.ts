import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';

/**
 * 管理子应用根路径占位：`GET /admin/v1`（随全局前缀），用于 smoke 测试信封与路由前缀是否正确。
 */
@ApiTags('Admin')
@Controller()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /** 返回固定结构 `{ service, message }`，不经业务表。 */
  @Get()
  @ApiOperation({ summary: '服务占位（验证信封与前缀）' })
  getHello(): { service: string; message: string } {
    return { service: 'admin', message: this.adminService.getHello() };
  }
}
