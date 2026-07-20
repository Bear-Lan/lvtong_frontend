<script setup lang="ts">
/**
 * 农产品选择弹窗
 *
 * 对齐 Qt AgriculturalProductDialog:
 * - 支持按产品类型 / 品种名称 / 拼音搜索
 * - 分页展示
 * - 多选
 */
import { onMounted, ref, watch } from 'vue'
import { request } from '@/api/request'

interface Product {
  product_code: string
  variety_name: string
  variety_name_pinyin: string
  product_type: string
  category: string
}

const props = defineProps<{
  selected?: { productCode: string; varietyName: string; varietyNamePinYin: string }[]
}>()

const emit = defineEmits<{
  confirm: [items: { productCode: string; varietyName: string; varietyNamePinYin: string }[]]
  close: []
}>()

const visible = ref(false)
const products = ref<Product[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const searchText = ref('')
const checked = ref<Set<string>>(new Set())

async function fetchProducts() {
  const params = new URLSearchParams()
  if (searchText.value) {
    // 尝试拼音搜索
    params.set('pinyin', searchText.value)
  }
  params.set('page', String(page.value))
  params.set('page_size', String(pageSize))

  const res = await request<{ items: Product[]; total: number }>(
    `/dict/products?${params.toString()}`
  )
  if (res.code === 0 && res.data) {
    // 拼音无结果时尝试中文搜索
    if (res.data.items.length === 0 && searchText.value) {
      params.delete('pinyin')
      params.set('variety_name', searchText.value)
      const res2 = await request<{ items: Product[]; total: number }>(
        `/dict/products?${params.toString()}`
      )
      if (res2.code === 0 && res2.data) {
        products.value = res2.data.items
        total.value = res2.data.total
        return
      }
    }
    products.value = res.data.items
    total.value = res.data.total
  }
}

function show(prevSelection: { productCode: string; varietyName: string; varietyNamePinYin: string }[] = []) {
  visible.value = true
  page.value = 1
  searchText.value = ''
  checked.value = new Set(prevSelection.map(p => p.productCode))
  fetchProducts()
}

function toggleCheck(code: string) {
  if (checked.value.has(code)) {
    checked.value.delete(code)
  } else {
    checked.value.add(code)
  }
  checked.value = new Set(checked.value)
}

function confirmSelection() {
  const result: { productCode: string; varietyName: string; varietyNamePinYin: string }[] = []
  products.value.forEach(p => {
    if (checked.value.has(p.product_code)) {
      result.push({
        productCode: p.product_code,
        varietyName: p.variety_name,
        varietyNamePinYin: p.variety_name_pinyin,
      })
    }
  })
  emit('confirm', result)
  visible.value = false
}

function onSearch() {
  page.value = 1
  fetchProducts()
}

const totalPages = () => Math.ceil(total.value / pageSize)

defineExpose({ show })
</script>

<template>
  <div v-if="visible" class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <h3>农产品选择</h3>
      <div class="search-bar">
        <input v-model="searchText" placeholder="搜索品种名称/拼音" @keyup.enter="onSearch" />
        <button @click="onSearch">搜索</button>
      </div>

      <div class="product-list">
        <div v-for="p in products" :key="p.product_code" class="product-item"
             :class="{ checked: checked.has(p.product_code) }"
             @click="toggleCheck(p.product_code)">
          <input type="checkbox" :checked="checked.has(p.product_code)" />
          <span class="name">{{ p.variety_name }}</span>
          <span class="code">{{ p.product_code }}</span>
          <span class="type">{{ p.category }}</span>
        </div>
      </div>
      <div v-if="!products.length" class="empty">无匹配结果</div>

      <div class="pagination" v-if="total > pageSize">
        <button :disabled="page <= 1" @click="page--; fetchProducts()">上一页</button>
        <span>{{ page }} / {{ totalPages() }}</span>
        <button :disabled="page >= totalPages()" @click="page++; fetchProducts()">下一页</button>
        <span>共 {{ total }} 条</span>
      </div>

      <div class="actions">
        <span class="hint">已选 {{ checked.size }} 项</span>
        <button class="btn-cancel" @click="emit('close')">取消</button>
        <button class="btn-confirm" @click="confirmSelection">确定</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  width: 600px;
  max-width: 95vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;

  h3 { margin-bottom: 12px; font-size: 18px; }
}
.search-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;

  input {
    flex: 1;
    height: 32px;
    padding: 0 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    &:focus { border-color: #4096ff; outline: none; }
  }
  button {
    height: 32px;
    padding: 0 16px;
    border: none;
    border-radius: 4px;
    background: #1677ff;
    color: #fff;
    cursor: pointer;
  }
}
.product-list {
  flex: 1;
  overflow-y: auto;
  max-height: 400px;
}
.product-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  font-size: 14px;

  &:hover { background: #f5f5f5; }
  &.checked { background: #e6f4ff; }

  .name { flex: 1; font-weight: 500; }
  .code { color: #999; font-size: 12px; width: 80px; }
  .type { color: #bbb; font-size: 12px; width: 60px; text-align: right; }
}
.empty {
  text-align: center;
  padding: 40px;
  color: #999;
}
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 0;
  font-size: 13px;

  button {
    padding: 4px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }
}
.actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #eee;

  .hint { margin-right: auto; color: #999; font-size: 13px; }

  button {
    height: 32px;
    padding: 0 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
  }
  .btn-cancel { background: #f0f0f0; color: #333; }
  .btn-confirm { background: #1677ff; color: #fff; }
}
</style>
