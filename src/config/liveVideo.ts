/**
 * MediaMTX WHEP 地址（开发环境经 Vite `/mtx` 代理到 http://127.0.0.1:8889）
 *
 * - cam1 ← devices.device_id=camera2 → 主页「实时视频」
 * - cam4 ← devices.device_id=camera4 → 预约弹窗右侧画面（WHEP）；对讲另走海康插件
 */
export const DEFAULT_WHEP_URL =
  (import.meta.env.VITE_WHEP_URL as string | undefined)?.trim() || '/mtx/cam1/whep'

export const TALK_WHEP_URL =
  (import.meta.env.VITE_TALK_WHEP_URL as string | undefined)?.trim() || '/mtx/cam4/whep'
