<script setup lang="ts">

import { ref } from 'vue'

import { useAuthStore } from '@/stores/useAuthStore'

import AppHeader from '@/components/AppHeader.vue'

import EyeWidget from '@/components/EyeWidget.vue'

import PreviewButton from '@/components/PreviewButton.vue'

import BottomWorkflowPanel from '@/components/BottomWorkflowPanel.vue'
import type { WorkflowStepKey } from '@/components/WorkflowIcons.vue'

import BookingDialog from '@/modules/booking/BookingDialog.vue'



const auth = useAuthStore()

const showBooking = ref(false)

/** 流程区状态 — 登录后初始为空闲，无预约、无来车 */
const workflow = ref({
  bookingActive: false,
  distance: 0,
})



const gammaValue = ref(2.0)
const gammaText = ref('2.00')

const whiteValue = ref(128)



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

  { key: 'head', label: '车头' },

  { key: 'tail', label: '车尾' },

  { key: 'top', label: '车顶' },

  { key: 'goods', label: '货物' },

  { key: 'license', label: '行驶证' },

  { key: 'evidence', label: '证据照' },

]



function simulateBooking() {

  showBooking.value = true

}

function onGammaBlur() {
  const n = Number.parseFloat(gammaText.value)
  if (!Number.isNaN(n)) {
    gammaValue.value = n
    gammaText.value = n.toFixed(2)
  } else {
    gammaText.value = gammaValue.value.toFixed(2)
  }
}

function onWorkflowClick(key: WorkflowStepKey) {
  if (key === 'book') {
    showBooking.value = true
  }
}

</script>



<template>

  <div class="dashboard">

    <AppHeader :username="auth.user?.realName" />



    <div class="dashboard-body">

      <!-- 左侧 -->

      <section class="panel-left">

        <!-- 车身影像 -->

        <div class="panel-card panel-stretch">

          <div class="panel-header panel-header-body">

            <img src="/assets/img/a_car.png" class="panel-icon" alt="" />

            <span class="panel-title">车身影像</span>

            <button class="header-icon-btn" title="点云量测车辆轮廓长宽高---图片保存">

              <img src="/assets/img/good_save.png" alt="" />

            </button>

            <button class="header-icon-btn header-icon-swap" title="切换视角">

              <img src="/assets/img/a_leftright.png" alt="" />

            </button>

            <PreviewButton label="预览" />

            <span class="header-spacer" />

          </div>

          <EyeWidget large placeholder="车身影像" />

        </div>



        <!-- 透视影像 -->

        <div class="panel-card panel-stretch">

          <div class="panel-header panel-header-xray">

            <img src="/assets/img/a_xray.png" class="panel-icon" alt="" />

            <span class="panel-title">透视影像</span>

            <span class="xray-meta">200图像：</span>

            <span class="xray-label">灰场</span>

            <input
              v-model="gammaText"
              type="text"
              inputmode="decimal"
              class="xray-spin is-active"
              @blur="onGammaBlur"
            />

            <span class="xray-label">亮场</span>

            <input v-model.number="whiteValue" type="number" step="16" min="0" max="255" class="xray-spin" />

            <button class="action-btn">删除</button>

            <button class="action-btn">渲染</button>

          </div>

          <EyeWidget large placeholder="透视影像" />

        </div>



        <!-- 底部：流程图标 + 车辆动画 + 硬件状态 -->

        <div class="panel-card panel-bottom">

          <BottomWorkflowPanel
            :booking-active="workflow.bookingActive"
            :distance="workflow.distance"
            @workflow-click="onWorkflowClick"
          />

        </div>

      </section>



      <!-- 右侧 -->

      <section class="panel-right">

        <!-- 实时视频 -->

        <div class="panel-card panel-video">

          <div class="panel-header">

            <img src="/assets/img/live_video.png" class="panel-icon" alt="" />

            <span class="panel-title">实时视频</span>

            <button class="header-icon-btn" title="货物图片保存">

              <img src="/assets/img/good_save.png" alt="" />

            </button>

          </div>

          <div class="video-area">

            <span class="video-placeholder">实时视频</span>

          </div>

        </div>



        <!-- 图像采集 -->

        <div class="panel-card panel-capture">

          <div class="panel-header">

            <img src="/assets/img/image_capture.png" class="panel-icon" alt="" />

            <span class="panel-title">图像采集</span>

          </div>

          <div class="capture-grid">

            <button v-for="btn in captureButtons" :key="btn.key" class="capture-btn">

              {{ btn.label }}

            </button>

          </div>

        </div>



        <!-- 绿通信息 -->

        <div class="panel-card panel-form">

          <div class="form-header">

            <img src="/assets/img/lv_info.png" class="panel-icon" alt="" />

            <span class="panel-title">绿通信息</span>

            <button class="header-icon-btn" title="通行码">

              <img src="/assets/img/ze-scan.png" alt="" />

            </button>

          </div>



          <div class="form-body">

            <div class="form-row">

              <label>车牌号码：</label>

              <span class="field-value">{{ form.plate }}</span>

              <button class="icon-btn" title="号牌号码编辑">

                <img src="/assets/img/a_chxz.png" alt="" />

              </button>

              <label class="col-right">挂车号码：</label>

              <span class="field-value">{{ form.plateGc }}</span>

              <button class="icon-btn" title="号牌号码编辑">

                <img src="/assets/img/a_chxz.png" alt="" />

              </button>

            </div>



            <div class="form-row">

              <label>司机电话：</label>

              <input v-model="form.phone" class="field-input" placeholder="请输入11位手机号" />

              <span class="col-gap" />

              <label class="col-right">货车类型：</label>

              <select v-model="form.truckType" class="field-input">

                <option value="">请选择</option>

              </select>

            </div>



            <div class="form-row">

              <label>货物类型：</label>

              <input v-model="form.goods" class="field-input" placeholder="请选择农产品类型" readonly />

              <button class="icon-btn" title="货物类型选择">

                <img src="/assets/img/a_search.png" alt="" />

              </button>

              <label class="col-right">货箱类型：</label>

              <select v-model="form.containerType" class="field-input">

                <option value="">请选择</option>

                <option value="厢式">厢式</option>

                <option value="栏板">栏板</option>

                <option value="罐式">罐式</option>

              </select>

            </div>



            <div class="form-row">

              <label>满载率约(%)：</label>

              <input v-model="form.loadRate" class="field-input" placeholder="请输入满载率，区间0-100" />

              <span class="col-gap" />

              <label class="col-right">轮廓尺寸：</label>

              <input v-model="form.size" class="field-input" placeholder="请输入外轮廓长宽高" readonly />

              <button class="icon-btn" title="货物类型选择">

                <img src="/assets/img/a_search.png" alt="" />

              </button>

            </div>



            <div class="form-row">

              <label>出口称重(kg)：</label>

              <input v-model="form.weight" class="field-input" placeholder="出口称重（kg）" />

              <span class="col-gap" />

              <label class="col-right">查验次数：</label>

              <span class="field-value">{{ form.historyCount }}</span>

            </div>

          </div>



          <div class="form-footer">

            <button class="btn-reset">重置</button>

            <button class="btn-confirm" @click="simulateBooking">确认</button>

          </div>

        </div>

      </section>

    </div>



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

  overflow: hidden;

  min-height: 0;

}



.panel-left {

  flex: 1168;

  display: flex;

  flex-direction: column;

  min-width: 0;

  overflow: hidden;

}



.panel-right {
  flex: 728;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}



.panel-card {

  background: #fff;

  border: 2px solid $border-color;

  border-radius: $card-radius;

  margin: 1px;

  display: flex;

  flex-direction: column;

  overflow: hidden;

}



.panel-stretch {

  flex: 2;

  min-height: 0;

}



.panel-bottom {

  flex: 0 0 200px;

  max-height: 200px;

  min-height: 150px;

  display: flex;

  flex-direction: column;

  overflow: hidden;

}



.panel-video {

  flex: 6;

  min-height: 0;

}



.panel-capture {

  flex: 5;

  min-height: 0;

}



.panel-form {

  flex: 5;

  min-height: 0;

}



.panel-header,

.form-header {

  display: flex;

  align-items: center;

  gap: 8px;

  padding: 8px 12px 8px 40px;

  flex-shrink: 0;

}



.panel-header-xray {
  flex-wrap: nowrap;
  gap: 6px;

  .panel-title {
    margin-right: 0;
  }
}

.panel-header-wrap {

  flex-wrap: wrap;

  row-gap: 4px;

}



.panel-icon {

  width: 24px;

  height: 24px;

  object-fit: contain;

}



.panel-title {

  font-size: 14px;

  font-weight: bold;

  color: $text-dark;

}



.panel-header-body {
  .panel-title {
    margin-right: 0;
  }
}

.panel-header .panel-title,
.form-header .panel-title {
  margin-right: auto;
}

.header-spacer {
  flex: 0 0 40px;
  width: 40px;
  margin-left: auto;
}

.header-icon-swap img {
  width: 16px;
  height: 16px;
}



.header-icon-btn {

  background: transparent;

  border: none;

  padding: 2px;

  display: flex;

  align-items: center;

  img {

    width: 24px;

    height: 24px;

  }

  &:disabled {

    opacity: 0.4;

    cursor: not-allowed;

  }

}



.xray-meta {

  font-size: 12px;

  color: $text-gray;

}



.xray-label {

  font-size: 12px;

  color: $text-gray;

}



.xray-spin {
  width: 56px;
  height: 24px;
  border: 1px solid #c5d5f8;
  border-radius: 3px;
  padding: 0 6px;
  font-size: 12px;
  text-align: center;
  background: #fff;
  outline: none;

  &.is-active {
    background: #dbeafe;
    border-color: #93b4f5;
  }

  &:focus {
    background: #dbeafe;
    border-color: #60a5fa;
  }
}

.xray-input {

  width: 56px;

  height: 24px;

  border: 1px solid #ddd;

  border-radius: 3px;

  padding: 0 4px;

  font-size: 12px;

  text-align: center;

}



.xray-input-int {

  width: 48px;

}



.action-btn {

  border: 2px solid $btn-preview-bg;

  border-radius: 10px;

  background: $btn-preview-bg;

  color: $btn-preview-text;

  padding: 2px 10px;

  font-size: 12px;

  font-weight: bold;

  cursor: pointer;

}



.video-area {

  flex: 1;

  min-height: 200px;

  background: #fff;

  border-bottom: 2px solid $border-color;

  border-radius: 0 0 12px 12px;

  display: flex;

  align-items: center;

  justify-content: center;

}



.video-placeholder {

  font-size: 28px;

  color: $text-placeholder;

}



.capture-grid {

  display: grid;

  grid-template-columns: repeat(3, 200px);

  gap: 9px;

  padding: 12px 9px;

  justify-content: center;

}



.capture-btn {

  width: 200px;

  height: 110px;

  border: 2px dashed #999;

  border-radius: 0;

  background: #fff;

  font-size: 14px;

  color: #999;

  cursor: pointer;

  transition: color 0.15s, border-color 0.15s;

  &:hover {

    color: #666;

    border-color: #666;

  }

}



.form-header {

  padding-left: 20px;

}



.form-body {

  flex: 1;

  overflow-y: auto;

  padding: 0 20px;

  display: flex;

  flex-direction: column;

  gap: 9px;

}



.form-row {

  display: grid;

  grid-template-columns: 100px 200px 24px 100px 200px 24px;

  align-items: center;

  gap: 4px 8px;

  font-size: 13px;



  label {

    color: #444;

    text-align: right;

    white-space: nowrap;

  }



  .col-right {

    grid-column: 4;

  }



  .col-gap {

    grid-column: 3;

  }

}



.field-input {

  width: 100%;

  height: 30px;

  border: none;

  border-bottom: 2px solid #e5e7eb;

  padding: 2px 8px;

  font-size: 14px;

  background: transparent;

  outline: none;

  &:focus {

    border-bottom-color: $accept-green;

    background: #f0fdf4;

  }

}



.field-value {

  font-size: 14px;

  color: $text-gray;

  padding: 2px 8px;

}



.icon-btn {

  background: transparent;

  border: none;

  padding: 0;

  display: flex;

  align-items: center;

  justify-content: center;

  img {

    width: 20px;

    height: 20px;

  }

}



.form-footer {

  display: grid;

  grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr;

  gap: 8px;

  padding: 12px 20px 16px;

  flex-shrink: 0;

}



.btn-reset {

  grid-column: 2;

  justify-self: start;

  min-width: 100px;

  height: 32px;

  border: none;

  border-radius: 4px;

  background: $reject-red;

  color: #ddd;

  font-size: 14px;

  font-weight: bold;

  cursor: pointer;

}



.btn-confirm {

  grid-column: 5;

  justify-self: end;

  min-width: 100px;

  height: 32px;

  border: none;

  border-radius: 4px;

  background: $accept-green;

  color: #ddd;

  font-size: 14px;

  font-weight: bold;

  cursor: pointer;

  &:hover {

    background: #047857;

  }

}

</style>

