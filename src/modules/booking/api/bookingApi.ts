import type { BookingAcceptPayload, RadarImageResponse } from '../types'
import { request } from '@/api/request'

/** 预约弹窗后端接口 */
export interface BookingApi {
  /** 拉取雷达来车图 — 对齐 Qt onRefreshClicked → GET headurl */
  fetchRadarImage(): Promise<RadarImageResponse | null>
  /** 弹窗打开时初始化 — 对齐 Qt onRefreshOrderDialog */
  onDialogOpen(): Promise<void>
  /** 停止视频对讲 — 对齐 Qt stopSpCamera */
  stopVideoSession(): Promise<void>
  /** 受理 — 对齐 Qt onAcceptClicked 后续调度 */
  acceptBooking(payload: BookingAcceptPayload): Promise<void>
  /** 驳回 — 对齐 Qt onRejectClicked */
  rejectBooking(): Promise<void>
}

const DEFAULT_HEAD_WIDTH = 1.5

/** 真实 HTTP 实现 */
export function createHttpBookingApi(): BookingApi {
  return {
    async fetchRadarImage() {
      const res = await request<RadarImageResponse>('/booking/radar-image')
      if (res.code === 0 && res.data) {
        return res.data
      }
      console.warn('[BookingApi] 雷达图像获取失败:', res.message)
      return null
    },
    async onDialogOpen() {
      // 获取当前预约状态
      await request('/booking/state')
    },
    async stopVideoSession() {
      // 停止视频对讲 — 由后端设备中间层处理
      await request('/booking/stop-video', { method: 'POST' })
    },
    async acceptBooking(payload: BookingAcceptPayload) {
      const res = await request('/booking/accept', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (res.code !== 0) {
        throw new Error(res.message || '受理失败')
      }
    },
    async rejectBooking() {
      const res = await request('/booking/reject', { method: 'POST' })
      if (res.code !== 0) {
        throw new Error(res.message || '驳回失败')
      }
    },
  }
}

/** Mock 实现（开发阶段使用） */
export function createMockBookingApi(): BookingApi {
  return {
    async fetchRadarImage() {
      return null
    },
    async onDialogOpen() {},
    async stopVideoSession() {},
    async acceptBooking() {
      console.info('[BookingApi] mock accept')
    },
    async rejectBooking() {
      console.info('[BookingApi] mock reject')
    },
  }
}

let bookingApi: BookingApi

// 根据环境选择实现
const useMock = import.meta.env.VITE_USE_MOCK === 'true'
if (useMock) {
  bookingApi = createMockBookingApi()
} else {
  bookingApi = createHttpBookingApi()
}

export function getBookingApi(): BookingApi {
  return bookingApi
}

export function setBookingApi(api: BookingApi): void {
  bookingApi = api
}

export { DEFAULT_HEAD_WIDTH }
