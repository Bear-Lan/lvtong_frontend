<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 设备已连接并有读数时传入，否则显示 --- */
    kv200?: string
    ma200?: string
    temp200?: string
    kv160?: string
    ma160?: string
    temp160?: string
    /** 对讲是否激活 */
    talkActive?: boolean
    /** 信号灯是否亮起 */
    signalActive?: boolean
    redOn?: boolean
    yellowOn?: boolean
    greenOn?: boolean
  }>(),
  {
    kv200: '---',
    ma200: '---',
    temp200: '---',
    kv160: '---',
    ma160: '---',
    temp160: '---',
    talkActive: false,
    signalActive: false,
    redOn: false,
    yellowOn: false,
    greenOn: false,
  },
)
</script>

<template>
  <div class="hardware-bar">
    <div class="section xray-section">
      <img src="/assets/img/dt_img/1online0.png" class="xray-icon" alt="X光200" />
      <div class="stat-group">
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
    </div>

    <div class="section center-section">
      <span class="mini-label">DM温度</span>
      <img src="/assets/img/tempature_green.png" class="mini-icon" alt="DM温度" />
      <span class="mini-label">对讲</span>
      <img
        :src="talkActive ? '/assets/img/a_camera_talk.png' : '/assets/img/a_camera_talk_gray.png'"
        class="mini-icon"
        alt="对讲"
        title="视频喊话"
      />
      <span class="mini-label">信号灯</span>
      <div class="plc-lights">
        <img
          :src="signalActive && redOn ? '/assets/img/a_plc_red.png' : '/assets/img/a_plc_gray.png'"
          :class="{ highlight: signalActive && redOn }"
          title="红灯"
          alt="红"
        />
        <img
          :src="signalActive && yellowOn ? '/assets/img/a_plc_yellow.png' : '/assets/img/a_plc_gray.png'"
          title="黄灯"
          alt="黄"
        />
        <img
          :src="signalActive && greenOn ? '/assets/img/a_plc_green.png' : '/assets/img/a_plc_gray.png'"
          title="绿灯"
          alt="绿"
        />
        <img src="/assets/img/a_plc_greatlight_gray.png" title="补光灯" alt="补光" />
      </div>
    </div>

    <div class="section xray-section">
      <img src="/assets/img/dt_img/2online0.png" class="xray-icon" alt="X光160" />
      <div class="stat-group">
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
  </div>
</template>

<style scoped lang="scss">
.hardware-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
  min-height: 36px;
  border-top: 1px solid #eee;
  background: #fff;
  flex-shrink: 0;
}

.section {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.center-section {
  justify-content: center;
}

.xray-section:last-child {
  justify-content: flex-end;
}

.xray-icon {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.stat-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stat {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  font-weight: bold;
  color: #666;
}

.stat-icon {
  width: 16px;
  height: 16px;
}

.mini-label {
  font-size: 8px;
  color: #333;
}

.mini-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.plc-lights {
  display: flex;
  gap: 4px;
  img {
    width: 20px;
    height: 20px;
  }
  .highlight {
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.35);
    border-radius: 50%;
  }
}
</style>
