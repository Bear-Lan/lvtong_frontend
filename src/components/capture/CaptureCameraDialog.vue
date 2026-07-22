<script setup lang="ts">
/**
 * 图像采集弹窗 — 1:1 对齐 Qt GetPic/Tail/Top/Goods/Evidence (1400×713)
 * - 球机：显示云台；horizontalLayout：云台 | 拍照 | 确认选择（横排）
 * - 其它相机：隐藏云台，拍照 | 确认选择 横排
 * - 货物/证据才有「图片数量」+「选中删除」（GetGoods/Evidence）；车头/尾/顶无
 */
import { computed, onMounted, ref, watch } from 'vue'

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

const DEFAULT_CAMERA: Record<CaptureKind, string> = {
  head: '车头相机',
  tail: '车尾相机',
  top: '车顶相机',
  goods: '球机',
  evidence: '球机',
}

const MAX_MAP: Partial<Record<CaptureKind, number>> = {
  goods: 16,
  evidence: 8,
}

/** 截图顺序：车顶 → 车头 → 车尾 → 球机 → 预约 */
const CAMERAS = ['车顶相机', '车头相机', '车尾相机', '球机', '预约相机'] as const

const isMulti = computed(() => props.kind === 'goods' || props.kind === 'evidence')
const maxCount = computed(() => MAX_MAP[props.kind] ?? 1)
const thumbW = computed(() => (isMulti.value ? 110 : 200))
const thumbH = 110

const activeCamera = ref(DEFAULT_CAMERA[props.kind])
const talking = ref(false)
/** 对齐 switchToCamera：仅球机显示云台 */
const showPtz = computed(() => activeCamera.value === '球机')

const photos = ref<string[]>([])
const selectedIndex = ref(0)
const fileInputRef = ref<HTMLInputElement | null>(null)

const countText = computed(() => {
  if (!isMulti.value) return ''
  return `图片数量: ${photos.value.length}/${maxCount.value}`
})

const selectedSrc = computed(() => {
  if (!photos.value.length) return ''
  const i = Math.min(Math.max(0, selectedIndex.value), photos.value.length - 1)
  return photos.value[i] || ''
})

function syncKind() {
  activeCamera.value = DEFAULT_CAMERA[props.kind]
  photos.value = [...(props.initialImages ?? [])].filter(Boolean)
  selectedIndex.value = 0
  talking.value = false
}

watch(() => props.kind, syncKind)
watch(
  () => props.initialImages,
  () => {
    photos.value = [...(props.initialImages ?? [])].filter(Boolean)
    selectedIndex.value = 0
  },
)

onMounted(syncKind)

function selectCamera(name: string) {
  activeCamera.value = name
}

function onCaptureClick() {
  if (isMulti.value && photos.value.length >= maxCount.value!) return
  fileInputRef.value?.click()
}

function onFileChosen(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const url = URL.createObjectURL(file)
  if (isMulti.value) {
    if (photos.value.length >= maxCount.value!) {
      URL.revokeObjectURL(url)
      return
    }
    photos.value.push(url)
    selectedIndex.value = photos.value.length - 1
  } else {
    photos.value.push(url)
    selectedIndex.value = photos.value.length - 1
  }
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

function onConfirm() {
  if (isMulti.value) emit('confirm', [...photos.value])
  else emit('confirm', selectedSrc.value ? [selectedSrc.value] : [])
  emit('close')
}

function onClose() {
  emit('close')
}

function openPreview() {
  if (selectedSrc.value) window.open(selectedSrc.value, '_blank')
}

function toggleTalk() {
  talking.value = !talking.value
}
</script>

<template>
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
        <button type="button" class="btn-x" title="关闭" @click="onClose">×</button>
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
              :class="{ on: activeCamera === cam }"
              @click="selectCamera(cam)"
            >
              {{ cam }}
            </button>
          </div>

          <div class="live-stage">
            <span class="live-ph">实时摄像头画面区域</span>
          </div>

          <!-- 对齐 Qt horizontalLayout_2：云台 | 拍照 | spacer | 确认选择（始终横排） -->
          <div class="bottom-ctrl">
            <!-- 用 div 模拟 QGroupBox：fieldset+flex 无法撑满高度 -->
            <div v-show="showPtz" class="ptz">
              <div class="ptz-title">360°球机操作云台</div>
              <div class="ptz-body">
                <div class="ptz-dirs">
                  <button type="button" class="ptz-btn">↖</button>
                  <button type="button" class="ptz-btn">↑</button>
                  <button type="button" class="ptz-btn">↗</button>
                  <button type="button" class="ptz-btn">←</button>
                  <button type="button" class="ptz-btn">↻</button>
                  <button type="button" class="ptz-btn">→</button>
                  <button type="button" class="ptz-btn">↙</button>
                  <button type="button" class="ptz-btn">↓</button>
                  <button type="button" class="ptz-btn">↘</button>
                  <button type="button" class="ptz-btn">−</button>
                  <span class="ptz-lab">焦距</span>
                  <button type="button" class="ptz-btn">+</button>
                </div>
                <button
                  type="button"
                  class="ptz-talk"
                  :title="talking ? '结束对讲' : '开始对讲'"
                  @click="toggleTalk"
                >
                  <img
                    :src="talking ? '/assets/img/a_talkstop.png' : '/assets/img/a_talkstart.png'"
                    alt="对讲"
                  />
                </button>
              </div>
            </div>

            <div class="actions">
              <button type="button" class="btn-shot" @click="onCaptureClick">拍照</button>
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
  </div>
</template>

<style scoped lang="scss">
.cap-overlay {
  position: fixed;
  inset: 0;
  z-index: 1600;
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

/* 右侧实时区：直接贴合面板底色，无卡片外框/内阴影 */
.live-stage {
  flex: 1;
  min-height: 0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.live-ph {
  font-size: 15px;
  color: #666;
  user-select: none;
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
  &:hover {
    color: #4096ff;
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
