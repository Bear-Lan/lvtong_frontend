<script setup lang="ts">
/**
 * 图像采集弹窗 — 1:1 对齐 Qt GetPic/Tail/Top/Goods/Evidence (1400×713)
 * - 球机：显示云台；horizontalLayout：云台 | 拍照 | 确认选择（横排）
 * - 其它相机：隐藏云台，拍照 | 确认选择 横排
 * - 货物/证据才有「图片数量」+「选中删除」（GetGoods/Evidence）；车头/尾/顶无
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  HIK_DISABLED_CAMERAS,
  HIK_ENABLED_CAMERAS,
  resolveCameraDeviceId,
} from '@/config/hikvision'
import { useHikvisionPlayer } from '@/composables/useHikvisionPlayer'

export type CaptureKind = 'head' | 'tail' | 'top' | 'goods' | 'evidence'

const props = defineProps<{
  kind: CaptureKind
  initialImages?: string[]
}>()

const emit = defineEmits<{
  close: []
  confirm: [images: string[]]
}>()

const TITLE_MAP: Record<CaptureKind, string> = {
  head: '车头图片',
  tail: '车尾图片',
  top: '车顶图片',
  goods: '货物图片',
  evidence: '证据照',
}

/** 打开弹窗时默认选中的相机 Tab（货物/证据仍默认车头） */
const DEFAULT_CAMERA: Record<CaptureKind, string> = {
  head: '车头相机',
  tail: '车尾相机',
  top: '车顶相机',
  goods: '车头相机',
  evidence: '车头相机',
}

const MAX_MAP: Partial<Record<CaptureKind, number>> = {
  goods: 16,
  evidence: 8,
}

/** 截图顺序：车顶 → 车头 → 车尾 → 球机 → 预约 */
const CAMERAS = ['车顶相机', '车头相机', '车尾相机', '球机', '预约相机'] as const
const DISABLED_CAMERAS = new Set<string>(HIK_DISABLED_CAMERAS)
const ENABLED_CAMERAS = new Set<string>(HIK_ENABLED_CAMERAS)

const isMulti = computed(() => props.kind === 'goods' || props.kind === 'evidence')
const maxCount = computed(() => MAX_MAP[props.kind] ?? 1)
const thumbW = computed(() => (isMulti.value ? 110 : 200))
const thumbH = 110

const activeCamera = ref(DEFAULT_CAMERA[props.kind])
/** 对齐 switchToCamera：仅球机显示云台 */
const showPtz = computed(() => activeCamera.value === '球机')
const switchingCamera = ref(false)

const photos = ref<string[]>([])
const selectedIndex = ref(0)
const fileInputRef = ref<HTMLInputElement | null>(null)
const capturing = ref(false)
const closing = ref(false)
/** 黑色预览锚点：把屏幕坐标发给全屏 iframe，在内部摆插件 */
const liveStageRef = ref<HTMLElement | null>(null)

const {
  status: hikStatus,
  statusText: hikStatusText,
  iframeRef,
  iframeSrc,
  currentDeviceId,
  start: startHik,
  stop: stopHik,
  onIframeLoad,
  captureJpegDataUrl,
  postLayout,
  ptzStart,
  ptzStop,
} = useHikvisionPlayer(liveStageRef)

const liveHint = computed(() => hikStatusText.value || '实时摄像头画面区域')
const showLiveHint = computed(() => hikStatus.value !== 'playing')

const countText = computed(() => {
  if (!isMulti.value) return ''
  return `图片数量: ${photos.value.length}/${maxCount.value}`
})

const selectedSrc = computed(() => {
  if (!photos.value.length) return ''
  const i = Math.min(Math.max(0, selectedIndex.value), photos.value.length - 1)
  return photos.value[i] || ''
})

function isCameraDisabled(name: string) {
  return DISABLED_CAMERAS.has(name) || !ENABLED_CAMERAS.has(name)
}

function syncKind() {
  activeCamera.value = DEFAULT_CAMERA[props.kind]
  photos.value = [...(props.initialImages ?? [])].filter(Boolean)
  selectedIndex.value = 0
}

watch(() => props.kind, syncKind)
watch(
  () => props.initialImages,
  () => {
    photos.value = [...(props.initialImages ?? [])].filter(Boolean)
    selectedIndex.value = 0
  },
)

onMounted(async () => {
  syncKind()
  await nextTick()
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
  startHik(resolveCameraDeviceId(activeCamera.value))
  // 布局稳定后强制下发一次坐标（仅一次，避免轮询导致黑闪）
  window.setTimeout(() => postLayout(true), 300)
})

onBeforeUnmount(() => {
  void stopHik()
})

async function selectCamera(name: string) {
  if (isCameraDisabled(name) || switchingCamera.value || closing.value) return
  if (name === activeCamera.value) return

  const nextId = resolveCameraDeviceId(name)
  const prevId = currentDeviceId.value
  activeCamera.value = name

  // 同一物理设备（如四路枪机共用 camera2）只改高亮
  if (nextId === prevId) return

  switchingCamera.value = true
  try {
    await stopHik()
    await nextTick()
    startHik(nextId)
    window.setTimeout(() => postLayout(true), 300)
  } finally {
    switchingCamera.value = false
  }
}

/** 海康 PTZ 索引：↖5 ↑1 ↗7 ←3 ↻9 →4 ↙6 ↓2 ↘8 −11 +10 */
function onPtzPointerDown(ev: PointerEvent, index: number) {
  if (!showPtz.value || hikStatus.value !== 'playing') return
  const el = ev.currentTarget as HTMLElement
  try {
    el.setPointerCapture(ev.pointerId)
  } catch {
    /* ignore */
  }
  if (index === 9) {
    ptzStart(9)
    return
  }
  ptzStart(index)
}

function onPtzPointerUp(ev: PointerEvent, index: number) {
  if (!showPtz.value) return
  const el = ev.currentTarget as HTMLElement
  try {
    if (el.hasPointerCapture(ev.pointerId)) el.releasePointerCapture(ev.pointerId)
  } catch {
    /* ignore */
  }
  // 自动为点击切换，不在 pointerup 停
  if (index === 9) return
  ptzStop(index)
}

function pushPhoto(url: string) {
  if (isMulti.value) {
    if (photos.value.length >= maxCount.value!) {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url)
      return
    }
    photos.value.push(url)
    selectedIndex.value = photos.value.length - 1
  } else {
    photos.value.push(url)
    selectedIndex.value = photos.value.length - 1
  }
}

async function onCaptureClick() {
  if (isMulti.value && photos.value.length >= maxCount.value!) return
  if (hikStatus.value === 'playing') {
    capturing.value = true
    try {
      const dataUrl = await captureJpegDataUrl()
      pushPhoto(dataUrl)
      return
    } catch {
      // SDK 抓图失败时回退本地选图，避免阻断现有流程
    } finally {
      capturing.value = false
    }
  }
  fileInputRef.value?.click()
}

function onFileChosen(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const url = URL.createObjectURL(file)
  pushPhoto(url)
}

function selectPhoto(idx: number) {
  selectedIndex.value = idx
}

function onDeleteSelected() {
  if (!isMulti.value || !photos.value.length) return
  const idx = selectedIndex.value
  const [removed] = photos.value.splice(idx, 1)
  if (removed?.startsWith('blob:')) URL.revokeObjectURL(removed)
  selectedIndex.value = Math.min(idx, Math.max(0, photos.value.length - 1))
}

async function closeDialog(after?: () => void) {
  if (closing.value) return
  closing.value = true
  try {
    // 必须先销毁原生插件窗口，再卸 DOM，否则主界面会残留不透明方块
    await stopHik()
  } finally {
    after?.()
    emit('close')
  }
}

async function onConfirm() {
  await closeDialog(() => {
    if (isMulti.value) emit('confirm', [...photos.value])
    else emit('confirm', selectedSrc.value ? [selectedSrc.value] : [])
  })
}

async function onClose() {
  await closeDialog()
}

function openPreview() {
  if (selectedSrc.value) window.open(selectedSrc.value, '_blank')
}
</script>

<template>
  <!-- 必须 Teleport 到 body：父级 ScreenScaler 有 CSS transform，海康原生插件嵌在其中会卡死页面 -->
  <Teleport to="body">
  <div class="cap-overlay" @click.self="onClose">
    <div
      class="cap-dialog"
      role="dialog"
      aria-modal="true"
      :aria-label="TITLE_MAP[kind]"
      @click.stop
    >
      <div class="titlebar">
        <img class="title-icon" src="/assets/img/logo.ico" alt="" />
        <span class="title-text">{{ TITLE_MAP[kind] }}</span>
        <button type="button" class="btn-x" title="关闭" :disabled="closing" @click="onClose">
          ×
        </button>
      </div>

      <div class="split">
        <!-- ========== 左栏 ========== -->
        <section class="col col-left">
          <div class="img-stage" @click="openPreview">
            <img v-if="selectedSrc" :src="selectedSrc" class="stage-img" alt="" />
          </div>

          <div class="gallery">
            <div class="gallery-inner">
              <button
                v-for="(src, idx) in photos"
                :key="idx + src.slice(-8)"
                type="button"
                class="thumb"
                :class="{ on: idx === selectedIndex }"
                :style="{ width: thumbW + 'px', height: thumbH + 'px' }"
                @click="selectPhoto(idx)"
              >
                <img :src="src" alt="" />
              </button>
            </div>
          </div>

          <div v-if="isMulti" class="multi-footer">
            <span class="count">{{ countText }}</span>
            <button type="button" class="btn-del" @click="onDeleteSelected">选中删除</button>
          </div>
        </section>

        <!-- ========== 右栏 ========== -->
        <section class="col col-right">
          <div class="cam-row">
            <button
              v-for="cam in CAMERAS"
              :key="cam"
              type="button"
              class="cam-tab"
              :class="{ on: activeCamera === cam, disabled: isCameraDisabled(cam) || switchingCamera }"
              :disabled="isCameraDisabled(cam) || switchingCamera"
              @click="selectCamera(cam)"
            >
              {{ cam }}
            </button>
          </div>

          <div class="live-wrap">
            <div ref="liveStageRef" class="live-stage">
              <!-- 黑区仅作锚点；实际插件在全屏透明 iframe 内按屏幕坐标定位 -->
            </div>
            <div v-if="showLiveHint" class="live-status" :class="{ err: hikStatus === 'error' }">
              {{ liveHint }}
            </div>
          </div>

          <!-- 对齐 Qt horizontalLayout_2：云台 | 拍照 | spacer | 确认选择（始终横排） -->
          <div class="bottom-ctrl">
            <!-- 用 div 模拟 QGroupBox：fieldset+flex 无法撑满高度 -->
            <div v-show="showPtz" class="ptz">
              <div class="ptz-title">360°球机操作云台</div>
              <div class="ptz-body">
                <div class="ptz-dirs">
                  <button
                    type="button"
                    class="ptz-btn"
                    @pointerdown.prevent="onPtzPointerDown($event, 5)"
                    @pointerup.prevent="onPtzPointerUp($event, 5)"
                    @pointercancel="onPtzPointerUp($event, 5)"
                  >
                    ↖
                  </button>
                  <button
                    type="button"
                    class="ptz-btn"
                    @pointerdown.prevent="onPtzPointerDown($event, 1)"
                    @pointerup.prevent="onPtzPointerUp($event, 1)"
                    @pointercancel="onPtzPointerUp($event, 1)"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    class="ptz-btn"
                    @pointerdown.prevent="onPtzPointerDown($event, 7)"
                    @pointerup.prevent="onPtzPointerUp($event, 7)"
                    @pointercancel="onPtzPointerUp($event, 7)"
                  >
                    ↗
                  </button>
                  <button
                    type="button"
                    class="ptz-btn"
                    @pointerdown.prevent="onPtzPointerDown($event, 3)"
                    @pointerup.prevent="onPtzPointerUp($event, 3)"
                    @pointercancel="onPtzPointerUp($event, 3)"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    class="ptz-btn"
                    title="自动巡航"
                    @click.prevent="ptzStart(9)"
                  >
                    ↻
                  </button>
                  <button
                    type="button"
                    class="ptz-btn"
                    @pointerdown.prevent="onPtzPointerDown($event, 4)"
                    @pointerup.prevent="onPtzPointerUp($event, 4)"
                    @pointercancel="onPtzPointerUp($event, 4)"
                  >
                    →
                  </button>
                  <button
                    type="button"
                    class="ptz-btn"
                    @pointerdown.prevent="onPtzPointerDown($event, 6)"
                    @pointerup.prevent="onPtzPointerUp($event, 6)"
                    @pointercancel="onPtzPointerUp($event, 6)"
                  >
                    ↙
                  </button>
                  <button
                    type="button"
                    class="ptz-btn"
                    @pointerdown.prevent="onPtzPointerDown($event, 2)"
                    @pointerup.prevent="onPtzPointerUp($event, 2)"
                    @pointercancel="onPtzPointerUp($event, 2)"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    class="ptz-btn"
                    @pointerdown.prevent="onPtzPointerDown($event, 8)"
                    @pointerup.prevent="onPtzPointerUp($event, 8)"
                    @pointercancel="onPtzPointerUp($event, 8)"
                  >
                    ↘
                  </button>
                  <button
                    type="button"
                    class="ptz-btn"
                    @pointerdown.prevent="onPtzPointerDown($event, 11)"
                    @pointerup.prevent="onPtzPointerUp($event, 11)"
                    @pointercancel="onPtzPointerUp($event, 11)"
                  >
                    −
                  </button>
                  <span class="ptz-lab">焦距</span>
                  <button
                    type="button"
                    class="ptz-btn"
                    @pointerdown.prevent="onPtzPointerDown($event, 10)"
                    @pointerup.prevent="onPtzPointerUp($event, 10)"
                    @pointercancel="onPtzPointerUp($event, 10)"
                  >
                    +
                  </button>
                </div>
                <button type="button" class="ptz-talk" disabled title="对讲稍后接入">
                  <img src="/assets/img/a_talkstart.png" alt="对讲" />
                </button>
              </div>
            </div>

            <div class="actions">
              <button
                type="button"
                class="btn-shot"
                :disabled="capturing"
                @click="onCaptureClick"
              >
                {{ capturing ? '拍照中…' : '拍照' }}
              </button>
              <button type="button" class="btn-ok" @click="onConfirm">确认选择</button>
            </div>
          </div>
        </section>
      </div>

      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        class="file-hide"
        @change="onFileChosen"
      />
    </div>

    <!-- 全屏透明 iframe：插件 HWND 按黑区坐标落在正确位置；pointer-events:none 不挡按钮 -->
    <iframe
      v-if="iframeSrc"
      ref="iframeRef"
      class="hik-iframe-fs"
      :src="iframeSrc"
      title="摄像头预览"
      allow="fullscreen"
      @load="onIframeLoad"
    />
  </div>
  </Teleport>
</template>

<style scoped lang="scss">
.cap-overlay {
  position: fixed;
  inset: 0;
  /* 高于主界面缩放层，且插件窗口挂在无 transform 的 body 下 */
  z-index: 10000;
  background: rgba(0, 0, 0, 0.32);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 对齐 Qt 1400×713 */
.cap-dialog {
  width: 1400px;
  height: 713px;
  max-width: 98vw;
  max-height: 96vh;
  box-sizing: border-box;
  background: #f2f2f2;
  border: 1px solid #b0b0b0;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.28);
  font-family: 'Microsoft YaHei', 'Segoe UI', sans-serif;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.titlebar {
  height: 28px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 0 4px 0 8px;
  background: linear-gradient(180deg, #ffffff 0%, #ececec 100%);
  border-bottom: 1px solid #d0d0d0;
  user-select: none;
}

.title-icon {
  width: 16px;
  height: 16px;
  margin-right: 6px;
  object-fit: contain;
}

.title-text {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: #222;
}

.btn-x {
  width: 36px;
  height: 24px;
  border: none;
  background: transparent;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  color: #333;
  &:hover {
    background: #e81123;
    color: #fff;
  }
}

.split {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
}

.col {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 10px 12px 12px;
  box-sizing: border-box;
  border-right: 1px solid #d8d8d8;

  &.col-right {
    border-right: none;
  }
}

/* 左侧预览：空态无提示字（对齐截图空白） */
.img-stage {
  flex: 8 1 0;
  min-height: 0;
  background: #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
  cursor: pointer;
}

.stage-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  background: #ddd;
}

/* 右侧实时区：按 16:9 适配画面，去掉多余黑边（插件一般不拉伸铺满） */
.live-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  justify-content: flex-start;
}

.live-stage {
  flex: 0 1 auto;
  width: 100%;
  aspect-ratio: 16 / 9;
  max-height: 100%;
  /* 与弹窗底色一致，避免画面下方再露一块黑条 */
  background: #f2f2f2;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.hik-plugin-box {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* 全屏透明：内部 #divPlugin 用父页下发的黑区屏幕坐标定位 */
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
  z-index: 10001;
}

.live-status {
  flex: 0 0 auto;
  min-height: 22px;
  font-size: 13px;
  color: #444;
  line-height: 1.3;
  user-select: none;

  &.err {
    color: #c0392b;
  }
}

.gallery {
  flex: 0 0 120px;
  margin-top: 8px;
  overflow-x: auto;
  overflow-y: hidden;
  background: transparent;
}

.gallery-inner {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 100%;
  min-height: 110px;
}

.thumb {
  flex-shrink: 0;
  padding: 0;
  border: 2px solid transparent;
  background: #ddd;
  cursor: pointer;
  overflow: hidden;
  box-sizing: border-box;

  img {
    width: 100%;
    height: 100%;
    object-fit: fill;
    display: block;
  }

  &.on {
    border: 3px solid #1677ff;
  }
}

.multi-footer {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  margin-top: 10px;
  min-height: 48px;
}

.count {
  flex: 1;
  font-size: 13px;
  color: #333;
}

.btn-del {
  width: 120px;
  height: 48px;
  border: 1px solid #4a9eff;
  background: #fff;
  color: #1677ff;
  font-size: 14px;
  cursor: pointer;
  flex-shrink: 0;
  border-radius: 2px;

  &:hover {
    background: #f0f7ff;
  }
}

/* 相机条 */
.cam-row {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  margin-bottom: 8px;
}

.cam-tab {
  flex: 1;
  min-width: 0;
  height: 32px;
  border: none;
  border-radius: 4px;
  padding: 0 4px;
  font-size: 14px;
  font-weight: bold;
  color: #fff;
  background: #059669;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    filter: brightness(1.05);
  }

  &.on {
    background: #ff9669;
  }

  &.disabled,
  &:disabled {
    background: #9ca3af;
    color: #eee;
    cursor: not-allowed;
    filter: none;
  }
}

/* 底部：对齐 Qt horizontalLayout_2（云台3 | 拍照2 | spacer | 确认2），始终横排 */
.bottom-ctrl {
  flex: 0 0 auto;
  margin-top: 10px;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 12px;
  height: 160px;
  min-height: 160px;
}

/* 模拟 Qt QGroupBox：内部横纵 1fr 铺满，对称饱满 */
.ptz {
  flex: 3 1 0;
  position: relative;
  margin: 0;
  padding: 16px 10px 10px;
  border: 1px solid #c8c8c8;
  background: #fafafa;
  box-sizing: border-box;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.ptz-title {
  position: absolute;
  top: -8px;
  left: 12px;
  padding: 0 6px;
  background: #fafafa;
  font-size: 12px;
  color: #333;
  line-height: 1.2;
  pointer-events: none;
}

.ptz-body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 10px;
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
}

/* 3×4 等分铺满左侧区域 */
.ptz-dirs {
  flex: 1 1 auto;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: repeat(4, minmax(0, 1fr));
  gap: 6px 10px;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.ptz-btn {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  border: 1px solid #4caf50;
  border-radius: 10px;
  background: #fff;
  color: #222;
  font-size: clamp(14px, 2.2vh, 18px);
  line-height: 1;
  cursor: pointer;
  padding: 0;
  box-sizing: border-box;

  &:hover {
    background: #45a049;
    color: #fff;
  }

  &:active {
    background: #388e3c;
    border: 2px solid #2e7d32;
    color: #fff;
  }
}

.ptz-lab {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 13px;
  color: #333;
  box-sizing: border-box;
}

/* 麦克风：占右侧一列，垂直居中于整高 */
.ptz-talk {
  flex: 0 0 22%;
  max-width: 72px;
  min-width: 52px;
  height: 100%;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  img {
    width: 70%;
    max-width: 52px;
    height: auto;
    aspect-ratio: 1;
    object-fit: contain;
    /* 深灰近黑，提高对比 */
    filter: brightness(0) invert(18%);
  }
}

.actions {
  flex: 4 1 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  min-width: 0;
  height: 100%;
}

.btn-shot,
.btn-ok {
  flex: 1 1 0;
  height: 48px;
  padding: 0 10px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
}

.btn-shot {
  background: #1677ff;
  color: #fff;
  &:hover:not(:disabled) {
    color: #4096ff;
  }
  &:disabled {
    opacity: 0.7;
    cursor: wait;
  }
}

.btn-ok {
  background: #059669;
  color: #ddd;
  &:hover {
    color: #fff;
  }
}

.file-hide {
  display: none;
}
</style>
