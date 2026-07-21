<script setup lang="ts">
import { computed } from 'vue'
import { SEGMENT_PIX, START_POS_X, SCENE_WIDTH } from '@/constants/workflowLayout'

export type WorkflowStepKey = 'book' | 'gate' | 'xray' | 'camera' | 'audit'

interface WorkflowItem {
  key: WorkflowStepKey
  label: string
  icon: string
  wide?: boolean
}

const props = withDefaults(
  defineProps<{
    bookingActive?: boolean
    checkStep?: number
  }>(),
  {
    bookingActive: false,
    checkStep: 0,
  },
)

const emit = defineEmits<{
  click: [key: WorkflowStepKey]
}>()

// checkStep → 对应步骤 key
// 0=待机, 1=受理(book), 2=闸机(gate), 3=光机(xray), 4=拍照(camera), 5=审核(audit)
const STEP_KEY_MAP: Record<number, WorkflowStepKey | null> = {
  0: null,
  1: 'book',
  2: 'gate',
  3: 'xray',
  4: 'camera',
  5: 'audit',
}

const items: WorkflowItem[] = [
  { key: 'book', label: '预约', icon: '/assets/img/a_lc_online.png', wide: true },
  { key: 'gate', label: '闸机', icon: '/assets/img/a_zj.png', wide: true },
  { key: 'xray', label: '光机', icon: '/assets/img/xray_online.png' },
  { key: 'camera', label: '拍照', icon: '/assets/img/a_xj_offline.png' },
  { key: 'audit', label: '审核', icon: '/assets/img/a_sh.png' },
]

const currentStepKey = computed(() => STEP_KEY_MAP[props.checkStep] ?? null)

function isStepActive(key: WorkflowStepKey): boolean {
  if (!currentStepKey.value) return false
  const keys = items.map(i => i.key)
  const currentIdx = keys.indexOf(currentStepKey.value)
  const itemIdx = keys.indexOf(key)
  return itemIdx <= currentIdx
}

const leadSpacerPct = `${(START_POS_X / SCENE_WIDTH) * 100}%`
const cellWidthPct = `${(SEGMENT_PIX / SCENE_WIDTH) * 100}%`
</script>

<template>
  <div class="workflow-icons">
    <div class="workflow-row">
      <div class="lead-spacer" :style="{ width: leadSpacerPct }" />
      <button
        v-for="item in items"
        :key="item.key"
        type="button"
        class="wf-btn"
        :style="{ width: cellWidthPct }"
        :title="item.label"
        @click="emit('click', item.key)"
      >
        <img
          :src="item.icon"
          :alt="item.label"
          class="wf-icon"
          :class="{ wide: item.wide }"
        />
        <span
          class="wf-label"
          :class="{
            active: item.key === 'book' && bookingActive,
            current: item.key === currentStepKey,
            completed: isStepActive(item.key) && item.key !== currentStepKey,
          }"
        >
          {{ item.label }}
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* Qt: icon_lc 48x24, icon_xray 24x24, label 11pt bold */
.workflow-icons {
  padding: 6px 0;
  flex-shrink: 0;
}

.workflow-row {
  display: flex;
  align-items: flex-start;
}

.lead-spacer {
  flex: none;
}

.wf-btn {
  flex: none;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding: 0 4px;
}

.wf-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;

  &.wide {
    width: 48px;
  }
}

.wf-label {
  font-size: 11px;
  font-weight: bold;
  color: #888;
  margin-top: 2px;

  &.active {
    color: #2ecc71;
  }

  &.current {
    color: #1a73e8;
    text-decoration: underline;
  }

  &.completed {
    color: #27ae60;
  }
}
</style>
