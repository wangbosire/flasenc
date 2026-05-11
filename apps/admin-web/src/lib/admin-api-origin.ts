/**
 * 管理端 Nest 全局前缀为 **`/admin/v1`**；此处返回 **origin**（不含路径），与 `http-api-specification.md` 一致。
 * - **空字符串**：请求走与页面同源相对路径（开发时依赖 `rsbuild.config.ts` 将 **`/admin`** 代理到 Nest）。
 * - **非空**：显式 API 根（如 `https://api.example.com`）；生产须配置且服务端须 **`CORS`** 放行 admin-web 来源。
 */
export function adminApiOrigin(): string {
  const raw = import.meta.env.PUBLIC_ADMIN_API_ORIGIN;
  if (raw === undefined || raw === null) {
    return '';
  }
  return String(raw).replace(/\/+$/, '').trim();
}
