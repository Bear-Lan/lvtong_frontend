<script setup lang="ts">
/**
 * 查验记录详情弹窗 — 1:1 对齐 Qt DetailDialog.ui / DetailDialog.cpp
 * 尺寸 1340×960，由历史记录「查看详情 / 双击」打开
 */
import { computed, onMounted, ref, watch } from 'vue'
import AgriculturalSelect from '@/components/AgriculturalSelect.vue'
import LicensePlateEdit from '@/components/LicensePlateEdit.vue'
import QtMessageBox from '@/components/common/QtMessageBox.vue'
import {
  fetchContainerTypes,
  fetchInspectionDetail,
  fetchInspectorUsers,
  fetchNoPassTypes,
  fetchStationName,
  fetchTruckTypes,
  updateInspectionDetail,
} from './api'
import type { DictOption, InspectionDetail, NoPassOption, UserOption } from './types'
import {
  goodsBorderClass,
  GROUP_OPTIONS,
  IMAGE_PLACEHOLDER,
  loadRateTextClass,
  plateColorStyle,
  RESULT_OPTIONS,
} from './utils/detailDisplay'
import {
  formatVehicleSizeDisplay,
  getMediaTypeStr,
  getTransPayTypeStr,
  getVehicleSignStr,
  isBrowsableImageUrl,
  parseVehicleSizeToMm,
  splitImagePaths,
} from './utils/passCodeDisplay'

const props = defineProps<{
  inspectionId: number
}>()

const emit = defineEmits<{
  close: []
  modified: []
}>()

const loading = ref(true)
const saving = ref(false)
const tipVisible = ref(false)
const tipMessage = ref('')
const tipOk = ref(true)

const record = ref<InspectionDetail | null>(null)
const enStationName = ref('')
const exStationName = ref('')

const truckTypes = ref<DictOption[]>([])
const containerTypes = ref<DictOption[]>([])
const noPassTypes = ref<NoPassOption[]>([])
const users = ref<UserOption[]>([])

// 可编辑表单
const truckType = ref('')
const containerType = ref('')
const goodsName = ref('')
const goodsTypeCode = ref('')
const plateNumber = ref('')
const plateColor = ref('')
const vehicleSizeDisplay = ref('')
const loadRate = ref('')
const driverPhone = ref('')
const remark = ref('')
const inspectorPhone = ref('')
const reviewerPhone = ref('')
const groupId = ref(0)
const resultStatus = ref(1)
const noPassType = ref(0)

const showCarSize = ref(false)
const carLen = ref('')
const carWidth = ref('')
const carHeight = ref('')

const agriculturalRef = ref<InstanceType<typeof AgriculturalSelect> | null>(null)
const plateRef = ref<InstanceType<typeof LicensePlateEdit> | null>(null)
const goodsSelection = ref<{ productCode: string; varietyName: string; varietyNamePinYin: string }[]>([])

const showNoPass = computed(() => resultStatus.value === 2)

const plateStyle = computed(() => {
  const s = plateColorStyle(plateColor.value)
  // 原 Qt 界面车牌默认醒目黄底
  if (s) return s
  if (plateNumber.value) return { backgroundColor: '#ffc000', color: '#2c3e50' }
  return null
})

const loadRateClass = computed(() => loadRateTextClass(loadRate.value))

const topPhotos = computed(() => [
  { key: 'head', label: '车头', path: record.value?.head_image_path },
  { key: 'tail', label: '车尾', path: record.value?.tail_image_path },
  { key: 'top', label: '车顶', path: record.value?.top_image_path },
  { key: 'license', label: '行驶证', path: record.value?.license_image_path },
])

/** 证据照格 — 对齐 gridLayout_evidences，空时 1 格占位 */
const evidenceSlots = computed(() => {
  const list = splitImagePaths(record.value?.evidences_image_path)
  if (!list.length) return ['']
  if (list.length <= 4) return list
  return list.slice(0, 8)
})

const evidenceGridStyle = computed(() => {
  const n = evidenceSlots.value.length
  if (n <= 1) return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }
  if (n <= 4) return { gridTemplateColumns: `repeat(${n}, 1fr)`, gridTemplateRows: '1fr' }
  if (n <= 6) return { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' }
  return { gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' }
})

/** 货物照 — 空时固定 3 列竖条（蓝/绿/蓝），对齐目标图 */
const goodsSlots = computed(() => {
  const list = splitImagePaths(record.value?.goods_image_path)
  if (!list.length) return ['', '', '']
  if (list.length < 3) {
    return [...list, ...Array(3 - list.length).fill('')]
  }
  return list
})

const goodsGridStyle = computed(() => {
  const n = goodsSlots.value.length
  if (n <= 3) return { gridTemplateColumns: `repeat(${n}, 1fr)`, gridTemplateRows: '1fr' }
  if (n <= 5) return { gridTemplateColumns: `repeat(${Math.min(n, 3)}, 1fr)`, gridTemplateRows: 'repeat(2, 1fr)' }
  return { gridTemplateColumns: 'repeat(5, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' }
})

const transparentSrc = computed(() => {
  const raw = record.value?.transparent_image_path
  if (isBrowsableImageUrl(raw)) return raw!
  return IMAGE_PLACEHOLDER.transparent
})

const bodySrc = computed(() => {
  const raw = record.value?.body_image_path
  if (isBrowsableImageUrl(raw)) return raw!
  return IMAGE_PLACEHOLDER.body
})

const passCodeSrc = computed(() => {
  const raw = record.value?.pass_code_image_path
  if (isBrowsableImageUrl(raw)) return raw!
  return ''
})

function imgSrc(path?: string | null, fallback = IMAGE_PLACEHOLDER.default) {
  if (isBrowsableImageUrl(path)) return path!
  return fallback
}

function userLabel(u: UserOption) {
  const phone = u.phone || u.username
  return `${u.real_name || u.username}-${phone}`
}

function applyRecord(data: InspectionDetail) {
  record.value = data
  truckType.value = data.vehicle_type || ''
  containerType.value = data.vehicle_container_type || ''
  goodsName.value = data.goods_name || data.cvarietyname || ''
  goodsTypeCode.value = data.goods_type || ''
  plateNumber.value = data.plate_number || ''
  plateColor.value = data.pass_code_vehicle_color_name || (data.plate_number ? '1' : '')
  vehicleSizeDisplay.value = formatVehicleSizeDisplay(data.vehicle_size)
  loadRate.value = data.load_rate != null ? String(data.load_rate) : ''
  driverPhone.value = data.driver_phone || ''
  remark.value = data.history_record || ''
  inspectorPhone.value = data.inspector_phone || ''
  reviewerPhone.value = data.reviewer_phone || ''
  groupId.value = data.group_id ?? 0
  resultStatus.value = data.result_status === 2 ? 2 : 1
  noPassType.value = data.no_pass_type ?? 0
}

async function loadDetail() {
  loading.value = true
  try {
    const res = await fetchInspectionDetail(props.inspectionId)
    if (res.code !== 0 || !res.data) {
      tipOk.value = false
      tipMessage.value = res.message || '加载详情失败'
      tipVisible.value = true
      return
    }
    applyRecord(res.data)
    enStationName.value = await fetchStationName(res.data.pass_code_en_station_id)
    exStationName.value = await fetchStationName(res.data.pass_code_ex_station_id)
  } finally {
    loading.value = false
  }
}

async function loadDicts() {
  const [trucks, containers, nopass, userList] = await Promise.all([
    fetchTruckTypes(),
    fetchContainerTypes(),
    fetchNoPassTypes(),
    fetchInspectorUsers(),
  ])
  truckTypes.value = trucks
  containerTypes.value = containers
  noPassTypes.value = nopass
  users.value = userList
}

function onSelectGoods() {
  // 从已有货物字段还原选中池（详情打开时未必经过本弹窗确认）
  if (!goodsSelection.value.length && (goodsTypeCode.value || goodsName.value)) {
    const codes = goodsTypeCode.value.split('|').filter(Boolean)
    const names = goodsName.value.split('|').filter(Boolean)
    goodsSelection.value = codes.map((code, i) => ({
      productCode: code,
      varietyName: names[i] || '',
      varietyNamePinYin: '',
    }))
  }
  agriculturalRef.value?.show(goodsSelection.value)
}

function onGoodsConfirm(
  items: { productCode: string; varietyName: string; varietyNamePinYin: string }[],
) {
  goodsSelection.value = items
  if (items.length) {
    goodsName.value = items.map((i) => i.varietyName).join('|')
    goodsTypeCode.value = items.map((i) => i.productCode).join('|')
  }
}

function onSelectPlate() {
  plateRef.value?.show()
}

function onPlateConfirm(plate: string, color: string) {
  plateNumber.value = plate
  plateColor.value = color
}

function openCarSize() {
  const m = vehicleSizeDisplay.value.match(/长\s*([\d.]+)\s*m\s*\|\s*宽\s*([\d.]+)\s*m\s*\|\s*高\s*([\d.]+)\s*m/i)
  if (m) {
    carLen.value = m[1]
    carWidth.value = m[2]
    carHeight.value = m[3]
  } else {
    carLen.value = ''
    carWidth.value = ''
    carHeight.value = ''
  }
  showCarSize.value = true
}

function confirmCarSize() {
  if (carLen.value && carWidth.value && carHeight.value) {
    vehicleSizeDisplay.value = `长${carLen.value}m|宽${carWidth.value}m|高${carHeight.value}m`
  }
  showCarSize.value = false
}

function onReviewerChange() {
  const u = users.value.find((x) => (x.phone || x.username) === reviewerPhone.value)
  if (u && typeof (u as { usergroup?: number }).usergroup === 'number') {
    groupId.value = (u as { usergroup: number }).usergroup
  }
}

watch(resultStatus, (v) => {
  if (v === 1) remark.value = ''
})

async function onModify() {
  if (!record.value) return
  saving.value = true
  try {
    const truck = truckTypes.value.find((t) => t.type_code === truckType.value)
    const container = containerTypes.value.find((t) => t.type_code === containerType.value)
    const inspector = users.value.find((u) => (u.phone || u.username) === inspectorPhone.value)
    const reviewer = users.value.find((u) => (u.phone || u.username) === reviewerPhone.value)

    const payload = {
      vehicle_type: truckType.value,
      vehicle_name: truck?.type_name || record.value.vehicle_name,
      vehicle_container_type: containerType.value,
      vehicle_container_name: container?.type_name || record.value.vehicle_container_name,
      goods_type: goodsTypeCode.value,
      goods_name: goodsName.value,
      plate_number: plateNumber.value,
      pass_code_vehicle_color_name: plateColor.value,
      load_rate: loadRate.value ? Number(loadRate.value) : record.value.load_rate,
      driver_phone: driverPhone.value,
      vehicle_size: parseVehicleSizeToMm(vehicleSizeDisplay.value),
      operator_name: inspector?.real_name || record.value.operator_name,
      inspector_phone: inspectorPhone.value,
      reviewer_name: reviewer?.real_name || record.value.reviewer_name,
      reviewer_phone: reviewerPhone.value,
      group_id: groupId.value,
      result_status: resultStatus.value,
      no_pass_type: resultStatus.value === 2 ? noPassType.value : 0,
    }

    const res = await updateInspectionDetail(record.value.id, payload)
    if (res.code === 0) {
      tipOk.value = true
      tipMessage.value = '修改成功！'
      tipVisible.value = true
      emit('modified')
      await loadDetail()
    } else {
      tipOk.value = false
      tipMessage.value = res.message || '修改失败'
      tipVisible.value = true
    }
  } catch {
    tipOk.value = false
    tipMessage.value = '修改失败'
    tipVisible.value = true
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadDicts(), loadDetail()])
})
</script>

<template>
  <div class="detail-overlay" @click.self="emit('close')">
    <div class="detail-dialog" role="dialog" aria-modal="true" @click.stop>
      <div class="dialog-titlebar">
        <img class="title-logo" src="/assets/img/logo.png" alt="" />
        <span class="dialog-title">查验记录</span>
        <button type="button" class="dialog-close" title="关闭" @click="emit('close')">×</button>
      </div>

      <div v-if="loading" class="loading-box">加载中...</div>

      <div v-else-if="record" class="dialog-content">
        <!-- 详情照片：浅绿渐变 + 竖分割线，普通文本标题（无胶囊） -->
        <div class="photos-top">
          <div class="section-title">详情照片</div>
          <div class="photo-row-5">
            <div v-for="p in topPhotos" :key="p.key" class="photo-col">
              <div class="photo-caption">{{ p.label }}</div>
              <div class="photo-img-box">
                <img :src="imgSrc(p.path, IMAGE_PLACEHOLDER.default)" :alt="p.label" />
              </div>
            </div>
            <div class="photo-col">
              <div class="photo-caption">证据照</div>
              <div class="photo-img-box evidence-wrap">
                <div class="evidence-grid" :style="evidenceGridStyle">
                  <div
                    v-for="(path, idx) in evidenceSlots"
                    :key="idx"
                    class="thumb-cell"
                    :class="path ? goodsBorderClass(idx) : ''"
                  >
                    <img :src="imgSrc(path, IMAGE_PLACEHOLDER.default)" alt="证据照" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 透视/车身/货物：单一大边框 + 内部竖线分隔 -->
        <div class="photos-mid">
          <div class="mid-cell">
            <div class="section-title">透视图像</div>
            <div class="wide-photo">
              <img :src="transparentSrc" alt="透视图像" />
            </div>
          </div>
          <div class="mid-cell">
            <div class="section-title">车身图像</div>
            <div class="wide-photo">
              <img :src="bodySrc" alt="车身图像" />
            </div>
          </div>
          <div class="mid-cell">
            <div class="section-title">货物照片</div>
            <div class="goods-grid" :style="goodsGridStyle">
              <div
                v-for="(path, idx) in goodsSlots"
                :key="idx"
                class="thumb-cell"
                :class="goodsBorderClass(idx)"
              >
                <img :src="imgSrc(path, IMAGE_PLACEHOLDER.good)" alt="货物照片" />
              </div>
            </div>
          </div>
        </div>

        <!-- 信息表单：外层绿色边框 -->
        <div class="form-box">
          <div class="form-grid">
            <!-- 左列 -->
            <div class="form-col">
              <div class="field-row"><label>入口站名称</label><input readonly :value="enStationName" /></div>
              <div class="field-row"><label>出口站名称</label><input readonly :value="exStationName" /></div>
              <div class="field-row"><label>出口交易时间</label><input readonly :value="record.pass_code_ex_time || ''" /></div>
              <div class="field-row"><label>总交易金额(元)</label><input readonly :value="record.pass_code_fee || ''" /></div>
              <div class="field-row"><label>通行介质</label><input readonly :value="getMediaTypeStr(record.pass_code_media_type_id)" /></div>
              <div class="field-row"><label>通过省份个数</label><input readonly :value="record.pass_code_province_count || ''" /></div>
              <div class="field-row"><label>出口交易编号</label><input readonly :value="record.pass_code_transaction_id || ''" /></div>
              <div class="field-row"><label>通行标识ID</label><input readonly :value="record.pass_code_pass_id || ''" /></div>
              <div class="field-row passcode-row">
                <label>通行码</label>
                <div class="passcode-box">
                  <img v-if="passCodeSrc" :src="passCodeSrc" alt="通行码" />
                  <span v-else>通行码</span>
                </div>
              </div>
            </div>

            <!-- 中列 -->
            <div class="form-col">
              <div class="field-row">
                <label>货车类型</label>
                <select v-model="truckType" class="uline-select">
                  <option v-for="t in truckTypes" :key="t.type_code" :value="t.type_code">{{ t.type_name }}</option>
                </select>
              </div>
              <div class="field-row">
                <label>货箱类型</label>
                <select v-model="containerType" class="uline-select">
                  <option v-for="t in containerTypes" :key="t.type_code" :value="t.type_code">{{ t.type_name }}</option>
                </select>
              </div>
              <div class="field-row">
                <label>货物名称</label>
                <input v-model="goodsName" readonly class="with-btn" />
                <button type="button" class="icon-btn" title="货物类型选择" @click="onSelectGoods">
                  <img src="/assets/img/a_search.png" alt="" />
                </button>
              </div>
              <div class="field-row"><label>入口称重(KG)</label><input readonly :value="record.pass_code_en_weight || ''" /></div>
              <div class="field-row"><label>出口称重(KG)</label><input readonly :value="record.pass_code_ex_weight || ''" /></div>
              <div class="field-row"><label>应收金额(元)</label><input readonly :value="record.pass_code_pay_fee || ''" /></div>
              <div class="field-row"><label>交易支付方式</label><input readonly :value="getTransPayTypeStr(record.pass_code_trans_pay_type)" /></div>
              <div class="field-row"><label>车辆状态标识</label><input readonly :value="getVehicleSignStr(record.pass_code_vehicle_sign)" /></div>
              <div class="field-row"><label>备注内容</label><input v-model="remark" /></div>
            </div>

            <!-- 右列 -->
            <div class="form-col">
              <div class="field-row">
                <label>车牌号码</label>
                <input
                  v-model="plateNumber"
                  readonly
                  class="with-btn plate-input"
                  :style="plateStyle || undefined"
                  :title="plateColor ? `车牌颜色：${plateColor}` : ''"
                />
                <button type="button" class="icon-btn" title="车牌选择" @click="onSelectPlate">
                  <img src="/assets/img/a_chxz.png" alt="" />
                </button>
              </div>
              <div class="field-row">
                <label>长宽高</label>
                <input v-model="vehicleSizeDisplay" readonly class="with-btn" />
                <button type="button" class="icon-btn" title="设置长宽高" @click="openCarSize">
                  <img src="/assets/img/a_chxz.png" alt="" />
                </button>
              </div>
              <div class="field-row field-row-loadrate">
                <label class="label-with-icon">
                  <img src="/assets/img/a_search.png" class="label-icon" alt="" />
                  满载率(%)
                </label>
                <input
                  v-model="loadRate"
                  class="load-rate-input"
                  :class="loadRateClass"
                  placeholder="请输入满载率，区间0-100"
                />
              </div>
              <div class="field-row">
                <label>司机电话</label>
                <input v-model="driverPhone" maxlength="11" placeholder="请输入11位手机号" />
              </div>
              <div class="field-row"><label>查验依据</label><input readonly value="" /></div>
              <div class="field-row">
                <label>查验</label>
                <select v-model="inspectorPhone" class="uline-select">
                  <option value="">请选择</option>
                  <option v-for="u in users" :key="u.username" :value="u.phone || u.username">
                    {{ userLabel(u) }}
                  </option>
                </select>
              </div>
              <div class="field-row">
                <label>复核</label>
                <select v-model="reviewerPhone" class="uline-select" @change="onReviewerChange">
                  <option value="">请选择</option>
                  <option v-for="u in users" :key="`r-${u.username}`" :value="u.phone || u.username">
                    {{ userLabel(u) }}
                  </option>
                </select>
              </div>
              <div class="field-row field-row-group">
                <label>班组</label>
                <select v-model.number="groupId" class="uline-select" disabled>
                  <option v-for="g in GROUP_OPTIONS" :key="g.value" :value="g.value">{{ g.label }}</option>
                </select>
              </div>
              <div class="field-row result-row">
                <label class="tag-blue">查验结果</label>
                <select v-model.number="resultStatus" class="uline-select result-select">
                  <option v-for="r in RESULT_OPTIONS" :key="r.value" :value="r.value">{{ r.label }}</option>
                </select>
              </div>
              <div v-if="showNoPass" class="field-row result-row">
                <label class="tag-red">不合格类型</label>
                <select v-model="noPassType" class="uline-select">
                  <option v-for="n in noPassTypes" :key="n.code" :value="Number(n.code)">
                    {{ n.code }}:{{ n.value }}
                  </option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div class="footer-actions">
          <button type="button" class="btn-modify" :disabled="saving" @click="onModify">修改</button>
          <button type="button" class="btn-close" @click="emit('close')">关闭</button>
        </div>
      </div>
    </div>

    <AgriculturalSelect ref="agriculturalRef" @confirm="onGoodsConfirm" />
    <LicensePlateEdit
      ref="plateRef"
      :current-plate="plateNumber"
      :current-color="plateColor"
      title="车牌修改"
      @confirm="onPlateConfirm"
    />

    <div v-if="showCarSize" class="car-size-panel" @click.self="showCarSize = false">
      <div class="car-size-box">
        <h4>设置长宽高 (m)</h4>
        <label>长 <input v-model="carLen" type="number" step="0.01" /></label>
        <label>宽 <input v-model="carWidth" type="number" step="0.01" /></label>
        <label>高 <input v-model="carHeight" type="number" step="0.01" /></label>
        <div class="car-size-actions">
          <button type="button" @click="showCarSize = false">取消</button>
          <button type="button" class="ok" @click="confirmCarSize">确定</button>
        </div>
      </div>
    </div>

    <QtMessageBox
      v-if="tipVisible"
      title="系统提醒"
      :message="tipMessage"
      :icon="tipOk ? 'info' : 'warning'"
      :buttons="['yes']"
      @yes="tipVisible = false"
      @close="tipVisible = false"
    />
  </div>
</template>
<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 1600;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-dialog {
  width: 1340px;
  height: 960px;
  max-width: 98vw;
  max-height: 98vh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 4px 6px 6px;
  /* 对齐原 Qt：上半区绿→浅绿→白，下半区近白 */
  background: linear-gradient(
    180deg,
    #5fbb9e 0%,
    #8fd0b8 10%,
    #f0f9f5 32%,
    #f7fcfa 52%,
    #ffffff 78%
  );
  border: 1px solid $primary;
  font-family: 'Microsoft YaHei', 'Segoe UI', sans-serif;
  overflow: hidden;
}

.dialog-titlebar {
  flex: 0 0 28px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 2px;
  background: transparent;
  border-bottom: none;
}

.title-logo {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.dialog-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: #1a1a1a;
}

.dialog-close {
  width: 28px;
  height: 22px;
  border: none;
  background: transparent;
  font-size: 16px;
  line-height: 1;
  color: #333;
  cursor: pointer;

  &:hover {
    background: #e81123;
    color: #fff;
  }
}

.loading-box {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
}

.dialog-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 4px;
}

.section-title {
  font-size: 12px;
  font-weight: bold;
  color: #2c3e50;
  padding: 2px 6px 4px;
}

.photos-top {
  flex: 0 0 auto;
  border: 1px solid rgba(155, 184, 168, 0.55);
  /* 半透明，让整窗绿白渐变透上来 */
  background: rgba(255, 255, 255, 0.28);
  padding: 2px 4px 6px;
}

.photo-row-5 {
  display: flex;
  align-items: stretch;
}

.photo-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #c0c8c4;

  &:last-child {
    border-right: none;
  }
}

.photo-caption {
  text-align: center;
  font-size: 12px;
  font-weight: bold;
  color: #2c3e50;
  padding: 2px 0;
}

.photo-img-box {
  flex: 1;
  min-height: 160px;
  height: 170px;
  margin: 0 6px 4px;
  background: #fff;
  border: 1px solid #d0d0d0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
}

.evidence-wrap {
  padding: 2px;
}

.evidence-grid {
  width: 100%;
  height: 100%;
  display: grid;
  gap: 2px;
}

.photos-mid {
  flex: 0 0 auto;
  display: flex;
  border: 1px solid rgba(155, 184, 168, 0.55);
  background: rgba(255, 255, 255, 0.35);
  min-height: 188px;
}

.mid-cell {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #c0c8c4;
  padding: 2px 6px 6px;

  &:last-child {
    border-right: none;
  }
}

.wide-photo {
  flex: 1;
  min-height: 148px;
  background: #fff;
  border: 1px solid #d0d0d0;
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
}

.goods-grid {
  flex: 1;
  min-height: 148px;
  display: grid;
  gap: 4px;
  padding: 2px;
  background: #fff;
  border: 1px solid #d0d0d0;
}

.thumb-cell {
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  background: #fff;

  &.border-blue {
    border: 2px solid #1e6fff;
  }

  &.border-green {
    border: 2px solid #2e8b57;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

.form-box {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 2px solid #29734b;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.96);
  /* 对齐 Qt QGroupBox padding: 15px */
  padding: 16px 18px 14px;
  margin-top: 4px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  /* 对齐 Qt grid spacing: 8px 纵向，列间距拉开 */
  column-gap: 28px;
  row-gap: 0;
  height: 100%;
  align-content: space-evenly;
}

.form-col {
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  gap: 0;
  min-height: 100%;
}

.field-row {
  display: grid;
  grid-template-columns: 108px 1fr auto;
  align-items: center;
  column-gap: 10px;
  /* 行高拉开，避免挤在一起 */
  min-height: 34px;
  padding: 4px 6px 6px;

  label {
    font-size: 12px;
    font-weight: bold;
    color: #2c3e50;
    text-align: left;
    white-space: nowrap;
    padding: 4px 2px;
  }

  input,
  select.uline-select {
    width: 100%;
    height: 28px;
    border: none;
    border-bottom: 1px solid #d5d8dc;
    border-radius: 0;
    background: transparent;
    font-size: 12px;
    color: #2c3e50;
    padding: 4px 8px;
    min-width: 0;
    box-sizing: border-box;

    &:focus {
      outline: none;
      border-bottom-color: #29734b;
      background: #f8fff9;
    }
  }

  select.uline-select {
    appearance: none;
    -webkit-appearance: none;
    background-image: url('/assets/img/drop-down-arrow.png');
    background-repeat: no-repeat;
    background-position: right 4px center;
    background-size: 10px 10px;
    padding-right: 18px;
    cursor: pointer;
  }

  select.uline-select:disabled {
    color: #555;
    cursor: not-allowed;
    opacity: 1;
  }
}

.with-btn {
  grid-column: 2;
}

.label-with-icon {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.label-icon {
  width: 14px;
  height: 14px;
  object-fit: contain;
}

.icon-btn {
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;

  img {
    width: 18px;
    height: 18px;
    object-fit: contain;
  }
}

.plate-input {
  font-weight: bold;
}

.load-rate-input.load-rate-ok {
  color: #27ae60;
  font-weight: bold;
}

.load-rate-input.load-rate-low {
  color: #c0392b;
  font-weight: bold;
}

/* 班组行浅灰底 — 对齐截图 */
.field-row-group {
  background: #f2f2f2;
  border-radius: 2px;
}

.passcode-row {
  grid-template-columns: 108px auto;
  align-items: center;
}

.passcode-box {
  width: 48px;
  height: 48px;
  border: 1px dashed #999;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #999;
  background: #fff;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

.tag-blue,
.tag-red {
  font-weight: bold;
  padding: 5px 10px;
  border-radius: 5px;
  color: #fff !important;
  text-align: center;
}

.tag-blue {
  background: #0000ff;
}

.tag-red {
  background: #e74c3c;
}

.result-select {
  font-weight: bold;
  color: #2c3e50;
}

.footer-actions {
  flex: 0 0 auto;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 6px 8px 2px;
}

.btn-modify,
.btn-close {
  width: 100px;
  height: 32px;
  border: 1px solid transparent;
  border-radius: 2px;
  font-size: 13px;
  font-weight: bold;
  font-family: 'Microsoft YaHei', sans-serif;
  color: #fff;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: wait;
  }
}

.btn-modify {
  background: #059669;
  border-color: #047857;
}

.btn-close {
  background: #ef4444;
  border-color: #dc2626;
}

.car-size-panel {
  position: fixed;
  inset: 0;
  z-index: 1700;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.car-size-box {
  background: #fff;
  padding: 16px 20px;
  border: 1px solid #aaa;
  border-radius: 2px;
  min-width: 280px;

  h4 {
    margin: 0 0 12px;
    font-size: 14px;
  }

  label {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 13px;
  }

  input {
    flex: 1;
    height: 28px;
    border: 1px solid #ccc;
    padding: 0 8px;
  }
}

.car-size-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;

  button {
    min-width: 64px;
    height: 28px;
    border: 1px solid #adadad;
    border-radius: 2px;
    background: #f0f0f0;
    cursor: pointer;
  }

  .ok {
    background: #059669;
    color: #fff;
    border-color: #047857;
  }
}
</style>
