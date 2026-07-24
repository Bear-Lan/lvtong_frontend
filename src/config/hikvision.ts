/**
 * 海康预览前端常量（不含设备凭证）
 * 设备 IP/账号/密码由 GET /api/device/<id>/preview-config 从 devices 表读取。
 *
 * 现场约定：
 * - camera1（devices.id=20，IP …104）：球机（带云台）
 * - camera2（devices.id=21，IP …101）：普通枪机（车顶/车头/车尾/预约共用）
 */

/** 与官方包实际落盘路径一致（整包放在 public/hikvision/codebase 下） */
export const HIK_SDK_PATHS = {
  /** iframe 内嵌官方同款播放页（推荐，避开 Vue 冲突） */
  playerPage: '/hikvision/player.html',
  jquery: '/hikvision/codebase/demo/jquery-1.7.1.min.js',
  webVideoCtrl: '/hikvision/codebase/demo/codebase/webVideoCtrl.js',
  basePath: '/hikvision/codebase/demo/codebase/',
  pluginInstaller: '/hikvision/codebase/demo/codebase/HCWebSDKPlugin.exe',
} as const

/** Tab 显示名 → devices.device_id */
export const CAMERA_DEVICE_ID: Record<string, string> = {
  车顶相机: 'camera2',
  车头相机: 'camera2',
  车尾相机: 'camera2',
  预约相机: 'camera2',
  球机: 'camera1',
}

/** 打开弹窗默认枪机 Tab 对应的 device_id */
export const DEFAULT_GUN_DEVICE_ID = 'camera2'

/** 已接入的相机 Tab */
export const HIK_ENABLED_CAMERAS = [
  '车顶相机',
  '车头相机',
  '车尾相机',
  '球机',
  '预约相机',
] as const
export const HIK_DISABLED_CAMERAS = [] as const

export type HikEnabledCamera = (typeof HIK_ENABLED_CAMERAS)[number]

export function resolveCameraDeviceId(cameraName: string): string {
  return CAMERA_DEVICE_ID[cameraName] || DEFAULT_GUN_DEVICE_ID
}
