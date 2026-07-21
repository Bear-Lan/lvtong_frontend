<script setup lang="ts">
import WorkflowIcons, { type WorkflowStepKey } from '@/components/WorkflowIcons.vue'
import TruckScene from '@/components/TruckScene.vue'
import HardwareStatusBar from '@/components/HardwareStatusBar.vue'

defineProps<{
  bookingActive?: boolean
  distance?: number
  checkStep?: number
}>()

const emit = defineEmits<{
  workflowClick: [key: WorkflowStepKey]
}>()
</script>

<template>
  <div class="bottom-panel">
    <WorkflowIcons
      :booking-active="bookingActive"
      :check-step="checkStep"
      @click="emit('workflowClick', $event)"
    />
    <TruckScene :distance="distance" />
    <HardwareStatusBar />
  </div>
</template>

<style scoped lang="scss">
.bottom-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
