<script setup lang="ts">

const emit = defineEmits<{

  talkClick: []

  dmTempClick: []

}>()



withDefaults(

  defineProps<{

    kv200?: string

    ma200?: string

    temp200?: string

    kv160?: string

    ma160?: string

    temp160?: string

  }>(),

  {

    kv200: '-',

    ma200: '-',

    temp200: '-',

    kv160: '-',

    ma160: '-',

    temp160: '-',

  },

)

</script>



<template>

  <div class="hardware-bar">

    <div class="section xray-section">

      <img src="/assets/img/dt_img/1online0.png" class="xray-icon" alt="X光200" />

      <span class="stat">

        <img src="/assets/img/a_v.png" class="stat-icon" alt="" />

        {{ kv200 }}kV

      </span>

      <span class="stat">

        <img src="/assets/img/a_a.png" class="stat-icon" alt="" />

        {{ ma200 }}mA

      </span>

      <span class="stat">

        <img src="/assets/img/a_o.png" class="stat-icon" alt="" />

        {{ temp200 }}℃

      </span>

    </div>



    <div class="section center-section">

      <span class="mini-label">DM温度</span>

      <button type="button" class="icon-btn" title="DM温度监测" @click="emit('dmTempClick')">

        <img src="/assets/img/tempature_green.png" class="mini-icon" alt="" />

      </button>

      <span class="mini-label">对讲</span>

      <button type="button" class="icon-btn" title="视频喊话" @click="emit('talkClick')">

        <img src="/assets/img/a_camera_talk.png" class="mini-icon" alt="" />

      </button>

      <span class="mini-label">信号灯</span>

      <img src="/assets/img/a_plc_red.png" class="plc-icon highlight" title="红灯" alt="" />

      <img src="/assets/img/a_plc_gray.png" class="plc-icon" title="黄灯" alt="" />

      <img src="/assets/img/a_plc_gray.png" class="plc-icon" title="绿灯" alt="" />

      <img src="/assets/img/a_plc_greatlight_gray.png" class="plc-icon" title="补光灯" alt="" />

    </div>



    <div class="section xray-section">

      <img src="/assets/img/dt_img/2online0.png" class="xray-icon" alt="X光160" />

      <span class="stat">

        <img src="/assets/img/a_v.png" class="stat-icon" alt="" />

        {{ kv160 }}kV

      </span>

      <span class="stat">

        <img src="/assets/img/a_a.png" class="stat-icon" alt="" />

        {{ ma160 }}mA

      </span>

      <span class="stat">

        <img src="/assets/img/a_o.png" class="stat-icon" alt="" />

        {{ temp160 }}℃

      </span>

    </div>

  </div>

</template>



<style scoped lang="scss">
/* 整行贴底，紧挨虚线；去掉原浅灰顶边线（由虚线覆盖） */
.hardware-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 4px 12px;
  min-height: 36px;
  border-top: none;
  background: #fff;
  flex: 0 0 auto;
  margin-top: 0;
}

.section {
  display: flex;
  align-items: center;
  justify-content: space-evenly;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.center-section {
  flex: 1.2;
}

.xray-section:first-child {
  justify-content: flex-start;
  padding-left: 28px;
}

.xray-section:last-child {
  justify-content: flex-end;
  padding-right: 4px;
}

.xray-icon {
  width: 28px;
  height: 28px;
  object-fit: contain;
  flex-shrink: 0;
}

.stat {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  font-weight: bold;
  color: #666;
  white-space: nowrap;
}

.stat-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.mini-label {
  font-size: 8px;
  color: #333;
  white-space: nowrap;
}

.icon-btn {
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  display: inline-flex;
  line-height: 0;
}

.mini-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.plc-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
  flex-shrink: 0;

  &.highlight {
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.4);
    border-radius: 50%;
  }
}
</style>


