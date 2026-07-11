<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/useAuthStore'
import AppHeader from '@/components/AppHeader.vue'
import EyeWidget from '@/components/EyeWidget.vue'
import PreviewButton from '@/components/PreviewButton.vue'
import DeviceStatusBar from '@/components/DeviceStatusBar.vue'
import TruckScene from '@/components/TruckScene.vue'
import BookingDialog from '@/modules/booking/BookingDialog.vue'

const auth = useAuthStore()
const showBooking = ref(false)

const form = ref({
  plate: '--',
  plateGc: '--',
  goods: '',
  containerType: '',
  truckType: '',
  size: '',
  loadRate: '',
  weight: '',
  phone: '',
  historyCount: '--',
})

const captureButtons = [
  { key: 'head', label: '车头', icon: '/assets/img/a_car.png' },
  { key: 'tail', label: '车尾', icon: '/assets/img/a_car.png' },
  { key: 'license', label: '行驶证', icon: '/assets/img/a_pics.png' },
  { key: 'top', label: '车顶', icon: '/assets/img/a_car.png' },
  { key: 'evidence', label: '证据照', icon: '/assets/img/a_pics.png' },
  { key: 'goods', label: '货物', icon: '/assets/img/good_save.png' },
]

function simulateBooking() {
  showBooking.value = true
}
</script>

<template>
  <div class="dashboard">
    <AppHeader :username="auth.user?.realName" />

    <div class="dashboard-body">
      <!-- ========== 左侧 ========== -->
      <section class="panel-left">
        <!-- 车身影像 -->
        <div class="panel-card">
          <div class="panel-header">
            <img src="/assets/img/a_car.png" class="panel-icon" alt="" />
            <span class="panel-title">车身影像</span>
            <div class="panel-actions">
              <PreviewButton label="预览" />
            </div>
          </div>
          <EyeWidget placeholder="车身影像" />
        </div>

        <!-- 透视影像 -->
        <div class="panel-card">
          <div class="panel-header">
            <img src="/assets/img/a_xray.png" class="panel-icon" alt="" />
            <span class="panel-title">透视影像</span>
            <div class="panel-actions">
              <span class="xray-label">灰场</span>
              <span class="xray-label">亮场</span>
              <button class="action-btn">删除</button>
              <button class="action-btn">渲染</button>
              <PreviewButton label="预览" />
            </div>
          </div>
          <EyeWidget placeholder="透视影像" />
        </div>

        <!-- 设备状态 + 车辆动画 -->
        <div class="panel-card panel-bottom">
          <DeviceStatusBar />
          <TruckScene :distance="38" />
        </div>
      </section>

      <!-- ========== 右侧 ========== -->
      <section class="panel-right">
        <!-- 实时视频 -->
        <div class="panel-card video-card">
          <div class="panel-header">
            <img src="/assets/img/live_video.png" class="panel-icon" alt="" />
            <span class="panel-title">实时视频</span>
          </div>
          <div class="video-area">
            <span class="video-placeholder">实时视频</span>
          </div>
        </div>

        <!-- 图像采集 -->
        <div class="panel-card">
          <div class="panel-header">
            <img src="/assets/img/a_pics.png" class="panel-icon" alt="" />
            <span class="panel-title">图像采集</span>
          </div>
          <div class="capture-grid">
            <button v-for="btn in captureButtons" :key="btn.key" class="capture-btn">
              <img :src="btn.icon" alt="" />
              <span>{{ btn.label }}</span>
            </button>
          </div>
        </div>

        <!-- 绿通信息表单 -->
        <div class="panel-card form-card">
          <div class="panel-header">
            <img src="/assets/img/a_sht.png" class="panel-icon" alt="" />
            <span class="panel-title">绿通信息</span>
          </div>

          <div class="form-grid">
            <div class="form-row">
              <label>车牌号码：</label>
              <span class="plate-value">{{ form.plate }}</span>
              <button class="icon-btn" title="号牌编辑">
                <img src="/assets/img/a_search.png" alt="" />
              </button>
            </div>
            <div class="form-row">
              <label>挂车号码：</label>
              <span>{{ form.plateGc }}</span>
            </div>
            <div class="form-row">
              <label>货物类型：</label>
              <input v-model="form.goods" placeholder="请选择农产品类型" />
              <button class="icon-btn" title="货物类型选择">
                <img src="/assets/img/a_search.png" alt="" />
              </button>
            </div>
            <div class="form-row">
              <label>货厢类型：</label>
              <select v-model="form.containerType">
                <option value="">请选择</option>
                <option value="厢式">厢式</option>
                <option value="栏板">栏板</option>
                <option value="罐式">罐式</option>
              </select>
            </div>
            <div class="form-row">
              <label>货车类型：</label>
              <select v-model="form.truckType">
                <option value="">请选择</option>
              </select>
            </div>
            <div class="form-row">
              <label>轮廓尺寸：</label>
              <input v-model="form.size" placeholder="请输入外轮廓长宽高" />
            </div>
            <div class="form-row">
              <label>满载率约(%)：</label>
              <input v-model="form.loadRate" placeholder="0-100" />
            </div>
            <div class="form-row">
              <label>出口称重(kg)：</label>
              <input v-model="form.weight" placeholder="出口称重（kg）" />
            </div>
            <div class="form-row">
              <label>司机电话：</label>
              <input v-model="form.phone" placeholder="请输入11位手机号" />
            </div>
            <div class="form-row">
              <label>查验次数：</label>
              <span>{{ form.historyCount }}</span>
            </div>
          </div>

          <div class="form-footer">
            <button class="btn-reset">重置</button>
            <button class="btn-confirm" @click="simulateBooking">确认</button>
          </div>
        </div>
      </section>
    </div>

    <!-- 预约弹窗 -->
    <BookingDialog v-if="showBooking" @close="showBooking = false" />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.dashboard {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  min-width: $min-app-width;
  background: #f0f0f0;
  overflow: hidden;
}

.dashboard-body {
  flex: 1;
  display: flex;
  gap: 0;
  overflow: hidden;
  min-height: 0;
}

.panel-left {
  flex: 1.6;
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
  overflow: hidden;
}

.panel-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 700px;
  max-width: 760px;
  overflow: hidden;
}

.panel-card {
  background: #fff;
  border: 2px solid $border-color;
  border-radius: $card-radius;
  margin: 2px;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &:not(.panel-bottom):not(.form-card) {
    flex: 1;
    min-height: 0;
  }
}

.panel-bottom {
  flex-shrink: 0;
}

.form-card {
  flex: 1;
  min-height: 0;
}

.video-card {
  flex: 1.2;
  min-height: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
}

.panel-icon {
  width: 24px;
  height: 24px;
}

.panel-title {
  font-size: 14px;
  font-weight: bold;
  color: $text-dark;
  flex: 1;
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.xray-label {
  font-size: 12px;
  color: $text-gray;
}

.action-btn {
  border: 2px solid $btn-preview-bg;
  border-radius: 10px;
  background: $btn-preview-bg;
  color: $btn-preview-text;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: bold;
}

.video-area {
  flex: 1;
  min-height: 280px;
  background: #1a1a1a;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-placeholder {
  font-size: 28px;
  color: #999;
}

.capture-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 12px;
}

.capture-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  border: 2px solid $btn-preview-bg;
  border-radius: 10px;
  background: #fff;
  font-size: 13px;
  font-weight: bold;
  color: $btn-preview-text;
  transition: all 0.15s;
  img {
    width: 32px;
    height: 32px;
  }
  &:hover {
    background: $btn-preview-bg;
  }
}

.form-grid {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;

  label {
    width: 110px;
    flex-shrink: 0;
    color: $text-dark;
    font-weight: 600;
    text-align: right;
  }

  input,
  select {
    flex: 1;
    height: 32px;
    padding: 0 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 13px;
    outline: none;
    &:focus {
      border-color: $primary;
    }
  }

  span {
    flex: 1;
    color: $text-gray;
  }
}

.plate-value {
  font-size: 16px;
  font-weight: bold;
  color: #1a56db;
}

.icon-btn {
  background: transparent;
  border: none;
  padding: 4px;
  img {
    width: 20px;
    height: 20px;
  }
}

.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid #eee;
  flex-shrink: 0;
}

.btn-reset {
  padding: 8px 24px;
  border: 2px solid #ddd;
  border-radius: 8px;
  background: #fff;
  font-size: 14px;
  color: $text-gray;
}

.btn-confirm {
  padding: 8px 36px;
  border: none;
  border-radius: 8px;
  background: $primary;
  color: #fff;
  font-size: 15px;
  font-weight: bold;
  &:hover {
    background: $primary-dark;
  }
}
</style>
