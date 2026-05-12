export type ApiError = {
  code?: string
  message?: string
  details?: unknown
}

export type MemberProfile = {
  memberId: string
  email: string
  displayName: string | null
}

export type LoginResult = MemberProfile & {
  accessToken: string
  refreshToken?: string
}

export type ContentBodyBlock = {
  type: 'paragraph' | 'image' | 'animation'
  text?: string
  url?: string
  caption?: string
}

export type ContentBody = {
  version: 1
  blocks: ContentBodyBlock[]
}

export type ContentRead = {
  id: string
  title: string | null
  body: ContentBody | unknown
  publishStatus: string
  listingState: string
  placeholderKind: string | null
  ownerMemberId: string | null
  createdAt: string
  updatedAt: string
}

export type RedeemResult = {
  contentId: string
  ownerMemberId: string
}

export type CommentItem = {
  id: string
  contentId: string
  authorMemberId: string
  anchorId: string | null
  parentId: string | null
  replyToCommentId: string | null
  body: unknown
  publishStatus: string
  createdAt: string
  updatedAt: string
}

export type PageResult<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export type TransferMethod = 'TRANSFER_CODE' | 'CARD_SHARE'

export type TransferItem = {
  id: string
  method: TransferMethod
  status: string
  expiresAt: string
  createdAt: string
  confirmedAt: string | null
  revokedAt: string | null
}

export type CreateTransferResult = {
  transferId: string
  method: TransferMethod
  expiresAt: string
  transferCode?: string
  cardToken?: string
}

export type NotificationPreference = {
  channelInApp: boolean
  channelMiniProgram: boolean
  updatedAt: string | null
}

export type InAppNotification = {
  id: string
  category: string
  title: string
  body: string
  data: unknown
  readAt: string | null
  createdAt: string
}
