import { computed, onMounted, ref, watch } from 'vue'
import { DEFAULT_HEAD_WIDTH, getBookingApi } from '../api/bookingApi'
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

  const loading = ref(false)
  const radarImageUrl = ref<string | null>(null)
  const linePosition = ref(0.5)
  const imageEnvelope = ref('')
  const vehicleHeaderEnvelope = ref('')
  const originalImageWidth = ref(0)
  const vehicleHeight = ref(3.0)
  const carHeadLength = ref(DEFAULT_HEAD_WIDTH)
  const xrayEnabled = ref(true)
  const confirmVisible = ref(false)
  const pendingConfirm = ref<BookingConfirmConfig | null>(null)

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

  const imgInfoText = computed(() => {
    if (!radarImageUrl.value) return ''
    return `车头长度:${carHeadLength.value.toFixed(2)}米，高度: ${vehicleHeight.value.toFixed(2)}米`
  })

  function updateCarHeadLength() {
    if (originalImageWidth.value <= 0) return
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
    try {
      const data = await api.fetchRadarImage()
      if (!data) return

      radarImageUrl.value = data.imageUrl
      imageEnvelope.value = data.imageEnvelope
      vehicleHeaderEnvelope.value = data.vehicleHeaderEnvelope
      originalImageWidth.value = data.originalImageWidth
      vehicleHeight.value = data.vehicleHeight

      const pos = parseImageEnvelope(data.imageEnvelope, data.originalImageWidth)
      if (pos != null) {
        linePosition.value = pos
      }
      updateCarHeadLength()
    } finally {
      loading.value = false
    }
  }

  async function initDialog() {
    xrayEnabled.value = true
    radarImageUrl.value = null
    linePosition.value = 0.5
    carHeadLength.value = DEFAULT_HEAD_WIDTH
    await api.onDialogOpen()
    await refreshRadarImage()
  }

  function toggleVehicleType() {
    // 对齐 Qt OrderDialog::onCarTypeClicked
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
    }
  }

  onMounted(() => {
    initDialog()
  })

  return {
    loading,
    radarImageUrl,
    linePosition,
    vehicleHeight,
    carHeadLength,
    xrayEnabled,
    confirmVisible,
    pendingConfirm,
    vehicleTypeIcon,
    vehicleTypeTip,
    xrayLabel,
    xrayLabelClass,
    xrayIcon,
    imgInfoText,
    refreshRadarImage,
    toggleVehicleType,
    requestConfirm,
    cancelConfirm,
    buildAcceptPayload,
    api,
  }
}
