import { adminSessionRequest } from './admin-session'

/** `POST /admin/v1/content-entitlements`：内容与权益、兑换码同事务创建；`plainCode` 仅本响应一次。 */
export type CreatedEntitlement = {
  entitlementId: string
  contentId: string
  redemptionCodeId: string
  plainCode: string
}

export type CreatedRedemptionCode = {
  plainCode: string
  redemptionCodeId: string
}

export type CreatedRedemptionCodeWithContent = CreatedRedemptionCode & {
  entitlementId: string
  contentId: string
}

export function createContentEntitlement(
  title?: string
): Promise<CreatedEntitlement> {
  return adminSessionRequest<CreatedEntitlement>(
    '/admin/v1/content-entitlements',
    {
      method: 'POST',
      body: JSON.stringify(title ? { title } : {}),
    }
  )
}

export function createRedemptionCode(
  entitlementId: string,
  plainCode?: string
): Promise<CreatedRedemptionCode> {
  return adminSessionRequest<CreatedRedemptionCode>(
    `/admin/v1/content-entitlements/${encodeURIComponent(entitlementId)}/redemption-codes`,
    {
      method: 'POST',
      body: JSON.stringify(plainCode ? { plainCode } : {}),
    }
  )
}

export function createRedemptionCodeWithContent(input: {
  title?: string
  plainCode?: string
}): Promise<CreatedRedemptionCodeWithContent> {
  return adminSessionRequest<CreatedRedemptionCodeWithContent>(
    '/admin/v1/content-entitlements/redemption-codes',
    {
      method: 'POST',
      body: JSON.stringify({
        ...(input.title ? { title: input.title } : {}),
        ...(input.plainCode ? { plainCode: input.plainCode } : {}),
      }),
    }
  )
}
