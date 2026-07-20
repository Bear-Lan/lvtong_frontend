<script setup lang="ts">
/**
 * 车牌号编辑弹窗
 *
 * 对齐 Qt LicensePlateDialog:
 * - 输入车牌号和颜色
 * - 蓝色/黄色/黑色/白色/绿色/红色/渐变绿/黄绿双拼/蓝白渐变/临时牌照
 */
import { ref } from 'vue'

const props = defineProps<{
  currentPlate?: string
  currentColor?: string
  title?: string
}>()

const emit = defineEmits<{
  confirm: [plate: string, color: string]
  close: []
}>()

const visible = ref(false)
const plate = ref('')
const color = ref('0')

const colorOptions = [
  { value: '0', label: '蓝色', bg: '#2980b9', fg: '#fff' },
  { value: '1', label: '黄色', bg: '#f1c40f', fg: '#2c3e50' },
  { value: '2', label: '黑色', bg: '#2c3e50', fg: '#ecf0f1' },
  { value: '3', label: '白色', bg: '#ecf0f1', fg: '#2c3e50' },
  { value: '4', label: '渐变绿色', bg: '#27ae60', fg: '#fff' },
  { value: '5', label: '黄绿双拼色', bg: '#16a085', fg: '#fff' },
  { value: '6', label: '蓝白渐变色', bg: '#16a085', fg: '#fff' },
  { value: '7', label: '临时牌照', bg: '#8e44ad', fg: '#fff' },
  { value: '11', label: '绿色', bg: '#27ae60', fg: '#fff' },
  { value: '12', label: '红色', bg: '#ff0000', fg: '#fff' },
]

function show() {
  plate.value = props.currentPlate === '--' ? '' : (props.currentPlate || '')
  color.value = props.currentColor || '0'
  visible.value = true
}

function closeDialog() {
  visible.value = false
  emit('close')
}

function confirm() {
  visible.value = false
  emit('confirm', plate.value.trim(), color.value)
}

defineExpose({ show })
</script>

<template>
  <div v-if="visible" class="modal-overlay" @click.self="closeDialog()">
    <div class="modal">
      <h3>{{ title || '车牌修改' }}</h3>

      <label class="field">
        车牌号码
        <input v-model="plate" placeholder="请输入车牌号" maxlength="10" />
      </label>

      <label class="field">车牌颜色</label>
      <div class="color-grid">
        <button
          v-for="opt in colorOptions"
          :key="opt.value"
          class="color-btn"
          :class="{ active: color === opt.value }"
          :style="{ background: opt.bg, color: opt.fg }"
          @click="color = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>

      <div class="actions">
        <button class="btn-cancel" @click="closeDialog()">取消</button>
        <button class="btn-confirm" @click="confirm">确定</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  width: 420px;
  max-width: 90vw;

  h3 { margin-bottom: 16px; font-size: 18px; }
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #666;

  input {
    height: 36px;
    padding: 0 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 16px;
    letter-spacing: 2px;
    &:focus { border-color: #4096ff; outline: none; }
  }
}
.color-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}
.color-btn {
  padding: 4px 10px;
  border: 2px solid transparent;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.15s, border-color 0.15s;

  &:hover { opacity: 0.9; }
  &.active {
    opacity: 1;
    border-color: #1677ff;
    box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.3);
  }
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;

  button {
    height: 32px;
    padding: 0 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
  }
  .btn-cancel { background: #f0f0f0; color: #333; }
  .btn-confirm { background: #1677ff; color: #fff; }
}
</style>
