<script setup lang="ts">
/**
 * 危险区域设置 — 第一期：展示 VS 流状态 + 引导用桌面版划红/黄区
 * 入口：主页「实时视频」标题栏，对号左侧
 */
import { onMounted, onUnmounted, ref } from 'vue'
import { LIVE_VS_STATUS_URL, VS_DESKTOP_BAT_HINT } from '@/config/liveVideo'

const emit = defineEmits<{
  close: []
}>()

type VsStatus = {
  connection?: string
  resolution?: string
  display_fps?: string | number
  detection_fps?: string | number
  device?: string
  model?: string
  error?: string
}

const loading = ref(true)
const unreachable = ref(false)
const status = ref<VsStatus>({})

let pollTimer: number | undefined

async function refreshStatus() {
  try {
    const controller = new AbortController()
    const t = window.setTimeout(() => controller.abort(), 3000)
    const res = await fetch(LIVE_VS_STATUS_URL, {
      cache: 'no-store',
      signal: controller.signal,
    })
    window.clearTimeout(t)
    if (!res.ok) {
      unreachable.value = true
      loading.value = false
      return
    }
    status.value = (await res.json()) as VsStatus
    unreachable.value = false
  } catch {
    unreachable.value = true
  } finally {
    loading.value = false
  }
}

function startPoll() {
  void refreshStatus()
  pollTimer = window.setInterval(() => {
    void refreshStatus()
  }, 2000)
}

async function copyDesktopPath() {
  try {
    await navigator.clipboard.writeText(VS_DESKTOP_BAT_HINT)
  } catch {
    // ignore
  }
}

onMounted(() => startPoll())

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
        <p class="dz-lead">
          红区 / 黄区在 VisualSurveillance 检测服务侧生效；主页「实时视频」只播放已叠加区域的画面。
        </p>

        <section class="dz-section">
          <h3>检测流状态</h3>
          <p v-if="loading" class="dz-muted">正在查询…</p>
          <p v-else-if="unreachable" class="dz-err">
            本地服务不可用。请先运行
            <code>启动网页版.bat</code>（WebStreamDemo，端口 8765）。
          </p>
          <dl v-else class="dz-metrics">
            <div>
              <dt>连接</dt>
              <dd>{{ status.connection || '--' }}</dd>
            </div>
            <div>
              <dt>分辨率</dt>
              <dd>{{ status.resolution || '--' }}</dd>
            </div>
            <div>
              <dt>显示 FPS</dt>
              <dd>{{ status.display_fps ?? '--' }}</dd>
            </div>
            <div>
              <dt>检测 FPS</dt>
              <dd>{{ status.detection_fps ?? '--' }}</dd>
            </div>
            <div>
              <dt>设备</dt>
              <dd>{{ status.device || '--' }}</dd>
            </div>
            <div>
              <dt>模型</dt>
              <dd>{{ status.model || '--' }}</dd>
            </div>
          </dl>
          <p v-if="status.error" class="dz-err">{{ status.error }}</p>
          <button type="button" class="dz-btn" @click="refreshStatus">刷新状态</button>
        </section>

        <section class="dz-section">
          <h3>如何划红区 / 黄区（第一期）</h3>
          <ol class="dz-steps">
            <li>关闭网页流服务控制台（若桌面版与网页版互斥）。</li>
            <li>运行桌面版，在画面上配置黄区、红区并保存。</li>
            <li>关闭桌面版后，再启动网页版，使主页 MJPEG 带上新区划。</li>
          </ol>
          <p class="dz-path">
            桌面版启动脚本：
            <code>{{ VS_DESKTOP_BAT_HINT }}</code>
          </p>
          <button type="button" class="dz-btn secondary" @click="copyDesktopPath">
            复制脚本路径
          </button>
        </section>
      </div>

      <div class="dz-footer">
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
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dz-dialog {
  width: 520px;
  max-width: 94vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #b0b0b0;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.28);
  font-family: 'Microsoft YaHei', 'Segoe UI', sans-serif;
  overflow: hidden;
}

.dz-titlebar {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 8px 0 12px;
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
  width: 32px;
  height: 28px;
  border: none;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
  color: #333;
  &:hover {
    background: #e81123;
    color: #fff;
  }
}

.dz-body {
  padding: 14px 16px;
  overflow: auto;
  flex: 1;
}

.dz-lead {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.5;
  color: #444;
}

.dz-section {
  margin-bottom: 16px;
  h3 {
    margin: 0 0 8px;
    font-size: 13px;
    color: #2c3e50;
  }
}

.dz-muted {
  font-size: 12px;
  color: #888;
}

.dz-err {
  font-size: 12px;
  color: #c0392b;
  line-height: 1.45;
  code {
    font-size: 11px;
  }
}

.dz-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
  margin: 0 0 10px;
  font-size: 12px;
  div {
    display: flex;
    gap: 8px;
  }
  dt {
    color: #888;
    min-width: 64px;
  }
  dd {
    margin: 0;
    color: #222;
    font-weight: 600;
  }
}

.dz-steps {
  margin: 0 0 10px;
  padding-left: 18px;
  font-size: 12px;
  line-height: 1.55;
  color: #333;
}

.dz-path {
  margin: 0 0 8px;
  font-size: 11px;
  color: #555;
  word-break: break-all;
  code {
    font-size: 11px;
  }
}

.dz-footer {
  display: flex;
  justify-content: flex-end;
  padding: 10px 16px 14px;
  border-top: 1px solid #eee;
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
  margin-right: 8px;

  &.secondary {
    background: #1677ff;
    color: #fff;
  }

  &.primary {
    background: #059669;
    color: #fff;
    margin-right: 0;
  }

  &:hover {
    filter: brightness(1.05);
  }
}
</style>
