<script setup lang="ts">
/**
 * 设备状态弹窗
 *
 * 对齐 Qt DeviceManager 状态弹窗 (QDialog + QTableWidget):
 * - 所有设备在线/离线/忙碌状态
 * - 设备重连按钮
 */
import { onMounted, ref } from 'vue'
import { request } from '@/api/request'

interface DeviceStatus {
  deviceId: string
  deviceName: string
  deviceType: string
  status: string
  connected: boolean
}

const visible = ref(false)
const devices = ref<DeviceStatus[]>([])
const loading = ref(false)

async function fetchStatus() {
  loading.value = true
  try {
    const res = await request<{ devices: DeviceStatus[]; onlineCount: number; total: number }>('/device/status')
    if (res.code === 0 && res.data) {
      devices.value = res.data.devices
    }
  } finally {
    loading.value = false
  }
}

async function reconnect() {
  await request('/device/reconnect', { method: 'POST' })
  // 等待 2 秒后刷新状态
  setTimeout(fetchStatus, 2000)
}

function show() {
  visible.value = true
  fetchStatus()
}

const typeLabels: Record<string, string> = {
  Camera: '摄像头',
  GPCamera: '高拍仪',
  Gate: '栏杆机',
  Controller: 'PLC控制器',
  UDPRadar: '雷达',
  Led: 'LED显示屏',
  TTSVoice: '语音播报',
  CodeReader: '扫码枪',
}

defineExpose({ show })
</script>

<template>
  <div v-if="visible" class="modal-overlay" @click.self="visible = false">
    <div class="modal">
      <div class="header">
        <h3>设备连接状态</h3>
        <button class="btn-close" @click="visible = false">✕</button>
      </div>

      <button class="btn-reconnect" @click="reconnect">
        <span>🔄</span> 设备重连
      </button>

      <table class="status-table" v-if="devices.length">
        <thead>
          <tr>
            <th>设备名称</th>
            <th>类型</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in devices" :key="d.deviceId">
            <td>{{ d.deviceName }}</td>
            <td>{{ typeLabels[d.deviceType] ?? d.deviceType }}</td>
            <td :class="{ online: d.connected, offline: !d.connected }">
              {{ d.status }}
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else-if="!loading" class="empty">暂无设备信息</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.3);
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 60px 20px 0 0;
  z-index: 1000;
}
.modal {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 6px;
  width: 300px;
  max-height: 500px;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #eee;

  h3 { font-size: 14px; margin: 0; }
  .btn-close {
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 16px;
    color: #999;
  }
}
.btn-reconnect {
  display: flex;
  align-items: center;
  gap: 4px;
  width: calc(100% - 16px);
  margin: 8px;
  padding: 6px;
  border: 1px solid #1677ff;
  border-radius: 4px;
  background: #f0f7ff;
  color: #1677ff;
  cursor: pointer;
  font-size: 13px;
  justify-content: center;
}
.status-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;

  th, td { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; text-align: left; }
  th { background: #fafafa; color: #666; font-weight: 600; }
}
.online { color: #27ae60; font-weight: 600; }
.offline { color: #c0392b; }

.empty {
  text-align: center;
  padding: 30px;
  color: #999;
  font-size: 13px;
}
</style>
