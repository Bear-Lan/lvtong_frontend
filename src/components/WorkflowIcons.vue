<script setup lang="ts">

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

  }>(),

  {

    bookingActive: false,

  },

)



const emit = defineEmits<{

  click: [key: WorkflowStepKey]

}>()



const items: WorkflowItem[] = [

  { key: 'book', label: '预约', icon: '/assets/img/a_lc_online.png', wide: true },

  { key: 'gate', label: '闸机', icon: '/assets/img/a_zj.png', wide: true },

  { key: 'xray', label: '光机', icon: '/assets/img/xray_online.png' },

  { key: 'camera', label: '拍照', icon: '/assets/img/a_xj_offline.png' },

  { key: 'audit', label: '审核', icon: '/assets/img/a_sh.png' },

]



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

        <span class="wf-label" :class="{ active: item.key === 'book' && bookingActive }">

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
  width: 100%;
}

.lead-spacer {
  flex-shrink: 0;
}

.wf-btn {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  min-width: 0;

  &:hover {
    opacity: 0.9;
  }
}

.wf-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;

  &.wide {
    width: 48px;
    height: 24px;
  }
}

.wf-label {
  font-size: 11px;
  font-weight: bold;
  color: #333;
  white-space: nowrap;

  &.active {
    color: #059669;
  }
}

</style>


