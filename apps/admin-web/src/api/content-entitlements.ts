import { adminSessionRequest } from './admin-session'

export type CreatedEntitlement = {
  entitlementId: string
  contentId: string
}

export type CreatedRedemptionCode = {
  plainCode: string
  redemptionCodeId: string
}

export function createContentEntitlement(
  title?: string
): Promise<CreatedEntitlement> {
  return adminSessionRequest<CreatedEntitlement>('/admin/v1/content-entitlements', {
    method: 'POST',
    body: JSON.stringify(title ? { title } : {}),
  })
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
