<script setup lang="ts">
/**
 * 图像采集弹窗 — 1:1 对齐 Qt GetPic/Tail/Top/Goods/Evidence (1400×713)
 * - 球机：显示「360°球机操作云台」+ 右侧竖排 拍照/确认选择
 * - 其它相机：隐藏云台，底部 拍照 | 确认选择 横排等宽
 * - 货物/证据：左下「图片数量: n/max」+「选中删除」
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
            <span v-else class="stage-ph">拍照显示区域</span>
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

          <div class="img-stage live">
            <span class="stage-ph">实时摄像头画面区域</span>
          </div>

          <!-- 球机：云台 + 竖排按钮；其它：横排双按钮 -->
          <div class="bottom-ctrl" :class="{ 'with-ptz': showPtz }">
            <fieldset v-show="showPtz" class="ptz">
              <legend>360°球机操作云台</legend>
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
            </fieldset>

            <div class="actions" :class="{ stacked: showPtz, row: !showPtz }">
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

/* 预览 / 实时画面：截图浅灰大块 */
.img-stage {
  flex: 1;
  min-height: 0;
  background: #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.img-stage.live {
  flex: 1;
  cursor: default;
}

.col-left .img-stage {
  cursor: pointer;
  /* 预览区略高于相册：约 stretch 对应 Qt 8:0 */
  flex: 8 1 0;
}

.stage-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  background: #ddd;
}

.stage-ph {
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

/* 底部控制区 */
.bottom-ctrl {
  flex: 0 0 auto;
  margin-top: 10px;
  display: flex;
  gap: 12px;
  align-items: stretch;
  min-height: 148px;

  &.with-ptz {
    min-height: 168px;
  }
}

.ptz {
  flex: 3;
  margin: 0;
  padding: 4px 8px 8px;
  border: 1px solid #c8c8c8;
  background: #fafafa;
  box-sizing: border-box;
  min-width: 0;

  legend {
    font-size: 12px;
    color: #333;
    padding: 0 4px;
  }
}

.ptz-body {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 3×4：方向 3×3 + 焦距行；对讲在右侧 */
.ptz-dirs {
  display: grid;
  grid-template-columns: repeat(3, 36px);
  grid-template-rows: repeat(4, 28px);
  gap: 4px 6px;
  justify-content: start;
}

.ptz-btn {
  width: 36px;
  height: 28px;
  border: 1px solid #4caf50;
  border-radius: 10px;
  background: #fff;
  color: #2e7d32;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  padding: 0;

  &:hover {
    background: #45a049;
    color: #fff;
  }

  &:active {
    background: #388e3c;
    border-color: #2e7d32;
    color: #fff;
  }
}

.ptz-lab {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #333;
}

.ptz-talk {
  flex-shrink: 0;
  width: 40px;
  height: 64px;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 32px;
    height: 32px;
    object-fit: contain;
  }
}

.actions {
  display: flex;
  min-width: 0;

  &.stacked {
    flex: 2;
    flex-direction: column;
    justify-content: space-between;
    gap: 16px;
  }

  &.row {
    flex: 1;
    flex-direction: row;
    gap: 16px;
  }
}

.btn-shot,
.btn-ok {
  border: none;
  border-radius: 4px;
  font-size: 15px;
  font-weight: bold;
  cursor: pointer;
  height: 56px;
}

.actions.stacked .btn-shot,
.actions.stacked .btn-ok {
  width: 100%;
  flex: 1;
}

.actions.row .btn-shot,
.actions.row .btn-ok {
  flex: 1;
  height: 64px;
}

.btn-shot {
  background: #1677ff;
  color: #fff;
  &:hover {
    background: #4096ff;
  }
}

.btn-ok {
  background: #059669;
  color: #e8e8e8;
  &:hover {
    color: #fff;
    filter: brightness(1.05);
  }
}

.file-hide {
  display: none;
}
</style>
