import { defineStore } from 'pinia'
import { ref } from 'vue'

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

  function login(
    userInfo: UserInfo,
    reviewer: { phone: string; name: string },
    remember = false,
  ) {
    user.value = userInfo
    reviewerPhone.value = reviewer.phone
    reviewerName.value = reviewer.name
    localStorage.setItem('lvtong_token', 'mock-token')
    if (remember) {
      localStorage.setItem('lvtong_remember', '1')
    }
  }

  function logout() {
    user.value = null
    reviewerPhone.value = ''
    reviewerName.value = ''
    localStorage.removeItem('lvtong_token')
  }

  return { user, reviewerPhone, reviewerName, login, logout }
})
