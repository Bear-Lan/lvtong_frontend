<script setup lang="ts">
/**
 * AI 智能体在线状态对话框
 */
import { onMounted, ref } from 'vue'
import { request } from '@/api/request'

const emit = defineEmits<{ close: [] }>()

const loading = ref(true)
const aiStatus = ref<'online' | 'offline' | 'checking'>('checking')
const ocrStatus = ref<'online' | 'offline' | 'checking'>('checking')

async function checkStatus() {
  loading.value = true
  aiStatus.value = 'checking'
  ocrStatus.value = 'checking'

  try {
    const res = await request<{ aiOnline: boolean; ocrOnline: boolean }>('/device/health')
    if (res.code === 0 && res.data) {
      aiStatus.value = res.data.aiOnline ? 'online' : 'offline'
      ocrStatus.value = res.data.ocrOnline ? 'online' : 'offline'
    }
  } catch {
    aiStatus.value = 'offline'
    ocrStatus.value = 'offline'
  } finally {
    loading.value = false
  }
}

const statusText = {
  online: '在线',
  offline: '离线',
  checking: '检测中...',
}

const statusClass = {
  online: 'status-online',
  offline: 'status-offline',
  checking: 'status-checking',
}

onMounted(() => { checkStatus() })
</script>

<template>
  <div class="ai-overlay" @click.self="emit('close')">
    <div class="ai-dialog" role="dialog" aria-modal="true" @click.stop>
      <div class="dialog-titlebar">
        <span class="dialog-title">AI 智能体在线连接状态</span>
        <button type="button" class="dialog-close" title="关闭" @click="emit('close')">×</button>
      </div>

      <div class="dialog-body">
        <div class="status-list">
          <div class="status-row">
            <span class="status-label">AI 大模型服务</span>
            <span class="status-value" :class="statusClass[aiStatus]">
              <span class="status-dot" aria-hidden="true" />
              {{ statusText[aiStatus] }}
            </span>
          </div>
          <div class="status-row">
            <span class="status-label">OCR 识别服务</span>
            <span class="status-value" :class="statusClass[ocrStatus]">
              <span class="status-dot" aria-hidden="true" />
              {{ statusText[ocrStatus] }}
            </span>
          </div>
        </div>

        <button
          class="btn-refresh"
          :disabled="loading"
          @click="checkStatus"
        >
          {{ loading ? '检测中...' : '重新检测' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ai-overlay {
  position: fixed;
  inset: 0;
  z-index: 1500;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-dialog {
  width: 380px;
  background: #f0f0f0;
  border: 1px solid #a0a0a0;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.28);
  font-family: 'Microsoft YaHei', 'Segoe UI', sans-serif;
}

.dialog-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px 6px 12px;
  background: linear-gradient(180deg, #fff 0%, #f0f0f0 100%);
  border-bottom: 1px solid #d0d0d0;
}

.dialog-title {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a1a;
}

.dialog-close {
  width: 28px;
  height: 24px;
  border: none;
  background: transparent;
  font-size: 18px;
  cursor: pointer;
  &:hover { background: #e81123; color: #fff; }
}

.dialog-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.status-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
}

.status-label {
  font-size: 14px;
  color: #333;
  font-weight: 600;
}

.status-value {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: bold;
}

.status-online { color: #52c41a; }
.status-offline { color: #ff4d4f; }
.status-checking { color: #faad14; }

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: currentColor;
}

.btn-refresh {
  width: 100%;
  height: 40px;
  border: 1px solid #adadad;
  border-radius: 4px;
  background: linear-gradient(180deg, #fdfdfd 0%, #f0f0f0 100%);
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: #0078d7;
    background: linear-gradient(180deg, #eaf4fc 0%, #d8ebf8 100%);
  }

  &:disabled { opacity: 0.6; cursor: wait; }
}
</style>
