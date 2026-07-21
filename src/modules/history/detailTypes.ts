/** 查验记录详情 — 对齐 Qt DetailDialog / VehicleInspection */

export interface InspectionDetail {
  id: number
  plate_number?: string
  plate_number_gc?: string
  driver_phone?: string
  vehicle_type?: string
  vehicle_name?: string
  vehicle_container_type?: string
  vehicle_container_name?: string
  goods_type?: string
  goods_name?: string
  goods_category?: string
  load_rate?: number
  load_weight?: number
  vehicle_size?: string
  body_image_path?: string
  transparent_image_path?: string
  head_image_path?: string
  tail_image_path?: string
  top_image_path?: string
  goods_image_path?: string
  evidences_image_path?: string
  license_image_path?: string
  license_image_path1?: string
  license_image_path2?: string
  pass_code_image_path?: string
  operator_name?: string
  inspector_phone?: string
  reviewer_name?: string
  reviewer_phone?: string
  group_id?: number
  result_status?: number
  no_pass_type?: number | string
  pass_code_vehicle_color_name?: string
  pass_code_en_station_id?: string
  pass_code_ex_station_id?: string
  pass_code_en_weight?: string
  pass_code_ex_weight?: string
  pass_code_media_type_id?: string
  pass_code_transaction_id?: string
  pass_code_pass_id?: string
  pass_code_ex_time?: string
  pass_code_trans_pay_type?: string
  pass_code_fee?: string
  pass_code_pay_fee?: string
  pass_code_vehicle_sign?: string
  pass_code_province_count?: string
  /** 站点名称（后端若已解析） */
  en_station_name?: string
  ex_station_name?: string
  btypename?: string
  cvarietyname?: string
  inspection_time?: string
  /** 备注 — Qt historyRecord，库表可能无此列 */
  history_record?: string
  remark?: string
}

export interface DictOption {
  code: string
  name: string
}

export interface StaffOption {
  label: string
  phone: string
  realName: string
  groupId?: number
}

export interface InspectionUpdatePayload {
  vehicle_type?: string
  vehicle_name?: string
  vehicle_container_type?: string
  vehicle_container_name?: string
  goods_type?: string
  goods_name?: string
  load_rate?: number
  vehicle_size?: string
  plate_number?: string
  driver_phone?: string
  result_status?: number
  no_pass_type?: number | string
  operator_name?: string
  inspector_phone?: string
  reviewer_name?: string
  reviewer_phone?: string
  group_id?: number
  pass_code_vehicle_color_name?: string
}
