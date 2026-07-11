<script setup lang="ts">
const emit = defineEmits<{
  close: []
  accept: []
  reject: []
}>()
</script>

<template>
  <div class="booking-overlay" @click.self="emit('close')">
    <div class="booking-dialog">
      <h2 class="dialog-title">预约处理</h2>

      <div class="preview-row">
        <div class="preview-box">
          <span>雷达测量来车信息区域</span>
        </div>
        <div class="preview-box">
          <span>视频对讲区域</span>
        </div>
      </div>

      <div class="info-row">
        <button class="refresh-btn" title="刷新">
          <img src="/assets/img/a_refresh.png" alt="刷新" />
        </button>
        <button class="mic-btn">
          <img src="/assets/img/a_mic_open.png" alt="麦克风" />
        </button>
        <button class="spk-btn">
          <img src="/assets/img/a_speaker_open.png" alt="扬声器" />
        </button>
        <img src="/assets/img/xray_open.png" class="xray-icon" alt="X光" />
        <span class="info-text">等待来车信息...</span>
      </div>

      <div class="action-row">
        <button class="btn-reject" @click="emit('reject'); emit('close')">
          <img src="/assets/img/a_dismiss.png" alt="" />
          驳回
        </button>
        <button class="btn-accept" @click="emit('accept'); emit('close')">
          <img src="/assets/img/a_accept.png" alt="" />
          受理
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.booking-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.booking-dialog {
  width: 1289px;
  max-width: 95vw;
  background: linear-gradient(180deg, $gradient-start 0%, $gradient-mid 12%, $gradient-end 100%);
  border: 1px solid $primary;
  border-radius: 8px;
  padding: 16px 24px 24px;
  font-family: 'Microsoft YaHei', sans-serif;
}

.dialog-title {
  font-size: 24px;
  font-weight: bold;
  color: $text-dark;
  text-align: center;
  padding-bottom: 12px;
  border-bottom: 2px solid $primary;
  margin-bottom: 16px;
}

.preview-row {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-bottom: 16px;
}

.preview-box {
  width: 512px;
  max-width: 48%;
  height: 256px;
  background: #1a1a2e;
  border: 2px solid #ddd;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #aaa;
  font-size: 16px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  margin-bottom: 16px;
}

.refresh-btn,
.mic-btn,
.spk-btn {
  background: $btn-blue;
  border: none;
  border-radius: 4px;
  padding: 4px;
  img {
    width: 24px;
    height: 24px;
  }
}

.xray-icon {
  width: 32px;
  height: 32px;
}

.info-text {
  font-size: 14px;
  color: $text-gray;
}

.action-row {
  display: flex;
  justify-content: center;
  gap: 40px;
}

.btn-reject,
.btn-accept {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 40px;
  border: none;
  border-radius: 8px;
  font-size: 18px;
  font-weight: bold;
  color: #fff;
  img {
    width: 28px;
    height: 28px;
  }
}

.btn-reject {
  background: $reject-red;
  &:hover {
    background: #dc2626;
  }
}

.btn-accept {
  background: $accept-green;
  &:hover {
    background: #047857;
  }
}
</style>
