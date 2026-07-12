<script setup lang="ts">
import { computed } from 'vue'

/** 对齐 Qt LvTongPro::initializeUI / truckStatus */
const SCENE_WIDTH = 1148
const SCENE_HEIGHT = 62
const START_POS_X = 170
const TOTAL_METERS = 48
const METER_PIX = SCENE_WIDTH / TOTAL_METERS
const SEGMENT_METERS = 8
const BASE_Y = 58

const props = withDefaults(
  defineProps<{
    /** 雷达距离，0 表示无来车（卡车隐藏） */
    distance?: number
  }>(),
  {
    distance: 0,
  },
)

const nodeXs = [
  START_POS_X + 10,
  START_POS_X + SEGMENT_METERS * METER_PIX + 10,
  START_POS_X + SEGMENT_METERS * METER_PIX * 2 + 25,
  START_POS_X + SEGMENT_METERS * METER_PIX * 4 + 60,
  START_POS_X + SEGMENT_METERS * METER_PIX * 5 + 70,
]

const showTruck = computed(() => props.distance > 0)

const truckX = computed(() => {
  if (!showTruck.value) return 0
  let x = START_POS_X + (42 - props.distance) * METER_PIX - 32
  if (Math.round(props.distance) === 8) {
    x += 50
  }
  return x
})

const truckLabel = computed(() => {
  if (!showTruck.value) return ''
  return `${Math.round(props.distance) - 4}m`
})

/** 根据卡车位置点亮已走过的节点 */
const activeNodeCount = computed(() => {
  if (!showTruck.value) return 0
  let count = 0
  for (const x of nodeXs) {
    if (truckX.value >= x - 20) count++
  }
  return count
})
</script>

<template>
  <div class="truck-scene" :style="{ height: `${SCENE_HEIGHT}px` }">
    <div class="scene-canvas" :style="{ width: `${SCENE_WIDTH}px`, height: `${SCENE_HEIGHT}px` }">
      <!-- 灰色虚线进度轴（Qt: grayPen DashLine） -->
      <div class="progress-line" :style="{ top: `${BASE_Y}px` }" />

      <!-- 5 个流程节点（Qt: 外圈 #112079 + 内实心圆） -->
      <div
        v-for="(x, index) in nodeXs"
        :key="index"
        class="node"
        :class="{
          passed: showTruck && index < activeNodeCount,
          idle: !showTruck,
        }"
        :style="{ left: `${x - 4}px`, top: `${BASE_Y - 4}px` }"
      />

      <!-- 卡车：仅 distance > 0 时显示，随流程右移 -->
      <template v-if="showTruck">
        <img
          class="truck"
          src="/assets/img/truck.png"
          alt="车辆"
          :style="{ left: `${truckX}px`, top: '28px' }"
        />
        <span class="truck-label" :style="{ left: `${truckX + 8}px`, top: '28px' }">
          {{ truckLabel }}
        </span>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.truck-scene {
  width: 100%;
  background: #fff;
  overflow: hidden;
  flex-shrink: 0;
}

.scene-canvas {
  position: relative;
  max-width: 100%;
}

.progress-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 0;
  border-top: 2px dotted #a8c5e8;
}

.node {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-sizing: border-box;

  /* 空闲：全部蓝色实心节点（对齐 Qt 初始化） */
  &.idle {
    width: 10px;
    height: 10px;
    margin-top: -1px;
    margin-left: -1px;
    border: 2px solid #112079;
    background: #112079;
  }

  /* 来车后：已走过 = 蓝色粗实心，未走过 = 灰色空心 */
  &.passed {
    width: 10px;
    height: 10px;
    margin-top: -1px;
    margin-left: -1px;
    border: 2px solid #112079;
    background: #112079;
  }

  &:not(.passed):not(.idle) {
    width: 8px;
    height: 8px;
    border: 2px solid #c0c8d8;
    background: #e8ecf2;
  }
}

.node-inner {
  display: none;
}

.truck {
  position: absolute;
  width: auto;
  height: 28px;
  transform: translateX(-50%);
  transition: left 0.35s ease;
  z-index: 2;
}

.truck-label {
  position: absolute;
  font-size: 12px;
  font-weight: bold;
  color: #0000ff;
  z-index: 2;
  white-space: nowrap;
}
</style>
