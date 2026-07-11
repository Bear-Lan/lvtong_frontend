const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  })
  if (!res.ok) {
    throw new Error(`请求失败: ${res.status}`)
  }
  return res.json() as Promise<T>
}
