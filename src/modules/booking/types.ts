/** 货车尺寸类型 — 对齐 Qt OrderDialog btnVehicleType */
export type VehicleSizeType = 'small' | 'big'

/** 雷达来车图响应 — 对齐 Qt OrderDialog::onRequestFinished 响应头 */
export interface RadarImageResponse {
  /** 图片可访问 URL 或 blob URL */
  imageUrl: string
  imageEnvelope: string
  imageResolution: string
  vehicleHeaderEnvelope: string
  vehicleHeight: number
  originalImageWidth: number
  originalImageHeight: number
}

/** 受理提交载荷 — 对齐 Qt emit carInfo(height, length, xrayChecked) */
export interface BookingAcceptPayload {
  vehicleHeight: number
  carHeadLength: number
  xrayEnabled: boolean
  linePosition: number
}

export type BookingConfirmKind = 'accept' | 'reject' | 'close'

export interface BookingConfirmConfig {
  kind: BookingConfirmKind
  title: string
  message: string
}
