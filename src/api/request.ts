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

  // 401 自动跳转登录页（跳过登录接口本身）
  if (res.status === 401 && !path.includes('/auth/login')) {
    localStorage.removeItem('lvtong_token')
    localStorage.removeItem('lvtong_user')
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    throw new Error('登录已过期，请重新登录')
  }

  if (!res.ok) {
    // 优先使用后端返回的错误信息
    let errorMessage = ''
    try {
      const body = await res.json() as ApiResponse<T>
      errorMessage = body.message || ''
    } catch {
      // JSON 解析失败则忽略，使用通用错误
    }
    throw new Error(errorMessage || `请求失败: ${res.status}`)
  }

  return res.json() as Promise<ApiResponse<T>>
}
