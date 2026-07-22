<script setup lang="ts">
/**
 * 行驶证弹窗 — 1:1 对齐 Qt GetDrivingPicDialog.ui / .cpp
 * 尺寸 702×650；主行驶证 / 挂车证各高 260；底栏 680×100，三钮各 200×60
 * 有图点击预览（对齐 openUrl）；空态 Web 可选本地图（Qt 由高拍仪写入）
 */
import { ref, watch } from 'vue'
import QtMessageBox from '@/components/common/QtMessageBox.vue'

const props = defineProps<{
  licenseSrc?: string
  licenseGcSrc?: string
}>()

const emit = defineEmits<{
  close: []
  confirm: [payload: { license: string; licenseGc: string }]
}>()

const license = ref(props.licenseSrc || '')
const licenseGc = ref(props.licenseGcSrc || '')

const confirmMsg = ref('')
const confirmVisible = ref(false)
let pendingDel: 'main' | 'gc' | null = null

const pickTarget = ref<'main' | 'gc' | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

watch(
  () => [props.licenseSrc, props.licenseGcSrc],
  () => {
    license.value = props.licenseSrc || ''
    licenseGc.value = props.licenseGcSrc || ''
  },
)

function onAreaClick(which: 'main' | 'gc') {
  const src = which === 'main' ? license.value : licenseGc.value
  if (src) {
    window.open(src, '_blank')
    return
  }
  // Qt 空态无操作；Web 演示：点空白选图
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
  } else {
    if (licenseGc.value.startsWith('blob:')) URL.revokeObjectURL(licenseGc.value)
    licenseGc.value = url
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
  } else if (pendingDel === 'gc') {
    if (licenseGc.value.startsWith('blob:')) URL.revokeObjectURL(licenseGc.value)
    licenseGc.value = ''
  }
  pendingDel = null
}

/** 对齐 onClose：关窗并回写路径 */
function onClose() {
  emit('confirm', { license: license.value, licenseGc: licenseGc.value })
  emit('close')
}
</script>

<template>
  <div class="drv-overlay" @click.self="onClose">
    <div class="drv-dialog" role="dialog" aria-modal="true" aria-label="行驶证" @click.stop>
      <div class="titlebar">
        <img class="title-icon" src="/assets/img/logo.ico" alt="" />
        <span class="title-text">行驶证</span>
        <button type="button" class="btn-x" title="关闭" @click="onClose">×</button>
      </div>

      <!-- 对齐 groupBox_Left → verticalLayout_2(spacing=0) -->
      <div class="body">
        <!-- 主行驶证 GroupBox 高 260，内部 label 661×231 -->
        <div class="license-group">
          <div class="group-title">主行驶证</div>
          <div class="license-view" @click="onAreaClick('main')">
            <img v-if="license" :src="license" alt="" />
          </div>
        </div>

        <!-- 挂车证 GroupBox 高 260 -->
        <div class="license-group">
          <div class="group-title">挂车证</div>
          <div class="license-view" @click="onAreaClick('gc')">
            <img v-if="licenseGc" :src="licenseGc" alt="" />
          </div>
        </div>

        <!-- scrollArea_gallery 680×100，三钮各 200×60 -->
        <div class="btn-bar">
          <button type="button" class="btn-action" @click="askDelete('main')">主行驶证删除</button>
          <button type="button" class="btn-action" @click="askDelete('gc')">挂车证删除</button>
          <button type="button" class="btn-action" @click="onClose">关闭</button>
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

/* 对齐 Qt 702×650 */
.drv-dialog {
  width: 702px;
  height: 650px;
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

/* 对齐 verticalLayout 边距 ≈9；内容区吃满剩余高度 */
.body {
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
  padding: 8px 10px 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* QGroupBox 高 260；标题打断顶边 */
.license-group {
  flex: 1 1 0;
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
}

/* 对齐 label_license 661×231：铺满，无边框、无提示字；IgnoreAspectRatio */
.license-view {
  flex: 1;
  min-height: 0;
  width: 100%;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: fill;
    display: block;
  }
}

/* 对齐 scrollArea_gallery 680×100 */
.btn-bar {
  flex: 0 0 100px;
  width: 100%;
  max-width: 680px;
  height: 100px;
  margin: 0 auto;
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 20px;
  padding: 0;
}

.btn-action {
  width: 200px;
  height: 60px;
  flex-shrink: 0;
  border: 1px solid #adadad;
  border-radius: 2px;
  background: #fff;
  font-size: 14px;
  color: #222;
  cursor: pointer;

  &:hover {
    background: #f5f5f5;
  }

  &:active {
    background: #ebebeb;
  }
}

.file-hide {
  display: none;
}
</style>
