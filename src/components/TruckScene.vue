<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  distance?: number
}>()

const truckLeft = ref(10)

watch(
  () => props.distance,
  (d) => {
    if (d == null) return
    // 距离越大，卡车越靠左（模拟 Qt graphicsView）
    const pct = Math.max(5, Math.min(90, 100 - d * 2.5))
    truckLeft.value = pct
  },
  { immediate: true },
)
</script>

<template>
  <div class="truck-scene">
    <div class="lane" />
    <img
      class="truck"
      src="/assets/img/truck.png"
      alt="车辆"
      :style="{ left: truckLeft + '%' }"
    />
  </div>
</template>

<style scoped lang="scss">
.truck-scene {
  position: relative;
  height: 62px;
  background: #fff;
  border-top: 1px solid #eee;
  overflow: hidden;
}

.lane {
  position: absolute;
  bottom: 8px;
  left: 5%;
  right: 5%;
  height: 4px;
  background: linear-gradient(90deg, #5fbb9e 0%, #ddd 100%);
  border-radius: 2px;
}

.truck {
  position: absolute;
  bottom: 10px;
  width: 80px;
  height: auto;
  transform: translateX(-50%);
  transition: left 0.4s ease;
}
</style>
