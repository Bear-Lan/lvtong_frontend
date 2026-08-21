<script setup lang="ts">

import WorkflowIcons, { type WorkflowStepKey } from '@/components/WorkflowIcons.vue'

import TruckScene from '@/components/TruckScene.vue'

import HardwareStatusBar from '@/components/HardwareStatusBar.vue'



defineProps<{

  bookingActive?: boolean

  distance?: number

  gateOnline?: boolean

  gateOpen?: boolean

}>()



const emit = defineEmits<{

  workflowClick: [key: WorkflowStepKey]

  talkClick: []

  dmTempClick: []

}>()

</script>



<template>

  <div class="left-bottom">

    <WorkflowIcons
      :booking-active="bookingActive"
      :gate-online="gateOnline"
      :gate-open="gateOpen"
      @click="emit('workflowClick', $event)"
    />

    <TruckScene :distance="distance" />

    <HardwareStatusBar
      @talk-click="emit('talkClick')"
      @dm-temp-click="emit('dmTempClick')"
    />

  </div>

</template>



<style scoped lang="scss">
.left-bottom {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  /* 图标区吃满剩余高度，虚线贴状态栏（不再被 margin-top:auto 拉开） */
}
</style>


