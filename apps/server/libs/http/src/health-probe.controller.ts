import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * 健康检查：各子应用 `imports: [HttpCoreModule]` 后自动具备 **`GET .../health`**。
 * 用于 K8s liveness/readiness、负载均衡探活；**不做鉴权**、不访问数据库。
 */
@ApiTags('Health')
@Controller('health')
export class HealthProbeController {
  /** 固定返回 `{ ok: true }`；只要进程与路由栈正常即 200。 */
  @Get()
  @ApiOperation({ summary: '健康检查（探活）' })
  getHealth(): { ok: true } {
    return { ok: true };
  }
}
