import type { BookingAcceptPayload, RadarImageResponse } from '../types'

/** 预约弹窗后端接口 — 将来替换为真实 HTTP/WebSocket 实现 */
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

/** 开发阶段 Mock；接入后端时新建 createHttpBookingApi() 替换 */
export function createMockBookingApi(): BookingApi {
  return {
    async fetchRadarImage() {
      // 无后端时返回 null，UI 显示占位
      return null
    },
    async onDialogOpen() {
      // 预留：开闸、LED、视频对讲等
    },
    async stopVideoSession() {
      // 预留：停止摄像头与对讲
    },
    async acceptBooking(payload: BookingAcceptPayload) {
      console.info('[BookingApi] accept', payload)
    },
    async rejectBooking() {
      console.info('[BookingApi] reject')
    },
  }
}

/** 单例，可在 main.ts 或插件中注入真实实现 */
let bookingApi: BookingApi = createMockBookingApi()

export function getBookingApi(): BookingApi {
  return bookingApi
}

export function setBookingApi(api: BookingApi): void {
  bookingApi = api
}

export { DEFAULT_HEAD_WIDTH }
