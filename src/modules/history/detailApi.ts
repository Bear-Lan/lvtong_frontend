import { request } from '@/api/request'
import type {
  DictOption,
  InspectionDetail,
  InspectionUpdatePayload,
  StaffOption,
} from './detailTypes'

/** GET /api/inspection/:id */
export async function fetchInspectionDetail(id: number) {
  return request<InspectionDetail>(`/inspection/${id}`)
}

/** PUT /api/inspection/:id — 对齐 DetailDialog::onModifyDetail */
export async function updateInspectionDetail(id: number, payload: InspectionUpdatePayload) {
  return request(`/inspection/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function fetchTruckTypes(): Promise<DictOption[]> {
  const res = await request<{ type_code: string; type_name: string }[]>('/dict/truck-types')
  if (res.code !== 0 || !res.data) return []
  return res.data.map((t) => ({ code: t.type_code, name: t.type_name }))
}

export async function fetchContainerTypes(): Promise<DictOption[]> {
  const res = await request<{ type_code: string; type_name: string }[]>('/dict/container-types')
  if (res.code !== 0 || !res.data) return []
  return res.data.map((t) => ({ code: t.type_code, name: t.type_name }))
}

export async function fetchNoPassTypes(): Promise<DictOption[]> {
  const res = await request<{ code?: string; value?: string; type_code?: string; type_name?: string }[]>(
    '/dict/no-pass-types',
  )
  if (res.code !== 0 || !res.data) return []
  return res.data.map((t) => ({
    code: String(t.code ?? t.type_code ?? ''),
    name: String(t.value ?? t.type_name ?? ''),
  }))
}

/** 收费站名称 — GET /api/dict/stations/:id */
export async function fetchStationName(stationId?: string): Promise<string> {
  if (!stationId) return ''
  try {
    const res = await request<{ station_name?: string; stationName?: string }>(
      `/dict/stations/${encodeURIComponent(stationId)}`,
    )
    if (res.code === 0 && res.data) {
      return res.data.station_name || res.data.stationName || stationId
    }
  } catch {
    /* ignore */
  }
  return stationId
}

/** 查验/复核人员 — 对齐 getUsersByRole，暂用全量用户 */
export async function fetchStaffOptions(): Promise<StaffOption[]> {
  try {
    const res = await request<
      { username: string; real_name: string; phone?: string; role?: number; usergroup?: number }[]
    >('/user/query?username=all')
    if (res.code !== 0 || !Array.isArray(res.data)) return []
    return res.data
      .map((u) => {
        const realName = u.real_name || u.username || ''
        const phone = u.phone || ''
        return {
          label: phone ? `${realName}-${phone}` : realName,
          phone,
          realName,
          groupId: u.usergroup ?? 0,
        }
      })
      .filter((s) => s.realName)
  } catch {
    return []
  }
}
