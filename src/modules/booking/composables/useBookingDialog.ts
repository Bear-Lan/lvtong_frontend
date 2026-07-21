/**
 * 预约弹窗控制器 — 对齐 OrderDialog 槽函数与局部状态
 */
import { computed, onMounted, ref, watch } from 'vue'
import { DEFAULT_HEAD_WIDTH, getBookingApi } from '../api/bookingApi'
import { useBookingStore } from '../store/useBookingStore'
import type { BookingAcceptPayload, BookingConfirmConfig, VehicleSizeType } from '../types'
import {
  calcCarHeadLength,
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
      // 无图时保持默认车头长，仍可手动改线位置后按默认宽兜底
      carHeadLength.value = Math.max(carHeadLength.value, DEFAULT_HEAD_WIDTH)
      return
    }
    carHeadLength.value = calcCarHeadLength(
      linePosition.value,
      originalImageWidth.value,
      imageEnvelope.value,
      vehicleHeaderEnvelope.value,
      DEFAULT_HEAD_WIDTH,
    )
  }

  watch(linePosition, updateCarHeadLength)

  async function refreshRadarImage() {
    loading.value = true
    errorMessage.value = ''
    try {
      const data = await api.fetchRadarImage()
      if (!data) {
        radarImageUrl.value = null
        return
      }

      radarImageUrl.value = data.imageUrl || null
      imageEnvelope.value = data.imageEnvelope || ''
      vehicleHeaderEnvelope.value = data.vehicleHeaderEnvelope || ''
      originalImageWidth.value = data.originalImageWidth || 0
      if (data.vehicleHeight > 0) {
        vehicleHeight.value = data.vehicleHeight
      }

      const pos = parseImageEnvelope(data.imageEnvelope, data.originalImageWidth)
      if (pos != null) {
        linePosition.value = pos
      }
      updateCarHeadLength()
    } catch (e) {
      errorMessage.value = e instanceof Error ? e.message : '雷达图获取失败'
      radarImageUrl.value = null
    } finally {
      loading.value = false
    }
  }

  /** 对齐 onRefreshOrderDialog */
  async function initDialog() {
    xrayEnabled.value = true
    radarImageUrl.value = null
    linePosition.value = 0.5
    carHeadLength.value = DEFAULT_HEAD_WIDTH
    vehicleHeight.value = 3.0
    imageEnvelope.value = ''
    vehicleHeaderEnvelope.value = ''
    originalImageWidth.value = 0
    errorMessage.value = ''

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

    await refreshRadarImage()
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
    return {
      vehicleHeight: vehicleHeight.value,
      carHeadLength: carHeadLength.value,
      xrayEnabled: xrayEnabled.value,
      linePosition: linePosition.value,
      acceptanceTime: new Date().toISOString(),
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
        return { kind: 'accept', payload }
      }

      await api.rejectBooking()
      bookingStore.applyReject()
      return { kind: 'reject' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '操作失败'
      errorMessage.value = msg
      // 确认失败时保持对话框打开以便用户看到错误
      return null
    } finally {
      submitting.value = false
    }
  }

  onMounted(() => {
    initDialog()
  })

  return {
    loading,
    submitting,
    radarImageUrl,
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
    api,
  }
}
