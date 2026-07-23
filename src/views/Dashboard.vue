<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useAuthStore } from '@/stores/useAuthStore'
import { useWsStore } from '@/stores/useWsStore'
import { request } from '@/api/request'

import AppHeader from '@/components/AppHeader.vue'
import type { ToolAnchor } from '@/components/AppHeader.vue'
import EyeWidget from '@/components/EyeWidget.vue'
import PreviewButton from '@/components/PreviewButton.vue'
import BottomWorkflowPanel from '@/components/BottomWorkflowPanel.vue'
import type { WorkflowStepKey } from '@/components/WorkflowIcons.vue'
import BookingDialog from '@/modules/booking/BookingDialog.vue'
import AgriculturalSelect from '@/components/AgriculturalSelect.vue'
import LicensePlateEdit from '@/components/LicensePlateEdit.vue'
import CarSizeDialog from '@/components/CarSizeDialog.vue'
import DeviceStatusPanel from '@/components/DeviceStatusPanel.vue'
import PlcControlDialog from '@/components/PlcControlDialog.vue'
import AiStatusDialog from '@/components/AiStatusDialog.vue'
import UserManager from '@/components/UserManager.vue'
import QtMessageBox from '@/components/common/QtMessageBox.vue'
import HistoryDialog from '@/modules/history/HistoryDialog.vue'
import CaptureCameraDialog from '@/components/capture/CaptureCameraDialog.vue'
import type { CaptureKind } from '@/components/capture/CaptureCameraDialog.vue'
import DrivingLicenseDialog from '@/components/capture/DrivingLicenseDialog.vue'
import { useBookingStore } from '@/modules/booking'
import type { BookingAcceptPayload, BookingComingPayload } from '@/modules/booking'
import { useRouter } from 'vue-router'

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

// ---- 透视参数 — 对齐 Qt sb_gammavalue / sb_whitevalue ----
/** 灰场 QDoubleSpinBox：max=5, step=0.5, 默认 2.00 */
const gammaValue = ref(2.0)
const gammaText = ref('2.00')
/** 亮场 QSpinBox：max=255, step=16, 默认 128 */
const whiteValue = ref(128)
const whiteText = ref('128')

const GAMMA_MIN = 0
const GAMMA_MAX = 5
const GAMMA_STEP = 0.5
const WHITE_MIN = 0
const WHITE_MAX = 255
const WHITE_STEP = 16

function clampNum(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function syncGamma(n: number) {
  gammaValue.value = clampNum(n, GAMMA_MIN, GAMMA_MAX)
  gammaText.value = gammaValue.value.toFixed(2)
}

function syncWhite(n: number) {
  whiteValue.value = clampNum(Math.round(n), WHITE_MIN, WHITE_MAX)
  whiteText.value = String(whiteValue.value)
}

function bumpGamma(delta: number) {
  const next = Math.round((gammaValue.value + delta) / GAMMA_STEP) * GAMMA_STEP
  syncGamma(next)
}

function bumpWhite(delta: number) {
  syncWhite(whiteValue.value + delta)
}

function onGammaBlur() {
  const n = Number.parseFloat(gammaText.value)
  if (Number.isNaN(n)) {
    gammaText.value = gammaValue.value.toFixed(2)
    return
  }
  syncGamma(n)
}

function onWhiteBlur() {
  const n = Number.parseInt(whiteText.value, 10)
  if (Number.isNaN(n)) {
    whiteText.value = String(whiteValue.value)
    return
  }
  syncWhite(n)
}

/** 透视影像路径 — 对齐 m_currentTanPath；删除确认后清空 */
const transparentImageUrl = ref('')
const showTransDelConfirm = ref(false)

/** 对齐 LvTongPro::onPreviewTansDel */
function onTransDelClick() {
  showTransDelConfirm.value = true
}

function onTransDelYes() {
  showTransDelConfirm.value = false
  transparentImageUrl.value = ''
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

/** 各格缩略图（blob/url），对齐 Qt setIcon 回写 */
const captureThumbs = ref<Partial<Record<CaptureKey, string>>>({})
/** 多图列表：货物 / 证据 */
const captureLists = ref<{ goods: string[]; evidence: string[] }>({
  goods: [],
  evidence: [],
})
const licensePaths = ref({ license: '', licenseGc: '' })

function onCaptureClick(key: CaptureKey) {
  if (key === 'license') {
    showLicenseDialog.value = true
    return
  }
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
function onReset() {
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
}

async function onConfirm() {
  if (!form.value.goods) {
    alert('请选择农产品类型')
    return
  }
  const body: Record<string, unknown> = {
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
    operator_name: auth.user?.realName || '',
  }
  try {
    const res = await request('/inspection/submit', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (res.code === 0) {
      alert('提交成功')
      onReset()
    } else {
      alert(res.message || '提交失败')
    }
  } catch (e) {
    alert('提交失败: ' + (e instanceof Error ? e.message : '未知错误'))
  }
}

// ---- 急停（对齐 LvTongPro::onStopClicked / onPLCStopChanged）----
/** 防止复位弹窗重复弹出 — 对齐 m_openStopFlag */
const openStopFlag = ref(false)
const showStopConfirmBox = ref(false)
const showStopResetBox = ref(false)
const stopErrorVisible = ref(false)
const stopErrorMessage = ref('')

// ---- WebSocket 实时数据 ----
function setupWS() {
  wsStore.connect()

  wsStore.subscribe('radar_distance', (msg) => {
    const data = msg.data as { distance?: number } | undefined
    if (data?.distance != null) {
      workflow.value.distance = data.distance
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
    console.log('[WS] 检测步骤:', msg.data)
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
  })

  wsStore.subscribe('booking_rejected', () => {
    bookingStore.applyReject()
    workflow.value.bookingActive = false
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

onMounted(() => {
  loadDicts()
  setupWS()
})

onUnmounted(() => {
  wsStore.disconnect()
})
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
        <!-- 车身影像 — 对齐 Qt：标题左，保存/切换/预览贴右上角 -->
        <div class="panel-card panel-stretch">
          <div class="panel-header panel-header-body">
            <img src="/assets/img/a_car.png" class="panel-icon" alt="" />
            <span class="panel-title">车身影像</span>
            <span class="header-spacer" aria-hidden="true" />
            <button type="button" class="header-icon-btn" title="点云量测车辆轮廓长宽高---图片保存">
              <img src="/assets/img/good_save.png" alt="" />
            </button>
            <button type="button" class="header-icon-btn header-icon-swap" title="切换视角">
              <img src="/assets/img/a_leftright.png" alt="" />
            </button>
            <PreviewButton label="预览" />
          </div>
          <EyeWidget large placeholder="车身影像" />
        </div>

        <!-- 透视影像 — 灰场/亮场对齐 QDoubleSpinBox / QSpinBox -->
        <div class="panel-card panel-stretch">
          <div class="panel-header panel-header-xray">
            <img src="/assets/img/a_xray.png" class="panel-icon" alt="" />
            <span class="panel-title">透视影像</span>
            <span class="xray-meta">200图像：</span>
            <span class="xray-label">灰场</span>
            <div class="xray-spinbox is-active">
              <input
                v-model="gammaText"
                class="xray-spin-input"
                type="text"
                inputmode="decimal"
                @blur="onGammaBlur"
                @keydown.enter="onGammaBlur"
              />
              <div class="spin-btns">
                <button type="button" class="spin-btn" title="增加" @click="bumpGamma(GAMMA_STEP)">▴</button>
                <button type="button" class="spin-btn" title="减少" @click="bumpGamma(-GAMMA_STEP)">▾</button>
              </div>
            </div>
            <span class="xray-label">亮场</span>
            <div class="xray-spinbox">
              <input
                v-model="whiteText"
                class="xray-spin-input"
                type="text"
                inputmode="numeric"
                @blur="onWhiteBlur"
                @keydown.enter="onWhiteBlur"
              />
              <div class="spin-btns">
                <button type="button" class="spin-btn" title="增加" @click="bumpWhite(WHITE_STEP)">▴</button>
                <button type="button" class="spin-btn" title="减少" @click="bumpWhite(-WHITE_STEP)">▾</button>
              </div>
            </div>
            <PreviewButton label="删除" title="不合格透视图删除" @click="onTransDelClick" />
            <PreviewButton label="渲染" />
            <PreviewButton label="预览" />
          </div>
          <EyeWidget large placeholder="透视影像" :image-url="transparentImageUrl || undefined" />
        </div>

        <!-- 底部：流程图标 + 车辆动画 + 硬件状态 -->
        <div class="panel-card panel-bottom">
          <BottomWorkflowPanel
            :booking-active="workflow.bookingActive"
            :distance="workflow.distance"
            @workflow-click="onWorkflowClick"
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
            <button class="header-icon-btn" title="货物图片保存">
              <img src="/assets/img/good_save.png" alt="" />
            </button>
          </div>
          <div class="video-area">
            <span class="video-placeholder">实时视频</span>
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
      :initial-images="captureInitialImages(captureDialog)"
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

    <QtMessageBox
      v-if="stopErrorVisible"
      title="系统提醒"
      :message="stopErrorMessage"
      icon="warning"
      :buttons="['yes']"
      @yes="stopErrorVisible = false"
      @close="stopErrorVisible = false"
    />
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

/* 对齐 Qt QSpinBox / QDoubleSpinBox：数值 + 上下调节钮 */
.xray-spinbox {
  display: inline-flex;
  align-items: stretch;
  height: 26px;
  border: 1px solid #c5d5f8;
  border-radius: 3px;
  background: #fff;
  overflow: hidden;
  box-sizing: border-box;

  &.is-active {
    background: #dbeafe;
    border-color: #93b4f5;
  }
}

.xray-spin-input {
  width: 44px;
  border: none;
  outline: none;
  background: transparent;
  font-size: 12px;
  text-align: center;
  padding: 0 4px;
  color: #222;
}

.spin-btns {
  display: flex;
  flex-direction: column;
  width: 16px;
  border-left: 1px solid #c5d5f8;
  flex-shrink: 0;
}

.spin-btn {
  flex: 1;
  margin: 0;
  padding: 0;
  border: none;
  background: #eef4ff;
  color: #304daf;
  font-size: 9px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: #dbeafe;
  }

  &:active {
    background: #c2d8ff;
  }

  & + & {
    border-top: 1px solid #c5d5f8;
  }
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
  background: #fff;
  border-bottom: 2px solid $border-color;
  border-radius: 0 0 12px 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-placeholder { font-size: 28px; color: $text-placeholder; }

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
  object-fit: fill;
  display: block;
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
