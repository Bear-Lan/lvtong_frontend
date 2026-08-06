<script setup lang="ts">
/**
 * 危险区域设置 — 检测状态 + 网页画区（黄区/红区） + 最近告警
 * 入口：主页「实时视频」标题栏右上角按钮
 * 画区坐标使用归一化（0~1），与 worker 的 zone 格式一致，分辨率无关。
 */
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { request } from '@/api/request'
import {
  LIVE_ALARMS_PATH,
  LIVE_FRAME_URL,
  LIVE_RECONNECT_PATH,
  LIVE_STATUS_PATH,
  LIVE_ZONES_PATH,
  LIVE_ZONES_SAVE_PATH,
} from '@/config/liveVideo'

const emit = defineEmits<{ close: [] }>()

type Pt = { x: number; y: number }
type ZoneItem = {
  id: string
  name: string
  kind: 'warning' | 'danger'
  points: Pt[]
  visible: boolean
}
type AlarmItem = {
  id: string
  zone_id: string
  zone_name: string
  kind: string
  track_id: number
  time: string
  file: string
  rel_path: string
}
type LiveStatus = {
  connection?: string
  resolution?: string
  display_fps?: string | number
  detection_fps?: string | number
  device?: string
  model?: string
  error?: string
  device_id?: string
  device_ip?: string
}

const loading = ref(true)
const unreachable = ref(false)
const status = ref<LiveStatus>({})
const zones = ref<ZoneItem[]>([])
const alarms = ref<AlarmItem[]>([])
const reconnecting = ref(false)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const img = new Image()
const imgLoaded = ref(false)
const frameLoading = ref(false)
const draftKind = ref<'warning' | 'danger'>('warning')
const draftPoints = ref<Pt[]>([])
const drawing = ref(false)
const selectedZoneId = ref<string>('')
const saving = ref(false)
const saveMsg = ref('')
const saveErr = ref('')

let pollTimer: number | undefined

async function refreshStatus() {
  try {
    const res = await request<LiveStatus>(LIVE_STATUS_PATH, { timeout: 3000 })
    status.value = res.data || {}
    unreachable.value = false
  } catch {
    unreachable.value = true
  } finally {
    loading.value = false
  }
}

async function refreshZones() {
  try {
    const res = await request<{ zones?: ZoneItem[] }>(LIVE_ZONES_PATH, { timeout: 3000 })
    const data = res.data || {}
    zones.value = (data.zones || []).map((z) => ({
      id: String(z.id),
      name: String(z.name || ''),
      kind: z.kind === 'danger' ? 'danger' : 'warning',
      points: (z.points || []).map((p) => ({ x: Number(p.x), y: Number(p.y) })),
      visible: z.visible !== false,
    }))
    redraw()
  } catch {
    /* ignore */
  }
}

async function refreshAlarms() {
  try {
    const res = await request<AlarmItem[]>(LIVE_ALARMS_PATH, { timeout: 3000 })
    alarms.value = Array.isArray(res.data) ? res.data : []
  } catch {
    /* ignore */
  }
}

function startPoll() {
  void refreshStatus()
  void refreshZones()
  void refreshAlarms()
  pollTimer = window.setInterval(() => {
    void refreshStatus()
    void refreshAlarms()
  }, 3000)
}

async function onReconnect() {
  if (reconnecting.value) return
  reconnecting.value = true
  try {
    await request(LIVE_RECONNECT_PATH, { method: 'POST', timeout: 15000 })
    await refreshStatus()
  } catch {
    /* status 轮询会反映结果 */
  } finally {
    reconnecting.value = false
  }
}

async function loadReferenceFrame() {
  frameLoading.value = true
  const url = `${LIVE_FRAME_URL}?t=${Date.now()}`
  await new Promise<void>((resolve) => {
    const probe = new Image()
    probe.onload = () => {
      img.src = url
      resolve()
    }
    probe.onerror = () => {
      frameLoading.value = false
      resolve()
    }
    probe.src = url
  })
}

img.onload = () => {
  imgLoaded.value = true
  resizeCanvas()
  redraw()
  frameLoading.value = false
}
img.onerror = () => {
  imgLoaded.value = false
  frameLoading.value = false
}

function resizeCanvas() {
  const c = canvasRef.value
  if (!c || !imgLoaded.value) return
  c.width = img.naturalWidth || 1280
  c.height = img.naturalHeight || 720
}

function redraw() {
  const c = canvasRef.value
  if (!c) return
  const ctx = c.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, c.width, c.height)
  if (imgLoaded.value && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, 0, 0, c.width, c.height)
  } else {
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.fillStyle = '#888'
    ctx.font = '16px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('正在加载参考帧…', c.width / 2, c.height / 2)
  }
  for (const z of zones.value) {
    if (!z.visible || z.points.length < 1) continue
    drawPolygon(ctx, z.points, z.kind, z.id === selectedZoneId.value, z.name)
  }
  if (drawing.value && draftPoints.value.length > 0) {
    drawPolygon(ctx, draftPoints.value, draftKind.value, true, '绘制中…', true)
  }
}

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  kind: 'warning' | 'danger',
  selected: boolean,
  label: string,
  draft = false,
) {
  if (pts.length < 1) return
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  const fill = kind === 'danger' ? 'rgba(220,38,38,0.28)' : 'rgba(234,179,8,0.25)'
  const stroke = kind === 'danger' ? '#dc2626' : '#eab308'
  ctx.beginPath()
  pts.forEach((p, i) => {
    const x = p.x * W
    const y = p.y * H
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  if (!draft && pts.length >= 3) {
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()
  }
  ctx.strokeStyle = stroke
  ctx.lineWidth = selected ? 3 : 2
  if (draft) ctx.setLineDash([6, 4])
  ctx.stroke()
  ctx.setLineDash([])
  pts.forEach((p) => {
    ctx.beginPath()
    ctx.arc(p.x * W, p.y * H, 4, 0, Math.PI * 2)
    ctx.fillStyle = stroke
    ctx.fill()
  })
  if (label && pts.length > 0) {
    const x = pts[0].x * W
    const y = pts[0].y * H
    ctx.font = 'bold 13px sans-serif'
    const w = ctx.measureText(label).width + 10
    ctx.fillStyle = stroke
    ctx.fillRect(x, y - 18, w, 18)
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'left'
    ctx.fillText(label, x + 5, y - 5)
  }
}

function canvasPos(e: MouseEvent): Pt {
  const c = canvasRef.value!
  const rect = c.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  const y = (e.clientY - rect.top) / rect.height
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) }
}

function onCanvasClick(e: MouseEvent) {
  if (!drawing.value) return
  draftPoints.value.push(canvasPos(e))
  redraw()
}

function onCanvasDblClick() {
  finishDraft()
}

function startDraw(kind: 'warning' | 'danger') {
  draftKind.value = kind
  draftPoints.value = []
  drawing.value = true
  selectedZoneId.value = ''
  redraw()
}

function finishDraft() {
  if (!drawing.value) return
  if (draftPoints.value.length < 3) {
    drawing.value = false
    draftPoints.value = []
    redraw()
    return
  }
  const id = `z_${Date.now()}`
  const idx = zones.value.filter((z) => z.kind === draftKind.value).length + 1
  zones.value.push({
    id,
    name: kindLabel(draftKind.value) + idx,
    kind: draftKind.value,
    points: draftPoints.value.slice(),
    visible: true,
  })
  drawing.value = false
  draftPoints.value = []
  selectedZoneId.value = id
  redraw()
}

function cancelDraft() {
  drawing.value = false
  draftPoints.value = []
  redraw()
}

function undoLastPoint() {
  if (drawing.value && draftPoints.value.length > 0) {
    draftPoints.value.pop()
    redraw()
  }
}

function removeZone(id: string) {
  zones.value = zones.value.filter((z) => z.id !== id)
  if (selectedZoneId.value === id) selectedZoneId.value = ''
  redraw()
}

function clearAllZones() {
  if (!zones.value.length) return
  if (!window.confirm('确定清空全部区域？')) return
  zones.value = []
  selectedZoneId.value = ''
  redraw()
}

function toggleZoneVisible(z: ZoneItem) {
  z.visible = !z.visible
  redraw()
}

function selectZone(id: string) {
  selectedZoneId.value = id
  redraw()
}

async function saveAll() {
  saving.value = true
  saveMsg.value = ''
  saveErr.value = ''
  try {
    const payload = {
      enter_seconds: 0.5,
      exit_seconds: 0.2,
      spatial_dedup_seconds: 5.0,
      zones: zones.value.map((z) => ({
        id: z.id,
        name: z.name,
        kind: z.kind,
        points: z.points,
        visible: z.visible,
      })),
    }
    const res = await request(LIVE_ZONES_SAVE_PATH, {
      method: 'POST',
      body: JSON.stringify(payload),
      timeout: 10000,
    })
    if (res.code === 0) {
      saveMsg.value = '已保存（worker 将热重载）'
      await refreshZones()
    } else {
      saveErr.value = res.message || '保存失败'
    }
  } catch (e) {
    saveErr.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    saving.value = false
    setTimeout(() => {
      saveMsg.value = ''
      saveErr.value = ''
    }, 3000)
  }
}

function alarmThumb(a: AlarmItem): string {
  if (!a.rel_path) return ''
  if (a.rel_path.startsWith('/api/images/')) return a.rel_path
  return `/api/images/${a.rel_path.replace(/^\/+/, '')}`
}

function kindLabel(kind: string): string {
  if (kind === 'danger') return '红区'
  if (kind === 'warning') return '黄区'
  return kind || '--'
}

const connectionLabel = computed(() => status.value.connection || '--')

onMounted(async () => {
  startPoll()
  await loadReferenceFrame()
  await nextTick()
  resizeCanvas()
  redraw()
})

onUnmounted(() => {
  if (pollTimer) window.clearInterval(pollTimer)
})
</script>

<template>
  <div class="dz-overlay" @click.self="emit('close')">
    <div class="dz-dialog" role="dialog" aria-modal="true" aria-label="危险区域设置" @click.stop>
      <div class="dz-titlebar">
        <span class="dz-title">危险区域设置</span>
        <button type="button" class="dz-x" title="关闭" @click="emit('close')">×</button>
      </div>

      <div class="dz-body">
        <section class="dz-section dz-status">
          <div class="dz-metrics">
            <span><b>连接：</b>{{ connectionLabel }}</span>
            <span><b>分辨率：</b>{{ status.resolution || '--' }}</span>
            <span><b>显示：</b>{{ status.display_fps ?? '--' }} fps</span>
            <span><b>检测：</b>{{ status.detection_fps ?? '--' }} fps</span>
            <span><b>摄像头：</b>{{ status.device_id || '--' }} / {{ status.device_ip || '--' }}</span>
          </div>
          <p v-if="status.error" class="dz-err">{{ status.error }}</p>
          <div class="dz-actions">
            <button type="button" class="dz-btn sm" @click="refreshStatus">刷新状态</button>
            <button
              type="button"
              class="dz-btn sm secondary"
              :disabled="reconnecting"
              @click="onReconnect"
            >
              {{ reconnecting ? '重连中…' : '重新连接' }}
            </button>
          </div>
        </section>

        <section class="dz-section">
          <div class="dz-canvas-head">
            <h3>区域绘制</h3>
            <div class="dz-tools">
              <button
                type="button"
                class="dz-btn sm warn"
                :class="{ active: drawing && draftKind === 'warning' }"
                @click="startDraw('warning')"
              >+ 黄区</button>
              <button
                type="button"
                class="dz-btn sm danger"
                :class="{ active: drawing && draftKind === 'danger' }"
                @click="startDraw('danger')"
              >+ 红区</button>
              <button v-if="drawing" type="button" class="dz-btn sm" @click="undoLastPoint">撤销点</button>
              <button v-if="drawing" type="button" class="dz-btn sm" @click="finishDraft">完成</button>
              <button v-if="drawing" type="button" class="dz-btn sm" @click="cancelDraft">取消</button>
              <button type="button" class="dz-btn sm" @click="loadReferenceFrame">刷新参考帧</button>
              <button type="button" class="dz-btn sm" @click="clearAllZones">清空全部</button>
            </div>
          </div>
          <p class="dz-tip">
            点击「+ 黄区 / + 红区」后在画面上单击添加顶点，双击或点「完成」结束一个区域（≥3 点）。
          </p>
          <div class="dz-canvas-wrap">
            <canvas
              ref="canvasRef"
              class="dz-canvas"
              :class="{ drawing }"
              @click="onCanvasClick"
              @dblclick="onCanvasDblClick"
            ></canvas>
            <div v-if="frameLoading" class="dz-frame-loading">加载参考帧…</div>
          </div>

          <ul v-if="zones.length" class="dz-zone-list">
            <li
              v-for="z in zones"
              :key="z.id"
              :class="[z.kind, { selected: z.id === selectedZoneId }]"
              @click="selectZone(z.id)"
            >
              <span class="badge" :class="z.kind">{{ kindLabel(z.kind) }}</span>
              <input
                v-model="z.name"
                class="zone-name"
                @click.stop
              />
              <span class="meta">{{ z.points.length }} 点</span>
              <button type="button" class="icon-btn" :title="z.visible ? '隐藏' : '显示'" @click.stop="toggleZoneVisible(z)">
                {{ z.visible ? '👁' : '⊘' }}
              </button>
              <button type="button" class="icon-btn del" title="删除" @click.stop="removeZone(z.id)">✕</button>
            </li>
          </ul>
          <p v-else class="dz-muted">暂无区域，点击上方按钮开始绘制。</p>
        </section>

        <section class="dz-section">
          <h3>最近告警</h3>
          <p v-if="!alarms.length" class="dz-muted">暂无红区告警记录。</p>
          <ul v-else class="dz-alarm-list">
            <li v-for="a in alarms" :key="a.id">
              <img v-if="a.rel_path" :src="alarmThumb(a)" class="thumb" alt="告警截图" />
              <div class="info">
                <div class="row">
                  <span class="badge danger">红区</span>
                  <span class="name">{{ a.zone_name || a.zone_id }}</span>
                </div>
                <div class="meta">{{ a.time }} · person#{{ a.track_id }}</div>
              </div>
            </li>
          </ul>
        </section>
      </div>

      <div class="dz-footer">
        <span v-if="saveMsg" class="dz-save-msg ok">{{ saveMsg }}</span>
        <span v-if="saveErr" class="dz-save-msg err">{{ saveErr }}</span>
        <button type="button" class="dz-btn" :disabled="saving" @click="saveAll">
          {{ saving ? '保存中…' : '保存区域' }}
        </button>
        <button type="button" class="dz-btn primary" @click="emit('close')">关 闭</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dz-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dz-dialog {
  width: 760px;
  max-width: 94vw;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #b0b0b0;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.32);
  font-family: 'Microsoft YaHei', 'Segoe UI', sans-serif;
  overflow: hidden;
}

.dz-titlebar {
  display: flex;
  align-items: center;
  height: 38px;
  padding: 0 8px 0 14px;
  background: linear-gradient(180deg, #ffffff 0%, #ececec 100%);
  border-bottom: 1px solid #d0d0d0;
}

.dz-title {
  flex: 1;
  font-size: 14px;
  font-weight: 700;
  color: #222;
}

.dz-x {
  width: 34px;
  height: 30px;
  border: none;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
  color: #333;
  &:hover { background: #e81123; color: #fff; }
}

.dz-body {
  padding: 14px 16px;
  overflow: auto;
  flex: 1;
}

.dz-section {
  margin-bottom: 16px;
  h3 { margin: 0 0 8px; font-size: 13px; color: #2c3e50; }
}

.dz-status .dz-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  font-size: 12px;
  color: #444;
  margin-bottom: 6px;
  b { color: #888; font-weight: 600; }
}

.dz-actions {
  display: flex;
  gap: 8px;
}

.dz-err {
  font-size: 12px;
  color: #c0392b;
  margin: 4px 0;
}

.dz-canvas-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
  flex-wrap: wrap;
  h3 { margin: 0; }
}

.dz-tools {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.dz-tip {
  margin: 0 0 8px;
  font-size: 12px;
  color: #888;
}

.dz-canvas-wrap {
  position: relative;
  width: 100%;
  background: #000;
  border: 1px solid #ccc;
  border-radius: 4px;
  overflow: hidden;
}

.dz-canvas {
  display: block;
  width: 100%;
  height: auto;
  cursor: crosshair;
  &.drawing { cursor: crosshair; }
  &:not(.drawing) { cursor: default; }
}

.dz-frame-loading {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 3px;
}

.dz-zone-list {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  max-height: 160px;
  overflow: auto;
  border: 1px solid #eee;
  border-radius: 4px;

  li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-bottom: 1px solid #f0f0f0;
    font-size: 12px;
    cursor: pointer;
    &:last-child { border-bottom: none; }
    &.selected { background: #f0f7ff; }
    &:hover { background: #fafafa; }
  }

  .zone-name {
    flex: 1;
    border: 1px solid transparent;
    background: transparent;
    font-size: 12px;
    font-weight: 600;
    color: #222;
    padding: 2px 4px;
    border-radius: 3px;
    &:focus { border-color: #1677ff; background: #fff; outline: none; }
  }

  .meta { color: #888; font-size: 11px; }
}

.icon-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 3px;
  color: #555;
  &:hover { background: #eee; }
  &.del:hover { background: #fee2e2; color: #b91c1c; }
}

.badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 700;
  background: #e8e8e8;
  color: #333;
  &.danger { background: #fee2e2; color: #b91c1c; }
  &.warning { background: #fef3c7; color: #b45309; }
}

.dz-alarm-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 180px;
  overflow: auto;
  li {
    display: flex;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid #f0f0f0;
    .thumb {
      width: 72px;
      height: 48px;
      object-fit: cover;
      border-radius: 3px;
      background: #eee;
    }
    .info { flex: 1; min-width: 0; }
    .row { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
    .name { font-size: 12px; font-weight: 600; color: #222; }
    .meta { font-size: 11px; color: #888; }
  }
}

.dz-muted {
  font-size: 12px;
  color: #888;
}

.dz-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 10px 16px 14px;
  border-top: 1px solid #eee;
}

.dz-save-msg {
  font-size: 12px;
  margin-right: auto;
  &.ok { color: #059669; }
  &.err { color: #c0392b; }
}

.dz-btn {
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  background: #e8e8e8;
  color: #333;

  &.sm { padding: 4px 10px; font-size: 12px; }
  &.secondary { background: #1677ff; color: #fff; }
  &.primary { background: #059669; color: #fff; }
  &.warn { background: #fef3c7; color: #b45309; }
  &.warn.active { background: #eab308; color: #fff; }
  &.danger { background: #fee2e2; color: #b91c1c; }
  &.danger.active { background: #dc2626; color: #fff; }

  &:disabled { opacity: 0.6; cursor: not-allowed; }
  &:hover:not(:disabled) { filter: brightness(1.05); }
}
</style>
