import { defineStore } from 'pinia'
import { ref } from 'vue'
import { loginApi, getCurrentUserApi } from '@/api/auth'

export interface UserInfo {
  username: string
  realName: string
  phone: string
  role: number
}

const STORAGE_TOKEN = 'lvtong_token'
const STORAGE_USER = 'lvtong_user'
const STORAGE_REMEMBER = 'lvtong_remember'
const STORAGE_REMEMBERED_USERNAME = 'lvtong_remembered_username'

function store(): Storage {
  return localStorage.getItem(STORAGE_REMEMBER) === '1'
    ? localStorage
    : sessionStorage
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserInfo | null>(null)
  const reviewerPhone = ref('')
  const reviewerName = ref('')
  const loading = ref(false)
  const error = ref('')

  /** 从 localStorage 恢复用户信息 */
  function restoreUser() {
    const saved = localStorage.getItem(STORAGE_USER)
        || sessionStorage.getItem(STORAGE_USER)
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
    usernameStr: string,
    pwd: string,
    reviewer: { phone: string; name: string },
    remember = false,
  ): Promise<boolean> {
    loading.value = true
    error.value = ''

    try {
      const res = await loginApi({ username: usernameStr, password: pwd })

      if (res.code === 0 && res.data) {
        const { token, user: userInfo } = res.data

        // 记住我：localStorage（持久），否则 sessionStorage（关浏览器就清）
        const s = remember ? localStorage : sessionStorage
        s.setItem(STORAGE_TOKEN, token)
        s.setItem(STORAGE_USER, JSON.stringify(userInfo))
        if (remember) {
          localStorage.setItem(STORAGE_REMEMBER, '1')
          localStorage.setItem(STORAGE_REMEMBERED_USERNAME, usernameStr)
        } else {
          localStorage.removeItem(STORAGE_REMEMBER)
          localStorage.removeItem(STORAGE_REMEMBERED_USERNAME)
        }

        user.value = userInfo
        reviewerPhone.value = reviewer.phone
        reviewerName.value = reviewer.name

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

  /** 退出登录（保留记住我信息用于下次自动填充） */
  function logout() {
    user.value = null
    reviewerPhone.value = ''
    reviewerName.value = ''
    error.value = ''
    localStorage.removeItem(STORAGE_TOKEN)
    localStorage.removeItem(STORAGE_USER)
    sessionStorage.removeItem(STORAGE_TOKEN)
    sessionStorage.removeItem(STORAGE_USER)
    // 保留 STORAGE_REMEMBER + STORAGE_REMEMBERED_USERNAME 用于下次登录填充
  }

  /** 获取记住的用户名（退出登录后登录页自动填充） */
  function getRememberedUsername(): string {
    if (localStorage.getItem(STORAGE_REMEMBER) === '1') {
      return localStorage.getItem(STORAGE_REMEMBERED_USERNAME) || ''
    }
    return ''
  }

  /** 班组切换本地更新 — 对齐 Qt signalUsrChange，不请求后端 */
  function applyLocalUserSwitch(
    userInfo: UserInfo,
    reviewer: { phone: string; name: string },
  ) {
    user.value = userInfo
    reviewerPhone.value = reviewer.phone
    reviewerName.value = reviewer.name
    store().setItem(STORAGE_USER, JSON.stringify(userInfo))
  }

  /** 初始化：恢复登录状态 */
  async function initAuth() {
    const token = localStorage.getItem(STORAGE_TOKEN)
        || sessionStorage.getItem(STORAGE_TOKEN)
    if (!token) return

    try {
      const res = await getCurrentUserApi()
      if (res.code === 0 && res.data) {
        user.value = res.data
        store().setItem(STORAGE_USER, JSON.stringify(res.data))
      } else {
        logout()
      }
    } catch {
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
    getRememberedUsername,
    applyLocalUserSwitch,
    restoreUser,
    initAuth,
  }
})
