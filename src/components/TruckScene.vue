<script setup lang="ts">
import { computed } from 'vue'
import {
  SCENE_HEIGHT,
  TOTAL_LENGTH,
  START_POS_X,
  METER_PIX,
  BASE_Y,
  NODE_CENTERS,
  toPercentX,
} from '@/constants/workflowLayout'

const props = withDefaults(
  defineProps<{
    distance?: number
  }>(),
  {
    distance: 0,
  },
)

const showTruck = computed(() => props.distance > 0)

const truckX = computed(() => {
  if (!showTruck.value) return '0%'
  let x = START_POS_X + (42 - props.distance) * METER_PIX - 32
  if (Math.round(props.distance) === 8) x += 50
  return toPercentX(x)
})

const truckLabel = computed(() => {
  if (!showTruck.value) return ''
  return `${Math.round(props.distance) - 4}m`
})
</script>

<template>
  <div class="truck-scene">
    <svg
      class="progress-line"
      :viewBox="`0 0 ${TOTAL_LENGTH} 2`"
      preserveAspectRatio="none"
    >
      <line
        x1="0"
        y1="1"
        :x2="TOTAL_LENGTH"
        y2="1"
        stroke="#808080"
        stroke-width="2"
        stroke-dasharray="10 8"
      />
    </svg>

    <div
      v-for="(x, index) in NODE_CENTERS"
      :key="index"
      class="node"
      :style="{ left: toPercentX(x) }"
    />

    <template v-if="showTruck">
      <img class="truck" src="/assets/img/truck.png" alt="车辆" :style="{ left: truckX }" />
      <span class="truck-label" :style="{ left: truckX }">{{ truckLabel }}</span>
    </template>
  </div>
</template>

<style scoped lang="scss">
/* Qt: graphicsView height 62, BASE_Y 58 */
.truck-scene {
  position: relative;
  width: 100%;
  height: 62px;
  flex-shrink: 0;
}

.progress-line {
  position: absolute;
  left: 0;
  right: 0;
  top: 58px;
  width: 100%;
  height: 2px;
}

/* Qt: addEllipse 8x8 描边 + 4x4 实心内点 */
.node {
  position: absolute;
  top: 54px;
  width: 8px;
  height: 8px;
  margin-left: -4px;
  border: 2px solid #112079;
  border-radius: 50%;
  background: transparent;
  box-sizing: border-box;

  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 4px;
    height: 4px;
    margin: -2px 0 0 -2px;
    border-radius: 50%;
    background: #112079;
  }
}

.truck {
  position: absolute;
  top: 28px;
  height: 28px;
  width: auto;
  transform: translateX(-50%);
  transition: left 0.35s ease;
}

.truck-label {
  position: absolute;
  top: 28px;
  margin-left: 8px;
  transform: translateX(-50%);
  font-size: 12px;
  font-weight: bold;
  color: #0000ff;
  white-space: nowrap;
}
</style>
