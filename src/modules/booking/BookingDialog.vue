<script setup lang="ts">
import ConfirmDialog from './components/ConfirmDialog.vue'
import RadarImagePanel from './components/RadarImagePanel.vue'
import SlipToggle from './components/SlipToggle.vue'
import { useBookingDialog } from './composables/useBookingDialog'
import type { BookingAcceptPayload } from './types'

const emit = defineEmits<{
  close: []
  accept: [payload: BookingAcceptPayload]
  reject: []
}>()

const {
  loading,
  radarImageUrl,
  linePosition,
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
} = useBookingDialog()

async function handleConfirmYes() {
  const kind = pendingConfirm.value?.kind
  confirmVisible.value = false
  pendingConfirm.value = null

  if (kind === 'accept') {
    const payload = buildAcceptPayload()
    await api.stopVideoSession()
    await api.acceptBooking(payload)
    emit('accept', payload)
    emit('close')
  } else if (kind === 'reject' || kind === 'close') {
    await api.stopVideoSession()
    await api.rejectBooking()
    emit('reject')
    emit('close')
  }
}

function onOverlayClick() {
  requestConfirm('close')
}

function onRejectClick() {
  requestConfirm('reject')
}

function onAcceptClick() {
  requestConfirm('accept')
}
</script>

<template>
  <div class="booking-overlay" @click.self="onOverlayClick">
    <div class="booking-dialog" @click.stop>
      <h2 class="dialog-title">预约处理</h2>

      <!-- 预览区：512×256 × 2 -->
      <div class="preview-row">
        <RadarImagePanel
          v-model:line-position="linePosition"
          :image-url="radarImageUrl"
          :darkness="0"
        />
        <div class="video-panel">
          <span class="video-placeholder">视频对讲区域</span>
        </div>
      </div>

      <!-- 工具行：刷新 + 车头信息 + 警告 -->
      <div class="tool-row">
        <span class="row-spacer row-spacer-40" />
        <button
          type="button"
          class="btn-refresh"
          title="点击刷新"
          :disabled="loading"
          @click="refreshRadarImage"
        >
          <img src="/assets/img/a_refresh.png" alt="刷新" />
        </button>
        <span class="img-info" :title="'刷新'">{{ imgInfoText }}</span>
        <span class="warning-text">请认真确认分界线位置，确保安全！</span>
        <span class="row-spacer row-spacer-300" />
        <!-- Qt 中 mic/spk 默认隐藏 -->
        <button type="button" class="btn-hidden" hidden>
          <img src="/assets/img/a_mic_open.png" alt="" />
        </button>
        <button type="button" class="btn-hidden" hidden>
          <img src="/assets/img/a_speaker_close.png" alt="" />
        </button>
        <span class="row-spacer row-spacer-220" />
      </div>

      <!-- 底栏：车型 + 透视开关 + 驳回/受理 -->
      <div class="bottom-row">
        <span class="row-spacer row-spacer-80" />
        <span class="label-vehicle">车型：</span>
        <button
          type="button"
          class="btn-vehicle"
          :title="vehicleTypeTip"
          @click="toggleVehicleType"
        >
          <img :src="vehicleTypeIcon" :alt="vehicleTypeTip" />
        </button>
        <span class="row-spacer row-spacer-100" />

        <div class="xray-group">
          <span class="xray-label" :class="xrayLabelClass">{{ xrayLabel }}</span>
          <img :src="xrayIcon" class="xray-status-icon" alt="" />
          <SlipToggle v-model="xrayEnabled" />
        </div>

        <span class="row-flex" />

        <button type="button" class="btn-reject" @click="onRejectClick">
          <img src="/assets/img/a_dismiss.png" alt="" />
          驳 回
        </button>
        <span class="row-spacer row-spacer-200" />
        <button type="button" class="btn-accept" @click="onAcceptClick">
          <img src="/assets/img/a_accept.png" alt="" />
          受 理
        </button>
        <span class="row-spacer row-spacer-100" />
      </div>
    </div>

    <ConfirmDialog
      v-if="confirmVisible && pendingConfirm"
      :title="pendingConfirm.title"
      :message="pendingConfirm.message"
      @confirm="handleConfirmYes"
      @cancel="cancelConfirm"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.booking-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

/* 对齐 OrderDialog.ui 1289×560 */
.booking-dialog {
  width: 1289px;
  height: 560px;
  max-width: 98vw;
  max-height: 96vh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, $gradient-start 0%, $gradient-mid 12%, $gradient-end 100%);
  border: 1px solid $primary;
  font-family: 'Microsoft YaHei', '新宋体', sans-serif;
  overflow: hidden;
}

.dialog-title {
  flex: 0 0 auto;
  min-height: 66px;
  max-height: 60px;
  font-size: 24px;
  font-weight: bold;
  color: $text-dark;
  text-align: center;
  padding: 10px;
  margin: 8px 8px 0;
  border-bottom: 2px solid $primary;
}

.preview-row {
  display: flex;
  justify-content: center;
  gap: 0;
  padding: 0 16px;
  flex-shrink: 0;
}

.video-panel {
  width: 512px;
  height: 256px;
  flex-shrink: 0;
  background: #1a1a2e;
  border: 2px solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-placeholder {
  color: #aaa;
  font-size: 16px;
}

.tool-row,
.bottom-row {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.tool-row {
  padding: 4px 0;
}

.bottom-row {
  padding: 9px 0;
  margin-top: auto;
}

.row-spacer {
  flex-shrink: 0;
}

.row-spacer-40 { width: 40px; }
.row-spacer-80 { width: 80px; }
.row-spacer-100 { width: 100px; }
.row-spacer-200 { width: 200px; }
.row-spacer-220 { width: 220px; }
.row-spacer-300 { width: 300px; }

.row-flex {
  flex: 1;
  min-width: 40px;
}

.btn-refresh {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 2px;
  background: #1677ff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;

  img {
    width: 24px;
    height: 24px;
  }

  &:hover:not(:disabled) {
    background: #40feff;
  }

  &:disabled {
    opacity: 0.6;
    cursor: wait;
  }
}

.img-info {
  flex: 3;
  min-width: 200px;
  font-size: 13px;
  color: $text-gray;
  word-break: break-word;
  padding: 0 8px;
}

.warning-text {
  flex: 3;
  font-size: 10px;
  font-weight: bold;
  color: $text-dark;
  font-family: 'Microsoft YaHei', sans-serif;
}

.label-vehicle {
  font-size: 14px;
  color: $text-dark;
  white-space: nowrap;
}

.btn-vehicle {
  width: 96px;
  height: 60px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;

  img {
    width: 96px;
    height: 60px;
    object-fit: contain;
  }
}

.xray-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.xray-label {
  max-width: 45px;
  font-size: 10px;
  font-weight: bold;
  white-space: nowrap;

  &.is-on {
    color: #f00;
  }

  &.is-off {
    color: #999;
  }
}

.xray-status-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.btn-reject,
.btn-accept {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100px;
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: bold;
  font-family: 'Microsoft YaHei', sans-serif;
  color: #ddd;
  cursor: pointer;
  flex-shrink: 0;

  img {
    width: 20px;
    height: 20px;
  }

  &:hover {
    color: #fff;
  }
}

.btn-reject {
  background: $reject-red;
}

.btn-accept {
  background: $accept-green;
}
</style>
