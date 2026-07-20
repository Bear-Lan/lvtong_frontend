/**
 * 预约端口 — 对齐 Qt OrderDialog 对外能力边界
 *
 * 前端只依赖本接口；Http / Mock 可切换。
 * 后端契约见各方法注释中的 REST / WS 路径。
 */
import type {
  BookingAcceptPayload,
  BookingOpenResult,
  BookingProcessState,
  RadarImageResponse,
} from '../types'

export interface BookingPort {
  /**
   * 拉取雷达车头图
   * 对齐 OrderDialog::onRefreshClicked → GET radar.headurl
   * REST: GET /api/booking/radar-image
   */
  fetchRadarImage(): Promise<RadarImageResponse | null>

  /**
   * 弹窗打开初始化
   * 对齐 OrderDialog::onRefreshOrderDialog
   * （开 SP 预览+对讲、关闸、LED step2、清图、拉雷达）
   * REST: POST /api/booking/open
   */
  openDialog(): Promise<BookingOpenResult>

  /**
   * 停止视频对讲
   * 对齐 OrderDialog::stopSpCamera
   * REST: POST /api/booking/stop-video
   */
  stopVideoSession(): Promise<void>

  /**
   * 受理
   * 对齐 emit carInfo → LvTongPro::onOrderAccept
   * REST: POST /api/booking/accept
   */
  acceptBooking(payload: BookingAcceptPayload): Promise<void>

  /**
   * 驳回 / 关窗等同驳回
   * 对齐 emit orderReject → LvTongPro::onOrderReject
   * REST: POST /api/booking/reject
   */
  rejectBooking(): Promise<void>

  /**
   * 查询检测流程状态
   * REST: GET /api/booking/state
   */
  getState(): Promise<BookingProcessState | null>
}

/** @deprecated 使用 BookingPort */
export type BookingApi = BookingPort
