<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  imageUrl?: string | null
  linePosition: number
  darkness?: number
  /** 无图时也显示红线 — 对齐 ImageLabelWithLine 默认可交互 */
  alwaysShowLine?: boolean
}>()

const emit = defineEmits<{
  'update:linePosition': [value: number]
}>()

const dragging = ref(false)
const panelRef = ref<HTMLElement | null>(null)

const linePercent = computed(() => `${props.linePosition * 100}%`)
const showLine = computed(() => props.alwaysShowLine || !!props.imageUrl)

function clampPosition(clientX: number) {
  const el = panelRef.value
  if (!el) return props.linePosition
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0) return props.linePosition
  const x = clientX - rect.left
  return Math.min(1, Math.max(0, x / rect.width))
}

function onPointerDown(e: PointerEvent) {
  if (!showLine.value) return
  const el = panelRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const lineX = rect.width * props.linePosition
  if (Math.abs(e.clientX - rect.left - lineX) <= 10) {
    dragging.value = true
    el.setPointerCapture(e.pointerId)
  }
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return
  emit('update:linePosition', clampPosition(e.clientX))
}

function onPointerUp(e: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  panelRef.value?.releasePointerCapture(e.pointerId)
}

watch(
  () => props.imageUrl,
  () => {
    dragging.value = false
  },
)
</script>

<template>
  <div
    ref="panelRef"
    class="radar-panel"
    :class="{ 'is-dragging': dragging, 'has-line': showLine }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <img v-if="imageUrl" :src="imageUrl" class="radar-image" alt="雷达来车图" />
    <span v-else class="radar-placeholder">雷达测量来车信息区域</span>

    <template v-if="showLine">
      <div
        class="radar-mask"
        :style="{ width: linePercent, opacity: (darkness ?? 0) / 255 }"
      />
      <div class="radar-line" :style="{ left: linePercent }" />
    </template>
  </div>
</template>

<style scoped lang="scss">
.radar-panel {
  position: relative;
  width: 512px;
  height: 256px;
  flex-shrink: 0;
  background: transparent;
  border: 2px solid #ddd;
  overflow: hidden;
  cursor: default;
  user-select: none;

  &.has-line {
    cursor: col-resize;
  }

  &.is-dragging {
    cursor: grabbing;
  }
}

.radar-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  pointer-events: none;
}

.radar-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 16px;
}

.radar-mask {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: #000;
  pointer-events: none;
}

.radar-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: #f00;
  pointer-events: none;

  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 10px;
    height: 10px;
    margin: -5px 0 0 -5px;
    border-radius: 50%;
    background: #f00;
    border: 1px solid #fff;
  }
}
</style>
