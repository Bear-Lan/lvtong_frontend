<script setup lang="ts">
defineProps<{
  username?: string
}>()

const tools = [
  { icon: '/assets/img/a_stop.png', tip: '急停' },
  { icon: '/assets/img/s_record.png', tip: '历史记录' },
  { icon: '/assets/img/s_turn.png', tip: '开关控制' },
  { icon: '/assets/img/s_disconnect.png', tip: '设备连接状态' },
  { icon: '/assets/img/usrmgr.png', tip: '用户管理' },
  { icon: '/assets/img/a_ts.png', tip: 'AI智能体在线连接状态' },
]

const emit = defineEmits<{
  toolClick: [tip: string]
}>()
</script>

<template>
  <header class="app-header">
    <img class="logo" src="/assets/img/logo.png" alt="logo" />
    <h1 class="title">硚孝高速王母湖收费站绿通快检系统</h1>

    <div class="toolbar">
      <button
        v-for="t in tools"
        :key="t.tip"
        class="tool-btn"
        :title="t.tip"
        @click="emit('toolClick', t.tip)"
      >
        <img :src="t.icon" :alt="t.tip" />
      </button>
      <span class="user-name">{{ username ?? '管理员' }}</span>
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
  padding: 0 8px;
  gap: 8px;
}

.logo {
  width: 40px;
  height: 40px;
  object-fit: contain;
  flex-shrink: 0;
}

.title {
  font-size: 18px;
  font-weight: bold;
  color: $text-gray;
  white-space: nowrap;
  flex: 1;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.tool-btn,
.win-btn {
  background: transparent;
  border: none;
  padding: 4px;
  display: flex;
  align-items: center;
  img {
    width: 28px;
    height: 28px;
  }
  &:hover {
    opacity: 0.75;
  }
}

.user-name {
  font-size: 14px;
  color: $text-gray;
  margin: 0 8px;
  white-space: nowrap;
}
</style>
