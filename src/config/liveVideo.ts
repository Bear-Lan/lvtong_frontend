/**
 * 实时视频 / 预约画面地址
 *
 * - 主页「实时视频」：VisualSurveillance MJPEG（camera4，本机 :8765）
 * - 预约右侧：MediaMTX WHEP cam4（camera4）；对讲另走海康插件
 * - DEFAULT_WHEP_URL 保留给其它可能仍用 cam1 的场景
 */
export const DEFAULT_WHEP_URL =
  (import.meta.env.VITE_WHEP_URL as string | undefined)?.trim() || '/mtx/cam1/whep'

export const TALK_WHEP_URL =
  (import.meta.env.VITE_TALK_WHEP_URL as string | undefined)?.trim() || '/mtx/cam4/whep'

/** 主页实时视频 MJPEG（Vite 代理 → WebStreamDemo :8765） */
export const LIVE_MJPEG_URL =
  (import.meta.env.VITE_LIVE_MJPEG_URL as string | undefined)?.trim() || '/vs/stream.mjpg'

/** VisualSurveillance 状态 API */
export const LIVE_VS_STATUS_URL =
  (import.meta.env.VITE_LIVE_VS_STATUS_URL as string | undefined)?.trim() || '/vs/api/status'

/** 桌面划区程序说明路径（运维本机） */
export const VS_DESKTOP_BAT_HINT =
  (import.meta.env.VITE_VS_DESKTOP_BAT as string | undefined)?.trim() ||
  'E:\\bibl\\visual111\\VisualSurveillance\\启动桌面版.bat'
