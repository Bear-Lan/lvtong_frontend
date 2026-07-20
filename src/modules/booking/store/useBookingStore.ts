/**
 * 预约全局状态 — 对齐 LvTongPro 预约/检测相关成员
 * 弹窗内临时 UI 状态仍由 useBookingDialog 管理；
 * 受理后的流程状态放这里，供 Dashboard / 后续检测步骤使用。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { BookingAcceptPayload, BookingProcessState } from '../types'
import { DEFAULT_HEAD_WIDTH } from '../api/bookingApi'

export const useBookingStore = defineStore('booking', () => {
  /** 弹窗是否可见 — 对齐 m_pOrderDialog->isVisible */
  const dialogVisible = ref(false)

  /** m_isDetection */
  const isDetection = ref(false)
  /** m_checkstep */
  const checkStep = ref(0)
  /** m_carHeight */
  const carHeight = ref(3.0)
  /** m_carLength（车头长） */
  const carLength = ref(DEFAULT_HEAD_WIDTH)
  /** m_isCheckXRay */
  const isCheckXRay = ref(true)
  /** m_bookingDialogShown */
  const bookingDialogShown = ref(false)
  /** SP 视频流预留 */
  const videoStreamUrl = ref<string | null>(null)

  /** 底部流程「预约」高亮 */
  const bookingActive = computed(() => isDetection.value || checkStep.value > 0)

  function openDialog() {
    if (isDetection.value) {
      // 对齐 Qt：检测中不弹窗，仅提示
      console.warn('[BookingStore] 检测进行中，忽略预约弹窗')
      return false
    }
    dialogVisible.value = true
    bookingDialogShown.value = true
    return true
  }

  function closeDialog() {
    dialogVisible.value = false
  }

  /** 对齐 onOrderAccept */
  function applyAccept(payload: BookingAcceptPayload) {
    carHeight.value = payload.vehicleHeight
    carLength.value = payload.carHeadLength
    isCheckXRay.value = payload.xrayEnabled
    isDetection.value = true
    checkStep.value = 1
    dialogVisible.value = false
  }

  /** 对齐 onOrderReject */
  function applyReject() {
    isDetection.value = false
    checkStep.value = 0
    dialogVisible.value = false
  }

  function setVideoStreamUrl(url: string | null) {
    videoStreamUrl.value = url
  }

  /** 用后端 /state 同步 */
  function syncFromServer(state: BookingProcessState) {
    isDetection.value = !!state.is_detection
    checkStep.value = state.check_step ?? 0
    carHeight.value = state.car_height ?? carHeight.value
    carLength.value = state.car_length ?? carLength.value
    isCheckXRay.value = state.is_check_xray ?? isCheckXRay.value
    bookingDialogShown.value = !!state.booking_dialog_shown
  }

  function reset() {
    dialogVisible.value = false
    isDetection.value = false
    checkStep.value = 0
    carHeight.value = 3.0
    carLength.value = DEFAULT_HEAD_WIDTH
    isCheckXRay.value = true
    bookingDialogShown.value = false
    videoStreamUrl.value = null
  }

  return {
    dialogVisible,
    isDetection,
    checkStep,
    carHeight,
    carLength,
    isCheckXRay,
    bookingDialogShown,
    videoStreamUrl,
    bookingActive,
    openDialog,
    closeDialog,
    applyAccept,
    applyReject,
    setVideoStreamUrl,
    syncFromServer,
    reset,
  }
})
