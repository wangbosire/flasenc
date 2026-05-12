<template>
  <scroll-view scroll-y class="page">
    <view class="hero">
      <view class="hero-topline">
        <text class="pill">内容权益小程序</text>
        <text class="network" :class="{ offline: !apiReady }">
          {{ apiReady ? 'API 已配置' : '待配置 API' }}
        </text>
      </view>
      <text class="hero-title">兑换、创作、发布和转让都在这里完成</text>
      <text class="hero-subtitle">
        面向 C 端用户的 MVP 工作台：拿到兑换码后认领内容，编辑正文，通过审核后开放评论与转让。
      </text>
      <view class="hero-card">
        <view>
          <text class="metric-value">{{ userLabel }}</text>
          <text class="metric-label">当前身份</text>
        </view>
        <view>
          <text class="metric-value">{{ content?.publishStatus ?? '未载入' }}</text>
          <text class="metric-label">内容状态</text>
        </view>
      </view>
    </view>

    <view class="tabs">
      <button
        v-for="item in tabs"
        :key="item.key"
        class="tab-button"
        :class="{ active: activeTab === item.key }"
        @click="activeTab = item.key"
      >
        {{ item.label }}
      </button>
    </view>

    <view v-if="!apiReady" class="notice">
      <text class="notice-title">需要配置接口地址</text>
      <text class="notice-body">
        在 apps/mobile 下配置 VITE_API_BASE，指向 front API 所在源，例如 http://localhost:3000。
      </text>
    </view>

    <view v-show="activeTab === 'redeem'" class="section">
      <view class="section-heading">
        <text class="section-title">登录与兑换</text>
        <text class="section-note">兑换必须登录，成功后自动载入内容草稿。</text>
      </view>

      <view class="panel">
        <view class="field-row">
          <input v-model="authForm.email" class="input" placeholder="邮箱" type="text" />
        </view>
        <view class="field-row">
          <input v-model="authForm.password" class="input" placeholder="密码（至少 8 位）" password />
        </view>
        <view class="action-grid">
          <button class="primary-button" :loading="busy === 'login'" @click="handleLogin">
            登录
          </button>
          <button class="ghost-button" :loading="busy === 'register'" @click="handleRegister">
            注册
          </button>
        </view>
        <!-- #ifdef MP-WEIXIN -->
        <button class="wechat-button" :loading="busy === 'wechat'" @click="wechatMiniProgramLogin">
          微信授权登录
        </button>
        <!-- #endif -->
      </view>

      <view class="panel accent">
        <text class="panel-title">兑换权益码</text>
        <input v-model="redeemForm.code" class="input strong" placeholder="输入兑换码" />
        <button class="primary-button full" :loading="busy === 'redeem'" @click="handleRedeem">
          立即兑换
        </button>
      </view>

      <view class="quick-load">
        <input v-model="contentIdInput" class="input" placeholder="已有内容 ID，可直接查看" />
        <button class="ghost-button compact" :loading="busy === 'loadContent'" @click="loadContent">
          查看
        </button>
      </view>
    </view>

    <view v-show="activeTab === 'content'" class="section">
      <view class="section-heading">
        <text class="section-title">内容编辑</text>
        <text class="section-note">Owner 可编辑草稿或被拒内容，提交后进入机审流水线。</text>
      </view>

      <view v-if="content" class="content-preview">
        <view class="status-row">
          <text class="status-badge">{{ content.publishStatus }}</text>
          <text class="status-badge muted">{{ content.listingState }}</text>
        </view>
        <input v-model="editor.title" class="title-input" placeholder="给内容起一个标题" />
        <textarea
          v-model="editor.bodyText"
          class="textarea"
          placeholder="写下正文。段落之间空一行，提交时会转换成 JSON 文档块。"
          :maxlength="6000"
        />
        <view class="action-grid">
          <button class="primary-button" :loading="busy === 'saveContent'" @click="saveContent">
            保存草稿
          </button>
          <button class="publish-button" :loading="busy === 'publish'" @click="publishContent">
            提交发布
          </button>
        </view>
      </view>

      <view v-else class="empty-state">
        <text class="empty-title">还没有选中的内容</text>
        <text class="empty-body">先兑换权益码，或输入内容 ID 查看已发布内容。</text>
      </view>
    </view>

    <view v-show="activeTab === 'comments'" class="section">
      <view class="section-heading">
        <text class="section-title">评论串</text>
        <text class="section-note">顶层为锚点，回复会挂在锚点下，保持二层结构。</text>
      </view>

      <view v-if="content" class="comment-composer">
        <textarea v-model="commentText" class="comment-input" placeholder="发表一条评论" maxlength="800" />
        <button class="primary-button full" :loading="busy === 'comment'" @click="sendComment">
          {{ replyDraft.anchorId ? '回复当前串' : '发表评论' }}
        </button>
        <button v-if="replyDraft.anchorId" class="text-button" @click="clearReply">取消回复</button>
      </view>

      <view v-if="comments.length" class="comment-list">
        <view v-for="thread in commentThreads" :key="thread.anchor.id" class="comment-thread">
          <view class="comment-anchor">
            <text class="comment-author">用户 {{ shortId(thread.anchor.authorMemberId) }}</text>
            <text class="comment-body">{{ commentBody(thread.anchor.body) }}</text>
            <button class="reply-button" @click="replyTo(thread.anchor, thread.anchor)">回复</button>
          </view>
          <view v-for="reply in thread.replies" :key="reply.id" class="comment-reply">
            <text class="comment-author">回复 {{ shortId(reply.authorMemberId) }}</text>
            <text class="comment-body">{{ commentBody(reply.body) }}</text>
            <button class="reply-button" @click="replyTo(thread.anchor, reply)">回复</button>
          </view>
        </view>
        <button v-if="comments.length < commentTotal" class="ghost-button full" @click="loadMoreComments">
          加载更多
        </button>
      </view>

      <view v-else class="empty-state">
        <text class="empty-title">暂无评论</text>
        <text class="empty-body">内容发布后，登录用户可以在这里开启对话。</text>
      </view>
    </view>

    <view v-show="activeTab === 'transfer'" class="section">
      <view class="section-heading">
        <text class="section-title">转让</text>
        <text class="section-note">Owner 可发起转让码或卡片分享，受让人确认后成为新 Owner。</text>
      </view>

      <view class="panel">
        <view class="action-grid">
          <button class="primary-button" :loading="busy === 'transferCode'" @click="startTransfer('TRANSFER_CODE')">
            生成转让码
          </button>
          <button class="ghost-button" :loading="busy === 'transferCard'" @click="startTransfer('CARD_SHARE')">
            生成卡片
          </button>
        </view>
        <view v-if="lastTransferSecret" class="secret-card">
          <text class="secret-label">{{ lastTransferSecret.label }}</text>
          <text class="secret-value">{{ lastTransferSecret.value }}</text>
          <text class="secret-hint">凭证只返回一次，请立即分享给受让人。</text>
        </view>
      </view>

      <view class="panel">
        <text class="panel-title">确认转让</text>
        <input v-model="confirmForm.transferId" class="input" placeholder="转让单 ID" />
        <input v-model="confirmForm.secret" class="input" placeholder="转让码或卡片凭证" />
        <view class="action-grid">
          <button class="primary-button" :loading="busy === 'confirmTransfer'" @click="confirmByCode">
            用转让码确认
          </button>
          <button class="ghost-button" :loading="busy === 'confirmCard'" @click="confirmByCard">
            用卡片确认
          </button>
        </view>
      </view>

      <view v-if="transfers.length" class="timeline">
        <view v-for="item in transfers" :key="item.id" class="timeline-item">
          <view>
            <text class="timeline-title">{{ item.method }} · {{ item.status }}</text>
            <text class="timeline-sub">截止 {{ formatDate(item.expiresAt) }}</text>
          </view>
          <button v-if="item.status === 'PENDING'" class="mini-danger" @click="revoke(item.id)">撤销</button>
        </view>
      </view>
    </view>

    <view v-show="activeTab === 'notifications'" class="section">
      <view class="section-heading">
        <text class="section-title">通知</text>
        <text class="section-note">控制站内信和小程序订阅消息，并查看系统通知。</text>
      </view>

      <view class="preference-card">
        <view class="switch-row">
          <text>站内信</text>
          <switch :checked="prefs.channelInApp" @change="toggleInApp" />
        </view>
        <view class="switch-row">
          <text>小程序订阅消息</text>
          <switch :checked="prefs.channelMiniProgram" @change="toggleMiniProgram" />
        </view>
      </view>

      <view v-if="notifications.length" class="notification-list">
        <view v-for="item in notifications" :key="item.id" class="notification-item" @click="markRead(item.id)">
          <view>
            <text class="notification-title">{{ item.title }}</text>
            <text class="notification-body">{{ item.body }}</text>
          </view>
          <text class="read-dot" :class="{ read: item.readAt }"></text>
        </view>
      </view>
      <button class="ghost-button full" :loading="busy === 'notifications'" @click="refreshNotifications">
        刷新通知
      </button>
    </view>
  </scroll-view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  confirmTransfer,
  createComment,
  createTransfer,
  getContent,
  getMe,
  getNotificationPreference,
  listComments,
  listNotifications,
  listTransfers,
  loginByWeChatCode,
  loginMember,
  markNotificationRead,
  patchContent,
  patchNotificationPreference,
  redeemCode,
  registerMember,
  revokeTransfer,
  submitPublish,
} from '@/api/front'
import { clearTokens, getAccessToken, hasApiBase, MobileApiError } from '@/api/http'
import type {
  CommentItem,
  ContentRead,
  InAppNotification,
  MemberProfile,
  TransferItem,
  TransferMethod,
} from '@/api/types'
import { bodyFromText, firstText, textFromBody } from '@/utils/content-body'

type TabKey = 'redeem' | 'content' | 'comments' | 'transfer' | 'notifications'

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'redeem', label: '兑换' },
  { key: 'content', label: '内容' },
  { key: 'comments', label: '评论' },
  { key: 'transfer', label: '转让' },
  { key: 'notifications', label: '通知' },
]

const apiReady = computed(() => hasApiBase())
const activeTab = ref<TabKey>('redeem')
const busy = ref('')
const member = ref<MemberProfile | null>(null)
const content = ref<ContentRead | null>(null)
const contentIdInput = ref('')
const commentText = ref('')
const comments = ref<CommentItem[]>([])
const commentPage = ref(1)
const commentTotal = ref(0)
const transfers = ref<TransferItem[]>([])
const notifications = ref<InAppNotification[]>([])
const lastTransferSecret = ref<{ label: string; value: string } | null>(null)

const authForm = reactive({ email: '', password: '' })
const redeemForm = reactive({ code: '' })
const editor = reactive({ title: '', bodyText: '' })
const replyDraft = reactive<{ anchorId?: string; replyToCommentId?: string }>({})
const confirmForm = reactive({ transferId: '', secret: '' })
const prefs = reactive({ channelInApp: true, channelMiniProgram: false })

const userLabel = computed(() => {
  if (member.value) {
    return member.value.displayName || member.value.email || shortId(member.value.memberId)
  }
  return getAccessToken() ? '已登录' : '访客'
})

const commentThreads = computed(() => {
  const anchors = comments.value.filter((item) => !item.anchorId)
  return anchors.map((anchor) => ({
    anchor,
    replies: comments.value.filter((item) => item.anchorId === anchor.id),
  }))
})

onShow(() => {
  if (apiReady.value && getAccessToken()) {
    void hydrateSession()
  }
})

async function run<T>(key: string, task: () => Promise<T>, success?: string): Promise<T | undefined> {
  busy.value = key
  try {
    const result = await task()
    if (success) {
      uni.showToast({ title: success, icon: 'success' })
    }
    return result
  } catch (error) {
    const message = error instanceof MobileApiError ? error.message : '操作失败，请稍后重试'
    uni.showToast({ title: message, icon: 'none' })
    return undefined
  } finally {
    busy.value = ''
  }
}

async function hydrateSession() {
  const me = await run('me', () => getMe())
  if (me) {
    member.value = me
    await refreshNotificationPreference()
    await refreshNotifications()
  } else {
    clearTokens()
  }
}

async function handleRegister() {
  if (!validateAuthForm()) {
    return
  }
  const profile = await run('register', () => registerMember(authForm.email.trim(), authForm.password), '注册成功')
  if (profile) {
    await handleLogin()
  }
}

async function handleLogin() {
  if (!validateAuthForm()) {
    return
  }
  const profile = await run('login', () => loginMember(authForm.email.trim(), authForm.password), '登录成功')
  if (profile) {
    member.value = profile
    await refreshNotificationPreference()
    await refreshNotifications()
  }
}

function validateAuthForm() {
  if (!authForm.email.trim() || authForm.password.length < 8) {
    uni.showToast({ title: '请输入邮箱和至少 8 位密码', icon: 'none' })
    return false
  }
  return true
}

async function wechatMiniProgramLogin() {
  const loginRes = await new Promise<UniApp.LoginRes>((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: (result) => resolve(result),
      fail: (error) => reject(error),
    })
  })
  if (!loginRes.code) {
    uni.showToast({ title: '未获取到微信 code', icon: 'none' })
    return
  }
  const profile = await run('wechat', () => loginByWeChatCode(loginRes.code!), '登录成功')
  if (profile) {
    member.value = profile
    await refreshNotificationPreference()
  }
}

async function handleRedeem() {
  const code = redeemForm.code.trim()
  if (!code) {
    uni.showToast({ title: '请输入兑换码', icon: 'none' })
    return
  }
  const result = await run('redeem', () => redeemCode(code), '兑换成功')
  if (result) {
    contentIdInput.value = result.contentId
    await loadContent()
    activeTab.value = 'content'
  }
}

async function loadContent() {
  const id = contentIdInput.value.trim()
  if (!id) {
    uni.showToast({ title: '请输入内容 ID', icon: 'none' })
    return
  }
  const row = await run('loadContent', () => getContent(id))
  if (row) {
    setContent(row)
    await refreshComments(true)
    await refreshTransfers()
  }
}

function setContent(row: ContentRead) {
  content.value = row
  contentIdInput.value = row.id
  editor.title = row.title ?? ''
  editor.bodyText = textFromBody(row.body)
}

async function saveContent() {
  if (!content.value) {
    return
  }
  const row = await run(
    'saveContent',
    () => patchContent(content.value!.id, editor.title.trim(), bodyFromText(editor.bodyText)),
    '已保存',
  )
  if (row) {
    setContent(row)
  }
}

async function publishContent() {
  if (!content.value) {
    return
  }
  const row = await run('publish', () => submitPublish(content.value!.id), '已提交审核')
  if (row) {
    setContent(row)
  }
}

async function refreshComments(reset = false) {
  if (!content.value) {
    return
  }
  const page = reset ? 1 : commentPage.value
  const result = await run('comments', () => listComments(content.value!.id, page))
  if (result) {
    comments.value = reset ? result.items : comments.value.concat(result.items)
    commentPage.value = result.page
    commentTotal.value = result.total
  }
}

async function loadMoreComments() {
  commentPage.value += 1
  await refreshComments(false)
}

async function sendComment() {
  if (!content.value) {
    uni.showToast({ title: '请先载入内容', icon: 'none' })
    return
  }
  const text = commentText.value.trim()
  if (!text) {
    uni.showToast({ title: '请输入评论内容', icon: 'none' })
    return
  }
  const item = await run(
    'comment',
    () =>
      createComment({
        contentId: content.value!.id,
        text,
        anchorId: replyDraft.anchorId,
        replyToCommentId: replyDraft.replyToCommentId,
      }),
    '已发表',
  )
  if (item) {
    commentText.value = ''
    clearReply()
    await refreshComments(true)
  }
}

function replyTo(anchor: CommentItem, target: CommentItem) {
  replyDraft.anchorId = anchor.id
  replyDraft.replyToCommentId = target.id
  commentText.value = `回复 ${shortId(target.authorMemberId)}：`
}

function clearReply() {
  replyDraft.anchorId = undefined
  replyDraft.replyToCommentId = undefined
}

async function refreshTransfers() {
  if (!content.value) {
    return
  }
  const result = await run('transfers', () => listTransfers(content.value!.id))
  if (result) {
    transfers.value = result.items
  }
}

async function startTransfer(method: TransferMethod) {
  if (!content.value) {
    uni.showToast({ title: '请先载入内容', icon: 'none' })
    return
  }
  const result = await run(
    method === 'TRANSFER_CODE' ? 'transferCode' : 'transferCard',
    () => createTransfer(content.value!.id, method),
    '已生成',
  )
  if (result) {
    confirmForm.transferId = result.transferId
    lastTransferSecret.value = {
      label: method === 'TRANSFER_CODE' ? '转让码' : '卡片凭证',
      value: result.transferCode ?? result.cardToken ?? '',
    }
    await refreshTransfers()
  }
}

async function revoke(transferId: string) {
  await run('revokeTransfer', () => revokeTransfer(transferId), '已撤销')
  await refreshTransfers()
}

async function confirmByCode() {
  const result = await run('confirmTransfer', () =>
    confirmTransfer({
      transferId: confirmForm.transferId.trim(),
      transferCode: confirmForm.secret.trim(),
    }),
  )
  if (result) {
    contentIdInput.value = result.contentId
    await loadContent()
    uni.showToast({ title: '转让已确认', icon: 'success' })
  }
}

async function confirmByCard() {
  const result = await run('confirmCard', () =>
    confirmTransfer({
      transferId: confirmForm.transferId.trim(),
      cardToken: confirmForm.secret.trim(),
    }),
  )
  if (result) {
    contentIdInput.value = result.contentId
    await loadContent()
    uni.showToast({ title: '转让已确认', icon: 'success' })
  }
}

async function refreshNotificationPreference() {
  const result = await run('prefs', () => getNotificationPreference())
  if (result) {
    prefs.channelInApp = result.channelInApp
    prefs.channelMiniProgram = result.channelMiniProgram
  }
}

function switchValue(event: Event) {
  return Boolean((event as unknown as { detail?: { value?: boolean } }).detail?.value)
}

async function toggleInApp(event: Event) {
  const result = await run('prefs', () => patchNotificationPreference({ channelInApp: switchValue(event) }))
  if (result) {
    prefs.channelInApp = result.channelInApp
    prefs.channelMiniProgram = result.channelMiniProgram
  }
}

async function toggleMiniProgram(event: Event) {
  const result = await run('prefs', () =>
    patchNotificationPreference({ channelMiniProgram: switchValue(event) }),
  )
  if (result) {
    prefs.channelInApp = result.channelInApp
    prefs.channelMiniProgram = result.channelMiniProgram
  }
}

async function refreshNotifications() {
  const result = await run('notifications', () => listNotifications(1, 20))
  if (result) {
    notifications.value = result.items
  }
}

async function markRead(notificationId: string) {
  const item = await run('readNotification', () => markNotificationRead(notificationId))
  if (item) {
    notifications.value = notifications.value.map((row) => (row.id === item.id ? item : row))
  }
}

function shortId(id?: string | null) {
  return id ? id.slice(0, 8) : '匿名'
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`
}

function commentBody(body: unknown) {
  return firstText(body, '（空评论）')
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  background: #f4f2ee;
  color: #19201c;
}

.hero {
  padding: 48rpx 32rpx 32rpx;
  background: linear-gradient(145deg, #163b34 0%, #1f5b4d 52%, #e7a84b 100%);
  color: #fff;
}

.hero-topline,
.status-row,
.quick-load,
.switch-row,
.timeline-item,
.notification-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pill,
.network,
.status-badge {
  display: inline-flex;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  line-height: 1;
}

.pill {
  background: rgba(255, 255, 255, 0.18);
}

.network {
  color: #124238;
  background: #f8d589;
}

.network.offline {
  color: #7a2e20;
  background: #ffd3c8;
}

.hero-title {
  display: block;
  margin-top: 42rpx;
  max-width: 660rpx;
  font-size: 54rpx;
  line-height: 1.16;
  font-weight: 800;
}

.hero-subtitle {
  display: block;
  margin-top: 22rpx;
  font-size: 28rpx;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.84);
}

.hero-card {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin-top: 34rpx;
  padding: 26rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.22);
  border-radius: 16rpx;
  background: rgba(11, 45, 39, 0.34);
}

.metric-value,
.metric-label,
.section-title,
.section-note,
.panel-title,
.empty-title,
.empty-body,
.comment-author,
.comment-body,
.timeline-title,
.timeline-sub,
.notification-title,
.notification-body,
.secret-label,
.secret-value,
.secret-hint,
.notice-title,
.notice-body {
  display: block;
}

.metric-value {
  font-size: 28rpx;
  font-weight: 700;
}

.metric-label {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.68);
}

.tabs {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  padding: 22rpx 24rpx 8rpx;
  column-gap: 10rpx;
  background: #f4f2ee;
}

.tab-button {
  height: 64rpx;
  padding: 0;
  border-radius: 12rpx;
  border: 1rpx solid #ddd6ca;
  background: #fffaf1;
  color: #5d625c;
  font-size: 24rpx;
  line-height: 64rpx;
}

.tab-button.active {
  border-color: #1f5b4d;
  background: #1f5b4d;
  color: #fff;
}

.section {
  padding: 26rpx 28rpx 56rpx;
}

.section-heading {
  margin-bottom: 22rpx;
}

.section-title {
  font-size: 38rpx;
  font-weight: 800;
}

.section-note {
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #686f68;
}

.panel,
.content-preview,
.comment-composer,
.preference-card,
.notice,
.empty-state {
  margin-bottom: 22rpx;
  padding: 26rpx;
  border: 1rpx solid #e2dacd;
  border-radius: 16rpx;
  background: #fffdf8;
  box-shadow: 0 16rpx 38rpx rgba(48, 39, 24, 0.08);
}

.panel.accent {
  border-color: #e7bd68;
  background: #fff8e9;
}

.panel-title {
  margin-bottom: 18rpx;
  font-size: 28rpx;
  font-weight: 800;
}

.input,
.textarea,
.title-input,
.comment-input {
  width: 100%;
  box-sizing: border-box;
  border: 1rpx solid #ddd6ca;
  border-radius: 12rpx;
  background: #ffffff;
  color: #1d2520;
  font-size: 28rpx;
}

.input,
.title-input {
  height: 86rpx;
  padding: 0 24rpx;
}

.field-row {
  margin-bottom: 18rpx;
}

.input.strong {
  border-color: #d3942e;
  font-weight: 700;
}

.textarea {
  height: 430rpx;
  padding: 22rpx 24rpx;
  line-height: 1.6;
}

.title-input {
  margin: 18rpx 0;
  font-size: 34rpx;
  font-weight: 800;
}

.comment-input {
  height: 180rpx;
  padding: 20rpx 22rpx;
  line-height: 1.55;
}

.action-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
  margin-top: 18rpx;
}

.primary-button,
.ghost-button,
.publish-button,
.wechat-button {
  height: 82rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
  line-height: 82rpx;
}

.primary-button {
  color: #fff;
  background: #1f5b4d;
}

.publish-button {
  color: #20170a;
  background: #e7a84b;
}

.ghost-button {
  color: #1f5b4d;
  border: 1rpx solid #1f5b4d;
  background: #fffdf8;
}

.wechat-button {
  margin-top: 18rpx;
  color: #fff;
  background: #07c160;
}

.full {
  width: 100%;
  margin-top: 18rpx;
}

.compact {
  flex: 0 0 150rpx;
  margin-left: 16rpx;
}

.status-badge {
  color: #124238;
  background: #dff1e9;
}

.status-badge.muted {
  color: #684510;
  background: #f8e4b6;
}

.empty-state {
  text-align: center;
}

.empty-title {
  font-size: 30rpx;
  font-weight: 800;
}

.empty-body,
.notice-body {
  margin-top: 10rpx;
  font-size: 25rpx;
  line-height: 1.55;
  color: #777168;
}

.comment-thread,
.timeline,
.notification-list {
  margin-top: 18rpx;
}

.comment-anchor,
.comment-reply,
.timeline-item,
.notification-item {
  margin-bottom: 16rpx;
  padding: 22rpx;
  border-radius: 14rpx;
  background: #fffdf8;
  border: 1rpx solid #e4dccc;
}

.comment-reply {
  margin-left: 44rpx;
  border-color: #d9e9e1;
  background: #f8fffb;
}

.comment-author,
.timeline-sub,
.notification-body {
  font-size: 22rpx;
  color: #778078;
}

.comment-body,
.timeline-title,
.notification-title {
  margin-top: 8rpx;
  font-size: 28rpx;
  line-height: 1.5;
  font-weight: 700;
}

.reply-button,
.text-button,
.mini-danger {
  display: inline-block;
  height: 54rpx;
  margin-top: 14rpx;
  padding: 0 18rpx;
  border-radius: 10rpx;
  font-size: 23rpx;
  line-height: 54rpx;
}

.reply-button,
.text-button {
  color: #1f5b4d;
  background: #eaf5f0;
}

.mini-danger {
  color: #8d2b1d;
  background: #ffe2dc;
}

.secret-card {
  margin-top: 20rpx;
  padding: 22rpx;
  border-radius: 14rpx;
  background: #1f2f2a;
  color: #fff;
}

.secret-label,
.secret-hint {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.72);
}

.secret-value {
  margin: 10rpx 0;
  font-size: 30rpx;
  font-weight: 800;
  word-break: break-all;
}

.switch-row {
  min-height: 88rpx;
  border-bottom: 1rpx solid #eee5d7;
  font-size: 28rpx;
}

.switch-row:last-child {
  border-bottom: 0;
}

.read-dot {
  width: 18rpx;
  height: 18rpx;
  flex: 0 0 18rpx;
  margin-left: 18rpx;
  border-radius: 999rpx;
  background: #e65d43;
}

.read-dot.read {
  background: #b7bdb6;
}

.notice {
  margin: 22rpx 28rpx 0;
  background: #fff3e8;
  border-color: #f1bf92;
}

.notice-title {
  font-size: 28rpx;
  font-weight: 800;
  color: #7d351d;
}
</style>
