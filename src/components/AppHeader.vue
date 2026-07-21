<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/useAuthStore'

export type ToolAnchor = {
  left: number
  top: number
  bottom: number
  right: number
}

const props = defineProps<{
  username?: string
  /** 对齐 Qt btn_webservice 在线图标 */
  aiOnline?: boolean
}>()

const emit = defineEmits<{
  toolClick: [key: string, anchor?: ToolAnchor]
}>()

const auth = useAuthStore()
const router = useRouter()
const userMenuOpen = ref(false)

function toggleUserMenu() {
  userMenuOpen.value = !userMenuOpen.value
}

function handleLogout() {
  userMenuOpen.value = false
  auth.logout()
}

function rectFromEl(el: EventTarget | null): ToolAnchor | undefined {
  if (!(el instanceof HTMLElement)) return undefined
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, bottom: r.bottom, right: r.right }
}

function handleToolClick(key: string, e?: MouseEvent) {
  switch (key) {
    case 'user':
      router.push('/users')
      break
    case 'history':
    case 'device':
    case 'stop':
    case 'plc':
    case 'ai':
      // 由主界面 Dashboard 处理弹窗（对齐 Qt 弹窗而非跳转页面）
      emit(
        'toolClick',
        key,
        key === 'plc' || key === 'ai' ? rectFromEl(e?.currentTarget ?? null) : undefined,
      )
      break
    default:
      emit('toolClick', key)
  }
}

const tools = computed(() => {
  // tip/icon 对齐 onAiModelOnlineStateChanged
  const aiOnline = props.aiOnline === true
  return [
    { key: 'history', icon: '/assets/img/s_record.png', tip: '历史记录' },
    { key: 'plc', icon: '/assets/img/s_turn.png', tip: '开关控制' },
    {
      key: 'ai',
      icon: aiOnline ? '/assets/img/ai_model_online.png' : '/assets/img/ai_model_offline.png',
      tip: aiOnline ? 'AI智能体连接状态：在线' : 'AI智能体连接状态：离线',
    },
    { key: 'device', icon: '/assets/img/s_disconnect.png', tip: '设备连接状态' },
    { key: 'user', icon: '/assets/img/usrmgr.png', tip: '用户管理' },
  ]
})
</script>

<template>
  <header class="app-header">
    <img class="logo" src="/assets/img/logo.png" alt="logo" />
    <h1 class="title">硚孝高速王母湖收费站绿通快检系统</h1>

    <div class="toolbar-frame">
      <button class="tool-btn stop-btn" title="急停" @click="emit('toolClick', 'stop')">
        <img src="/assets/img/a_stop.png" alt="急停" />
      </button>

      <button
        v-for="t in tools"
        :key="t.key"
        class="tool-btn"
        :title="t.tip"
        @click="handleToolClick(t.key, $event)"
      >
        <img :src="t.icon" :alt="t.tip" />
      </button>

      <div class="user-area" @click="toggleUserMenu">
        <span class="user-avatar">👤</span>
        <span class="user-name">{{ username ?? '系统管理员' }}</span>
        <div v-if="userMenuOpen" class="user-menu">
          <button @click.stop="handleLogout">退出登录</button>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped lang="scss">
.app-header {
  display: flex;
  align-items: center;
  height: 72px;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;
  gap: 12px;
}

.logo {
  height: 48px;
  width: auto;
  object-fit: contain;
}

.title {
  font-size: 20px;
  font-weight: bold;
  color: #1a1a1a;
  white-space: nowrap;
  margin: 0;
  flex: 1;
}

.toolbar-frame {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.tool-btn {
  width: 36px;
  height: 36px;
  padding: 2px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;

  img { width: 28px; height: 28px; object-fit: contain; }
  &:hover { background: #f0f0f0; }
}

.stop-btn img { width: 32px; height: 32px; }

.user-area {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  margin-left: 8px;

  &:hover { background: #f0f0f0; }

  .user-avatar { font-size: 20px; }
  .user-name { font-size: 14px; color: #333; white-space: nowrap; }
}

.user-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  z-index: 100;
  min-width: 100px;

  button {
    width: 100%;
    padding: 8px 16px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 13px;
    text-align: left;

    &:hover { background: #f5f5f5; }
  }
}
</style>
