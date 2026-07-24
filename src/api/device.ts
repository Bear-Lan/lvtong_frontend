import { request } from './request'

/** 海康 Web 预览登录配置（来自 devices 表） */
export interface DevicePreviewConfig {
  deviceId: string
  deviceName?: string
  deviceType?: string
  ip: string
  port: number
  username: string
  password: string
  channelId: number
  streamType: number
  protocol: number
  zeroChannel: boolean
}

/**
 * 读取摄像头 Web 预览配置
 * GET /api/device/<deviceId>/preview-config
 */
export function getDevicePreviewConfigApi(deviceId: string) {
  return request<DevicePreviewConfig>(
    `/device/${encodeURIComponent(deviceId)}/preview-config`,
  )
}
