<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/useAuthStore'

defineProps<{
  username?: string
}>()

const emit = defineEmits<{
  toolClick: [tip: string]
}>()

const auth = useAuthStore()
const userMenuOpen = ref(false)

function toggleUserMenu() {
  userMenuOpen.value = !userMenuOpen.value
}

function closeUserMenu() {
  userMenuOpen.value = false
}

function handleLogout() {
  userMenuOpen.value = false
  auth.logout()
}

const tools = [
  { key: 'history', icon: '/assets/img/s_record.png', tip: '历史记录' },
  { key: 'plc', icon: '/assets/img/s_turn.png', tip: '开关控制' },
  { key: 'ai', icon: '/assets/img/ai_model_offline.png', tip: 'AI智能体在线连接状态' },
  { key: 'device', icon: '/assets/img/s_disconnect.png', tip: '设备连接状态' },
  { key: 'user', icon: '/assets/img/usrmgr.png', tip: '用户管理' },
]
</script>

<template>
  <header class="app-header">
    <img class="logo" src="/assets/img/logo.png" alt="logo" />
    <h1 class="title">硚孝高速王母湖收费站绿通快检系统</h1>

    <div class="toolbar-frame">
      <button class="tool-btn stop-btn" title="急停" @click="emit('toolClick', '急停')">
        <img src="/assets/img/a_stop.png" alt="急停" />
      </button>

      <button
        v-for="t in tools"
        :key="t.key"
        class="tool-btn"
        :title="t.tip"
        @click="emit('toolClick', t.tip)"
      >
        <img :src="t.icon" :alt="t.tip" />
      </button>

      <div class="user-area" @click="toggleUserMenu">
        <span class="user-avatar">👤</span>
        <span class="user-name">{{ username ?? '系统管理员' }}</span>
        <span class="user-arrow" :class="{ open: userMenuOpen }">▼</span>

        <div v-if="userMenuOpen" class="user-dropdown" @click.stop>
          <div class="dropdown-item user-detail">
            <span class="detail-label">当前用户</span>
            <span class="detail-value">{{ username ?? '系统管理员' }}</span>
          </div>
          <div class="dropdown-item user-detail" v-if="auth.user">
            <span class="detail-label">角色</span>
            <span class="detail-value">{{ auth.user.role === 1 ? '管理员' : '操作员' }}</span>
          </div>
          <div class="dropdown-divider" />
          <button class="dropdown-item logout-btn" @click="handleLogout">
            <span>退出登录</span>
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.app-header {
  height: $header-height;
  min-height: $header-height;
  display: flex;
  align-items: center;
  background: #fff;
  border-bottom: 2px solid $primary;
  padding: 0 5px;
  gap: 0;
}

.logo {
  width: 48px;
  height: 48px;
  object-fit: contain;
  flex-shrink: 0;
}

.title {
  flex: 1;
  font-size: 18px;
  font-weight: bold;
  color: $text-gray;
  white-space: nowrap;
  margin: 0;
  padding-left: 4px;
}

.toolbar-frame {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 850px;
  max-width: 850px;
  height: 48px;
  flex-shrink: 0;
  padding-right: 4px;
}

.stop-btn {
  margin-left: 80px;
  margin-right: 40px;
}

.tool-btn {
  background: transparent;
  border: none;
  padding: 4px;
  display: flex;
  align-items: center;
  cursor: pointer;
  img {
    width: 32px;
    height: 32px;
  }
  &:hover {
    opacity: 0.75;
  }
}

.user-area {
  position: relative;
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  height: 48px;
  cursor: pointer;
  border-left: 1px dashed #ccc;
  border-right: 1px dashed #ccc;
  user-select: none;

  &:hover {
    background: #f5f5f5;
  }
}

.user-avatar {
  font-size: 16px;
  line-height: 1;
}

.user-name {
  font-size: 12px;
  font-weight: bold;
  color: #999;
  white-space: nowrap;
}

.user-arrow {
  font-size: 8px;
  color: #999;
  transition: transform 0.2s;

  &.open {
    transform: rotate(180deg);
  }
}

.user-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  min-width: 180px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  z-index: 1000;
  overflow: hidden;
}

.dropdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  font-size: 13px;
  width: 100%;
  border: none;
  background: none;
  cursor: pointer;
}

.user-detail {
  cursor: default;

  .detail-label {
    color: #999;
    font-size: 12px;
  }

  .detail-value {
    color: #333;
    font-weight: 500;
  }
}

.dropdown-divider {
  height: 1px;
  background: #e5e7eb;
  margin: 0;
}

.logout-btn {
  color: #ef4444;
  justify-content: center;

  &:hover {
    background: #fef2f2;
  }
}
</style>
