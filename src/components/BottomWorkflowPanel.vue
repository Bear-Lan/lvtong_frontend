<script setup lang="ts">

import WorkflowIcons, { type WorkflowStepKey } from '@/components/WorkflowIcons.vue'

import TruckScene from '@/components/TruckScene.vue'

import HardwareStatusBar from '@/components/HardwareStatusBar.vue'



defineProps<{

  bookingActive?: boolean

  distance?: number

}>()



const emit = defineEmits<{

  workflowClick: [key: WorkflowStepKey]

}>()

</script>



<template>

  <div class="left-bottom">

    <WorkflowIcons :booking-active="bookingActive" @click="emit('workflowClick', $event)" />

    <TruckScene :distance="distance" />

    <HardwareStatusBar />

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


