/**
 * 预约弹窗控制器 — 对齐 OrderDialog 槽函数与局部状态
 */
import { computed, ref, watch } from 'vue'
import { DEFAULT_HEAD_WIDTH, getBookingApi } from '../api/bookingApi'
import { useBookingStore } from '../store/useBookingStore'
import type { BookingAcceptPayload, BookingConfirmConfig, VehicleSizeType } from '../types'
import {
  calcCarHeadLength,
  defaultLinePositionAfterOrigin,
  envelopeFirstNumber,
  parseImageEnvelope,
  toggleVehicleHeight,
  vehicleTypeFromRadarHeight,
} from '../utils/bookingMath'

const CONFIRM_TEXT: Record<string, BookingConfirmConfig> = {
  accept: { kind: 'accept', title: '受理确认', message: '确定受理此操作吗？' },
  reject: { kind: 'reject', title: '驳回确认', message: '确定要驳回此操作吗？' },
  close: { kind: 'close', title: '确认关闭', message: '确定要关闭对话框吗？' },
}

export function useBookingDialog() {
  const api = getBookingApi()
  const bookingStore = useBookingStore()

  const loading = ref(false)
  const submitting = ref(false)
  const radarImageUrl = ref<string | null>(null)
  /** 雷达拉取已最终失败（重试用尽）— 允许驳回，受理仍需有图 */
  const radarFetchFailed = ref(false)
  const radarRetryAttempt = ref(0)
  const linePosition = ref(0.5) // 对齐 ImageLabelWithLine 默认中间
  const imageEnvelope = ref('')
  const vehicleHeaderEnvelope = ref('')
  const originalImageWidth = ref(0)
  const vehicleHeight = ref(3.0)
  const carHeadLength = ref(DEFAULT_HEAD_WIDTH)
  const xrayEnabled = ref(true)
  const confirmVisible = ref(false)
  const pendingConfirm = ref<BookingConfirmConfig | null>(null)
  const errorMessage = ref('')

  const vehicleType = computed<VehicleSizeType>(() =>
    vehicleTypeFromRadarHeight(vehicleHeight.value),
  )

  const vehicleTypeIcon = computed(() =>
    vehicleType.value === 'big'
      ? '/assets/img/vehicle_big.png'
      : '/assets/img/vehicle_small.png',
  )

  const vehicleTypeTip = computed(() =>
    vehicleType.value === 'big' ? '货车类型:大型' : '货车类型:小型',
  )

  const xrayLabel = computed(() => (xrayEnabled.value ? '透视开' : '透视关'))
  const xrayLabelClass = computed(() => (xrayEnabled.value ? 'is-on' : 'is-off'))
  const xrayIcon = computed(() =>
    xrayEnabled.value ? '/assets/img/xray_open.png' : '/assets/img/xray_close.png',
  )

  /** 对齐 label_imginfo：有数值即显示（不依赖是否有图） */
  const imgInfoText = computed(
    () =>
      `车头长度: ${carHeadLength.value.toFixed(2)}米，高度: ${vehicleHeight.value.toFixed(2)}米`,
  )

  const videoStreamUrl = computed(() => bookingStore.videoStreamUrl)

  function updateCarHeadLength() {
    if (originalImageWidth.value <= 0) {
      // 无原图宽度时无法按像素换算，只能保持默认
      carHeadLength.value = DEFAULT_HEAD_WIDTH
      return
    }
    const next = calcCarHeadLength(
      linePosition.value,
      originalImageWidth.value,
      imageEnvelope.value,
      vehicleHeaderEnvelope.value,
      DEFAULT_HEAD_WIDTH,
    )
    carHeadLength.value = next
  }

  watch(linePosition, updateCarHeadLength)

  async function refreshRadarImage(options?: { maxRetries?: number }) {
    const maxRetries = Math.max(1, options?.maxRetries ?? 2)
    loading.value = true
    errorMessage.value = ''
    radarFetchFailed.value = false
    radarRetryAttempt.value = 0

    let lastErr = ''
    try {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        radarRetryAttempt.value = attempt
        try {
          const data = await api.fetchRadarImage()
          if (data?.imageUrl) {
            radarImageUrl.value = data.imageUrl
            imageEnvelope.value = data.imageEnvelope || ''
            vehicleHeaderEnvelope.value = data.vehicleHeaderEnvelope || ''
            originalImageWidth.value = data.originalImageWidth || 0
            if (data.vehicleHeight > 0) {
              vehicleHeight.value = data.vehicleHeight
            }

            console.info(
              '[Booking] radar meta',
              `attempt=${attempt}/${maxRetries}`,
              `w=${originalImageWidth.value}`,
              `env=${imageEnvelope.value || '-'}`,
              `hdr=${vehicleHeaderEnvelope.value || '-'}`,
              `originX=${data.contentOriginX ?? '-'}`,
            )

            const width = data.originalImageWidth || 0
            const fromEnvelope = parseImageEnvelope(data.imageEnvelope, width)
            if (fromEnvelope != null) {
              linePosition.value = fromEnvelope
            } else {
              const originPx =
                typeof data.contentOriginX === 'number' && data.contentOriginX > 0
                  ? data.contentOriginX
                  : envelopeFirstNumber(data.vehicleHeaderEnvelope || '')
              const fromOrigin = defaultLinePositionAfterOrigin(
                originPx,
                width,
                DEFAULT_HEAD_WIDTH,
              )
              if (fromOrigin != null) {
                linePosition.value = fromOrigin
              }
            }
            updateCarHeadLength()
            radarFetchFailed.value = false
            errorMessage.value = ''
            return
          }
          lastErr = '雷达未返回图像'
        } catch (e) {
          lastErr = e instanceof Error ? e.message : '雷达图获取失败'
          console.warn(`[Booking] radar attempt ${attempt}/${maxRetries}:`, lastErr)
        }

        if (attempt < maxRetries) {
          errorMessage.value = `雷达图获取失败，正在重试（${attempt}/${maxRetries}）…`
          await new Promise((r) => setTimeout(r, 1200))
        }
      }

      radarImageUrl.value = null
      originalImageWidth.value = 0
      radarFetchFailed.value = true
      errorMessage.value = `${lastErr || '雷达图获取失败'}（可点刷新重试；无图时仍可驳回）`
    } finally {
      loading.value = false
      radarRetryAttempt.value = 0
    }
  }

  /** 对齐 onRefreshOrderDialog；open 会阻塞播报 step2（约数秒） */
  async function initDialog(opts?: { fetchRadar?: boolean }) {
    xrayEnabled.value = true
    radarImageUrl.value = null
    linePosition.value = 0.5
    carHeadLength.value = DEFAULT_HEAD_WIDTH
    vehicleHeight.value = 3.0
    imageEnvelope.value = ''
    vehicleHeaderEnvelope.value = ''
    originalImageWidth.value = 0
    errorMessage.value = ''
    radarFetchFailed.value = false

    try {
      const openResult = await api.openDialog()
      if (openResult.videoStreamUrl) {
        bookingStore.setVideoStreamUrl(openResult.videoStreamUrl)
      }
      if (openResult.state) {
        bookingStore.syncFromServer(openResult.state)
      }
    } catch (e) {
      console.warn('[BookingDialog] openDialog 失败:', e)
    }

    if (opts?.fetchRadar === false) {
      return
    }
    await refreshRadarImage({ maxRetries: 2 })
  }

  /** 对齐 onCarTypeClicked */
  function toggleVehicleType() {
    vehicleHeight.value = toggleVehicleHeight(vehicleHeight.value)
  }

  function requestConfirm(kind: keyof typeof CONFIRM_TEXT) {
    pendingConfirm.value = CONFIRM_TEXT[kind]
    confirmVisible.value = true
  }

  function cancelConfirm() {
    confirmVisible.value = false
    pendingConfirm.value = null
  }

  function buildAcceptPayload(): BookingAcceptPayload {
    // acceptanceTime 由后端在受理时打点（对齐 Qt QDateTime::currentDateTime()），前端不再生成
    return {
      vehicleHeight: vehicleHeight.value,
      carHeadLength: carHeadLength.value,
      xrayEnabled: xrayEnabled.value,
      linePosition: linePosition.value,
      radarHeadImageUrl: radarImageUrl.value || undefined,
    }
  }

  /**
   * 确认框「是」
   * accept → stopSpCamera + accept API + store
   * reject/close → stopSpCamera + reject API + store
   */
  async function confirmYes(): Promise<
    { kind: 'accept'; payload: BookingAcceptPayload } | { kind: 'reject' } | null
  > {
    const kind = pendingConfirm.value?.kind
    confirmVisible.value = false
    pendingConfirm.value = null
    if (!kind) return null

    submitting.value = true
    try {
      await api.stopVideoSession()
      bookingStore.setVideoStreamUrl(null)

      if (kind === 'accept') {
        const payload = buildAcceptPayload()
        await api.acceptBooking(payload)
        bookingStore.applyAccept(payload)
        // 出图由 flask 受理后的占位/硬件拉图 + WS image_ready 负责，不再调 mock_back
        return { kind: 'accept', payload }
      }

      await api.rejectBooking()
      bookingStore.applyReject()
      return { kind: 'reject' }
    } catch (e) {
      errorMessage.value = e instanceof Error ? e.message : '操作失败'
      throw e
    } finally {
      submitting.value = false
    }
  }

  return {
    loading,
    submitting,
    radarImageUrl,
    radarFetchFailed,
    linePosition,
    vehicleHeight,
    carHeadLength,
    xrayEnabled,
    confirmVisible,
    pendingConfirm,
    errorMessage,
    vehicleTypeIcon,
    vehicleTypeTip,
    xrayLabel,
    xrayLabelClass,
    xrayIcon,
    imgInfoText,
    videoStreamUrl,
    refreshRadarImage,
    toggleVehicleType,
    requestConfirm,
    cancelConfirm,
    buildAcceptPayload,
    confirmYes,
    initDialog,
    api,
  }
}
