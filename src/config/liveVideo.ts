/**
 * 实时视频 / 预约画面地址
 *
 * - 主页「实时视频」：multipart MJPEG（/api/live/stream.mjpg，带检测框叠加）
 * - 预约右侧：MediaMTX WHEP cam4；对讲另走海康插件
 */
export const DEFAULT_WHEP_URL =
  (import.meta.env.VITE_WHEP_URL as string | undefined)?.trim() || '/mtx/cam1/whep'

export const TALK_WHEP_URL =
  (import.meta.env.VITE_TALK_WHEP_URL as string | undefined)?.trim() || '/mtx/cam4/whep'

/** 主页实时视频 MJPEG（Flask /api/live/stream.mjpg，含检测框） */
export const LIVE_MJPEG_URL =
  (import.meta.env.VITE_LIVE_MJPEG_URL as string | undefined)?.trim() ||
  '/api/live/stream.mjpg'

/** 单帧 JPEG（调试/缩略图可选） */
export const LIVE_FRAME_URL =
  (import.meta.env.VITE_LIVE_FRAME_URL as string | undefined)?.trim() ||
  '/api/live/frame.jpg'

/** 内置检测服务状态 API（经 request → /api/live/status） */
export const LIVE_STATUS_PATH =
  (import.meta.env.VITE_LIVE_STATUS_PATH as string | undefined)?.trim() || '/live/status'

/** 触发重连 */
export const LIVE_RECONNECT_PATH =
  (import.meta.env.VITE_LIVE_RECONNECT_PATH as string | undefined)?.trim() ||
  '/live/reconnect'

/** 区域只读列表 */
export const LIVE_ZONES_PATH =
  (import.meta.env.VITE_LIVE_ZONES_PATH as string | undefined)?.trim() || '/live/zones'

/** 区域保存 */
export const LIVE_ZONES_SAVE_PATH =
  (import.meta.env.VITE_LIVE_ZONES_SAVE_PATH as string | undefined)?.trim() ||
  '/live/zones'

/** 告警列表 */
export const LIVE_ALARMS_PATH =
  (import.meta.env.VITE_LIVE_ALARMS_PATH as string | undefined)?.trim() || '/live/alarms'
