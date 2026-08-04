<script setup lang="ts">
/**
 * 可视对讲 — 对齐 Qt TalkDialog.ui / TalkDialog.cpp
 * 视频源与预约弹窗右侧同一路：camera4 → MediaMTX cam4 WHEP（主页仍为 cam1/camera2）
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useWhepPlayer } from '@/composables/useWhepPlayer'
import { TALK_WHEP_URL } from '@/config/liveVideo'

const emit = defineEmits<{
  close: []
}>()

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
  return '视频区域'
})
const showVideoHint = computed(() => videoStatus.value !== 'playing')

async function startTalkVideo() {
  const el = liveVideoRef.value
  if (!el) return
  try {
    await playVideo({ video: el, whepUrl: TALK_WHEP_URL })
  } catch {
    window.clearTimeout(videoRetryTimer)
    videoRetryTimer = window.setTimeout(() => {
      void startTalkVideo()
    }, 3000)
  }
}

async function onClose() {
  window.clearTimeout(videoRetryTimer)
  await stopVideo()
  emit('close')
}

onMounted(async () => {
  await nextTick()
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
  void startTalkVideo()
})

onBeforeUnmount(() => {
  window.clearTimeout(videoRetryTimer)
  void stopVideo()
})
</script>

<template>
  <div class="talk-overlay" @click.self="onClose">
    <div class="talk-dialog" role="dialog" aria-modal="true" aria-label="可视对讲" @click.stop>
      <h2 class="dialog-title">可视对讲</h2>

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

      <div class="bottom-row">
        <button type="button" class="btn-close" @click="onClose">关 闭</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.talk-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

/* #TalkDialog：0 #5fbb9e → 0.12 #f0f9f5 → 1 #ffffff */
.talk-dialog {
  width: 840px;
  max-width: 98vw;
  max-height: 96vh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 0 12px 12px;
  background: linear-gradient(180deg, #5fbb9e 0%, #f0f9f5 12%, #ffffff 100%);
  border: 1px solid #5fbb9e;
  font-family: 'Microsoft YaHei', '新宋体', sans-serif;
  overflow: hidden;
}

.dialog-title {
  flex: 0 0 auto;
  min-height: 50px;
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

.video-panel {
  width: 800px;
  max-width: 100%;
  height: 450px;
  max-height: 55vh;
  margin: 0 auto;
  flex-shrink: 0;
  background: #1a1a1a;
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
  z-index: 2;
  color: #999;
  font-size: 16px;
  user-select: none;
  pointer-events: none;

  &.err {
    color: #c0392b;
  }
}

.bottom-row {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 18px 0 8px;
  flex-shrink: 0;
}

.btn-close {
  min-width: 120px;
  max-width: 120px;
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  background: #ef4444;
  color: #ddd;
  font-size: 14px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;

  &:hover {
    color: #fff;
  }
}
</style>
