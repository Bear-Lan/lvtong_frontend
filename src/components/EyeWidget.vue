<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  title?: string
  placeholder?: string
  imageUrl?: string
}>()

const displayText = ref(props.placeholder ?? '')

watch(
  () => props.imageUrl,
  (url) => {
    displayText.value = url ? '' : (props.placeholder ?? '')
  },
)
</script>

<template>
  <div class="eye-widget">
    <img v-if="imageUrl" :src="imageUrl" class="eye-image" alt="" />
    <span v-else class="eye-placeholder">{{ displayText }}</span>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.eye-widget {
  width: 100%;
  height: 100%;
  min-height: 280px;
  background: #fff;
  border-bottom: 2px solid $border-color;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.eye-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.eye-placeholder {
  font-size: 28px;
  color: $text-placeholder;
}
</style>
