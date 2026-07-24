import { onMounted, onUnmounted, ref, shallowRef, type Ref } from 'vue'
import { getDevicePreviewConfigApi, type DevicePreviewConfig } from '@/api/device'
import { DEFAULT_GUN_DEVICE_ID } from '@/config/hikvision'

export type HikPlayerStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'error'

export type HikLayoutRect = {
  left: number
  top: number
  width: number
  height: number
}

const PLAYER_URL = '/hikvision/player.html'
const DEFAULT_PTZ_SPEED = 4

function rectChanged(a: HikLayoutRect | null, b: HikLayoutRect): boolean {
  if (!a) return true
  return (
    Math.abs(a.left - b.left) > 1 ||
    Math.abs(a.top - b.top) > 1 ||
    Math.abs(a.width - b.width) > 1 ||
    Math.abs(a.height - b.height) > 1
  )
}

/**
 * 全屏透明 iframe 承载插件；把黑色预览区屏幕坐标发给 iframe，在内部定位 #divPlugin。
 * 注意：避免高频 layout/I_Resize，否则预览会黑闪。
 */
export function useHikvisionPlayer(anchorRef: Ref<HTMLElement | null>) {
  const status = ref<HikPlayerStatus>('idle')
  const statusText = ref('实时摄像头画面区域')
  const iframeRef = shallowRef<HTMLIFrameElement | null>(null)
  const iframeSrc = ref('')
  /** 当前预览对应的 devices.device_id */
  const currentDeviceId = ref(DEFAULT_GUN_DEVICE_ID)

  let pendingDeviceId = DEFAULT_GUN_DEVICE_ID
  let startAfterReady = false
  let startSent = false
  let lastSentLayout: HikLayoutRect | null = null
  let stopWaiters: Array<() => void> = []
  let captureWaiters: Array<(r: { ok: boolean; dataUrl?: string; message?: string }) => void> =
    []
  let ptzAutoOn = false

  function postToIframe(msg: Record<string, unknown>) {
    const win = iframeRef.value?.contentWindow
    if (!win) return
    win.postMessage({ target: 'hik-embed', ...msg }, '*')
  }

  function measureAnchor(): HikLayoutRect | null {
    const el = anchorRef.value
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (r.width < 40 || r.height < 40) return null

    // 按 16:9 裁切测量区域，避免容器过高时插件窗下方留黑
    const targetH = Math.round((r.width * 9) / 16)
    const height = Math.min(Math.round(r.height), targetH)
    const top = Math.round(r.top + (r.height - height) / 2)
    return {
      left: Math.round(r.left),
      top,
      width: Math.round(r.width),
      height,
    }
  }

  /** 仅在坐标真正变化时下发，避免插件反复 Resize 黑闪 */
  function postLayout(force = false) {
    const rect = measureAnchor()
    if (!rect) return
    if (!force && !rectChanged(lastSentLayout, rect)) return
    lastSentLayout = rect
    postToIframe({ type: 'hik-layout', rect })
  }

  function onMessage(ev: MessageEvent) {
    const data = ev.data
    if (!data || data.source !== 'hik-embed') return

    if (data.type === 'hik-ready') {
      tryStartOnce()
      return
    }

    if (data.type === 'hik-status') {
      statusText.value = String(data.text || '')
      if (data.status === 'playing') status.value = 'playing'
      else if (data.status === 'error') status.value = 'error'
      else if (data.status === 'loading') status.value = 'loading'
      return
    }

    if (data.type === 'hik-playing') {
      status.value = 'playing'
      statusText.value = '预览中'
      return
    }

    if (data.type === 'hik-error') {
      status.value = 'error'
      statusText.value = String(data.message || '摄像头启动失败')
      return
    }

    if (data.type === 'hik-stopped') {
      const waiters = stopWaiters
      stopWaiters = []
      waiters.forEach((fn) => fn())
      return
    }

    if (data.type === 'hik-capture-result') {
      const waiters = captureWaiters
      captureWaiters = []
      waiters.forEach((fn) =>
        fn({
          ok: !!data.ok,
          dataUrl: data.dataUrl,
          message: data.message,
        }),
      )
    }
  }

  async function sendStart() {
    const deviceId = pendingDeviceId
    status.value = 'loading'
    statusText.value = '正在加载摄像头配置…'

    let cfg: DevicePreviewConfig
    try {
      const res = await getDevicePreviewConfigApi(deviceId)
      if (res.code !== 0 || !res.data?.ip) {
        throw new Error(res.message || '获取摄像头配置失败')
      }
      cfg = res.data
    } catch (e) {
      status.value = 'error'
      statusText.value = e instanceof Error ? e.message : '获取摄像头配置失败'
      return
    }

    // 切设备过程中若已改成别的 deviceId，丢弃过期结果
    if (deviceId !== pendingDeviceId) return

    currentDeviceId.value = deviceId
    statusText.value = '正在连接摄像头…'
    postLayout(true)
    postToIframe({
      type: 'hik-start',
      payload: {
        ip: cfg.ip,
        port: cfg.port,
        username: cfg.username,
        password: cfg.password,
        channelId: cfg.channelId,
        streamType: cfg.streamType,
      },
    })
  }

  function tryStartOnce() {
    if (!startAfterReady || startSent) return
    if (!iframeRef.value?.contentWindow) return
    startSent = true
    startAfterReady = false
    postLayout(true)
    window.setTimeout(() => {
      void sendStart()
    }, 50)
  }

  function start(deviceId = DEFAULT_GUN_DEVICE_ID) {
    pendingDeviceId = deviceId
    currentDeviceId.value = deviceId
    ptzAutoOn = false
    startSent = false
    startAfterReady = true
    lastSentLayout = null
    iframeSrc.value = `${PLAYER_URL}?t=${Date.now()}`
  }

  function onIframeLoad() {
    window.setTimeout(() => tryStartOnce(), 200)
  }

  function stop(): Promise<void> {
    return new Promise((resolve) => {
      ptzAutoOn = false
      if (!iframeRef.value || !iframeSrc.value) {
        status.value = 'idle'
        statusText.value = '实时摄像头画面区域'
        resolve()
        return
      }

      let done = false
      const finish = () => {
        if (done) return
        done = true
        iframeSrc.value = ''
        lastSentLayout = null
        startSent = false
        startAfterReady = false
        status.value = 'idle'
        statusText.value = '实时摄像头画面区域'
        resolve()
      }

      stopWaiters.push(finish)
      postToIframe({ type: 'hik-stop' })
      window.setTimeout(finish, 1200)
    })
  }

  function captureJpegDataUrl(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (status.value !== 'playing') {
        reject(new Error('预览未就绪，无法拍照'))
        return
      }
      captureWaiters.push((r) => {
        if (r.ok && r.dataUrl) resolve(r.dataUrl)
        else reject(new Error(r.message || '抓图失败'))
      })
      postToIframe({ type: 'hik-capture' })
      window.setTimeout(() => {
        if (captureWaiters.length) {
          const waiters = captureWaiters
          captureWaiters = []
          waiters.forEach((fn) => fn({ ok: false, message: '抓图超时' }))
        }
      }, 8000)
    })
  }

  /** 海康：1上 2下 3左 4右 5左上 6左下 7右上 8右下 9自动 10变焦+ 11变焦- */
  function ptzStart(index: number, speed = DEFAULT_PTZ_SPEED) {
    if (status.value !== 'playing') return
    if (index === 9) {
      // 自动：已开则用 speed=0 关闭
      if (ptzAutoOn) {
        postToIframe({ type: 'hik-ptz', index: 9, stop: false, speed: 0 })
        ptzAutoOn = false
        return
      }
      postToIframe({ type: 'hik-ptz', index: 9, stop: false, speed })
      ptzAutoOn = true
      return
    }
    ptzAutoOn = false
    postToIframe({ type: 'hik-ptz', index, stop: false, speed })
  }

  function ptzStop(index?: number) {
    if (status.value !== 'playing') return
    // 方向停止：对齐官方 demo 用 index=1 + stop；变焦停止用 11
    const stopIndex = index === 10 || index === 11 ? 11 : 1
    postToIframe({ type: 'hik-ptz', index: stopIndex, stop: true, speed: DEFAULT_PTZ_SPEED })
  }

  function onWinResize() {
    postLayout(false)
  }

  onMounted(() => {
    window.addEventListener('message', onMessage)
    window.addEventListener('resize', onWinResize)
  })

  onUnmounted(() => {
    window.removeEventListener('message', onMessage)
    window.removeEventListener('resize', onWinResize)
  })

  return {
    status,
    statusText,
    iframeRef,
    iframeSrc,
    currentDeviceId,
    start,
    stop,
    onIframeLoad,
    captureJpegDataUrl,
    postLayout,
    ptzStart,
    ptzStop,
  }
}
