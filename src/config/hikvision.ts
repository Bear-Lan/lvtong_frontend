/**
 * 海康预览前端常量（不含设备凭证）
 * 设备 IP/账号/密码由 GET /api/device/<id>/preview-config 从 devices 表读取。
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

/** 初版已接入的相机 Tab；球机暂不接入 */
export const HIK_ENABLED_CAMERAS = ['车顶相机', '车头相机', '车尾相机', '预约相机'] as const
export const HIK_DISABLED_CAMERAS = ['球机'] as const

export type HikEnabledCamera = (typeof HIK_ENABLED_CAMERAS)[number]
