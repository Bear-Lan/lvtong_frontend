<script setup lang="ts">
/**
 * 车身点云竖线测量 + 任意框图（移植自 captures_demo）
 * - 三视图均可画框；框完成后裁切 emit 到实时视频区
 * - 车顶/车侧：额外支持拖竖线测距
 * - 不做暗化、不做保存
 */
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'

export type BodyPcView = 'body' | 'top' | 'side'

const props = defineProps<{
  imageUrl?: string
  view: BodyPcView
  placeholder?: string
}>()

const emit = defineEmits<{
  crop: [dataUrl: string]
}>()

const PIXEL_TO_METER = 0.01
const HIT_PX = 12
const POINT_LUMA_MAX = 250
const COL_RADIUS = 2
const MIN_BOX_PX = 8
/** 点云索引最长边；全分辨率扫描万级宽图会卡死主线程 */
const INDEX_MAX_EDGE = 1600

type PointIndex = {
  headX: number
  tailX: number
  globalMinY: number
  globalMaxY: number
  colMinY: Int32Array
  colMaxY: Int32Array
  pointCount: number
}

type Box = {
  id: number
  x1: number
  y1: number
  x2: number
  y2: number
  label: string
}

/** 仅车顶/车侧做点云竖线测距 */
const canMeasure = computed(() => props.view === 'top' || props.view === 'side')

const stageRef = ref<HTMLElement | null>(null)
const fitRef = ref<HTMLElement | null>(null)
const imgRef = ref<HTMLImageElement | null>(null)

const imgW = ref(0)
const imgH = ref(0)
const index = ref<PointIndex | null>(null)
const linePosition = ref(0.35)
const draggingLine = ref(false)
const drawingBox = ref(false)
const draftStart = ref<{ x: number; y: number } | null>(null)
const draftEnd = ref<{ x: number; y: number } | null>(null)
const boxes = ref<Box[]>([])
const selectedBoxId = ref<number | null>(null)
let nextBoxId = 1

const measure = reactive({
  span: '—',
  toHead: '—',
  length: '—',
  tickTop: null as number | null,
  tickBot: null as number | null,
})

const spanLabel = computed(() => (props.view === 'top' ? '车宽' : '车高'))
const flipLabel = computed(() => linePosition.value > 0.72)

const draftStyle = computed(() => {
  if (!drawingBox.value || !draftStart.value || !draftEnd.value || imgW.value <= 0) {
    return null
  }
  const r = normalizeRect(draftStart.value, draftEnd.value)
  return boxToStyle(r)
})

function meters(px: number) {
  return px * PIXEL_TO_METER
}

function fmt(m: number) {
  return `${m.toFixed(2)} m`
}

function normalizeRect(a: { x: number; y: number }, b: { x: number; y: number }) {
  return {
    x1: Math.round(Math.min(a.x, b.x)),
    y1: Math.round(Math.min(a.y, b.y)),
    x2: Math.round(Math.max(a.x, b.x)),
    y2: Math.round(Math.max(a.y, b.y)),
  }
}

function boxToStyle(box: { x1: number; y1: number; x2: number; y2: number }) {
  if (imgW.value <= 0 || imgH.value <= 0) return {}
  return {
    left: `${(box.x1 / imgW.value) * 100}%`,
    top: `${(box.y1 / imgH.value) * 100}%`,
    width: `${((box.x2 - box.x1) / imgW.value) * 100}%`,
    height: `${((box.y2 - box.y1) / imgH.value) * 100}%`,
  }
}

function buildPointCloudIndex(img: HTMLImageElement): PointIndex | null {
  const nw = img.naturalWidth
  const nh = img.naturalHeight
  if (nw <= 0 || nh <= 0) return null

  // 缩到 INDEX_MAX_EDGE 再扫；结果坐标映射回 natural，避免万级宽图卡死主线程
  const edge = Math.max(nw, nh)
  const down = edge > INDEX_MAX_EDGE ? INDEX_MAX_EDGE / edge : 1
  const w = Math.max(1, Math.round(nw * down))
  const h = Math.max(1, Math.round(nh * down))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)

  const colMinY = new Int32Array(nw)
  const colMaxY = new Int32Array(nw)
  colMinY.fill(-1)
  colMaxY.fill(-1)

  let headX = nw
  let tailX = -1
  let globalMinY = nh
  let globalMaxY = -1
  let pointCount = 0

  for (let y = 0; y < h; y++) {
    const natY = Math.min(nh - 1, Math.round((y * nh) / h))
    const row = y * w * 4
    for (let x = 0; x < w; x++) {
      const i = row + x * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]
      if (a < 16) continue
      if ((r + g + b) / 3 >= POINT_LUMA_MAX) continue

      const natX = Math.min(nw - 1, Math.round((x * nw) / w))
      pointCount++
      if (natX < headX) headX = natX
      if (natX > tailX) tailX = natX
      if (natY < globalMinY) globalMinY = natY
      if (natY > globalMaxY) globalMaxY = natY
      if (colMinY[natX] < 0 || natY < colMinY[natX]) colMinY[natX] = natY
      if (natY > colMaxY[natX]) colMaxY[natX] = natY
    }
  }

  if (pointCount === 0 || tailX < headX) return null
  return { headX, tailX, globalMinY, globalMaxY, colMinY, colMaxY, pointCount }
}

function spanAtLine(lineX: number) {
  const idx = index.value
  if (!idx) return null
  const x0 = Math.round(lineX)
  let minY = Infinity
  let colMax = -Infinity
  let hit = false

  for (let dx = -COL_RADIUS; dx <= COL_RADIUS; dx++) {
    const x = x0 + dx
    if (x < 0 || x >= imgW.value) continue
    const cMin = idx.colMinY[x]
    const cMax = idx.colMaxY[x]
    if (cMin < 0) continue
    hit = true
    if (cMin < minY) minY = cMin
    if (cMax > colMax) colMax = cMax
  }

  if (!hit) return null
  const maxY = props.view === 'side' ? Math.max(colMax, idx.globalMaxY) : colMax
  return { minY, maxY, spanPx: maxY - minY }
}

function updateMeasure() {
  if (!canMeasure.value || imgW.value <= 0) {
    measure.span = '—'
    measure.toHead = '—'
    measure.length = '—'
    measure.tickTop = null
    measure.tickBot = null
    return
  }

  const lineXPx = linePosition.value * imgW.value
  const idx = index.value
  if (!idx) {
    measure.span = '—'
    measure.toHead = '—'
    measure.length = '—'
    measure.tickTop = null
    measure.tickBot = null
    return
  }

  const lengthPx = idx.tailX - idx.headX
  const toHeadPx = Math.max(0, lineXPx - idx.headX)
  measure.length = fmt(meters(lengthPx))
  measure.toHead = fmt(meters(toHeadPx))

  const span = spanAtLine(lineXPx)
  if (!span) {
    measure.span = '—'
    measure.tickTop = null
    measure.tickBot = null
    return
  }
  measure.span = fmt(meters(span.spanPx))
  measure.tickTop = (span.minY / imgH.value) * 100
  measure.tickBot = (span.maxY / imgH.value) * 100
}

function currentMeasureLabel() {
  if (props.view === 'body') return '标注'
  if (props.view === 'top') {
    return measure.span !== '—' ? `车宽 ${measure.span}` : '车宽'
  }
  if (measure.length !== '—') return `车长 ${measure.length}`
  if (measure.span !== '—') return `车高 ${measure.span}`
  return '标注'
}

function clearBoxes() {
  boxes.value = []
  selectedBoxId.value = null
  draftStart.value = null
  draftEnd.value = null
  drawingBox.value = false
}

function resetState() {
  clearBoxes()
  index.value = null
  imgW.value = 0
  imgH.value = 0
  linePosition.value = 0.35
  draggingLine.value = false
  updateMeasure()
}

function onImgLoad() {
  const img = imgRef.value
  if (!img) return
  imgW.value = img.naturalWidth
  imgH.value = img.naturalHeight
  clearBoxes()

  if (!canMeasure.value) {
    index.value = null
    updateMeasure()
    return
  }

  // 延后扫描，先让 <img> 上屏，避免与小车重绘抢主线程
  window.setTimeout(() => {
    if (imgRef.value !== img) return
    try {
      index.value = buildPointCloudIndex(img)
    } catch (err) {
      console.error('[BodyPointCloudPanel] 点云扫描失败', err)
      index.value = null
    }

    if (index.value) {
      linePosition.value = (index.value.headX + index.value.tailX) / 2 / imgW.value
    } else {
      linePosition.value = 0.5
    }
    updateMeasure()
  }, 0)
}

function clientToNatural(clientX: number, clientY: number) {
  const rect = fitRef.value?.getBoundingClientRect()
  if (!rect || rect.width <= 0 || rect.height <= 0 || imgW.value <= 0) {
    return { x: 0, y: 0 }
  }
  return {
    x: Math.min(imgW.value, Math.max(0, ((clientX - rect.left) / rect.width) * imgW.value)),
    y: Math.min(imgH.value, Math.max(0, ((clientY - rect.top) / rect.height) * imgH.value)),
  }
}

function clientXToPosition(clientX: number) {
  const rect = fitRef.value?.getBoundingClientRect()
  if (!rect || rect.width <= 0) return linePosition.value
  return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
}

function isNearLine(clientX: number) {
  const rect = fitRef.value?.getBoundingClientRect()
  if (!rect) return false
  const lineX = rect.width * linePosition.value
  return Math.abs(clientX - rect.left - lineX) <= HIT_PX
}

function drawOverlaysOnCanvas(ctx: CanvasRenderingContext2D) {
  const w = imgW.value
  const h = imgH.value

  if (canMeasure.value) {
    const lineX = Math.round(linePosition.value * w)

    const lineW = Math.max(2, Math.round(w / 450))
    ctx.fillStyle = '#ff3030'
    ctx.fillRect(lineX - Math.floor(lineW / 2), 0, lineW, h)

    const span = spanAtLine(lineX)
    if (span) {
      const tickW = Math.max(10, Math.round(w / 80))
      ctx.fillStyle = '#ffcf5a'
      ctx.fillRect(lineX - tickW / 2, span.minY - 1, tickW, 2)
      ctx.fillRect(lineX - tickW / 2, span.maxY - 1, tickW, 2)
    }

    const r = Math.max(4, Math.round(h / 50))
    ctx.beginPath()
    ctx.arc(lineX, h / 2, r, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#ff3030'
    ctx.stroke()

    const fontSize = Math.max(14, Math.round(h / 20))
    ctx.font = `650 ${fontSize}px "Microsoft YaHei","Segoe UI",sans-serif`
    const rows = [
      `${spanLabel.value}  ${measure.span}`,
      `线→车头  ${measure.toHead}`,
      `车长  ${measure.length}`,
    ]
    const padX = 10
    const padY = 8
    const lineH = fontSize * 1.45
    let maxTw = 0
    for (const t of rows) maxTw = Math.max(maxTw, ctx.measureText(t).width)
    const panelW = maxTw + padX * 2
    const panelH = rows.length * lineH + padY * 2
    const flip = linePosition.value > 0.72
    const panelX = flip ? lineX - 10 - panelW : lineX + 10
    const panelY = Math.round(h / 2 - panelH / 2)

    ctx.fillStyle = 'rgba(8, 22, 18, 0.88)'
    ctx.strokeStyle = 'rgba(95, 187, 158, 0.55)'
    ctx.lineWidth = 1
    ctx.beginPath()
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(panelX, panelY, panelW, panelH, 6)
    } else {
      ctx.rect(panelX, panelY, panelW, panelH)
    }
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#5fbb9e'
    rows.forEach((t, i) => {
      ctx.fillText(t, panelX + padX, panelY + padY + (i + 0.8) * lineH)
    })
  }

  const boxStroke = Math.max(2, Math.round(Math.min(w, h) / 200))
  const tagFont = Math.max(12, Math.round(h / 24))
  ctx.font = `${tagFont}px "Microsoft YaHei","Segoe UI",sans-serif`
  for (const box of boxes.value) {
    ctx.strokeStyle = box.id === selectedBoxId.value ? '#ffcf5a' : '#ff3030'
    ctx.lineWidth = boxStroke
    ctx.strokeRect(box.x1 + 0.5, box.y1 + 0.5, box.x2 - box.x1, box.y2 - box.y1)
    if (box.label) {
      const tw = ctx.measureText(box.label).width
      const th = tagFont
      const tx = box.x1
      let ty = box.y1 - th - 8
      if (ty < 0) ty = box.y1 + 2
      ctx.fillStyle = 'rgba(8, 22, 18, 0.88)'
      ctx.fillRect(tx, ty, tw + 10, th + 6)
      ctx.fillStyle = '#5fbb9e'
      ctx.fillText(box.label, tx + 5, ty + th)
    }
  }
}

async function cropBoxToDataUrl(box: Box): Promise<string> {
  const img = imgRef.value
  if (!img || imgW.value <= 0) throw new Error('无图像')
  const bw = box.x2 - box.x1
  const bh = box.y2 - box.y1
  if (bw <= 0 || bh <= 0) throw new Error('无效框')

  const full = document.createElement('canvas')
  full.width = imgW.value
  full.height = imgH.value
  const fctx = full.getContext('2d')
  if (!fctx) throw new Error('canvas 不可用')
  fctx.drawImage(img, 0, 0, imgW.value, imgH.value)
  drawOverlaysOnCanvas(fctx)

  const out = document.createElement('canvas')
  out.width = bw
  out.height = bh
  const octx = out.getContext('2d')
  if (!octx) throw new Error('canvas 不可用')
  octx.drawImage(full, box.x1, box.y1, bw, bh, 0, 0, bw, bh)

  return out.toDataURL('image/jpeg', 0.92)
}

async function emitCrop(box: Box) {
  try {
    const dataUrl = await cropBoxToDataUrl(box)
    emit('crop', dataUrl)
  } catch (err) {
    console.error('[BodyPointCloudPanel] 裁切失败', err)
  }
}

function onPointerDown(e: PointerEvent) {
  if (!props.imageUrl || imgW.value <= 0) return
  if (e.button !== 0) return

  const target = e.target as HTMLElement
  if (target.closest('.box-rect')) return

  const stage = stageRef.value
  if (!stage) return

  if (canMeasure.value && isNearLine(e.clientX)) {
    draggingLine.value = true
    drawingBox.value = false
    stage.setPointerCapture(e.pointerId)
    return
  }

  // 开始画新框：影像上旧框先消失；右侧预览等松手裁切成功后再更新（不在此处 emit）
  boxes.value = []
  selectedBoxId.value = null

  drawingBox.value = true
  draggingLine.value = false
  draftStart.value = clientToNatural(e.clientX, e.clientY)
  draftEnd.value = { ...draftStart.value }
  stage.setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (drawingBox.value && draftStart.value) {
    draftEnd.value = clientToNatural(e.clientX, e.clientY)
    return
  }
  if (!draggingLine.value) return
  linePosition.value = clientXToPosition(e.clientX)
  updateMeasure()
}

async function onPointerUp(e: PointerEvent) {
  const stage = stageRef.value
  if (drawingBox.value && draftStart.value && draftEnd.value) {
    drawingBox.value = false
    try {
      stage?.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    const r = normalizeRect(draftStart.value, draftEnd.value)
    draftStart.value = null
    draftEnd.value = null
    if (r.x2 - r.x1 >= MIN_BOX_PX && r.y2 - r.y1 >= MIN_BOX_PX) {
      const id = nextBoxId++
      const box: Box = { id, ...r, label: currentMeasureLabel() }
      boxes.value.push(box)
      selectedBoxId.value = id
      await emitCrop(box)
    }
    return
  }

  if (!draggingLine.value) return
  draggingLine.value = false
  try {
    stage?.releasePointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }
}

function onSelectBox(id: number, e: PointerEvent) {
  e.stopPropagation()
  e.preventDefault()
  selectedBoxId.value = id
}

watch(
  () => [props.imageUrl, props.view] as const,
  async () => {
    resetState()
    await nextTick()
    if (imgRef.value?.complete && imgRef.value.naturalWidth > 0) {
      onImgLoad()
    }
  },
)

onUnmounted(() => {
  resetState()
})

defineExpose({
  clearBoxes,
})
</script>

<template>
  <div class="body-pc" :class="{ interactive: !!imageUrl }">
    <template v-if="!imageUrl">
      <span class="body-pc-placeholder">{{ placeholder ?? '车身影像' }}</span>
    </template>
    <div
      v-else
      ref="stageRef"
      class="stage"
      :class="{
        'is-dragging': draggingLine,
        'is-drawing-box': drawingBox,
      }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <div ref="fitRef" class="fit">
        <img ref="imgRef" :src="imageUrl" class="body-image" alt="" draggable="false" @load="onImgLoad" />

        <template v-if="canMeasure">
          <div class="vline" :style="{ left: `${linePosition * 100}%` }">
            <span class="vline-dot" />
            <span
              v-if="measure.tickTop != null"
              class="vline-tick"
              :style="{ top: `${measure.tickTop}%` }"
            />
            <span
              v-if="measure.tickBot != null"
              class="vline-tick"
              :style="{ top: `${measure.tickBot}%` }"
            />
          </div>

          <aside class="measure-label" :class="{ 'flip-left': flipLabel }" :style="{ left: `${linePosition * 100}%` }">
            <div class="row">
              <span class="k">{{ spanLabel }}</span>
              <span class="v">{{ measure.span }}</span>
            </div>
            <div class="row">
              <span class="k">线→车头</span>
              <span class="v">{{ measure.toHead }}</span>
            </div>
            <div class="row">
              <span class="k">车长</span>
              <span class="v">{{ measure.length }}</span>
            </div>
          </aside>
        </template>

        <div class="boxes-layer">
          <div
            v-for="box in boxes"
            :key="box.id"
            class="box-rect"
            :class="{ 'is-selected': box.id === selectedBoxId }"
            :style="boxToStyle(box)"
            @pointerdown="onSelectBox(box.id, $event)"
          >
            <span v-if="box.label" class="box-tag">{{ box.label }}</span>
          </div>
          <div v-if="draftStyle" class="box-rect is-draft" :style="draftStyle" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.body-pc {
  width: 100%;
  flex: 1;
  min-height: 0;
  background: #fff;
  border-bottom: 2px solid $border-color;
  border-radius: 0 0 12px 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.body-pc-placeholder {
  font-family: 'SimSun', '新宋体', serif;
  font-size: 72px;
  font-weight: bold;
  color: #bbb;
  line-height: 1;
  user-select: none;
}

.stage {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  touch-action: none;
  user-select: none;
}

.body-pc.interactive .stage {
  cursor: crosshair;
}

.body-pc.interactive .stage.is-dragging {
  cursor: ew-resize;
}

.fit {
  position: relative;
  max-width: 100%;
  max-height: 100%;
  line-height: 0;
}

.body-image {
  display: block;
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  pointer-events: none;
}

.vline {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: #ff3030;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
  pointer-events: none;
  z-index: 2;
}

.vline-dot {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 10px;
  height: 10px;
  margin: -5px 0 0 -5px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #ff3030;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
}

.vline-tick {
  position: absolute;
  left: 50%;
  width: 14px;
  height: 2px;
  margin-left: -7px;
  background: #ffcf5a;
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}

.measure-label {
  position: absolute;
  top: 50%;
  transform: translate(10px, -50%);
  z-index: 3;
  min-width: 132px;
  padding: 8px 10px;
  background: rgba(8, 22, 18, 0.88);
  border: 1px solid rgba(95, 187, 158, 0.55);
  border-radius: 6px;
  pointer-events: none;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
  color: #e8f5f0;
}

.measure-label.flip-left {
  transform: translate(calc(-100% - 10px), -50%);
}

.measure-label .row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  line-height: 1.45;
  font-size: 12px;
}

.measure-label .k {
  color: #8aada0;
  white-space: nowrap;
}

.measure-label .v {
  color: #5fbb9e;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  white-space: nowrap;
}

.boxes-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 4;
}

.box-rect {
  position: absolute;
  border: 2px solid #ff3030;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25);
  background: rgba(255, 48, 48, 0.08);
  pointer-events: auto;
  box-sizing: border-box;
}

.box-rect.is-draft {
  border-style: dashed;
  pointer-events: none;
  z-index: 5;
}

.box-rect.is-selected {
  border-color: #ffcf5a;
  background: rgba(255, 207, 90, 0.12);
}

.box-tag {
  position: absolute;
  left: 0;
  top: 0;
  transform: translateY(-100%);
  margin-top: -2px;
  padding: 2px 6px;
  font-size: 11px;
  line-height: 1.3;
  white-space: nowrap;
  color: #5fbb9e;
  background: rgba(8, 22, 18, 0.88);
  border: 1px solid rgba(95, 187, 158, 0.45);
  border-radius: 3px;
  pointer-events: none;
}
</style>
