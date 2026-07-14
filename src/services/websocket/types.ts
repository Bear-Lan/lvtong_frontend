/** WebSocket 连接状态 */
export type WsConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'closed'
  | 'error'

/** 后端 → 前端 消息类型（按业务扩展） */
export const WsMessageType = {
  DeviceStatus: 'device_status',
  VehicleInfo: 'vehicle_info',
  ImageUpdate: 'image_update',
  BookingRequest: 'booking_request',
  VideoSignal: 'video_signal',
  Pong: 'pong',
  Error: 'error',
} as const

export type WsMessageType =
  (typeof WsMessageType)[keyof typeof WsMessageType]

/** 前端 → 后端 消息类型 */
export const WsOutgoingType = {
  Ping: 'ping',
  BookingAction: 'booking_action',
  CaptureCommand: 'capture_command',
  Subscribe: 'subscribe',
} as const

export type WsOutgoingType =
  (typeof WsOutgoingType)[keyof typeof WsOutgoingType]

export interface WsEnvelope<T = unknown> {
  type: WsMessageType | WsOutgoingType | string
  timestamp?: number
  data?: T
}

export type WsMessageHandler<T = unknown> = (payload: WsEnvelope<T>) => void

export interface WsClientOptions {
  url: string
  protocols?: string | string[]
  reconnectMaxRetries?: number
  heartbeatInterval?: number
  onStatusChange?: (status: WsConnectionStatus) => void
  onMessage?: WsMessageHandler
  onError?: (event: Event) => void
}
