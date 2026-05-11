<template>
  <view class="content">
    <image class="logo" src="/static/logo.png" />
    <view class="text-area">
      <text class="title">{{ title }}</text>
    </view>
    <!-- #ifdef MP-WEIXIN -->
    <button class="wx-login" @click="wechatMiniProgramLogin">
      微信授权登录
    </button>
    <!-- #endif -->
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const title = ref('Hello')

/** 与后端 **`POST /api/v1/auth/wechat/mini-program`** 对接；须配置 **`VITE_API_BASE`**。 */
async function wechatMiniProgramLogin() {
  const base = (import.meta.env.VITE_API_BASE ?? '').trim().replace(/\/$/, '')
  if (!base) {
    uni.showToast({ title: '请配置 VITE_API_BASE', icon: 'none' })
    return
  }
  const loginRes = await new Promise<UniApp.LoginRes>((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: (r) => resolve(r),
      fail: (e) => reject(e),
    })
  })
  if (!loginRes.code) {
    uni.showToast({ title: '未获取到 code', icon: 'none' })
    return
  }
  await new Promise<void>((resolve, reject) => {
    uni.request({
      url: `${base}/api/v1/auth/wechat/mini-program`,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { code: loginRes.code },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const body = res.data as { success?: boolean; data?: { accessToken?: string } }
          const token = body.data?.accessToken
          if (token) {
            uni.setStorageSync('memberAccessToken', token)
            uni.showToast({ title: '登录成功', icon: 'success' })
          } else {
            uni.showToast({ title: '响应异常', icon: 'none' })
          }
        } else {
          const err = res.data as { error?: { message?: string } }
          uni.showToast({
            title: err.error?.message ?? `HTTP ${res.statusCode}`,
            icon: 'none',
          })
        }
        resolve()
      },
      fail: (e) => reject(e),
    })
  })
}
</script>

<style>
.content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.logo {
  height: 200rpx;
  width: 200rpx;
  margin-top: 200rpx;
  margin-left: auto;
  margin-right: auto;
  margin-bottom: 50rpx;
}

.text-area {
  display: flex;
  justify-content: center;
}

.title {
  font-size: 36rpx;
  color: #8f8f94;
}

.wx-login {
  margin-top: 48rpx;
  width: 520rpx;
  background-color: #07c160;
  color: #fff;
}
</style>
