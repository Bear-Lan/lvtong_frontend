import { defineStore } from 'pinia'
import { ref } from 'vue'
import { loginApi, getCurrentUserApi } from '@/api/auth'

export interface UserInfo {
  username: string
  realName: string
  phone: string
  role: number
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserInfo | null>(null)
  const reviewerPhone = ref('')
  const reviewerName = ref('')
  const loading = ref(false)
  const error = ref('')

  /** 从 localStorage 恢复用户信息 */
  function restoreUser() {
    const saved = localStorage.getItem('lvtong_user')
    if (saved) {
      try {
        user.value = JSON.parse(saved)
      } catch {
        // ignore
      }
    }
  }

  /** 登录 */
  async function login(
    username: string,
    password: string,
    reviewer: { phone: string; name: string },
    remember = false,
  ): Promise<boolean> {
    loading.value = true
    error.value = ''

    try {
      const res = await loginApi({ username, password })

      if (res.code === 0 && res.data) {
        const { token, user: userInfo } = res.data

        // 保存 token
        localStorage.setItem('lvtong_token', token)

        // 保存用户信息
        user.value = userInfo
        localStorage.setItem('lvtong_user', JSON.stringify(userInfo))

        // 保存复核人信息
        reviewerPhone.value = reviewer.phone
        reviewerName.value = reviewer.name

        if (remember) {
          localStorage.setItem('lvtong_remember', '1')
        }

        return true
      }

      error.value = res.message || '登录失败'
      return false
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : '登录请求失败'
      return false
    } finally {
      loading.value = false
    }
  }

  /** 退出登录 */
  function logout() {
    user.value = null
    reviewerPhone.value = ''
    reviewerName.value = ''
    error.value = ''
    localStorage.removeItem('lvtong_token')
    localStorage.removeItem('lvtong_user')
  }

  /** 班组切换本地更新 — 对齐 Qt signalUsrChange，不请求后端 */
  function applyLocalUserSwitch(
    userInfo: UserInfo,
    reviewer: { phone: string; name: string },
  ) {
    user.value = userInfo
    reviewerPhone.value = reviewer.phone
    reviewerName.value = reviewer.name
    localStorage.setItem('lvtong_user', JSON.stringify(userInfo))
  }

  /** 初始化：恢复登录状态 */
  async function initAuth() {
    const token = localStorage.getItem('lvtong_token')
    if (!token) return

    try {
      const res = await getCurrentUserApi()
      if (res.code === 0 && res.data) {
        user.value = res.data
        localStorage.setItem('lvtong_user', JSON.stringify(res.data))
      } else {
        logout()
      }
    } catch {
      // token 无效，清除
      logout()
    }
  }

  return {
    user,
    reviewerPhone,
    reviewerName,
    loading,
    error,
    login,
    logout,
    applyLocalUserSwitch,
    restoreUser,
    initAuth,
  }
})
