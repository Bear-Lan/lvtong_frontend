<script setup lang="ts">
import { computed } from 'vue'

/** 对齐 Qt LvTongPro::initializeUI 常量 */
const SCENE_WIDTH = 1148
const START_POS_X = 170
const TOTAL_METERS = 48
const METER_PIX = SCENE_WIDTH / TOTAL_METERS
const SEGMENT_METERS = 8

interface WorkflowItem {
  key: string
  label: string
  icon: string
  iconOnline?: string
  iconWidth: number
}

const props = withDefaults(
  defineProps<{
    /** 是否已按下预约（对应 m_btnPrebookState） */
    bookingActive?: boolean
    /** 雷达是否在线（影响预约图标） */
    radarOnline?: boolean
  }>(),
  {
    bookingActive: false,
    radarOnline: false,
  },
)

const items: WorkflowItem[] = [
  { key: 'book', label: '预约', icon: '/assets/img/a_lc_offline.png', iconOnline: '/assets/img/a_lc_online.png', iconWidth: 48 },
  { key: 'gate', label: '闸机', icon: '/assets/img/a_zj.png', iconWidth: 48 },
  { key: 'xray', label: '光机', icon: '/assets/img/xray_offline.png', iconWidth: SEGMENT_METERS * METER_PIX },
  { key: 'camera', label: '拍照', icon: '/assets/img/a_xj_offline.png', iconOnline: '/assets/img/a_xj_online.png', iconWidth: SEGMENT_METERS * METER_PIX },
  { key: 'audit', label: '审核', icon: '/assets/img/a_sh.png', iconWidth: SEGMENT_METERS * METER_PIX },
]

/** 与 graphicsScene 节点 X 对齐 */
const nodePositions = computed(() => {
  const offsets = [10, 10 + SEGMENT_METERS * METER_PIX, 10 + SEGMENT_METERS * METER_PIX * 2 + 15, 10 + SEGMENT_METERS * METER_PIX * 4 + 60, 10 + SEGMENT_METERS * METER_PIX * 5 + 70]
  return offsets.map((offset) => START_POS_X + offset)
})

function itemLeft(index: number) {
  return `${(nodePositions.value[index] / SCENE_WIDTH) * 100}%`
}

function itemIcon(item: WorkflowItem) {
  if (item.key === 'book' && props.radarOnline && item.iconOnline) {
    return item.iconOnline
  }
  return item.icon
}
</script>

<template>
  <div class="workflow-icons">
    <div class="workflow-track" :style="{ width: `${SCENE_WIDTH}px` }">
      <div
        v-for="(item, index) in items"
        :key="item.key"
        class="workflow-item"
        :style="{ left: itemLeft(index), width: `${item.iconWidth}px` }"
      >
        <img
          :src="itemIcon(item)"
          :alt="item.label"
          class="icon"
          :style="{ width: `${Math.min(item.iconWidth, 48)}px` }"
        />
        <span class="label" :class="{ active: item.key === 'book' && bookingActive }">
          {{ item.label }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.workflow-icons {
  padding: 6px 0 10px;
  overflow: hidden;
  display: flex;
  justify-content: flex-start;
  min-height: 54px;
}

.workflow-track {
  position: relative;
  height: 40px;
  max-width: 100%;
}

.workflow-item {
  position: absolute;
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.icon {
  height: 24px;
  object-fit: contain;
}

.label {
  font-size: 11px;
  font-weight: bold;
  color: #333;
  white-space: nowrap;

  &.active {
    color: #059669;
  }
}
</style>
