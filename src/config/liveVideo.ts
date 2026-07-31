/**
 * 主页实时视频 WHEP 地址（MediaMTX）
 * 开发环境经 Vite `/mtx` 代理到 http://127.0.0.1:8889
 */
export const DEFAULT_WHEP_URL =
  (import.meta.env.VITE_WHEP_URL as string | undefined)?.trim() || '/mtx/cam1/whep'
