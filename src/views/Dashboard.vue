<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/useAuthStore'
import { useWsStore } from '@/stores/useWsStore'
import { request } from '@/api/request'

import AppHeader from '@/components/AppHeader.vue'
import type { ToolAnchor } from '@/components/AppHeader.vue'
import BodyPointCloudPanel from '@/components/BodyPointCloudPanel.vue'
import PreviewButton from '@/components/PreviewButton.vue'
import BottomWorkflowPanel from '@/components/BottomWorkflowPanel.vue'
import type { WorkflowStepKey } from '@/components/WorkflowIcons.vue'
import BookingDialog from '@/modules/booking/BookingDialog.vue'
import TalkDialog from '@/components/TalkDialog.vue'
import DangerZoneDialog from '@/components/DangerZoneDialog.vue'
import AgriculturalSelect from '@/components/AgriculturalSelect.vue'
import LicensePlateEdit from '@/components/LicensePlateEdit.vue'
import CarSizeDialog from '@/components/CarSizeDialog.vue'
import DeviceStatusPanel from '@/components/DeviceStatusPanel.vue'
import PlcControlDialog from '@/components/PlcControlDialog.vue'
import AiStatusDialog from '@/components/AiStatusDialog.vue'
import UserManager from '@/components/UserManager.vue'
import QtMessageBox from '@/components/common/QtMessageBox.vue'
import HistoryDialog from '@/modules/history/HistoryDialog.vue'
import DetailDialog from '@/modules/history/DetailDialog.vue'
import type { InspectionDetail } from '@/modules/history'
import CaptureCameraDialog from '@/components/capture/CaptureCameraDialog.vue'
import type { CaptureKind } from '@/components/capture/CaptureCameraDialog.vue'
import DrivingLicenseDialog from '@/components/capture/DrivingLicenseDialog.vue'
import { useBookingStore } from '@/modules/booking'
import type { BookingAcceptPayload, BookingComingPayload } from '@/modules/booking'
import { useRouter } from 'vue-router'
import { toApiUrl, toStoragePath, joinImagePaths } from '@/utils/imagePath'
import { processImage } from '@/utils/imageProcess'
import {
  LIVE_ENSURE_PATH,
  LIVE_MJPEG_URL,
  LIVE_RECONNECT_PATH,
  LIVE_STATUS_PATH,
} from '@/config/liveVideo'
const auth = useAuthStore()
const wsStore = useWsStore()
const bookingStore = useBookingStore()
const router = useRouter()

const showHistory = ref(false)
const showPlcControl = ref(false)
const showAiStatus = ref(false)
const showDeviceStatus = ref(false)
const showUserMgr = ref(false)
const showUsrMgrDenied = ref(false)
/** 可视对讲 — 对齐 Qt TalkDialog（底部喇叭按钮） */
const showTalkDialog = ref(false)
/** 危险区域设置（实时视频栏入口） */
const showDangerZone = ref(false)
/** 对齐 Qt：弹窗贴在对应按钮下方 */
const plcAnchor = ref<{ left: number; top: number } | null>(null)
const aiAnchor = ref<{ left: number; top: number } | null>(null)
const deviceAnchor = ref<{ left: number; top: number } | null>(null)
/** 对齐 btn_webservice / btn_setting 在线图标 */
const aiOnline = ref(false)
const devicesOnline = ref(false)
const workflow = ref({
  bookingActive: false,
  distance: 0,
  /** 对齐 Qt m_checkstep：0 待机 1 预约等待 2 放行中 3 检测中 4 采集完成 6 已离开 */
  checkStep: 0,
  /** 当前检测步骤文字提示（来自 WS detection_step message） */
  stepMessage: '',
  // ---- 6 个时间字段：权威源是后端 _booking_state；前端仅镜像显示 ----
  btnPrebookTime: '',        // 司机按键预约
  acceptanceTime: '',         // 受理
  opengateTime: '',           // 开闸
  openlightscreenTime: '',    // 光幕开
  closelightscreenTime: '',   // 光幕关
  cdPhotoTime: '',            // 车顶拍照
})

/** 弹窗可见：与 Pinia 同步 — 对齐 m_pOrderDialog->show */
const showBooking = computed({
  get: () => bookingStore.dialogVisible,
  set: (v: boolean) => {
    if (v) bookingStore.openDialog()
    else bookingStore.closeDialog()
  },
})

// ---- 下拉选项 ----
const truckTypeOptions = ref<{ type_code: string; type_name: string }[]>([])
const containerTypeOptions = ref<{ type_code: string; type_name: string }[]>([])

async function loadDicts() {
  try {
    const [truckRes, containerRes] = await Promise.all([
      request<{ type_code: string; type_name: string }[]>('/dict/truck-types'),
      request<{ type_code: string; type_name: string }[]>('/dict/container-types'),
    ])
    if (truckRes.code === 0 && truckRes.data) {
      truckTypeOptions.value = truckRes.data
    }
    if (containerRes.code === 0 && containerRes.data) {
      containerTypeOptions.value = containerRes.data
    }
  } catch (e) {
    console.warn('加载字典失败:', e)
  }
}

// ---- 透视参数 — 对齐 color_demo：灰场/亮场三档 + 渲染伪彩 ----
/** 灰场：高 3.00 / 中 2.00 / 低 1.00 */
const GAMMA_LEVELS = [
  { key: 'high', label: '高', value: 3.0 },
  { key: 'mid', label: '中', value: 2.0 },
  { key: 'low', label: '低', value: 1.0 },
] as const
/** 亮场：高 64 / 中 128 / 低 255 */
const WHITE_LEVELS = [
  { key: 'high', label: '高', value: 64 },
  { key: 'mid', label: '中', value: 128 },
  { key: 'low', label: '低', value: 255 },
] as const

type LevelKey = 'high' | 'mid' | 'low'
type XrayOpenMenu = 'gamma' | 'white' | null

const gammaKey = ref<LevelKey>('mid')
const whiteKey = ref<LevelKey>('mid')
const xrayOpenMenu = ref<XrayOpenMenu>(null)
/** 对齐 btn_pseudoColor：开 = 伪彩 */
const xrayRenderOn = ref(false)
/** 色阶/伪彩处理后的显示 URL */
const xrayDisplayUrl = ref('')
let xrayApplyTimer: number | undefined
let xrayApplySeq = 0

const gammaValue = computed(
  () => GAMMA_LEVELS.find((x) => x.key === gammaKey.value)!.value,
)
const whiteValue = computed(
  () => WHITE_LEVELS.find((x) => x.key === whiteKey.value)!.value,
)
const gammaLabel = computed(
  () => GAMMA_LEVELS.find((x) => x.key === gammaKey.value)!.label,
)
const whiteLabel = computed(
  () => WHITE_LEVELS.find((x) => x.key === whiteKey.value)!.label,
)

function toggleXrayMenu(menu: XrayOpenMenu) {
  xrayOpenMenu.value = xrayOpenMenu.value === menu ? null : menu
}

function pickGamma(key: LevelKey) {
  gammaKey.value = key
  xrayOpenMenu.value = null
}

function pickWhite(key: LevelKey) {
  whiteKey.value = key
  xrayOpenMenu.value = null
}

function toggleXrayRender() {
  xrayRenderOn.value = !xrayRenderOn.value
}

function onXrayDocClick(ev: MouseEvent) {
  const t = ev.target as HTMLElement | null
  if (t?.closest('.xray-dropdown')) return
  xrayOpenMenu.value = null
}

async function applyXrayProcess() {
  const src = transparentImageUrl.value
  if (!src) {
    xrayDisplayUrl.value = ''
    return
  }
  const seq = ++xrayApplySeq
  try {
    const url = await processImage(src, {
      gamma: gammaValue.value,
      white: whiteValue.value,
      black: 0,
      pseudoColor: xrayRenderOn.value,
    })
    if (seq !== xrayApplySeq) return
    xrayDisplayUrl.value = url
  } catch (e) {
    if (seq !== xrayApplySeq) return
    console.error('[透视影像] 处理失败', e)
    // 处理失败时仍显示原图，避免空白
    xrayDisplayUrl.value = src
  }
}

function scheduleXrayApply() {
  window.clearTimeout(xrayApplyTimer)
  xrayApplyTimer = window.setTimeout(() => {
    void applyXrayProcess()
  }, 60)
}

function resetXrayProcessState() {
  window.clearTimeout(xrayApplyTimer)
  xrayApplySeq++
  xrayDisplayUrl.value = ''
  gammaKey.value = 'mid'
  whiteKey.value = 'mid'
  xrayRenderOn.value = false
  xrayOpenMenu.value = null
}

/** 车身影像 — 车身图 / 车顶图 / 车侧图 三视图循环切换 */
type BodyView = 'body' | 'top' | 'side'
const BODY_VIEW_ORDER: BodyView[] = ['body', 'top', 'side']
const BODY_VIEW_LABELS: Record<BodyView, string> = {
  body: '车身图',
  top: '车顶图',
  side: '车侧图',
}
const bodyView = ref<BodyView>('body')
const bodyImageUrls = ref<Record<BodyView, string>>({
  body: '',
  top: '',
  side: '',
})
const bodyImageUrl = computed(() => bodyImageUrls.value[bodyView.value])
const bodyViewLabel = computed(() => BODY_VIEW_LABELS[bodyView.value])

function onBodyViewSwap() {
  const idx = BODY_VIEW_ORDER.indexOf(bodyView.value)
  bodyView.value = BODY_VIEW_ORDER[(idx + 1) % BODY_VIEW_ORDER.length]
}

/** 透视影像路径 — 对齐 m_currentTanPath；删除确认后清空 */
type XrayView = '200' | '160' | 'mosaic'
const XRAY_VIEW_ORDER: XrayView[] = ['200', '160', 'mosaic']
const XRAY_VIEW_LABELS: Record<XrayView, string> = {
  '200': '200图像',
  '160': '160图像',
  mosaic: '拼接图',
}
const xrayView = ref<XrayView>('200')
const xrayImageUrls = ref<Record<XrayView, string>>({
  '200': '',
  '160': '',
  mosaic: '',
})
const transparentImageUrl = computed(() => xrayImageUrls.value[xrayView.value])
const xrayViewLabel = computed(() => XRAY_VIEW_LABELS[xrayView.value])
const showTransDelConfirm = ref(false)

watch(
  [transparentImageUrl, gammaKey, whiteKey, xrayRenderOn],
  () => {
    scheduleXrayApply()
  },
)

function onXrayViewSwap() {
  const idx = XRAY_VIEW_ORDER.indexOf(xrayView.value)
  xrayView.value = XRAY_VIEW_ORDER[(idx + 1) % XRAY_VIEW_ORDER.length]
}

/** 对齐 LvTongPro::onPreviewTansDel */
function onTransDelClick() {
  showTransDelConfirm.value = true
}

function onTransDelYes() {
  showTransDelConfirm.value = false
  xrayImageUrls.value = { '200': '', '160': '', mosaic: '' }
  xrayDisplayUrl.value = ''
  xrayBoxPanelRef.value?.clearBoxes()
}

function onTransDelNo() {
  showTransDelConfirm.value = false
}

// ---- 绿通信息表单 ----
const form = ref({
  plate: '--',
  plateColor: '',
  plateGc: '--',
  plateGcColor: '',
  goods: '',
  goodsProductCode: '',
  goodsVarietyPinYin: '',
  containerType: '',
  truckType: '',
  size: '',
  loadRate: '',
  weight: '',
  phone: '',
  historyCount: '--',
})

// ---- 农产品选择 ----
const agriculturalSelectRef = ref<InstanceType<typeof AgriculturalSelect> | null>(null)
const previousSelection = ref<{ productCode: string; varietyName: string; varietyNamePinYin: string }[]>([])

function onSelectProduct() {
  agriculturalSelectRef.value?.show(previousSelection.value)
}

function onAgriculturalConfirm(items: { productCode: string; varietyName: string; varietyNamePinYin: string }[]) {
  previousSelection.value = items
  if (items.length > 0) {
    form.value.goods = items.map(i => i.varietyName).join('|')
    form.value.goodsProductCode = items.map(i => i.productCode).join('|')
    form.value.goodsVarietyPinYin = items.map(i => i.varietyNamePinYin).join('|')
  } else {
    form.value.goods = ''
    form.value.goodsProductCode = ''
    form.value.goodsVarietyPinYin = ''
  }
}

// ---- 车牌编辑 ----
const licensePlateRef = ref<InstanceType<typeof LicensePlateEdit> | null>(null)
const licensePlateGCRef = ref<InstanceType<typeof LicensePlateEdit> | null>(null)
const showCarSize = ref(false)

function onEditCarSize() {
  showCarSize.value = true
}

function onCarSizeConfirm(sizeText: string) {
  form.value.size = sizeText
}

function onEditPlate() {
  licensePlateRef.value?.show()
}
function onPlateConfirm(plate: string, color: string) {
  form.value.plate = plate || '--'
  form.value.plateColor = color
  // 查询查验次数
  if (plate) checkHistoryCount(plate)
}
function onEditPlateGC() {
  licensePlateGCRef.value?.show()
}
function onPlateGCConfirm(plate: string, color: string) {
  form.value.plateGc = plate || '--'
  form.value.plateGcColor = color
}

// ---- 查验次数 ----
async function checkHistoryCount(plate: string) {
  try {
    const res = await request<{ count: number; driver_phone: string; gc_plate: string }>(
      `/inspection/plate/${encodeURIComponent(plate)}`
    )
    if (res.code === 0 && res.data) {
      form.value.historyCount = String(res.data.count || '--')
      if (res.data.driver_phone && !form.value.phone) {
        form.value.phone = res.data.driver_phone
      }
      if (res.data.gc_plate && form.value.plateGc === '--') {
        form.value.plateGc = res.data.gc_plate
      }
    }
  } catch {
    // ignore
  }
}

// ---- 图像采集 — 对齐 btn_head/tail/top/goods/license/evidence ----
const captureButtons = [
  { key: 'head' as const, label: '车头' },
  { key: 'tail' as const, label: '车尾' },
  { key: 'top' as const, label: '车顶' },
  { key: 'goods' as const, label: '货物' },
  { key: 'license' as const, label: '行驶证' },
  { key: 'evidence' as const, label: '证据照' },
]

type CaptureKey = (typeof captureButtons)[number]['key']

const captureDialog = ref<CaptureKind | null>(null)
const showLicenseDialog = ref(false)

// ---- 实时视频：multipart MJPEG（含 YOLO 检测框叠加）----
// 检测服务不自动启动：需点右上角 ↻ 调 POST /live/ensure
const liveMjpegSrc = ref('')
const liveVideoStatus = ref<'idle' | 'connecting' | 'playing' | 'error'>('idle')
const liveVideoError = ref('检测未启动，请点击右上角启动')
const liveReconnecting = ref(false)
const liveDetectRunning = ref(false)

let liveVideoRetryTimer: number | undefined
let liveStatusPollTimer: number | undefined

const videoHint = computed(() => {
  if (liveVideoError.value) return liveVideoError.value
  if (liveVideoStatus.value === 'idle') return '检测未启动，请点击右上角启动'
  if (liveVideoStatus.value === 'connecting') return '连接中…'
  if (liveVideoStatus.value === 'playing') return ''
  if (liveVideoStatus.value === 'error') return liveVideoError.value || '实时视频连接失败'
  return '准备播放…'
})

function bumpLiveMjpeg() {
  liveMjpegSrc.value = `${LIVE_MJPEG_URL}?t=${Date.now()}`
}

function onLiveMjpegLoad() {
  liveVideoStatus.value = 'playing'
  liveVideoError.value = ''
}

function onLiveMjpegError() {
  // 偶发坏帧不要立刻整路重连（会灰屏）；仅在未出画时提示
  if (liveVideoStatus.value === 'playing') return
  if (!liveDetectRunning.value) {
    liveVideoStatus.value = 'idle'
    liveVideoError.value = '检测未启动，请点击右上角启动'
    return
  }
  liveVideoStatus.value = 'error'
  liveVideoError.value = '实时视频不可用（请点击右上角重试）'
  scheduleLiveVideoRetry()
}

async function pollLiveStatus() {
  try {
    const res = await request<{
      connection?: string
      error?: string
      running?: boolean
    }>(LIVE_STATUS_PATH, { timeout: 2500 })
    const st = res.data || {}
    liveDetectRunning.value = !!st.running
    if (!st.running) {
      if (liveVideoStatus.value !== 'playing') {
        liveVideoStatus.value = 'idle'
        liveVideoError.value = '检测未启动，请点击右上角启动'
        liveMjpegSrc.value = ''
      }
      return
    }
    if (st.error && liveVideoStatus.value !== 'playing') {
      liveVideoError.value = String(st.error)
    }
    // 已运行但尚未绑流：自动绑 MJPEG（例如刚 ensure 成功）
    if (
      liveVideoStatus.value !== 'playing' &&
      ['connected', 'connecting', 'starting', 'running', 'ok'].includes(
        st.connection || '',
      )
    ) {
      if (!liveMjpegSrc.value) {
        liveVideoStatus.value = 'connecting'
        liveVideoError.value = ''
        bumpLiveMjpeg()
      }
    }
  } catch {
    if (liveVideoStatus.value !== 'playing') {
      liveVideoStatus.value = 'error'
      liveVideoError.value = '实时视频服务未就绪'
    }
  }
}

async function reconnectLiveVideo() {
  if (liveReconnecting.value) return
  liveReconnecting.value = true
  liveVideoStatus.value = 'connecting'
  liveVideoError.value = ''
  try {
    const res = await request<{ connection?: string; running?: boolean }>(
      LIVE_STATUS_PATH,
      { timeout: 2500 },
    )
    const st = res.data || {}
    if (!st.running) {
      // 未运行：手动启动
      await request(LIVE_ENSURE_PATH, { method: 'POST', timeout: 15000 })
      liveDetectRunning.value = true
      bumpLiveMjpeg()
    } else {
      // 已运行：软刷新；连接异常则硬重启
      const conn = st.connection || ''
      if (!['connected', 'connecting', 'starting'].includes(conn)) {
        await request(LIVE_RECONNECT_PATH, { method: 'POST', timeout: 15000 })
      }
      bumpLiveMjpeg()
    }
  } catch (e: unknown) {
    liveVideoError.value = e instanceof Error ? e.message : '启动/重连失败'
  } finally {
    void pollLiveStatus()
    liveReconnecting.value = false
  }
}

function startLiveVideo() {
  // 进入页面只轮询状态，不自动启动 worker
  liveVideoStatus.value = 'idle'
  liveVideoError.value = '检测未启动，请点击右上角启动'
  liveMjpegSrc.value = ''
  void pollLiveStatus()
  window.clearInterval(liveStatusPollTimer)
  liveStatusPollTimer = window.setInterval(() => {
    void pollLiveStatus()
  }, 5000)
}

function stopLiveVideo() {
  window.clearTimeout(liveVideoRetryTimer)
  window.clearInterval(liveStatusPollTimer)
  liveStatusPollTimer = undefined
  liveVideoStatus.value = 'idle'
  liveMjpegSrc.value = ''
}

function scheduleLiveVideoRetry() {
  window.clearTimeout(liveVideoRetryTimer)
  liveVideoRetryTimer = window.setTimeout(() => {
    if (!liveDetectRunning.value) return
    liveVideoStatus.value = 'connecting'
    bumpLiveMjpeg()
  }, 5000)
}

/** 框图裁切预览（叠在直播画面之上；来自车身/透视框图，非 MJPEG 截帧） */
const liveCropPreviewUrl = ref('')
const bodyPcPanelRef = ref<{ clearBoxes: () => void } | null>(null)
const xrayBoxPanelRef = ref<{ clearBoxes: () => void } | null>(null)

function onBodyBoxCrop(dataUrl: string) {
  liveCropPreviewUrl.value = dataUrl
}

function onXrayBoxCrop(dataUrl: string) {
  liveCropPreviewUrl.value = dataUrl
}

/** 「勾」：用户确认把当前右侧预览的框图保存到货物图列表。
 *  - dataUrl 是 base64（来自 BodyPointCloudPanel/@crop），先原样入 captureLists.goods
 *    让 UI 立即可见；提交时会由 onSubmitConfirmYes 通过 imagePath 工具归一或上传
 *  - 同步刷新 captureThumbs.goods（最后一张作为缩略图）
 *  - 顺手清掉预览区，回到正常实时视频占位
 *  - 注意：不对 MJPEG 直播帧做截帧，裁切仅来自车身/透视框图
 */
function onConfirmCropToGoods() {
  if (!liveCropPreviewUrl.value) return
  const next = [...(captureLists.value.goods || []), liveCropPreviewUrl.value]
  captureLists.value = { ...captureLists.value, goods: next }
  captureThumbs.value = { ...captureThumbs.value, goods: next[next.length - 1] || '' }
  liveCropPreviewUrl.value = ''
  console.info('[Dashboard] 框图已保存到货物图:', next.length)
}

function onDeleteBodyBoxes() {
  liveCropPreviewUrl.value = ''
  bodyPcPanelRef.value?.clearBoxes()
}

function onDeleteXrayBoxes() {
  liveCropPreviewUrl.value = ''
  xrayBoxPanelRef.value?.clearBoxes()
}
const showVideoHint = computed(() => true)

/** 各格缩略图（blob/url），对齐 Qt setIcon 回写 */
const captureThumbs = ref<Partial<Record<CaptureKey, string>>>({})
/** 多图列表：货物 / 证据 */
const captureLists = ref<{ goods: string[]; evidence: string[] }>({
  goods: [],
  evidence: [],
})
const licensePaths = ref({ license: '', licenseGc: '' })

/** 通行码 14 字段（对齐 Qt PassCodeUtil::GetPassCodeInfoByCodeStr） */
const passcode = ref<{
  valid: boolean
  vehicleId: string
  vehicleDisplayId: string
  vehicleColorName: string
  enStationId: string
  exStationId: string
  enWeight: string
  exWeight: string
  mediaTypeId: number
  transactionId: string
  passId: string
  exTime: string
  transPayTypeId: number
  fee: string
  payFee: string
  vehicleSignId: number
  provinceCount: string
} | null>(null)

/** 把任意图片引用转成可显示的 URL（前端 <img> 用）。
 *  对齐后端 /api/images/<rel> 静态路由；同时兼容旧的绝对路径与 /api/image?path= 形态。
 */
function toImageUrl(reference: string | undefined | null): string {
  return toApiUrl(reference)
}

/** 任意弹窗打开时暂停 Dashboard 视频，避免海康原生窗口穿透到弹窗之上 */
/** 打开采集弹窗时快照初始图，避免父组件重渲染（如雷达距离）生成新数组把弹窗内新拍清掉 */
const captureDialogInitial = ref<string[]>([])

function onCaptureClick(key: CaptureKey) {
  if (key === 'license') {
    showLicenseDialog.value = true
    return
  }
  captureDialogInitial.value = captureInitialImages(key)
  captureDialog.value = key
}

function onCaptureConfirm(kind: CaptureKind, images: string[]) {
  if (kind === 'goods') {
    captureLists.value.goods = images
    captureThumbs.value.goods = images[0] || ''
  } else if (kind === 'evidence') {
    captureLists.value.evidence = images
    captureThumbs.value.evidence = images[0] || ''
  } else {
    captureThumbs.value[kind] = images[0] || ''
  }
}

function onLicenseConfirm(payload: { license: string; licenseGc: string }) {
  licensePaths.value = payload
  // 对齐合并后显示到 btn_license：优先主证
  captureThumbs.value.license = payload.license || payload.licenseGc || ''
}

function captureInitialImages(kind: CaptureKind): string[] {
  if (kind === 'goods') return [...captureLists.value.goods]
  if (kind === 'evidence') return [...captureLists.value.evidence]
  const one = captureThumbs.value[kind]
  return one ? [one] : []
}

// ---- 预约 — 对齐 LvTongPro::onCarComingClicked / onBookingDebounceTimeout ----
function openBookingDialog() {
  // 检测中不弹窗
  bookingStore.openDialog()
  workflow.value.bookingActive = bookingStore.bookingActive
}

function onWorkflowClick(key: WorkflowStepKey) {
  if (key === 'book') {
    openBookingDialog()
  }
}

function onBookingAccept(payload: BookingAcceptPayload) {
  bookingStore.applyAccept(payload)
  workflow.value.bookingActive = true
}

function onBookingReject() {
  bookingStore.applyReject()
  workflow.value.bookingActive = false
}

/** WS 来车/按键预约 → 自动弹窗 */
function handleBookingComing(msg: { data?: BookingComingPayload | Record<string, unknown> }) {
  const data = (msg.data ?? {}) as BookingComingPayload
  const action = data.action
  // push_booking_event: coming / book_button；或纯 booking_request
  if (!action || action === 'coming' || action === 'book_button') {
    openBookingDialog()
  }
}

// ---- 重置 / 确认 ----
/** 对齐 LvTongPro::onReset：先弹 QMessageBox 二次确认 */
function onReset() {
  showResetConfirmBox.value = true
}

function onResetConfirmYes() {
  showResetConfirmBox.value = false
  doReset()
  // 通知后端重置（清 _booking_state + 停调度器 + 设备复位）
  void request('/booking/reset', { method: 'POST' })
    .then((r) => console.info('[booking] reset 响应:', r.code, r.message))
    .catch((e) => console.warn('[booking] reset 失败:', e))
}

function onResetConfirmNo() {
  showResetConfirmBox.value = false
}

function doReset() {
  form.value = {
    plate: '--',
    plateColor: '',
    plateGc: '--',
    plateGcColor: '',
    goods: '',
    goodsProductCode: '',
    goodsVarietyPinYin: '',
    containerType: '',
    truckType: '',
    size: '',
    loadRate: '',
    weight: '',
    phone: '',
    historyCount: '--',
  }
  previousSelection.value = []
  // 清图片（对齐 Qt clearFormData 清除所有图片缩略图）
  captureThumbs.value = {}
  captureLists.value = { goods: [], evidence: [] }
  licensePaths.value = { license: '', licenseGc: '' }
  bodyImageUrls.value = { body: '', top: '', side: '' }
  xrayImageUrls.value = { '200': '', '160': '', mosaic: '' }
  liveCropPreviewUrl.value = ''
  resetXrayProcessState()
  // 清通行码
  passcode.value = null
  // 清工作流状态
  bookingStore.reset()
  workflow.value.bookingActive = false
  workflow.value.checkStep = 0
  workflow.value.stepMessage = ''
  workflow.value.btnPrebookTime = ''
  workflow.value.acceptanceTime = ''
  workflow.value.opengateTime = ''
  workflow.value.openlightscreenTime = ''
  workflow.value.closelightscreenTime = ''
  workflow.value.cdPhotoTime = ''
}

function buildSubmitPreview(): InspectionDetail {
  const plate = form.value.plate === '--' ? '' : form.value.plate
  const truck = truckTypeOptions.value.find((t) => t.type_code === form.value.truckType)
  const container = containerTypeOptions.value.find(
    (t) => t.type_code === form.value.containerType,
  )
  // 多图字段必须逐张 toApiUrl：移动端绝对路径等否则 <img> 无法加载
  const goodsJoined = (captureLists.value.goods || [])
    .map((p) => toApiUrl(p))
    .filter(Boolean)
    .join('|')
  const evidenceJoined = (captureLists.value.evidence || [])
    .map((p) => toApiUrl(p))
    .filter(Boolean)
    .join('|')
  const pc = passcode.value?.valid ? passcode.value : null

  return {
    id: 0,
    plate_number: plate,
    plate_number_gc: form.value.plateGc === '--' ? '' : form.value.plateGc,
    driver_phone: form.value.phone,
    vehicle_type: form.value.truckType,
    vehicle_name: truck?.type_name || '',
    vehicle_container_type: form.value.containerType,
    vehicle_container_name: container?.type_name || '',
    goods_type: form.value.goodsProductCode || form.value.goods,
    goods_name: form.value.goods,
    load_rate: parseFloat(form.value.loadRate) || 0,
    load_weight: parseFloat(form.value.weight) || 0,
    vehicle_size: form.value.size,
    head_image_path: toApiUrl(captureThumbs.value.head || '') || undefined,
    tail_image_path: toApiUrl(captureThumbs.value.tail || '') || undefined,
    top_image_path: toApiUrl(bodyImageUrls.value.top || captureThumbs.value.top || '') || undefined,
    body_image_path: toApiUrl(bodyImageUrls.value.body || '') || undefined,
    transparent_image_path:
      toApiUrl(xrayDisplayUrl.value || xrayImageUrls.value['200'] || '') || undefined,
    goods_image_path: goodsJoined || undefined,
    evidences_image_path: evidenceJoined || undefined,
    license_image_path:
      toApiUrl(licensePaths.value.license || captureThumbs.value.license || '') || undefined,
    pass_code_image_path: toApiUrl(captureThumbs.value.passcode || '') || undefined,
    operator_name: auth.user?.realName || '',
    inspector_phone: auth.user?.phone || '',
    result_status: 1,
    pass_code_vehicle_color_name: form.value.plateColor || pc?.vehicleColorName || '',
    pass_code_en_station_id: pc?.enStationId,
    pass_code_ex_station_id: pc?.exStationId,
    pass_code_en_weight: pc?.enWeight,
    pass_code_ex_weight: pc?.exWeight,
    pass_code_media_type_id: pc != null ? String(pc.mediaTypeId || '') : undefined,
    pass_code_transaction_id: pc?.transactionId,
    pass_code_pass_id: pc?.passId,
    pass_code_ex_time: pc?.exTime,
    pass_code_trans_pay_type: pc != null ? String(pc.transPayTypeId || '') : undefined,
    pass_code_fee: pc?.fee,
    pass_code_pay_fee: pc?.payFee,
    pass_code_vehicle_sign: pc?.vehicleSignId
      ? `0x${pc.vehicleSignId.toString(16).toUpperCase()}`
      : undefined,
    pass_code_province_count: pc?.provinceCount,
  }
}

function onConfirm() {
  /** 对齐 LvTongPro::onConfirmClicked：先弹查验记录预览，再写库 */
  if (!form.value.goods) {
    alert('请选择农产品类型')
    return
  }
  submitPreview.value = buildSubmitPreview()
  showSubmitPreview.value = true
}

async function onSubmitConfirmYes() {
  showSubmitPreview.value = false
  submitPreview.value = null

  // ---- 1. 组装 body（50+ 字段，对齐 Qt VehicleInspection） ----
  // 图片统一交给后端 persist_to_storage 归一：前端只负责把"任何形态的引用"
  // （dataUrl、blob、/api/images/<rel>、绝对路径等）原样/可识别地交给后端；
  // 自动拍与手动拍都先在前端预览，真正落盘与改名在提交时完成。
  const body: Record<string, unknown> = {
    // 业务字段
    plate_number: form.value.plate === '--' ? '' : form.value.plate,
    plate_number_gc: form.value.plateGc === '--' ? '' : form.value.plateGc,
    driver_phone: form.value.phone,
    vehicle_type: form.value.truckType,
    vehicle_container_type: form.value.containerType,
    goods_type: form.value.goodsProductCode || form.value.goods,
    goods_name: form.value.goods,
    load_rate: parseFloat(form.value.loadRate) || 0,
    load_weight: parseFloat(form.value.weight) || 0,
    vehicle_size: form.value.size,
    // 8 个图片路径（Qt m_*ImagePath）
    head_image_path: toStoragePath(captureThumbs.value.head || ''),
    tail_image_path: toStoragePath(captureThumbs.value.tail || ''),
    body_image_path: toStoragePath(bodyImageUrls.value.body || ''),
    top_image_path: toStoragePath(bodyImageUrls.value.top || ''),
    transparent_image_path: toStoragePath(xrayImageUrls.value['200'] || ''),
    // 通行码 QR 图（对齐 Qt m_codeImagePath，flask 后端生成）
    passcode_image_path: toStoragePath(captureThumbs.value.passcode || ''),
    // 货物图 / 证据照（多张统一 | 分隔）
    goods_image_path: joinImagePaths(captureLists.value.goods || []),
    evidences_image_path: joinImagePaths(captureLists.value.evidence || []),
    // 行驶证（合并图 + GC 牌）
    license_image_path: toStoragePath(licensePaths.value.license || ''),
    license_image_path1: toStoragePath(licensePaths.value.licenseGc || ''),
    // 操作员
    operator_name: auth.user?.realName || '',
    inspector_phone: auth.user?.phone || '',
  }

  // ---- 3. 通行码 14 字段（从 passcode ref 读） ----
  if (passcode.value && passcode.value.valid) {
    const pc = passcode.value
    body.passcode_vehicle_id = pc.vehicleId
    body.passcode_vehicle_display_id = pc.vehicleDisplayId
    body.passcode_vehicle_color_name = pc.vehicleColorName
    body.passcode_en_station_id = pc.enStationId
    body.passcode_ex_station_id = pc.exStationId
    body.passcode_en_weight = pc.enWeight
    body.passcode_ex_weight = pc.exWeight
    body.passcode_media_type = String(pc.mediaTypeId || '')
    body.passcode_transaction_id = pc.transactionId
    body.passcode_pass_id = pc.passId
    body.passcode_ex_time = pc.exTime
    body.passcode_trans_pay_type = String(pc.transPayTypeId || '')
    body.passcode_fee = pc.fee
    body.passcode_pay_fee = pc.payFee
    body.passcode_vehicle_sign = pc.vehicleSignId ? `0x${pc.vehicleSignId.toString(16).toUpperCase()}` : ''
    body.passcode_province_count = pc.provinceCount
  }

  // ---- 4. 7 个时间戳（权威源是后端 _booking_state；前端仅在缺失时同步显示） ----
  // 注意：实际入库值由后端 submit_inspection 从 _booking_state 注入（最强权威）。
  // 前端发送的值只用于覆盖（让前端有"重置后还在用老时间"的余地），一般置空让后端注入。
  if (workflow.value.btnPrebookTime) body.btn_prebook_time = workflow.value.btnPrebookTime
  if (bookingStore.acceptanceTime) body.acceptance_time = bookingStore.acceptanceTime
  if (workflow.value.opengateTime) body.opengate_time = workflow.value.opengateTime
  if (workflow.value.openlightscreenTime) body.openlightscreen_time = workflow.value.openlightscreenTime
  if (workflow.value.closelightscreenTime) body.closelightscreen_time = workflow.value.closelightscreenTime
  if (workflow.value.cdPhotoTime) body.cd_photo_time = workflow.value.cdPhotoTime
  // inspection_time ← 后端 submit 时打（不用前端传）

  try {
    const res = await request('/inspection/submit', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (res.code === 0) {
      alert('提交成功')
      // 提交成功直接重置（不再二次弹重置确认，因为已经走完流程）
      doReset()
      // 通知后端重置
      void request('/booking/reset', { method: 'POST' })
        .catch((e) => console.warn('[booking] reset 失败:', e))
    } else {
      alert(res.message || '提交失败')
    }
  } catch (e) {
    alert('提交失败: ' + (e instanceof Error ? e.message : '未知错误'))
  }
}

function onSubmitConfirmNo() {
  showSubmitPreview.value = false
  submitPreview.value = null
}

// ---- 急停（对齐 LvTongPro::onStopClicked / onPLCStopChanged）----
/** 防止复位弹窗重复弹出 — 对齐 m_openStopFlag */
const openStopFlag = ref(false)
const showStopConfirmBox = ref(false)
const showStopResetBox = ref(false)
const stopErrorVisible = ref(false)
const stopErrorMessage = ref('')

// ---- 提交前查验记录预览 — 对齐 DetailDialog ----
const showSubmitPreview = ref(false)
const submitPreview = ref<InspectionDetail | null>(null)
const showResetConfirmBox = ref(false)

// ---- WebSocket 实时数据 ----
function setupWS() {
  wsStore.connect()

  let radarLogN = 0
  wsStore.subscribe('radar_distance', (msg) => {
    const data = msg.data as { distance?: number; mode?: number } | undefined
    if (data?.distance != null && Number.isFinite(Number(data.distance))) {
      const d = Number(data.distance)
      workflow.value.distance = d
      // 调试：受理后应持续打印；若没有则后端未推或 WS 未收到
      radarLogN += 1
      if (radarLogN === 1 || radarLogN % 20 === 0) {
        console.info(`[WS] radar_distance #${radarLogN}: ${d}m mode=${data.mode ?? '-'}`)
      }
    }
  })

  wsStore.subscribe('device_status', (msg) => {
    console.log('[WS] 设备状态:', msg.data)
  })

  wsStore.subscribe('plc_status', (msg) => {
    console.log('[WS] PLC状态:', msg.data)
    // 对齐 LvTongPro::onPLCStopChanged(bool value)
    const data = msg.data as Record<string, unknown> | undefined
    const urgent =
      data?.urgentstop === true ||
      data?.urgentStop === true ||
      data?.stop === true
    if (urgent && !openStopFlag.value) {
      openStopFlag.value = true
      showStopResetBox.value = true
    }
  })

  wsStore.subscribe('detection_step', (msg) => {
    const data = msg.data as { step?: number; message?: string } | undefined
    if (data?.step != null) {
      workflow.value.checkStep = data.step
      workflow.value.stepMessage = data.message ?? ''
      // 对齐 Qt m_checkstep 联动 store
      bookingStore.checkStep = data.step
    }
  })

  // 对齐 PLC bookingStatus → 弹 OrderDialog
  wsStore.subscribe('booking_request', handleBookingComing)
  wsStore.subscribe('booking', handleBookingComing)

  wsStore.subscribe('booking_accepted', (msg) => {
    const data = msg.data as BookingAcceptPayload | undefined
    if (data?.vehicleHeight != null) {
      bookingStore.applyAccept({
        vehicleHeight: data.vehicleHeight,
        carHeadLength: data.carHeadLength,
        xrayEnabled: data.xrayEnabled,
        linePosition: data.linePosition ?? 0.5,
      })
      workflow.value.bookingActive = true
    }
    // 同步 6 个时间字段（来自后端 _booking_state 推送）
    if (data) {
      const a = data as unknown as Record<string, string | undefined>
      bookingStore.setTimeFields({
        btnPrebookTime: a.btnPrebookTime,
        acceptanceTime: a.acceptanceTime,
        opengateTime: a.opengateTime,
        openlightscreenTime: a.openlightscreenTime,
        closelightscreenTime: a.closelightscreenTime,
        cdPhotoTime: a.cdPhotoTime,
      })
      workflow.value.btnPrebookTime = a.btnPrebookTime || workflow.value.btnPrebookTime
      workflow.value.acceptanceTime = a.acceptanceTime || workflow.value.acceptanceTime
      workflow.value.opengateTime = a.opengateTime || workflow.value.opengateTime
      workflow.value.openlightscreenTime = a.openlightscreenTime || workflow.value.openlightscreenTime
      workflow.value.closelightscreenTime = a.closelightscreenTime || workflow.value.closelightscreenTime
      workflow.value.cdPhotoTime = a.cdPhotoTime || workflow.value.cdPhotoTime
    }
  })

  wsStore.subscribe('booking_rejected', () => {
    bookingStore.applyReject()
    workflow.value.bookingActive = false
  })

  /** 对齐 LvTongPro::onReset：服务端推送 booking_reset 时兜底重置 */
  wsStore.subscribe('booking_reset', () => {
    bookingStore.reset()
    workflow.value.bookingActive = false
    workflow.value.checkStep = 0
    workflow.value.stepMessage = ''
  })

  /** 图像就绪：兼容
   *  1) mock_back：{ imageType: body|transparent, urls: {1,2,3} }
   *  2) flask capture_service：{ imageType: head|tail|top|..., url }
   */
  wsStore.subscribe('image_ready', (msg) => {
    const data = msg.data as
      | {
          imageType?: string
          group?: number
          url?: string
          urls?: Record<string, string>
        }
      | undefined
    if (!data?.imageType) return

    // 调度器自动采集 / 手动同逻辑：单张 url（多为 dataUrl，提交时再落盘）
    if (data.url) {
      const raw = String(data.url)
      const isInline =
        raw.startsWith('data:') || raw.startsWith('blob:')
      // dataUrl/blob 不能拼 ?t=；磁盘 API 路径才做防缓存
      const apiUrl = toImageUrl(raw)
      const viewUrl = isInline
        ? apiUrl
        : `${apiUrl}${apiUrl.includes('?') ? '&' : '?'}t=${Date.now()}`
      const t = data.imageType
      if (t === 'head' || t === 'tail' || t === 'top' || t === 'goods' || t === 'evidence' || t === 'license') {
        captureThumbs.value = { ...captureThumbs.value, [t]: viewUrl }
        // 图像采集(枪机) 与 车身影像(中间 agent) 无关，不要写 bodyImageUrls
      }
      console.info(
        `[WS] image_ready: ${t} → ${isInline ? `dataUrl(${raw.length} chars)` : viewUrl}`,
      )
      return
    }

    // 中间设备 agent / 占位批量出图 → 仅填车身影像、透视影像
    if (!data.urls) return
    if (data.imageType === 'body') {
      if (data.urls['1']) bodyImageUrls.value.body = data.urls['1']
      if (data.urls['2']) bodyImageUrls.value.top = data.urls['2']
      if (data.urls['3']) bodyImageUrls.value.side = data.urls['3']
    } else if (data.imageType === 'transparent') {
      if (data.urls['1']) xrayImageUrls.value['200'] = data.urls['1']
      if (data.urls['2']) xrayImageUrls.value['160'] = data.urls['2']
      if (data.urls['3']) xrayImageUrls.value.mosaic = data.urls['3']
    }
    console.info(
      `[WS] image_ready group: ${data.imageType} group=${data.group} urls=${Object.keys(data.urls).length}`,
    )
  })

  /** 移动 app 上传 — 对齐 LvTongPro.cpp:1680-1948 JsonFolderWatcher 回调 */
  wsStore.subscribe('mobile_upload', (msg) => {
    const data = msg.data as
      | {
          sessionId?: string
          plate_number_gc?: string
          phone?: string
          goods_type?: string
          head_image_path?: string
          body_image_path?: string
          tail_image_path?: string
          passcode_image_path?: string
          license_image_path1?: string
          license_image_path2?: string
          goods_image_path?: string  // 多个，| 分隔
          evidences_image_path?: string
        }
      | undefined
    if (!data) return

    // 13 个图片字段 — 对齐 Qt m_headImagePath / m_tailImagePath / m_bodyPath / m_licenseImagePath1/2 / m_codeImagePath
    if (data.head_image_path) captureThumbs.value.head = toImageUrl(data.head_image_path)
    if (data.tail_image_path) captureThumbs.value.tail = toImageUrl(data.tail_image_path)
    if (data.body_image_path) bodyImageUrls.value.body = toImageUrl(data.body_image_path)
    // passcode_image_path 是 flask 后端用 QR 库生成的（对齐 Qt QZXing::encodeData）
    if (data.passcode_image_path) captureThumbs.value.passcode = toImageUrl(data.passcode_image_path)
    if (data.license_image_path1) licensePaths.value.license = toImageUrl(data.license_image_path1)
    if (data.license_image_path2) licensePaths.value.licenseGc = toImageUrl(data.license_image_path2)

    // 货物图（多张，| 分隔 — 对齐 Qt getGoodImgListPath()）
    if (data.goods_image_path) {
      const urls = data.goods_image_path.split('|').filter(Boolean).map(toImageUrl)
      captureLists.value.goods = urls
      captureThumbs.value.goods = urls[0] || ''
    }

    // 证据照（多张，| 分隔 — 对齐 Qt getEvidenceListPath()）
    if (data.evidences_image_path) {
      const urls = data.evidences_image_path.split('|').filter(Boolean).map(toImageUrl)
      captureLists.value.evidence = urls
      captureThumbs.value.evidence = urls[0] || ''
    }

    // 业务字段 — 对齐 Qt ui.lineEdit_phone / ui.lineEdit_plate_gc / ui.lineEdit_goods
    if (data.phone) form.value.phone = data.phone
    if (data.plate_number_gc) form.value.plateGc = data.plate_number_gc
    if (data.goods_type) {
      form.value.goods = data.goods_type
      // 对齐 Qt ui.lineEdit_goods->setProperty('productCode', ...)
      form.value.goodsProductCode = data.goods_type
    }

    console.info(
      `[mobile_upload] session=${data.sessionId} plate_gc=${data.plate_number_gc} ` +
      `phone=${data.phone} head=${!!data.head_image_path} body=${!!data.body_image_path} ` +
      `license1=${!!data.license_image_path1} license2=${!!data.license_image_path2} ` +
      `goods=${!!data.goods_image_path} evidences=${!!data.evidences_image_path}`,
    )
  })

  /** 通行码 14 字段解析 — 对齐 Qt PassCodeUtil::GetPassCodeInfoByCodeStr */
  wsStore.subscribe('mobile_passcode', (msg) => {
    const pc = msg.data as typeof passcode.value
    if (!pc || !pc.valid) return
    passcode.value = pc
    // 对齐 Qt dispVhicleLicQRInfoToMainUI：自动填车牌 + 颜色
    if (pc.vehicleDisplayId) form.value.plate = pc.vehicleDisplayId
    if (pc.vehicleColorName) form.value.plateColor = pc.vehicleColorName
    console.info(
      `[mobile_passcode] vehicle=${pc.vehicleDisplayId} color=${pc.vehicleColorName} ` +
      `enSta=${pc.enStationId} exSta=${pc.exStationId} fee=${pc.fee}`,
    )
  })
}

function onStopClick() {
  // 对齐 QMessageBox::question(this, "系统提醒", "确定执行急停操作？", Yes|No)
  showStopConfirmBox.value = true
}

/** 顶栏工具 — 对齐 onHistoryClicked / onPlcControl / onWebServiceClicked / onSettingClicked */
function onHeaderToolClick(key: string, anchor?: ToolAnchor) {
  if (key === 'history') {
    showHistory.value = true
    return
  }
  if (key === 'plc') {
    if (showPlcControl.value) {
      showPlcControl.value = false
      return
    }
    showAiStatus.value = false
    showDeviceStatus.value = false
    if (anchor) {
      plcAnchor.value = { left: anchor.left, top: anchor.bottom }
    }
    showPlcControl.value = true
    return
  }
  if (key === 'ai') {
    if (showAiStatus.value) {
      showAiStatus.value = false
      return
    }
    showPlcControl.value = false
    showDeviceStatus.value = false
    if (anchor) {
      aiAnchor.value = { left: anchor.left, top: anchor.bottom }
    }
    showAiStatus.value = true
    return
  }
  if (key === 'device') {
    // 对齐 onSettingClicked：再点关闭；位置 mapToGlobal(-50, height)
    if (showDeviceStatus.value) {
      showDeviceStatus.value = false
      return
    }
    showPlcControl.value = false
    showAiStatus.value = false
    if (anchor) {
      deviceAnchor.value = { left: anchor.left - 50, top: anchor.bottom }
    }
    showDeviceStatus.value = true
    return
  }
  if (key === 'stop') {
    onStopClick()
    return
  }
  if (key === 'user') {
    // 对齐 onUsrMgrClicked：仅 role==0 系统管理员可打开
    if (Number(auth.user?.role) === 0) {
      showUserMgr.value = true
    } else {
      showUsrMgrDenied.value = true
    }
  }
}

function onAiStatusChange(online: boolean) {
  aiOnline.value = online
}

function onDevicesStatusChange(allOnline: boolean) {
  devicesOnline.value = allOnline
}

async function onStopConfirmYes() {
  showStopConfirmBox.value = false
  try {
    await request('/booking/urgent-stop', { method: 'POST' })
    // 对齐 Qt：setPLC urgentstop=true 成功后 m_openStopFlag = false
    openStopFlag.value = false
  } catch {
    stopErrorMessage.value = '急停指令发送失败'
    stopErrorVisible.value = true
  }
}

function onStopConfirmNo() {
  showStopConfirmBox.value = false
}

async function onStopResetYes() {
  // 对齐 QMessageBox::question(..., "设备急停！ 是否复位？", Yes)
  showStopResetBox.value = false
  try {
    await request('/booking/stop-reset', { method: 'POST' })
    openStopFlag.value = false
  } catch {
    stopErrorMessage.value = '急停复位失败'
    stopErrorVisible.value = true
  }
}

function onStopResetClose() {
  showStopResetBox.value = false
}

onMounted(async () => {
  loadDicts()
  setupWS()
  document.addEventListener('click', onXrayDocClick)
  await nextTick()
  startLiveVideo()
})

onUnmounted(() => {
  document.removeEventListener('click', onXrayDocClick)
  window.clearTimeout(xrayApplyTimer)
  stopLiveVideo()
  wsStore.disconnect()
})

/** 任意弹窗打开（采集/预约等仍可能用海康 HWND） */
const anyDialogOpen = computed(
  () =>
    showBooking.value ||
    showHistory.value ||
    showPlcControl.value ||
    showAiStatus.value ||
    showTalkDialog.value ||
    showDangerZone.value ||
    showDeviceStatus.value ||
    showUserMgr.value ||
    showUsrMgrDenied.value ||
    showCarSize.value ||
    captureDialog.value !== null ||
    showLicenseDialog.value ||
    showStopConfirmBox.value ||
    showStopResetBox.value ||
    stopErrorVisible.value ||
    showTransDelConfirm.value ||
    showSubmitPreview.value,
)
</script>

<template>
  <div class="dashboard">
    <AppHeader
      :username="auth.user?.realName"
      :ai-online="aiOnline"
      :devices-online="devicesOnline"
      @tool-click="onHeaderToolClick"
    />

    <div class="dashboard-body">
      <!-- 左侧 -->
      <section class="panel-left">
        <!-- 车身影像 — 车身图 / 车顶图 / 车侧图 三视图循环切换 -->
        <div class="panel-card panel-stretch">
          <div class="panel-header panel-header-body">
            <img src="/assets/img/a_car.png" class="panel-icon" alt="" />
            <span class="panel-title">车身影像</span>
            <span class="header-spacer" aria-hidden="true" />
            <PreviewButton label="删除框图" title="删除框选图" @click="onDeleteBodyBoxes" />
            <span class="xray-meta">{{ bodyViewLabel }}：</span>
            <button type="button" class="header-icon-btn header-icon-swap" title="切换视角" @click="onBodyViewSwap">
              <img src="/assets/img/a_leftright.png" alt="" />
            </button>
          </div>
          <BodyPointCloudPanel
            ref="bodyPcPanelRef"
            placeholder="车身影像"
            :image-url="bodyImageUrl || undefined"
            :view="bodyView"
            @crop="onBodyBoxCrop"
          />
        </div>

        <!-- 透视影像 — 灰场/亮场三档 + 渲染伪彩（对齐 color_demo） -->
        <div class="panel-card panel-stretch">
          <div class="panel-header panel-header-xray">
            <img src="/assets/img/a_xray.png" class="panel-icon" alt="" />
            <span class="panel-title">透视影像</span>
            <span class="xray-meta">{{ xrayViewLabel }}：</span>
            <span class="xray-label">灰场</span>
            <div class="xray-dropdown" :class="{ open: xrayOpenMenu === 'gamma' }">
              <button type="button" class="xray-dropdown-trigger" @click.stop="toggleXrayMenu('gamma')">
                <span>{{ gammaLabel }}</span>
                <i class="xray-caret">▾</i>
              </button>
              <ul v-show="xrayOpenMenu === 'gamma'" class="xray-dropdown-menu">
                <li
                  v-for="item in GAMMA_LEVELS"
                  :key="item.key"
                  :class="{ active: gammaKey === item.key }"
                  @click.stop="pickGamma(item.key)"
                >
                  {{ item.label }}
                </li>
              </ul>
            </div>
            <span class="xray-label">亮场</span>
            <div class="xray-dropdown" :class="{ open: xrayOpenMenu === 'white' }">
              <button type="button" class="xray-dropdown-trigger" @click.stop="toggleXrayMenu('white')">
                <span>{{ whiteLabel }}</span>
                <i class="xray-caret">▾</i>
              </button>
              <ul v-show="xrayOpenMenu === 'white'" class="xray-dropdown-menu">
                <li
                  v-for="item in WHITE_LEVELS"
                  :key="item.key"
                  :class="{ active: whiteKey === item.key }"
                  @click.stop="pickWhite(item.key)"
                >
                  {{ item.label }}
                </li>
              </ul>
            </div>
            <PreviewButton label="删除框图" title="删除框选图" @click="onDeleteXrayBoxes" />
            <PreviewButton label="删除" title="不合格透视图删除" @click="onTransDelClick" />
            <PreviewButton
              label="渲染"
              title="伪彩渲染"
              :active="xrayRenderOn"
              @click="toggleXrayRender"
            />
            <button type="button" class="header-icon-btn header-icon-swap" title="切换视角" @click="onXrayViewSwap">
              <img src="/assets/img/a_leftright.png" alt="" />
            </button>
          </div>
          <!-- 与车身框图相同：在色阶/伪彩结果上画框，裁切进实时视频区（不测距） -->
          <BodyPointCloudPanel
            ref="xrayBoxPanelRef"
            placeholder="透视影像"
            :image-url="xrayDisplayUrl || undefined"
            view="body"
            @crop="onXrayBoxCrop"
          />
        </div>

        <!-- 底部：流程图标 + 车辆动画 + 硬件状态 -->
        <div class="panel-card panel-bottom">
          <BottomWorkflowPanel
            :booking-active="workflow.bookingActive"
            :distance="workflow.distance"
            @workflow-click="onWorkflowClick"
            @talk-click="showTalkDialog = true"
          />
        </div>
      </section>

      <!-- 右侧 -->
      <section class="panel-right">
        <!-- 实时视频 -->
        <div class="panel-card panel-video">
          <div class="panel-header">
            <img src="/assets/img/live_video.png" class="panel-icon" alt="" />
            <span class="panel-title">实时视频</span>
            <button
              type="button"
              class="header-icon-btn"
              title="危险区域设置"
              @click="showDangerZone = true"
            >
              <img src="/assets/img/a_plc_yellow.png" alt="危险区域" />
            </button>
            <button
              type="button"
              class="header-icon-btn"
              :title="liveDetectRunning ? '重新连接实时视频' : '启动检测服务'"
              :disabled="liveReconnecting"
              @click="reconnectLiveVideo"
            >
              <span class="reconnect-label">{{ liveReconnecting ? '…' : '↻' }}</span>
            </button>
            <button
              type="button"
              class="header-icon-btn"
              :class="{ disabled: !liveCropPreviewUrl }"
              :title="liveCropPreviewUrl ? '保存到货物图' : '当前无裁切预览'"
              :disabled="!liveCropPreviewUrl"
              @click="onConfirmCropToGoods"
            >
              <img src="/assets/img/good_save.png" alt="" />
            </button>
          </div>
          <div class="video-area">
            <img
              v-if="liveMjpegSrc"
              :src="liveMjpegSrc"
              class="live-mjpeg"
              alt="实时视频"
              @load="onLiveMjpegLoad"
              @error="onLiveMjpegError"
            />
            <img
              v-if="liveCropPreviewUrl"
              :src="liveCropPreviewUrl"
              class="video-crop-preview"
              alt="框图预览"
            />
            <div
              v-if="!liveCropPreviewUrl && liveVideoStatus !== 'playing'"
              class="video-status"
              :class="{ err: liveVideoStatus === 'error' || liveVideoStatus === 'idle' || !!liveVideoError }"
            >
              {{ videoHint }}
            </div>
          </div>
        </div>

        <!-- 图像采集 -->
        <div class="panel-card panel-capture">
          <div class="panel-header">
            <img src="/assets/img/image_capture.png" class="panel-icon" alt="" />
            <span class="panel-title">图像采集</span>
          </div>
          <div class="capture-grid">
            <button
              v-for="btn in captureButtons"
              :key="btn.key"
              type="button"
              class="capture-btn"
              :class="{ 'has-thumb': !!captureThumbs[btn.key] }"
              :title="btn.label"
              @click="onCaptureClick(btn.key)"
            >
              <img
                v-if="captureThumbs[btn.key]"
                :src="captureThumbs[btn.key]"
                :alt="btn.label"
                class="capture-thumb"
              />
              <span v-else>{{ btn.label }}</span>
            </button>
          </div>
        </div>

        <!-- 绿通信息 -->
        <div class="panel-card panel-form">
          <div class="form-header">
            <img src="/assets/img/lv_info.png" class="panel-icon" alt="" />
            <span class="panel-title">绿通信息</span>
            <button class="header-icon-btn" title="通行码">
              <img src="/assets/img/ze-scan.png" alt="" />
            </button>
          </div>

          <div class="form-body">
            <div class="form-row">
              <label>车牌号码：</label>
              <span class="field-value">{{ form.plate }}</span>
              <button class="icon-btn" title="号牌号码编辑" @click="onEditPlate">
                <img src="/assets/img/a_chxz.png" alt="" />
              </button>
              <label class="col-right">挂车号码：</label>
              <span class="field-value">{{ form.plateGc }}</span>
              <button class="icon-btn" title="号牌号码编辑" @click="onEditPlateGC">
                <img src="/assets/img/a_chxz.png" alt="" />
              </button>
            </div>

            <div class="form-row">
              <label>司机电话：</label>
              <input v-model="form.phone" class="field-input" placeholder="请输入11位手机号" />
              <span class="col-gap" />
              <label class="col-right">货车类型：</label>
              <select v-model="form.truckType" class="field-input">
                <option value="">请选择</option>
                <option v-for="t in truckTypeOptions" :key="t.type_code" :value="t.type_code">
                  {{ t.type_name }}
                </option>
              </select>
            </div>

            <div class="form-row">
              <label>货物类型：</label>
              <input v-model="form.goods" class="field-input" placeholder="请选择农产品类型" readonly />
              <button class="icon-btn" title="货物类型选择" @click="onSelectProduct">
                <img src="/assets/img/a_search.png" alt="" />
              </button>
              <label class="col-right">货箱类型：</label>
              <select v-model="form.containerType" class="field-input">
                <option value="">请选择</option>
                <option v-for="c in containerTypeOptions" :key="c.type_code" :value="c.type_code">
                  {{ c.type_name }}
                </option>
              </select>
            </div>

            <div class="form-row">
              <label>满载率约(%)：</label>
              <input v-model="form.loadRate" class="field-input" placeholder="请输入满载率，区间0-100" />
              <span class="col-gap" />
              <label class="col-right">轮廓尺寸：</label>
              <input v-model="form.size" class="field-input" placeholder="请输入外轮廓长宽高" readonly />
              <button class="icon-btn" title="轮廓尺寸编辑" @click="onEditCarSize">
                <img src="/assets/img/a_search.png" alt="" />
              </button>
            </div>

            <div class="form-row">
              <label>出口称重(kg)：</label>
              <input v-model="form.weight" class="field-input" placeholder="出口称重（kg）" />
              <span class="col-gap" />
              <label class="col-right">查验次数：</label>
              <span class="field-value">{{ form.historyCount }}</span>
            </div>
          </div>

          <div class="form-footer">
            <button class="btn-reset" @click="onReset">重置</button>
            <button class="btn-confirm" @click="onConfirm">确认</button>
          </div>
        </div>
      </section>
    </div>

    <!-- 预约弹窗 — 对齐 OrderDialog -->
    <BookingDialog
      v-if="showBooking"
      @close="bookingStore.closeDialog()"
      @accept="onBookingAccept"
      @reject="onBookingReject"
    />

    <!-- 可视对讲 — 对齐 TalkDialog（预约弹窗右半视频独立出来） -->
    <TalkDialog
      v-if="showTalkDialog"
      @close="showTalkDialog = false"
    />

    <DangerZoneDialog
      v-if="showDangerZone"
      @close="showDangerZone = false"
    />

    <!-- 农产品选择弹窗 -->
    <AgriculturalSelect
      ref="agriculturalSelectRef"
      @confirm="onAgriculturalConfirm"
    />

    <!-- 车牌编辑弹窗 -->
    <LicensePlateEdit
      ref="licensePlateRef"
      :current-plate="form.plate === '--' ? '' : form.plate"
      :current-color="form.plateColor"
      title="车牌修改"
      @confirm="onPlateConfirm"
    />
    <LicensePlateEdit
      ref="licensePlateGCRef"
      :current-plate="form.plateGc === '--' ? '' : form.plateGc"
      :current-color="form.plateGcColor"
      title="挂车车牌修改"
      @confirm="onPlateGCConfirm"
    />

    <!-- 货车轮廓尺寸修改 — 对齐 CarSizeDialog -->
    <CarSizeDialog
      v-if="showCarSize"
      :model-value="form.size"
      @confirm="onCarSizeConfirm"
      @close="showCarSize = false"
    />

    <!-- 图像采集弹窗 — 对齐 GetPic/Tail/Top/Goods/Evidence -->
    <CaptureCameraDialog
      v-if="captureDialog"
      :kind="captureDialog"
      :initial-images="captureDialogInitial"
      @confirm="(imgs) => onCaptureConfirm(captureDialog!, imgs)"
      @close="captureDialog = null"
    />

    <!-- 行驶证 — 对齐 GetDrivingPicDialog -->
    <DrivingLicenseDialog
      v-if="showLicenseDialog"
      :license-src="licensePaths.license"
      :license-gc-src="licensePaths.licenseGc"
      @confirm="onLicenseConfirm"
      @close="showLicenseDialog = false"
    />

    <!-- 设备连接状态 — 对齐 onSettingClicked DeviceStatusPopup -->
    <DeviceStatusPanel
      v-if="showDeviceStatus"
      :anchor="deviceAnchor"
      @close="showDeviceStatus = false"
      @status-change="onDevicesStatusChange"
    />

    <!-- 开关控制 / PLC设备状态控制 — 对齐 PLCControlDialog -->
    <PlcControlDialog
      v-if="showPlcControl"
      :anchor="plcAnchor"
      @close="showPlcControl = false"
    />

    <!-- AI智能体连接状态 — 对齐 WebServiceDialog -->
    <AiStatusDialog
      v-if="showAiStatus"
      :anchor="aiAnchor"
      @close="showAiStatus = false"
      @status-change="onAiStatusChange"
    />

    <!-- 用户管理 — 对齐 UsrMgrDialog -->
    <UserManager
      v-if="showUserMgr"
      @close="showUserMgr = false"
    />

    <QtMessageBox
      v-if="showUsrMgrDenied"
      title="通知"
      message="系统管理员用户才能进行用户管理操作 !"
      icon="warning"
      :buttons="['yes']"
      @yes="showUsrMgrDenied = false"
      @close="showUsrMgrDenied = false"
    />

    <!-- 历史记录查询 — 对齐 HistoryDialog -->
    <HistoryDialog
      v-if="showHistory"
      @close="showHistory = false"
    />

    <!-- 急停确认 — 对齐 QMessageBox::question 系统提醒 / 确定执行急停操作？ -->
    <QtMessageBox
      v-if="showStopConfirmBox"
      title="系统提醒"
      message="确定执行急停操作？"
      icon="question"
      :buttons="['yes', 'no']"
      @yes="onStopConfirmYes"
      @no="onStopConfirmNo"
      @close="onStopConfirmNo"
    />

    <!-- 透视图删除 — 对齐 onPreviewTansDel：确认 / 确定要删除透视图 ？ -->
    <QtMessageBox
      v-if="showTransDelConfirm"
      title="确认"
      message="确定要删除透视图 ？"
      icon="question"
      :buttons="['yes', 'no']"
      @yes="onTransDelYes"
      @no="onTransDelNo"
      @close="onTransDelNo"
    />

    <!-- 急停复位 — 对齐 onPLCStopChanged：仅「是」按钮 -->
    <QtMessageBox
      v-if="showStopResetBox"
      title="系统提醒"
      message="设备急停！ 是否复位？"
      icon="question"
      :buttons="['yes']"
      @yes="onStopResetYes"
      @close="onStopResetClose"
    />

    <!-- 提交前查验记录预览 — 对齐 DetailDialog 查验记录页 -->
    <DetailDialog
      v-if="showSubmitPreview && submitPreview"
      mode="submit"
      :preview="submitPreview"
      @confirm="onSubmitConfirmYes"
      @close="onSubmitConfirmNo"
    />

    <!-- 重置确认 — 对齐 LvTongPro::onReset：QMessageBox 二次确认 -->
    <QtMessageBox
      v-if="showResetConfirmBox"
      title="重置"
      message="确定重置录入车辆信息吗？"
      icon="question"
      :buttons="['yes', 'no']"
      @yes="onResetConfirmYes"
      @no="onResetConfirmNo"
      @close="onResetConfirmNo"
    />

    <QtMessageBox
      v-if="stopErrorVisible"
      title="系统提醒"
      :message="stopErrorMessage"
      icon="warning"
      :buttons="['yes']"
      @yes="stopErrorVisible = false"
      @close="stopErrorVisible = false"
    />

    <!-- 主页实时视频：VisualSurveillance MJPEG；裁切叠层来自车身/透视框图（非 MJPEG 截帧） -->
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.dashboard {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  min-width: $min-app-width;
  background: #f0f0f0;
  overflow: hidden;
}

.dashboard-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.panel-left {
  flex: 1168;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.panel-right {
  flex: 728;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.panel-card {
  background: #fff;
  border: 2px solid $border-color;
  border-radius: $card-radius;
  margin: 1px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-stretch {
  flex: 2;
  min-height: 0;
}

.panel-bottom {
  flex: 0 0 200px;
  max-height: 200px;
  min-height: 150px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-video {
  flex: 6;
  min-height: 0;
}

.panel-capture {
  flex: 5;
  min-height: 0;
}

.panel-form {
  flex: 5;
  min-height: 0;
}

.panel-header,
.form-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 8px 40px;
  flex-shrink: 0;
}

.panel-header-xray {
  flex-wrap: nowrap;
  gap: 6px;
  .panel-title { margin-right: 0; }
}

.panel-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.panel-title {
  font-size: 14px;
  font-weight: bold;
  color: $text-dark;
}

.panel-header-body .panel-title {
  margin-right: 0;
}

.panel-header .panel-title,
.form-header .panel-title {
  margin-right: auto;
}

/* 车身：中间弹性空白，把保存/切换/预览顶到右上角（对齐图1） */
.panel-header-body .header-spacer {
  flex: 1 1 auto;
  width: auto;
  min-width: 8px;
  margin-left: 0;
  margin-right: 0;
}

.header-spacer {
  flex: 0 0 40px;
  width: 40px;
}

.header-icon-btn {
  background: transparent;
  border: none;
  padding: 2px;
  display: flex;
  align-items: center;
  cursor: pointer;
  img {
    width: 24px;
    height: 24px;
  }
  .reconnect-label {
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 700;
    color: #2c3e50;
    line-height: 1;
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}
.header-icon-swap img {
  width: 16px;
  height: 16px;
}

.xray-meta {
  font-size: 12px;
  color: $text-gray;
}
.xray-label {
  font-size: 12px;
  color: $text-gray;
}

/* 灰场 / 亮场：高中低下拉（对齐 color_demo，样式贴合现有 header） */
.xray-dropdown {
  position: relative;
  flex-shrink: 0;
}

.xray-dropdown-trigger {
  min-width: 52px;
  height: 26px;
  padding: 0 6px 0 8px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  border: 1px solid #c5d5f8;
  border-radius: 3px;
  background: #fff;
  color: #222;
  cursor: pointer;
  font-size: 12px;
  box-sizing: border-box;
}

.xray-dropdown.open .xray-dropdown-trigger,
.xray-dropdown-trigger:hover {
  background: #dbeafe;
  border-color: #93b4f5;
}

.xray-caret {
  font-style: normal;
  font-size: 10px;
  color: #304daf;
  line-height: 1;
}

.xray-dropdown-menu {
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  z-index: 30;
  min-width: 100%;
  margin: 0;
  padding: 2px 0;
  list-style: none;
  background: #fff;
  border: 1px solid #c5d5f8;
  border-radius: 3px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.xray-dropdown-menu li {
  padding: 4px 10px;
  cursor: pointer;
  font-size: 12px;
  color: #222;
  white-space: nowrap;
}

.xray-dropdown-menu li:hover {
  background: #eef4ff;
}

.xray-dropdown-menu li.active {
  background: #dbeafe;
  font-weight: 600;
}

.action-btn {
  /* 与 PreviewButton 一致（若别处仍引用） */
  border: 2px solid $btn-preview-bg;
  border-radius: 10px;
  background: $btn-preview-bg;
  color: $btn-preview-text;
  padding: 2px 12px;
  font-size: 13px;
  font-weight: bold;
  min-height: 28px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: $btn-preview-text;
    background: #c2d8ff;
  }
}

.video-area {
  flex: 1;
  min-height: 200px;
  background: #1a1a1a;
  border-bottom: 2px solid $border-color;
  border-radius: 0 0 12px 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.live-webrtc,
.live-mjpeg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #1a1a1a;
  z-index: 1;
}

.video-crop-preview {
  position: absolute;
  inset: 0;
  margin: auto;
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  z-index: 2;
  pointer-events: none;
  /* 盖住下层实时视频，避免半透明透出 */
  background: #1a1a1a;
}

.video-status {
  position: relative;
  z-index: 3;
  font-size: 16px;
  color: #999;
  user-select: none;
  padding: 12px;
  text-align: center;

  &.err {
    color: #c0392b;
  }
}

/* Dashboard 实时视频 iframe — 略低于弹窗 iframe（10001），避免遮挡采集弹窗 */
.dashboard-video-iframe {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  border: 0;
  margin: 0;
  padding: 0;
  background: transparent;
  pointer-events: none;
  z-index: 9999;
}

.capture-grid {
  display: grid;
  grid-template-columns: repeat(3, 200px);
  gap: 9px;
  padding: 12px 9px;
  justify-content: center;
}

.capture-btn {
  width: 200px;
  height: 110px;
  border: 2px dashed #999;
  border-radius: 0;
  background: #fff;
  font-size: 14px;
  color: #999;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  padding: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover { color: #666; border-color: #666; }

  &.has-thumb {
    border-style: solid;
    border-color: #ccc;
  }
}

.capture-thumb {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  background: #1a1a1a;
}

.form-header { padding-left: 20px; }

.form-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.form-row {
  display: grid;
  grid-template-columns: 100px 200px 24px 100px 200px 24px;
  align-items: center;
  gap: 4px 8px;
  font-size: 13px;

  label { color: #444; text-align: right; white-space: nowrap; }
  .col-right { grid-column: 4; }
  .col-gap { grid-column: 3; }
}

.field-input {
  width: 100%;
  height: 30px;
  border: none;
  border-bottom: 2px solid #e5e7eb;
  padding: 2px 8px;
  font-size: 14px;
  background: transparent;
  outline: none;
  &:focus { border-bottom-color: $accept-green; background: #f0fdf4; }
}

.field-value {
  font-size: 14px;
  color: $text-gray;
  padding: 2px 8px;
}

.icon-btn {
  background: transparent;
  border: none;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  img { width: 20px; height: 20px; }
}

.form-footer {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr;
  gap: 8px;
  padding: 12px 20px 16px;
  flex-shrink: 0;
}

.btn-reset {
  grid-column: 2;
  justify-self: start;
  min-width: 100px;
  height: 32px;
  border: none;
  border-radius: 4px;
  background: $reject-red;
  color: #ddd;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
}

.btn-confirm {
  grid-column: 5;
  justify-self: end;
  min-width: 100px;
  height: 32px;
  border: none;
  border-radius: 4px;
  background: $accept-green;
  color: #ddd;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  &:hover { background: #047857; }
}
</style>
