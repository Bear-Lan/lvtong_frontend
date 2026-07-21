<script setup lang="ts">
/**
 * PLC 开关控制对话框 — 对齐 Qt 开关控制面板
 */
import { onMounted, onUnmounted, ref } from 'vue'
import { request } from '@/api/request'
import { useWsStore } from '@/stores/useWsStore'
import QtMessageBox from '@/components/common/QtMessageBox.vue'

const emit = defineEmits<{ close: [] }>()

const wsStore = useWsStore()
const loading = ref(false)
const tipVisible = ref(false)
const tipMessage = ref('')

interface SwitchItem {
  key: string
  label: string
  field: string
}

const switches: SwitchItem[] = [
  { key: 'redlight', label: '红灯', field: 'red' },
  { key: 'yellowlight', label: '黄灯', field: 'yellow' },
  { key: 'greenlight', label: '绿灯', field: 'green' },
  { key: 'greatlight', label: '强光灯', field: 'greatlight' },
  { key: 'lightgate200', label: '200kV 光栅', field: 'lightgate200' },
  { key: 'lightgate160', label: '160kV 光栅', field: 'lightgate160' },
]

const states = ref<Record<string, boolean>>({
  red: false, yellow: false, green: false, greatlight: false,
  lightgate200: false, lightgate160: false, urgentstop: false,
})

function onWsPlcStatus(msg: { data?: Record<string, unknown> }) {
  const d = msg.data
  if (!d) return
  states.value.red = (d.redLightCmd ?? d.red ?? false) as boolean
  states.value.yellow = (d.yellowLightCmd ?? d.yellow ?? false) as boolean
  states.value.green = (d.greenLightCmd ?? d.green ?? false) as boolean
  states.value.greatlight = (d.createLightCmd ?? d.greatlight ?? d.greatLight ?? false) as boolean
  states.value.lightgate200 = (d.lightGate200Status ?? false) as boolean
  states.value.lightgate160 = (d.lightGate160Status ?? false) as boolean
  states.value.urgentstop = (d.urgentStopStatus ?? d.urgentstop ?? false) as boolean
}

onMounted(() => {
  wsStore.subscribe('plc_status', onWsPlcStatus)
})

onUnmounted(() => {
  // cleanup handled by wsStore
})

async function toggleSwitch(item: SwitchItem) {
  loading.value = true
  // 构建 PLC 控制参数（翻转当前状态）
  const params: Record<string, boolean> = {}
  switches.forEach(s => { params[s.key] = states.value[s.field] })
  params[item.key] = !states.value[item.field]

  try {
    const res = await request('/device/plc-control', {
      method: 'POST',
      body: JSON.stringify(params),
    })
    if (res.code === 0) {
      states.value[item.field] = !states.value[item.field]
    } else {
      tipMessage.value = res.message || '控制失败'
      tipVisible.value = true
    }
  } catch (e) {
    tipMessage.value = '控制失败: ' + (e instanceof Error ? e.message : '未知错误')
    tipVisible.value = true
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="plc-overlay" @click.self="emit('close')">
    <div class="plc-dialog" role="dialog" aria-modal="true" @click.stop>
      <div class="dialog-titlebar">
        <span class="dialog-title">开关控制</span>
        <button type="button" class="dialog-close" title="关闭" @click="emit('close')">×</button>
      </div>

      <div class="dialog-body">
        <div class="light-grid">
          <div
            v-for="item in switches"
            :key="item.key"
            class="light-item"
            :class="{ on: states[item.field] }"
          >
            <span class="light-dot" aria-hidden="true" />
            <span class="light-label">{{ item.label }}</span>
            <button
              class="toggle-btn"
              :class="{ active: states[item.field] }"
              :disabled="loading"
              @click="toggleSwitch(item)"
            >
              {{ states[item.field] ? 'ON' : 'OFF' }}
            </button>
          </div>
        </div>

        <div class="urgent-info" :class="{ urgent: states.urgentstop }">
          急停状态: {{ states.urgentstop ? '已急停 ⚠' : '正常' }}
        </div>
      </div>

      <QtMessageBox
        v-if="tipVisible"
        title="提示"
        :message="tipMessage"
        icon="warning"
        :buttons="['yes']"
        @yes="tipVisible = false"
        @close="tipVisible = false"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.plc-overlay {
  position: fixed;
  inset: 0;
  z-index: 1500;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}

.plc-dialog {
  width: 420px;
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
  padding: 20px 24px;
}

.light-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.light-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  transition: background 0.2s;

  &.on {
    border-color: #52c41a;
    background: #f6ffed;
  }
}

.light-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ccc;
  flex-shrink: 0;
}

.light-item.on .light-dot {
  background: #52c41a;
  box-shadow: 0 0 6px #52c41a;
}

.light-label {
  flex: 1;
  font-size: 14px;
  color: #333;
}

.toggle-btn {
  min-width: 56px;
  height: 30px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #f5f5f5;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;

  &.active {
    background: #1677ff;
    color: #fff;
    border-color: #1677ff;
  }

  &:disabled { opacity: 0.6; cursor: not-allowed; }
}

.urgent-info {
  margin-top: 16px;
  padding: 8px 12px;
  border-radius: 4px;
  background: #f0f0f0;
  text-align: center;
  font-size: 13px;
  font-weight: bold;

  &.urgent {
    background: #fff2f0;
    color: #e81123;
  }
}
</style>
