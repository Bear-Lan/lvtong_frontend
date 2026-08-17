<script setup lang="ts">
/**
 * 行驶证弹窗 — 1:1 对齐 Qt GetDrivingPicDialog.ui / .cpp
 * 尺寸 702×700；主行驶证 / 挂车证各高 260；底栏按钮区
 * 有图点击预览（对齐 openUrl）；空态 Web 可选本地图（Qt 由高拍仪写入）
 * AI检测拼接：调用后端 /api/license/ai-crop → 主/挂分开展示，另保留拼接图供提交落库
 */
import { ref, watch } from 'vue'
import QtMessageBox from '@/components/common/QtMessageBox.vue'
import { appConfig } from '@/config/env'

const props = defineProps<{
  licenseSrc?: string
  licenseGcSrc?: string
  licenseStitchedSrc?: string
}>()

const emit = defineEmits<{
  close: []
  confirm: [payload: { license: string; licenseGc: string; licenseStitched: string }]
}>()

const license = ref(props.licenseSrc || '')
const licenseGc = ref(props.licenseGcSrc || '')
/** 拼接图（提交确认 / 落库）；主页分开展示仍用 license / licenseGc */
const licenseStitched = ref(props.licenseStitchedSrc || '')

const confirmMsg = ref('')
const confirmVisible = ref(false)
let pendingDel: 'main' | 'gc' | null = null

const pickTarget = ref<'main' | 'gc' | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

const aiBusy = ref(false)
/** AI 裁剪后主/挂槽仍分开展示，不因拼接而撑高主证区 */
const tipVisible = ref(false)
const tipMessage = ref('')
const tipOk = ref(true)

watch(
  () => [props.licenseSrc, props.licenseGcSrc, props.licenseStitchedSrc],
  () => {
    license.value = props.licenseSrc || ''
    licenseGc.value = props.licenseGcSrc || ''
    licenseStitched.value = props.licenseStitchedSrc || ''
  },
)

/** AI 结果是 data:URL，Chrome/Edge 对超长 data: 的 window.open 会落到 about:blank */
async function openLargePreview(src: string) {
  try {
    let openUrl = src
    let revokeLater: string | null = null

    if (src.startsWith('data:')) {
      const res = await fetch(src)
      const blob = await res.blob()
      openUrl = URL.createObjectURL(blob)
      revokeLater = openUrl
    }

    const win = window.open(openUrl, '_blank')
    if (!win) {
      // 弹窗被拦：退回当前页新标签式提示失败时，至少用同页打开
      tipOk.value = false
      tipMessage.value = '浏览器拦截了弹窗，请允许本站弹窗后再试'
      tipVisible.value = true
      if (revokeLater) URL.revokeObjectURL(revokeLater)
      return
    }

    if (revokeLater) {
      // 等新页加载完再释放，避免立刻 revoke 导致空白
      setTimeout(() => URL.revokeObjectURL(revokeLater!), 120_000)
    }
  } catch (e) {
    tipOk.value = false
    tipMessage.value = e instanceof Error ? e.message : '打开大图失败'
    tipVisible.value = true
  }
}

function onAreaClick(which: 'main' | 'gc') {
  const src = which === 'main' ? license.value : licenseGc.value
  if (src) {
    void openLargePreview(src)
    return
  }
  pickTarget.value = which
  fileInputRef.value?.click()
}

function onFileChosen(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !pickTarget.value) return
  const url = URL.createObjectURL(file)
  if (pickTarget.value === 'main') {
    if (license.value.startsWith('blob:')) URL.revokeObjectURL(license.value)
    license.value = url
    licenseStitched.value = ''
  } else {
    if (licenseGc.value.startsWith('blob:')) URL.revokeObjectURL(licenseGc.value)
    licenseGc.value = url
    licenseStitched.value = ''
  }
  pickTarget.value = null
}

function askDelete(which: 'main' | 'gc') {
  pendingDel = which
  confirmMsg.value = which === 'main' ? '确定要删除主行驶证吗？' : '确定要删除挂车证吗？'
  confirmVisible.value = true
}

function onConfirmYes() {
  confirmVisible.value = false
  if (pendingDel === 'main') {
    if (license.value.startsWith('blob:')) URL.revokeObjectURL(license.value)
    license.value = ''
    licenseStitched.value = ''
  } else if (pendingDel === 'gc') {
    if (licenseGc.value.startsWith('blob:')) URL.revokeObjectURL(licenseGc.value)
    licenseGc.value = ''
    licenseStitched.value = ''
  }
  pendingDel = null
}

/** 任意 src → File（blob / dataUrl / http(s) / 同源 /api） */
async function srcToFile(src: string, filename: string): Promise<File> {
  const res = await fetch(src)
  if (!res.ok) throw new Error(`读取图片失败: ${res.status}`)
  const blob = await res.blob()
  const type = blob.type || 'image/jpeg'
  return new File([blob], filename, { type })
}

async function onAiCrop() {
  if (aiBusy.value) return
  if (!license.value) {
    tipOk.value = false
    tipMessage.value = '请先添加主行驶证照片'
    tipVisible.value = true
    return
  }

  aiBusy.value = true
  try {
    const fd = new FormData()
    fd.append('crop_image1', await srcToFile(license.value, 'crop_image1.jpg'))
    const hasGc = !!licenseGc.value
    if (hasGc) {
      fd.append('crop_image2', await srcToFile(licenseGc.value, 'crop_image2.jpg'))
    }

    const token =
      localStorage.getItem('lvtong_token') || sessionStorage.getItem('lvtong_token')
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 120000)
    let res: Response
    try {
      res = await fetch(`${appConfig.apiBaseUrl}/license/ai-crop`, {
        method: 'POST',
        headers,
        body: fd,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }

    const json = (await res.json()) as {
      code: number
      message?: string
      data?: {
        imageDataUrl?: string
        mainDataUrl?: string
        hangDataUrl?: string
        mode?: string
      }
    }
    if (!res.ok || json.code !== 0 || !json.data?.imageDataUrl) {
      tipOk.value = false
      tipMessage.value = json.message || `AI 检测失败（HTTP ${res.status}）`
      tipVisible.value = true
      return
    }

    if (license.value.startsWith('blob:')) URL.revokeObjectURL(license.value)
    if (licenseGc.value.startsWith('blob:')) URL.revokeObjectURL(licenseGc.value)

    const d = json.data
    // 主页/弹窗分开展示裁剪后的主、挂；拼接图单独保留供提交
    license.value = d.mainDataUrl || d.imageDataUrl
    licenseGc.value = d.hangDataUrl || ''
    licenseStitched.value = d.imageDataUrl || ''

    tipOk.value = true
    tipMessage.value =
      d.mode === 'stitch'
        ? 'AI 检测完成（主/挂已分开展示，提交时用拼接图）'
        : 'AI 检测完成'
    tipVisible.value = true
  } catch (e) {
    tipOk.value = false
    tipMessage.value =
      e instanceof DOMException && e.name === 'AbortError'
        ? 'AI 请求超时'
        : e instanceof Error
          ? e.message
          : 'AI 检测失败'
    tipVisible.value = true
  } finally {
    aiBusy.value = false
  }
}

/** 主+挂上下拼成 dataURL（未走 AI 时补拼，供提交确认展示） */
async function stitchVerticalDataUrl(src1: string, src2: string): Promise<string> {
  const load = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = src
    })
  const [a, b] = await Promise.all([load(src1), load(src2)])
  const width = Math.max(a.naturalWidth, b.naturalWidth)
  const scaleA = width / a.naturalWidth
  const scaleB = width / b.naturalWidth
  const hA = Math.round(a.naturalHeight * scaleA)
  const hB = Math.round(b.naturalHeight * scaleB)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = hA + hB
  const ctx = canvas.getContext('2d')
  if (!ctx) return src1
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, canvas.height)
  ctx.drawImage(a, 0, 0, width, hA)
  ctx.drawImage(b, 0, hA, width, hB)
  return canvas.toDataURL('image/jpeg', 0.92)
}

/** 对齐 onClose：关窗并回写路径（主/挂分开 + 拼接图） */
async function onClose() {
  let stitched = licenseStitched.value
  try {
    if (!stitched && license.value && licenseGc.value) {
      stitched = await stitchVerticalDataUrl(license.value, licenseGc.value)
      licenseStitched.value = stitched
    } else if (!stitched) {
      stitched = license.value || ''
    }
  } catch {
    stitched = license.value || licenseGc.value || ''
  }
  emit('confirm', {
    license: license.value,
    licenseGc: licenseGc.value,
    licenseStitched: stitched,
  })
  emit('close')
}
</script>

<template>
  <div class="drv-overlay" @click.self="void onClose()">
    <div class="drv-dialog" role="dialog" aria-modal="true" aria-label="行驶证" @click.stop>
      <div class="titlebar">
        <img class="title-icon" src="/assets/img/logo.ico" alt="" />
        <span class="title-text">行驶证</span>
        <button type="button" class="btn-x" title="关闭" @click="void onClose()">×</button>
      </div>

      <div class="body">
        <div class="license-group">
          <div class="group-title">主行驶证</div>
          <div class="license-view" @click="onAreaClick('main')">
            <img v-if="license" :src="license" alt="" />
          </div>
        </div>

        <div class="license-group">
          <div class="group-title">挂车证</div>
          <div class="license-view" @click="onAreaClick('gc')">
            <img v-if="licenseGc" :src="licenseGc" alt="" />
          </div>
        </div>

        <div class="btn-bar">
          <button type="button" class="btn-action" @click="askDelete('main')">主行驶证删除</button>
          <button type="button" class="btn-action" @click="askDelete('gc')">挂车证删除</button>
          <button
            type="button"
            class="btn-action btn-ai"
            :disabled="aiBusy || !license"
            title="调用 AI 裁剪；双图保留分开展示，并生成拼接图供提交"
            @click="onAiCrop"
          >
            {{ aiBusy ? 'AI处理中…' : 'AI检测拼接' }}
          </button>
          <button type="button" class="btn-action" @click="void onClose()">关闭</button>
        </div>
      </div>

      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        class="file-hide"
        @change="onFileChosen"
      />
    </div>

    <QtMessageBox
      v-if="confirmVisible"
      title="确认"
      :message="confirmMsg"
      icon="question"
      :buttons="['yes', 'no']"
      @yes="onConfirmYes"
      @no="confirmVisible = false"
      @close="confirmVisible = false"
    />

    <QtMessageBox
      v-if="tipVisible"
      :title="tipOk ? '提示' : '错误'"
      :message="tipMessage"
      :icon="tipOk ? 'info' : 'warning'"
      :buttons="['yes']"
      @yes="tipVisible = false"
      @close="tipVisible = false"
    />
  </div>
</template>

<style scoped lang="scss">
.drv-overlay {
  position: fixed;
  inset: 0;
  z-index: 1600;
  background: rgba(0, 0, 0, 0.32);
  display: flex;
  align-items: center;
  justify-content: center;
}

.drv-dialog {
  width: 702px;
  height: 700px;
  max-width: 98vw;
  max-height: 96vh;
  box-sizing: border-box;
  background: #f0f0f0;
  border: 1px solid #a0a0a0;
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
  height: 22px;
  border: none;
  background: transparent;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  color: #444;
  &:hover {
    background: #e81123;
    color: #fff;
  }
}

.body {
  flex: 1;
  min-height: 0;
  padding: 10px 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.license-group {
  flex: 0 0 260px;
  min-height: 0;
  max-height: 260px;
  height: 260px;
  position: relative;
  box-sizing: border-box;
  margin: 0;
  padding: 18px 10px 10px;
  border: 1px solid #c8c8c8;
  background: #fafafa;
  display: flex;
  flex-direction: column;
  overflow: visible; /* 标题 top:-8px 探出边框，不能 hidden */
}

/* 仅 AI 结果：主证区域可撑高，方便看竖拼长图 */
.license-group--tall {
  flex: 1 1 auto;
  max-height: none;
  height: auto;
  min-height: 360px;
  overflow: visible;
}

.license-group--collapsed {
  flex: 0 0 72px;
  max-height: 72px;
  height: 72px;
  padding-top: 16px;
  padding-bottom: 6px;
}

.group-title {
  position: absolute;
  top: -8px;
  left: 12px;
  padding: 0 6px;
  background: #fafafa;
  font-size: 12px;
  color: #333;
  line-height: 1.2;
  pointer-events: none;
  z-index: 1;
}

.license-view {
  flex: 1;
  min-height: 0;
  width: 100%;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden; /* 大图只在预览区内裁切，不撑破框 */

  img {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    display: block;
  }
}

.license-group--tall .license-view {
  overflow: auto;
}

.btn-bar {
  flex: 0 0 100px;
  width: 100%;
  max-width: 680px;
  height: 100px;
  margin: 0 auto;
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  padding: 8px 0 4px;
}

.btn-action {
  width: 150px;
  height: 60px;
  flex-shrink: 0;
  border: 1px solid #adadad;
  border-radius: 2px;
  background: #fff;
  font-size: 14px;
  color: #222;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: #e8f0fe;
    border-color: #7aa2e8;
  }
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}

.btn-ai {
  background: #e8f5e9;
  border-color: #66bb6a;
  font-weight: 600;
  &:hover:not(:disabled) {
    background: #c8e6c9;
  }
}

.file-hide {
  display: none;
}
</style>
