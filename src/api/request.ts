import { appConfig } from '@/config/env'

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

/**
 * 统一请求封装
 * - 自动附加 Authorization: Bearer <token>
 * - 401 时清除 token 并跳转登录页
 */
export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('lvtong_token')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${appConfig.apiBaseUrl}${path}`, {
    ...options,
    headers,
  })

  // 401 自动跳转登录页
  if (res.status === 401) {
    localStorage.removeItem('lvtong_token')
    localStorage.removeItem('lvtong_user')
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    throw new Error('登录已过期，请重新登录')
  }

  if (!res.ok) {
    throw new Error(`请求失败: ${res.status}`)
  }

  return res.json() as Promise<ApiResponse<T>>
}
