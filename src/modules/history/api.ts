import { request } from '@/api/request'
import type { HistoryListResult, HistorySearchCriteria } from './types'

function buildParams(
  criteria: HistorySearchCriteria,
  page: number,
  pageSize: number,
): URLSearchParams {
  const params = new URLSearchParams()
  if (criteria.plateNumber) params.set('plate_number', criteria.plateNumber)
  if (criteria.driverPhone) params.set('driver_phone', criteria.driverPhone)
  if (criteria.operatorName) params.set('operator_name', criteria.operatorName)
  if (criteria.startTime) params.set('start_time', criteria.startTime)
  if (criteria.endTime) params.set('end_time', criteria.endTime)
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  return params
}

/** GET /api/history/list — 对齐 HistoryDialog::loadDataFromDatabase */
export async function fetchHistoryList(
  criteria: HistorySearchCriteria,
  page: number,
  pageSize: number,
) {
  const params = buildParams(criteria, page, pageSize)
  return request<HistoryListResult>(`/history/list?${params.toString()}`)
}

/** GET /api/history/export */
export async function exportHistoryCsv(criteria: HistorySearchCriteria) {
  const params = buildParams(criteria, 1, 10000)
  return request<{ csv: string; total: number }>(`/history/export?${params.toString()}`)
}

/** 操作员下拉 — 对齐 getDistinctOperators，暂用用户列表 */
export async function fetchOperators(): Promise<string[]> {
  try {
    const res = await request<{ username: string; real_name: string }[] | Record<string, unknown>>(
      '/user/query?username=all',
    )
    if (res.code !== 0 || !res.data) return []
    const list = Array.isArray(res.data) ? res.data : []
    const names = list
      .map((u) => (u as { real_name?: string }).real_name || (u as { username?: string }).username || '')
      .filter(Boolean)
    return [...new Set(names)]
  } catch {
    return []
  }
}
