<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useAuthStore } from '@/stores/useAuthStore'
import { useWsStore } from '@/stores/useWsStore'
import { request } from '@/api/request'

import AppHeader from '@/components/AppHeader.vue'
import EyeWidget from '@/components/EyeWidget.vue'
import PreviewButton from '@/components/PreviewButton.vue'
import BottomWorkflowPanel from '@/components/BottomWorkflowPanel.vue'
import type { WorkflowStepKey } from '@/components/WorkflowIcons.vue'
import BookingDialog from '@/modules/booking/BookingDialog.vue'
import AgriculturalSelect from '@/components/AgriculturalSelect.vue'
import LicensePlateEdit from '@/components/LicensePlateEdit.vue'
import DeviceStatusPanel from '@/components/DeviceStatusPanel.vue'
import QtMessageBox from '@/components/common/QtMessageBox.vue'

const auth = useAuthStore()
const wsStore = useWsStore()

const showBooking = ref(false)
const workflow = ref({
  bookingActive: false,
  distance: 0,
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

// ---- 透视参数 ----
const gammaValue = ref(2.0)
const gammaText = ref('2.00')
const whiteValue = ref(128)

function onGammaBlur() {
  const n = Number.parseFloat(gammaText.value)
  if (!Number.isNaN(n)) {
    gammaValue.value = n
    gammaText.value = n.toFixed(2)
  } else {
    gammaText.value = gammaValue.value.toFixed(2)
  }
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

// ---- 设备状态面板 ----
const deviceStatusRef = ref<InstanceType<typeof DeviceStatusPanel> | null>(null)

// ---- 图像采集 ----
const captureButtons = [
  { key: 'head', label: '车头' },
  { key: 'tail', label: '车尾' },
  { key: 'top', label: '车顶' },
  { key: 'goods', label: '货物' },
  { key: 'license', label: '行驶证' },
  { key: 'evidence', label: '证据照' },
]

// ---- 预约 ----
function simulateBooking() {
  showBooking.value = true
}
function onWorkflowClick(key: WorkflowStepKey) {
  if (key === 'book') {
    showBooking.value = true
  }
}
function onBookingAccept() {
  workflow.value.bookingActive = true
  showBooking.value = false
}
function onBookingReject() {
  workflow.value.bookingActive = false
  showBooking.value = false
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
}

function onStopClick() {
  // 对齐 QMessageBox::question(this, "系统提醒", "确定执行急停操作？", Yes|No)
  showStopConfirmBox.value = true
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
      @tool-click="(key: string) => { if (key === 'device') deviceStatusRef?.show(); else if (key === 'stop') onStopClick(); }"
    />

    <div class="dashboard-body">
      <!-- 左侧 -->
      <section class="panel-left">
        <!-- 车身影像 -->
        <div class="panel-card panel-stretch">
          <div class="panel-header panel-header-body">
            <img src="/assets/img/a_car.png" class="panel-icon" alt="" />
            <span class="panel-title">车身影像</span>
            <button class="header-icon-btn" title="点云量测车辆轮廓长宽高---图片保存">
              <img src="/assets/img/good_save.png" alt="" />
            </button>
            <button class="header-icon-btn header-icon-swap" title="切换视角">
              <img src="/assets/img/a_leftright.png" alt="" />
            </button>
            <PreviewButton label="预览" />
            <span class="header-spacer" />
          </div>
          <EyeWidget large placeholder="车身影像" />
        </div>

        <!-- 透视影像 -->
        <div class="panel-card panel-stretch">
          <div class="panel-header panel-header-xray">
            <img src="/assets/img/a_xray.png" class="panel-icon" alt="" />
            <span class="panel-title">透视影像</span>
            <span class="xray-meta">200图像：</span>
            <span class="xray-label">灰场</span>
            <input
              v-model="gammaText"
              type="text"
              inputmode="decimal"
              class="xray-spin is-active"
              @blur="onGammaBlur"
            />
            <span class="xray-label">亮场</span>
            <input v-model.number="whiteValue" type="number" step="16" min="0" max="255" class="xray-spin" />
            <button class="action-btn">删除</button>
            <button class="action-btn">渲染</button>
          </div>
          <EyeWidget large placeholder="透视影像" />
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
            <button v-for="btn in captureButtons" :key="btn.key" class="capture-btn">
              {{ btn.label }}
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
              <button class="icon-btn" title="轮廓尺寸编辑">
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

    <!-- 预约弹窗 -->
    <BookingDialog
      v-if="showBooking"
      @close="showBooking = false"
      @accept="onBookingAccept"
      @reject="onBookingReject"
    />

    <!-- 农产品选择弹窗 -->
    <AgriculturalSelect
      ref="agriculturalSelectRef"
      @confirm="onAgriculturalConfirm"
      @close="() => {}"
    />

    <!-- 车牌编辑弹窗 -->
    <LicensePlateEdit
      ref="licensePlateRef"
      :current-plate="form.plate === '--' ? '' : form.plate"
      :current-color="form.plateColor"
      title="车牌修改"
      @confirm="onPlateConfirm"
      @close="() => {}"
    />
    <LicensePlateEdit
      ref="licensePlateGCRef"
      :current-plate="form.plateGc === '--' ? '' : form.plateGc"
      :current-color="form.plateGcColor"
      title="挂车车牌修改"
      @confirm="onPlateGCConfirm"
      @close="() => {}"
    />

    <!-- 设备状态弹窗 -->
    <DeviceStatusPanel ref="deviceStatusRef" />

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

.panel-header-body .panel-title { margin-right: 0; }
.panel-header .panel-title,
.form-header .panel-title { margin-right: auto; }

.header-spacer {
  flex: 0 0 40px;
  width: 40px;
  margin-left: auto;
}

.header-icon-btn {
  background: transparent;
  border: none;
  padding: 2px;
  display: flex;
  align-items: center;
  img { width: 24px; height: 24px; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
}
.header-icon-swap img { width: 16px; height: 16px; }

.xray-meta { font-size: 12px; color: $text-gray; }
.xray-label { font-size: 12px; color: $text-gray; }

.xray-spin {
  width: 56px;
  height: 24px;
  border: 1px solid #c5d5f8;
  border-radius: 3px;
  padding: 0 6px;
  font-size: 12px;
  text-align: center;
  background: #fff;
  outline: none;
  &.is-active { background: #dbeafe; border-color: #93b4f5; }
  &:focus { background: #dbeafe; border-color: #60a5fa; }
}

.action-btn {
  border: 2px solid $btn-preview-bg;
  border-radius: 10px;
  background: $btn-preview-bg;
  color: $btn-preview-text;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
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
  &:hover { color: #666; border-color: #666; }
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
