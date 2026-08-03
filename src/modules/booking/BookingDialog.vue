<script setup lang="ts">
/**
 * 预约处理 — 1:1 对齐 Qt OrderDialog.ui / OrderDialog.cpp
 * 背景渐变穿透无边框预览区；红线仅在左侧雷达区可拖动
 *
 * 视频对讲区域当前**已关闭**：保留 DOM 容器与 placeholder 文案，
 * 但不启动海康插件、不渲染 videoStreamUrl、不挂载全屏 iframe。
 * Dashboard 实时视频区不受影响（本来就没启用）。
 */
import { computed, ref } from 'vue'
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
  submitting,
  radarImageUrl,
  linePosition,
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
  videoStreamUrl,   // 保留引用以保持 layout，渲染上不输出
  refreshRadarImage,
  toggleVehicleType,
  requestConfirm,
  cancelConfirm,
  confirmYes,
} = useBookingDialog()

// ---- 视频对讲区域：已禁用 ----
//   不再调 useHikvisionPlayer；不 startVideo、不挂 iframe。
//   DOM 容器保留以便后续重新启用时不破坏 layout。
const videoStageRef = ref<HTMLElement | null>(null)
const VIDEO_DISABLED_HINT = '预约视频对讲已关闭'

async function handleConfirmYes() {
  try {
    const result = await confirmYes()
    if (result?.kind === 'accept') {
      emit('accept', result.payload)
      emit('close')
    } else if (result?.kind === 'reject') {
      emit('reject')
      emit('close')
    }
  } catch {
    // errorMessage 已写入，保持弹窗打开
  }
}

function onOverlayClick() {
  if (submitting.value) return
  requestConfirm('close')
}

function onRejectClick() {
  if (submitting.value) return
  requestConfirm('reject')
}

function onAcceptClick() {
  if (submitting.value) return
  requestConfirm('accept')
}
</script>

<template>
  <div class="booking-overlay" @click.self="onOverlayClick">
    <div class="booking-dialog" role="dialog" aria-modal="true" @click.stop>
      <!-- 对齐 titleLabel：居中 + 透明底，绿渐变透过 -->
      <h2 class="dialog-title">预约处理</h2>

      <!-- frame NoFrame：左右 512×256 无边框，背景透明透出渐变 -->
      <div class="preview-row">
        <RadarImagePanel
          v-model:line-position="linePosition"
          :image-url="radarImageUrl"
          :darkness="0"
          always-show-line
        />
        <div class="video-panel">
          <div ref="videoStageRef" class="video-stage">
            <!-- 海康插件锚点已停用，保留 DOM 以便未来重新启用 -->
          </div>
          <div class="video-status">{{ VIDEO_DISABLED_HINT }}</div>
        </div>
      </div>

      <!-- horizontalLayout_4 stretch 0,0,3,3,0,0,0,0,0 -->
      <div class="tool-row">
        <span class="sp sp-40" />
        <button
          type="button"
          class="btn-refresh"
          title="点击刷新"
          :disabled="loading || submitting"
          @click="refreshRadarImage"
        >
          <img src="/assets/img/a_refresh.png" alt="刷新" />
        </button>
        <span class="img-info" :title="imgInfoText">{{ imgInfoText }}</span>
        <span class="warning-text">请认真确认分界线位置，确保安全！</span>
        <span class="sp sp-300" />
        <button type="button" class="btn-hidden" hidden aria-hidden="true" />
        <span class="sp sp-120" />
        <button type="button" class="btn-hidden" hidden aria-hidden="true" />
        <span class="sp sp-220" />
      </div>

      <p v-if="errorMessage" class="error-tip">{{ errorMessage }}</p>

      <!-- horizontalLayout stretch 0,0,0,0,0,0,2,0,2,0 -->
      <div class="bottom-row">
        <span class="sp sp-80" />
        <span class="label-vehicle">车型：</span>
        <button
          type="button"
          class="btn-vehicle"
          :title="vehicleTypeTip"
          :disabled="submitting"
          @click="toggleVehicleType"
        >
          <img :src="vehicleTypeIcon" :alt="vehicleTypeTip" />
        </button>
        <span class="sp sp-100" />

        <div class="xray-group">
          <span class="xray-label" :class="xrayLabelClass">{{ xrayLabel }}</span>
          <img :src="xrayIcon" class="xray-status-icon" alt="" />
          <SlipToggle v-model="xrayEnabled" />
        </div>

        <span class="flex-2" />

        <button
          type="button"
          class="btn-reject"
          :disabled="submitting"
          @click="onRejectClick"
        >
          <img src="/assets/img/a_dismiss.png" alt="" />
          驳 回
        </button>
        <span class="flex-2" />
        <button
          type="button"
          class="btn-accept"
          :disabled="submitting"
          @click="onAcceptClick"
        >
          <img src="/assets/img/a_accept.png" alt="" />
          受 理
        </button>
        <span class="sp sp-100" />
      </div>
    </div>

    <ConfirmDialog
      v-if="confirmVisible && pendingConfirm"
      :title="pendingConfirm.title"
      :message="pendingConfirm.message"
      @confirm="handleConfirmYes"
      @cancel="cancelConfirm"
    />

    <!-- 全屏透明 iframe 承载海康插件，已停用 -->
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

/* #OrderDialog 渐变：0 #5fbb9e → 0.12 #f0f9f5 → 1 #ffffff */
.booking-dialog {
  width: 1289px;
  height: 560px;
  max-width: 98vw;
  max-height: 96vh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 0;
  background: linear-gradient(
    180deg,
    #5fbb9e 0%,
    #f0f9f5 12%,
    #ffffff 100%
  );
  border: 1px solid #5fbb9e;
  font-family: 'Microsoft YaHei', '新宋体', sans-serif;
  overflow: hidden;
}

.dialog-title {
  flex: 0 0 auto;
  min-height: 60px;
  max-height: 66px;
  margin: 8px;
  padding: 10px;
  font-size: 24px;
  font-weight: 700;
  color: #2c3e50;
  text-align: center;
  background: transparent;
  border: none;
  box-sizing: border-box;
}

/* 无边框、透明底 — 渐变绿色透过，避免「一大片死白」 */
.preview-row {
  display: flex;
  justify-content: center;
  align-items: stretch;
  gap: 0;
  padding: 0;
  margin: 0;
  flex-shrink: 0;
  background: transparent;
}

.video-panel {
  width: 512px;
  height: 256px;
  flex-shrink: 0;
  background: transparent;
  border: none;
  outline: none;
  box-shadow: none;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.video-stage {
  position: absolute;
  inset: 0;
  background: transparent;
}

.video-stream {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.video-status {
  position: relative;
  z-index: 1;
  color: #999;
  font-size: 16px;
  user-select: none;
  pointer-events: none;

  &.err {
    color: #c0392b;
  }
}

.video-placeholder {
  color: #666;
  font-size: 16px;
}

/* 全屏透明 iframe：内部 #divPlugin 用父页下发的视频区屏幕坐标定位 */
.hik-iframe-fs {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  border: 0;
  margin: 0;
  padding: 0;
  background: transparent;
  pointer-events: none;
  z-index: 1000;
}

.tool-row {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 0;
  /* 整行再下移一些 */
  margin: 28px 0 0;
  min-height: 32px;
}

.bottom-row {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 9px 0;
  margin-top: auto;
}

.sp {
  flex-shrink: 0;
  display: block;
}
.sp-40 {
  width: 40px;
}
.sp-80 {
  width: 80px;
}
.sp-100 {
  width: 100px;
}
.sp-120 {
  width: 120px;
}
.sp-220 {
  width: 220px;
}
.sp-300 {
  width: 300px;
}

.flex-2 {
  flex: 2;
  min-width: 40px;
}

.btn-refresh {
  width: 28px; /* 24×1.15 */
  height: 28px;
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
    width: 28px;
    height: 28px;
  }

  &:hover:not(:disabled) {
    background: #40feff;
  }

  &:disabled {
    opacity: 0.6;
    cursor: wait;
  }
}

/* stretch 3 — 字号 ×1.15 */
.img-info {
  flex: 3;
  min-width: 200px;
  font-size: 14.95px; /* 13×1.15 */
  color: #666;
  word-break: break-word;
  padding: 0 4px;
}

/* stretch 3 — 相对原 10px ×1.4，加黑 */
.warning-text {
  flex: 3;
  font-size: 14px;
  font-weight: 900;
  color: #000;
  font-family: 'Microsoft YaHei', sans-serif;
  white-space: nowrap;
  text-align: left;
}

.error-tip {
  margin: 0 24px;
  font-size: 12px;
  color: #c0392b;
}

.label-vehicle {
  font-size: 14px;
  color: #2c3e50;
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

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.xray-group {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.xray-label {
  max-width: 45px;
  font-size: 10px;
  font-weight: 700;
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
  justify-content: center;
  gap: 4px;
  max-width: 100px;
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 700;
  font-family: 'Microsoft YaHei', sans-serif;
  color: #ddd;
  cursor: pointer;
  flex-shrink: 0;

  img {
    width: 20px;
    height: 20px;
  }

  &:hover:not(:disabled) {
    color: #fff;
  }

  &:disabled {
    opacity: 0.55;
    cursor: wait;
  }
}

.btn-reject {
  background: #ef4444;
}

.btn-accept {
  background: #059669;
}
</style>
