<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { request } from '@/api/request'

interface InspectionRecord {
  id: number
  plate_number: string
  driver_phone: string
  vehicle_name: string
  vehicle_container_name: string
  goods_name: string
  operator_name: string
  inspection_time: string
  result_status: number
}

const loading = ref(false)
const items = ref<InspectionRecord[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20

const filters = ref({
  plate_number: '',
  driver_phone: '',
  vehicle_type: '',
  goods_type: '',
  operator_name: '',
  start_time: '',
  end_time: '',
})

async function fetchData() {
  loading.value = true
  try {
    const params = new URLSearchParams()
    Object.entries(filters.value).forEach(([k, v]) => {
      if (v) params.set(k, v)
    })
    params.set('page', String(page.value))
    params.set('page_size', String(pageSize))

    const res = await request<{ items: InspectionRecord[]; total: number }>(
      `/inspection/query?${params.toString()}`
    )
    if (res.code === 0 && res.data) {
      items.value = res.data.items
      total.value = res.data.total
    }
  } finally {
    loading.value = false
  }
}

function onSearch() {
  page.value = 1
  fetchData()
}

function onReset() {
  filters.value = {
    plate_number: '',
    driver_phone: '',
    vehicle_type: '',
    goods_type: '',
    operator_name: '',
    start_time: '',
    end_time: '',
  }
  page.value = 1
  fetchData()
}

function onPageChange(p: number) {
  page.value = p
  fetchData()
}

function goDetail(id: number) {
  window.open(`/detail/${id}`, '_blank')
}

async function exportCSV() {
  const params = new URLSearchParams()
  if (filters.value.plate_number) params.set('plate_number', filters.value.plate_number)
  const res = await request<{ csv: string }>(`/history/export?${params.toString()}`)
  if (res.code === 0 && res.data?.csv) {
    const blob = new Blob(['﻿' + res.data.csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `检测记录_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
}

const totalPages = () => Math.ceil(total.value / pageSize)

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="history-page">
    <h2>检测历史记录</h2>

    <!-- 筛选条件 -->
    <div class="filter-bar">
      <input v-model="filters.plate_number" placeholder="车牌号" @keyup.enter="onSearch" />
      <input v-model="filters.driver_phone" placeholder="司机电话" @keyup.enter="onSearch" />
      <input v-model="filters.operator_name" placeholder="操作员" @keyup.enter="onSearch" />
      <input v-model="filters.goods_type" placeholder="货物类型" @keyup.enter="onSearch" />
      <input v-model="filters.start_time" type="date" title="开始日期" />
      <input v-model="filters.end_time" type="date" title="结束日期" />
      <button class="btn-search" @click="onSearch">查询</button>
      <button class="btn-reset" @click="onReset">重置</button>
      <button class="btn-export" @click="exportCSV">导出CSV</button>
    </div>

    <!-- 表格 -->
    <table class="data-table" v-if="items.length">
      <thead>
        <tr>
          <th>ID</th>
          <th>车牌号</th>
          <th>司机电话</th>
          <th>货车类型</th>
          <th>货箱类型</th>
          <th>货物</th>
          <th>操作员</th>
          <th>检测时间</th>
          <th>结果</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in items" :key="row.id">
          <td>{{ row.id }}</td>
          <td>{{ row.plate_number }}</td>
          <td>{{ row.driver_phone }}</td>
          <td>{{ row.vehicle_name }}</td>
          <td>{{ row.vehicle_container_name }}</td>
          <td>{{ row.goods_name?.slice(0, 20) }}{{ row.goods_name?.length > 20 ? '...' : '' }}</td>
          <td>{{ row.operator_name }}</td>
          <td>{{ row.inspection_time?.slice(0, 19) }}</td>
          <td :class="row.result_status === 0 ? 'text-green' : 'text-red'">
            {{ row.result_status === 0 ? '正常' : '异常' }}
          </td>
          <td>
            <button class="btn-detail" @click="goDetail(row.id)">详情</button>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else-if="!loading" class="empty">暂无记录</div>

    <!-- 分页 -->
    <div class="pagination" v-if="total > pageSize">
      <button :disabled="page <= 1" @click="onPageChange(page - 1)">上一页</button>
      <span>{{ page }} / {{ totalPages() }}</span>
      <button :disabled="page >= totalPages()" @click="onPageChange(page + 1)">下一页</button>
      <span class="total-count">共 {{ total }} 条</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.history-page {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;

  h2 {
    margin-bottom: 16px;
    font-size: 20px;
  }
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;

  input {
    height: 32px;
    padding: 0 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 13px;
    min-width: 120px;

    &:focus {
      border-color: #4096ff;
      outline: none;
    }
  }

  button {
    height: 32px;
    padding: 0 16px;
    border: none;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
  }

  .btn-search {
    background: #1677ff;
    color: #fff;
  }
  .btn-reset {
    background: #f0f0f0;
    color: #333;
  }
  .btn-export {
    background: #52c41a;
    color: #fff;
  }
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th, td {
    padding: 8px 10px;
    border-bottom: 1px solid #eee;
    text-align: left;
  }

  th {
    background: #fafafa;
    font-weight: 600;
    white-space: nowrap;
  }

  tr:hover { background: #f5f5f5; }
}

.btn-detail {
  padding: 2px 8px;
  border: 1px solid #1677ff;
  border-radius: 3px;
  background: transparent;
  color: #1677ff;
  cursor: pointer;
  font-size: 12px;
}

.text-green { color: #52c41a; font-weight: 600; }
.text-red { color: #ff4d4f; font-weight: 600; }

.empty {
  text-align: center;
  padding: 60px;
  color: #999;
  font-size: 16px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 20px;

  button {
    padding: 4px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .total-count {
    color: #999;
    font-size: 13px;
  }
}
</style>
