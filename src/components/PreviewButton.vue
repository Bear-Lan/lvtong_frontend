<script setup lang="ts">
defineProps<{
  label?: string
}>()

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <button class="preview-btn" @click="emit('click')">
    {{ label ?? '预览' }}
  </button>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.preview-btn {
  border: 2px solid $btn-preview-bg;
  border-radius: 10px;
  background: $btn-preview-bg;
  color: $btn-preview-text;
  padding: 2px 12px;
  font-weight: bold;
  font-size: 13px;
  min-height: 28px;
  transition: all 0.15s;
  &:hover {
    border-color: $btn-preview-text;
    background: #c2d8ff;
  }
}
</style>
