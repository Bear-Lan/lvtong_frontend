<script setup lang="ts">
/**
 * 行驶证弹窗 — 对齐 Qt GetDrivingPicDialog (702×650)
 * 主行驶证 / 挂车证展示 + 删除确认 + 关闭
 * Web：空白区域点击可选本地图（Qt 无拍照控件，便于 UI 演示）
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

function onPick(which: 'main' | 'gc') {
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

function openPreview(src: string) {
  if (!src) return
  window.open(src, '_blank')
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

function onClose() {
  emit('confirm', { license: license.value, licenseGc: licenseGc.value })
  emit('close')
}
</script>

<template>
  <div class="drv-overlay" @click.self="onClose">
    <div class="drv-dialog" role="dialog" aria-modal="true" aria-label="行驶证" @click.stop>
      <div class="dialog-titlebar">
        <img class="title-icon" src="/assets/img/logo.ico" alt="" />
        <span class="dialog-title">行驶证</span>
        <button type="button" class="dialog-close" title="关闭" @click="onClose">×</button>
      </div>

      <div class="dialog-body">
        <fieldset class="license-box">
          <legend>主行驶证</legend>
          <div
            class="license-view"
            @click="license ? openPreview(license) : onPick('main')"
          >
            <img v-if="license" :src="license" alt="主行驶证" />
            <span v-else class="empty-tip">点击选择主行驶证图片</span>
          </div>
        </fieldset>

        <fieldset class="license-box">
          <legend>挂车证</legend>
          <div
            class="license-view"
            @click="licenseGc ? openPreview(licenseGc) : onPick('gc')"
          >
            <img v-if="licenseGc" :src="licenseGc" alt="挂车证" />
            <span v-else class="empty-tip">点击选择挂车证图片</span>
          </div>
        </fieldset>

        <div class="btn-row">
          <button type="button" class="btn-action" @click="askDelete('main')">主行驶证删除</button>
          <button type="button" class="btn-action" @click="askDelete('gc')">挂车证删除</button>
          <button type="button" class="btn-action" @click="onClose">关闭</button>
        </div>
      </div>

      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        class="hidden-file"
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
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}

.drv-dialog {
  width: 702px;
  height: 650px;
  max-width: 96vw;
  max-height: 96vh;
  box-sizing: border-box;
  background: #f0f0f0;
  border: 1px solid #a0a0a0;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3);
  font-family: 'Microsoft YaHei', 'Segoe UI', sans-serif;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dialog-titlebar {
  display: flex;
  align-items: center;
  height: 30px;
  padding: 0 6px 0 8px;
  background: linear-gradient(180deg, #fff 0%, #ececec 100%);
  border-bottom: 1px solid #d0d0d0;
  flex-shrink: 0;
}

.title-icon {
  width: 16px;
  height: 16px;
  margin-right: 6px;
  object-fit: contain;
}

.dialog-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
}

.dialog-close {
  width: 32px;
  height: 24px;
  border: none;
  background: transparent;
  font-size: 18px;
  cursor: pointer;
  &:hover {
    background: #e81123;
    color: #fff;
  }
}

.dialog-body {
  flex: 1;
  min-height: 0;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-sizing: border-box;
}

.license-box {
  margin: 0;
  padding: 8px 10px 10px;
  border: 1px solid #c8c8c8;
  background: #fafafa;
  height: 260px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;

  legend {
    font-size: 13px;
    padding: 0 4px;
  }
}

.license-view {
  flex: 1;
  min-height: 0;
  background: #fff;
  border: 1px solid #ddd;
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

.empty-tip {
  font-size: 13px;
  color: #999;
}

.btn-row {
  display: flex;
  justify-content: space-around;
  gap: 8px;
  margin-top: auto;
  padding-top: 4px;
}

.btn-action {
  width: 200px;
  height: 60px;
  border: 1px solid #adadad;
  background: #fff;
  font-size: 14px;
  cursor: pointer;
  &:hover {
    background: #f5f5f5;
  }
}

.hidden-file {
  display: none;
}
</style>
