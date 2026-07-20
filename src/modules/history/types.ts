/** 历史记录 — 对齐 Qt HistoryDialog / VehicleInspection */
export interface HistoryRecord {
  id: number
  plate_number: string
  driver_phone: string
  /** 车辆类型显示名 — Qt btypename */
  btypename?: string
  vehicle_name?: string
  goods_name?: string
  load_rate?: number
  operator_name?: string
  /** 1=合格，其它=不合格 — 对齐 Qt resultStatus */
  result_status?: number
  inspection_time?: string
}

export interface HistoryListResult {
  items: HistoryRecord[]
  total: number
  page: number
  page_size: number
}

export interface HistorySearchCriteria {
  plateNumber: string
  driverPhone: string
  operatorName: string
  startTime: string
  endTime: string
}
