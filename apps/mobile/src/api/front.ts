import { apiRequest, saveTokens } from './http'
import type {
  CommentItem,
  ContentBody,
  ContentRead,
  CreateTransferResult,
  InAppNotification,
  LoginResult,
  MemberProfile,
  NotificationPreference,
  PageResult,
  RedeemResult,
  TransferItem,
  TransferMethod,
} from './types'

export async function registerMember(email: string, password: string) {
  return apiRequest<MemberProfile>({
    path: '/api/v1/auth/register',
    method: 'POST',
    data: { email, password },
    auth: false,
  })
}

export async function loginMember(email: string, password: string) {
  const result = await apiRequest<LoginResult>({
    path: '/api/v1/auth/login',
    method: 'POST',
    data: { email, password },
    auth: false,
  })
  saveTokens(result)
  return result
}

export async function loginByWeChatCode(code: string) {
  const result = await apiRequest<LoginResult>({
    path: '/api/v1/auth/wechat/mini-program',
    method: 'POST',
    data: { code },
    auth: false,
  })
  saveTokens(result)
  return result
}

export function getMe() {
  return apiRequest<MemberProfile>({ path: '/api/v1/auth/me' })
}

export function patchMe(displayName: string | null) {
  return apiRequest<MemberProfile>({
    path: '/api/v1/auth/me',
    method: 'PATCH',
    data: { displayName },
  })
}

export function redeemCode(code: string) {
  return apiRequest<RedeemResult>({
    path: '/api/v1/redemption-codes/actions/redeem',
    method: 'POST',
    data: { code },
  })
}

export function getContent(contentId: string) {
  return apiRequest<ContentRead>({
    path: `/api/v1/contents/${encodeURIComponent(contentId)}`,
  })
}

export function patchContent(contentId: string, title: string, body: ContentBody) {
  return apiRequest<ContentRead>({
    path: `/api/v1/contents/${encodeURIComponent(contentId)}`,
    method: 'PATCH',
    data: { title, body },
  })
}

export function submitPublish(contentId: string) {
  return apiRequest<ContentRead>({
    path: `/api/v1/contents/${encodeURIComponent(contentId)}/actions/submit-publish`,
    method: 'POST',
  })
}

export function listComments(contentId: string, page: number, pageSize = 20) {
  return apiRequest<PageResult<CommentItem>>({
    path: `/api/v1/contents/${encodeURIComponent(contentId)}/comments`,
    query: { page, pageSize },
  })
}

export function createComment(params: {
  contentId: string
  text: string
  anchorId?: string
  replyToCommentId?: string
}) {
  return apiRequest<CommentItem>({
    path: `/api/v1/contents/${encodeURIComponent(params.contentId)}/comments`,
    method: 'POST',
    data: {
      body: { version: 1, blocks: [{ type: 'paragraph', text: params.text }] },
      anchorId: params.anchorId,
      replyToCommentId: params.replyToCommentId,
    },
  })
}

export function listTransfers(contentId: string, page = 1, pageSize = 20) {
  return apiRequest<PageResult<TransferItem>>({
    path: `/api/v1/contents/${encodeURIComponent(contentId)}/transfers`,
    query: { page, pageSize },
  })
}

export function createTransfer(contentId: string, method: TransferMethod) {
  return apiRequest<CreateTransferResult>({
    path: `/api/v1/contents/${encodeURIComponent(contentId)}/transfers`,
    method: 'POST',
    data: { method },
  })
}

export function revokeTransfer(transferId: string) {
  return apiRequest<{ ok: true }>({
    path: `/api/v1/transfers/${encodeURIComponent(transferId)}/actions/revoke`,
    method: 'POST',
  })
}

export function confirmTransfer(params: {
  transferId: string
  transferCode?: string
  cardToken?: string
}) {
  return apiRequest<{ ok: true; contentId: string }>({
    path: `/api/v1/transfers/${encodeURIComponent(params.transferId)}/actions/confirm`,
    method: 'POST',
    data: {
      transferCode: params.transferCode || undefined,
      cardToken: params.cardToken || undefined,
    },
  })
}

export function getNotificationPreference() {
  return apiRequest<NotificationPreference>({
    path: '/api/v1/member-notification-preferences',
  })
}

export function patchNotificationPreference(data: {
  channelInApp?: boolean
  channelMiniProgram?: boolean
}) {
  return apiRequest<NotificationPreference>({
    path: '/api/v1/member-notification-preferences',
    method: 'PATCH',
    data,
  })
}

export function listNotifications(page = 1, pageSize = 20, onlyUnread = false) {
  return apiRequest<PageResult<InAppNotification>>({
    path: '/api/v1/in-app-notifications',
    query: { page, pageSize, onlyUnread },
  })
}

export function markNotificationRead(notificationId: string) {
  return apiRequest<InAppNotification>({
    path: `/api/v1/in-app-notifications/${encodeURIComponent(notificationId)}`,
    method: 'PATCH',
  })
}
