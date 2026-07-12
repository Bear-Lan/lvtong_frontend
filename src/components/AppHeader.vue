<script setup lang="ts">
defineProps<{
  username?: string
}>()

const emit = defineEmits<{
  toolClick: [tip: string]
}>()

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

      <span class="user-name">{{ username ?? '系统管理员' }}</span>

      <button class="win-btn" title="最小化">
        <img src="/assets/img/s_min.png" alt="最小化" />
      </button>
      <button class="win-btn" title="最大化">
        <img src="/assets/img/s_max.png" alt="最大化" />
      </button>
      <button class="win-btn" title="关闭">
        <img src="/assets/img/s_close.png" alt="关闭" />
      </button>
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

.tool-btn,
.win-btn {
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

.user-name {
  font-size: 12px;
  font-weight: bold;
  color: #999;
  margin-left: auto;
  margin-right: 8px;
  padding: 0 12px;
  white-space: nowrap;
  border-left: 1px dashed #ccc;
  border-right: 1px dashed #ccc;
  height: 48px;
  display: flex;
  align-items: center;
}
</style>
