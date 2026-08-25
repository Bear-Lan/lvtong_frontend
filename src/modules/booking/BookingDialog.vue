<script setup lang="ts">
/**
 * 预约处理 — 1:1 对齐 Qt OrderDialog.ui / OrderDialog.cpp
 * 右侧：WHEP 看画面（cam4）+ 海康插件只做对讲（HWND 屏外）
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import RadarImagePanel from './components/RadarImagePanel.vue'
import SlipToggle from './components/SlipToggle.vue'
import { useBookingDialog } from './composables/useBookingDialog'
import type { BookingAcceptPayload } from './types'
import { useWhepPlayer } from '@/composables/useWhepPlayer'
import { useHikvisionPlayer } from '@/composables/useHikvisionPlayer'
import { TALK_WHEP_URL } from '@/config/liveVideo'
import { TALK_CAMERA_DEVICE_ID } from '@/config/hikvision'

const emit = defineEmits<{
  close: []
  accept: [payload: BookingAcceptPayload]
  reject: []
}>()

const {
  loading,
  submitting,
  radarImageUrl,
  radarFetchFailed,
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
  refreshRadarImage,
  toggleVehicleType,
  requestConfirm,
  cancelConfirm,
  confirmYes,
  initDialog,
} = useBookingDialog()

// ---- 画面：MediaMTX WHEP（cam_booking → /mtx/cam4）----
const liveVideoRef = ref<HTMLVideoElement | null>(null)
const {
  status: videoStatus,
  error: videoError,
  play: playVideo,
  stop: stopVideo,
} = useWhepPlayer()

let videoRetryTimer: number | undefined

const videoHint = computed(() => {
  if (videoError.value) return videoError.value
  if (videoStatus.value === 'connecting') return '连接中…'
  if (videoStatus.value === 'playing') return ''
  if (videoStatus.value === 'failed' || videoStatus.value === 'disconnected') {
    return '连接中断'
  }
  if (videoStatus.value === 'error') return videoError.value || '视频连接失败'
  return '视频对讲区域'
})
const showVideoHint = computed(() => videoStatus.value !== 'playing')

async function startBookingVideo() {
  const el = liveVideoRef.value
  if (!el) return
  try {
    await playVideo({ video: el, whepUrl: TALK_WHEP_URL })
  } catch {
    window.clearTimeout(videoRetryTimer)
    videoRetryTimer = window.setTimeout(() => {
      void startBookingVideo()
    }, 3000)
  }
}

// ---- 对讲：播报完成后再自动开对讲，播报中必须关闭 ----
const hikTalkAnchorRef = ref<HTMLElement | null>(null)
const {
  status: talkStatus,
  statusText: talkStatusText,
  talking,
  talkBusy,
  iframeRef,
  iframeSrc,
  start: startHik,
  stop: stopHik,
  onIframeLoad,
  hidePluginOverlay,
  toggleTalk,
  stopTalk,
  startTalk,
} = useHikvisionPlayer(hikTalkAnchorRef)

/** 后端 /booking/open 阻塞播 step2 期间 */
const announcePlaying = ref(true)

const talkHint = computed(() => {
  if (announcePlaying.value) return '语音播报中，稍后自动开对讲…'
  if (talkBusy.value) return talking.value ? '对讲连接中…' : '正在停止对讲…'
  if (talking.value) return '对讲中'
  if (talkStatus.value === 'error') return talkStatusText.value || '对讲失败'
  if (talkStatus.value === 'loading') return '对讲连接中…'
  if (talkStatus.value === 'playing') return '可对讲'
  return ''
})
const canToggleTalk = computed(
  () =>
    !announcePlaying.value &&
    !talkBusy.value &&
    (talkStatus.value === 'playing' || talking.value),
)

/** 左侧雷达图是否已在浏览器解码完成 */
const radarImageReady = ref(false)
watch(radarImageUrl, () => {
  radarImageReady.value = false
})

const videoReady = computed(() => videoStatus.value === 'playing')
const talkReady = computed(() => talkStatus.value === 'playing' || talking.value)
const radarReady = computed(
  () => !!radarImageUrl.value && radarImageReady.value && !loading.value,
)
/** 受理：视频 + 左侧图就绪（播报完成后即可，不强制对讲已开） */
const canAccept = computed(
  () =>
    !announcePlaying.value &&
    videoReady.value &&
    radarReady.value &&
    !submitting.value,
)
/** 驳回：拉图失败或非加载中即可驳回（避免雷达超时把界面卡死） */
const canReject = computed(
  () =>
    !announcePlaying.value &&
    !submitting.value &&
    !loading.value &&
    (radarReady.value || radarFetchFailed.value),
)
const decideHint = computed(() => {
  if (submitting.value) return ''
  if (announcePlaying.value) return '正在语音播报「申请已接收…」，播完后自动开启对讲'
  if (loading.value) return '正在拉取雷达图（失败会自动重试），请稍候…'
  if (canAccept.value) return ''
  if (radarFetchFailed.value && !radarReady.value) {
    return '雷达图拉取失败：可点刷新重试，或直接驳回'
  }
  const missing: string[] = []
  if (!radarReady.value) missing.push('左侧图')
  if (!videoReady.value) missing.push('视频')
  if (!missing.length) return ''
  return `请等待${missing.join('、')}加载完成后再受理`
})

function onRadarImageLoaded() {
  radarImageReady.value = true
}

function onRadarImageError() {
  radarImageReady.value = false
}

async function handleConfirmYes() {
  try {
    // 受理/驳回前先停 WHEP + 海康对讲，不依赖用户先点「停止对讲」
    try {
      await stopVideo()
    } catch {
      /* ignore */
    }
    try {
      await stopHik()
    } catch {
      /* ignore */
    }
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
  if (submitting.value || loading.value || announcePlaying.value) return
  requestConfirm('close')
}

function onRejectClick() {
  if (!canReject.value) return
  requestConfirm('reject')
}

function onAcceptClick() {
  if (!canAccept.value) return
  requestConfirm('accept')
}

watch(confirmVisible, (visible) => {
  if (visible) hidePluginOverlay()
})

onMounted(async () => {
  await nextTick()
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
  // 1) WHEP 画面可先开（不占 TwoWayAudio）
  void startBookingVideo()
  try {
    stopTalk()
  } catch {
    /* ignore */
  }
  // 2) 只预热海康插件，不要 autoTalk：避免抢在 step2 前占 TwoWayAudio
  startHik(TALK_CAMERA_DEVICE_ID, { autoTalk: false, talkOnly: true })
  announcePlaying.value = true
  try {
    await initDialog({ fetchRadar: false })
  } finally {
    announcePlaying.value = false
  }
  // 3) step2 播完且 /open 返回后再开对讲（插件可能仍在加载，短等 playing）
  void (async () => {
    for (let i = 0; i < 50; i++) {
      if (talkStatus.value === 'playing') break
      await new Promise<void>((r) => window.setTimeout(r, 100))
    }
    await startTalk()
  })()
  void refreshRadarImage({ maxRetries: 2 })
})

onBeforeUnmount(() => {
  window.clearTimeout(videoRetryTimer)
  void stopVideo()
  void stopHik()
})
</script>

<template>
  <div class="booking-overlay" @click.self="onOverlayClick">
    <div class="booking-dialog" role="dialog" aria-modal="true" @click.stop>
      <h2 class="dialog-title">预约处理</h2>

      <div class="preview-row">
        <RadarImagePanel
          v-model:line-position="linePosition"
          :image-url="radarImageUrl"
          :darkness="0"
          always-show-line
          @loaded="onRadarImageLoaded"
          @error="onRadarImageError"
        />
        <div class="video-panel">
          <video
            ref="liveVideoRef"
            class="live-webrtc"
            muted
            autoplay
            playsinline
          />
          <div
            v-if="showVideoHint"
            class="video-status"
            :class="{ err: videoStatus === 'error' || !!videoError }"
          >
            {{ videoHint }}
          </div>
        </div>
      </div>

      <div
        ref="hikTalkAnchorRef"
        class="hik-talk-anchor"
        aria-hidden="true"
      />

      <div class="tool-row">
        <span class="sp sp-40" />
        <button
          type="button"
          class="btn-refresh"
          title="点击刷新雷达图"
          :disabled="loading || submitting"
          @click="() => refreshRadarImage({ maxRetries: 2 })"
        >
          <img src="/assets/img/a_refresh.png" alt="刷新" />
        </button>
        <span class="img-info" :title="imgInfoText">{{ imgInfoText }}</span>
        <span class="warning-text">请认真确认分界线位置，确保安全！</span>
        <button
          type="button"
          class="btn-talk"
          :class="{ on: talking }"
          :disabled="!canToggleTalk"
          :title="talkHint || '对讲'"
          @click="toggleTalk"
        >
          {{ talking ? '停止对讲' : '对讲' }}
        </button>
        <span v-if="talkHint" class="talk-hint" :class="{ err: talkStatus === 'error' }">
          {{ talkHint }}
        </span>
        <span class="sp sp-120" />
        <button type="button" class="btn-hidden" hidden aria-hidden="true" />
        <span class="sp sp-220" />
      </div>

      <p v-if="errorMessage" class="error-tip">{{ errorMessage }}</p>
      <p v-else-if="decideHint" class="decide-hint">{{ decideHint }}</p>

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
          :disabled="!canReject"
          :title="canReject ? '驳回' : decideHint || '驳回'"
          @click="onRejectClick"
        >
          <img src="/assets/img/a_dismiss.png" alt="" />
          驳 回
        </button>
        <span class="flex-2" />
        <button
          type="button"
          class="btn-accept"
          :disabled="!canAccept"
          :title="canAccept ? '受理' : decideHint || '受理'"
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

    <iframe
      v-if="iframeSrc"
      ref="iframeRef"
      class="hik-iframe-fs"
      :src="iframeSrc"
      title="预约对讲"
      allow="microphone; fullscreen"
      @load="onIframeLoad"
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
  background: #1a1a1a;
  border: none;
  outline: none;
  box-shadow: none;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.live-webrtc {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #1a1a1a;
  z-index: 1;
}

.video-status {
  position: relative;
  z-index: 3;
  color: #999;
  font-size: 16px;
  user-select: none;
  pointer-events: none;

  &.err {
    color: #c0392b;
  }
}

/* 插件 HWND 锚点：屏外，不影响 WHEP 画面与按钮点击 */
.hik-talk-anchor {
  position: fixed;
  left: -10000px;
  top: -10000px;
  width: 160px;
  height: 90px;
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
}

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
  z-index: 1001;
}

.tool-row {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 0;
  margin: 28px 0 0;
  min-height: 32px;
}

.btn-talk {
  flex-shrink: 0;
  margin-left: 8px;
  min-width: 72px;
  padding: 4px 10px;
  border: none;
  border-radius: 4px;
  background: #059669;
  color: #ddd;
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;

  &.on {
    background: #d97706;
  }

  &:hover:not(:disabled) {
    color: #fff;
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}

.talk-hint {
  flex-shrink: 0;
  margin-left: 8px;
  font-size: 12px;
  color: #059669;
  white-space: nowrap;

  &.err {
    color: #c0392b;
  }
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

.flex-2 {
  flex: 2;
  min-width: 40px;
}

.btn-refresh {
  width: 28px;
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

.img-info {
  flex: 3;
  min-width: 200px;
  font-size: 14.95px;
  color: #666;
  word-break: break-word;
  padding: 0 4px;
}

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

.decide-hint {
  margin: 0 24px;
  font-size: 12px;
  color: #b45309;
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
    cursor: not-allowed;
  }
}

.btn-reject {
  background: #ef4444;
}

.btn-accept {
  background: #059669;
}
</style>
