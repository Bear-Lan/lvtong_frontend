import type {
  WsClientOptions,
  WsConnectionStatus,
  WsEnvelope,
  WsMessageHandler,
} from './types'

function resolveWsUrl(url: string): string {
  if (url.startsWith('ws://') || url.startsWith('wss://')) {
    return url
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const path = url.startsWith('/') ? url : `/${url}`
  return `${protocol}//${window.location.host}${path}`
}

/**
 * WebSocket 客户端 — 负责连接、重连、心跳与消息分发。
 * 业务层通过 useWsStore / useWebSocket 使用，不直接 new。
 */
export class WebSocketClient {
  private socket: WebSocket | null = null
  private status: WsConnectionStatus = 'idle'
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private readonly handlers = new Map<string, Set<WsMessageHandler>>()
  private readonly options: Required<
    Pick<WsClientOptions, 'reconnectMaxRetries' | 'heartbeatInterval'>
  > &
    WsClientOptions

  constructor(options: WsClientOptions) {
    this.options = {
      reconnectMaxRetries: 10,
      heartbeatInterval: 30000,
      ...options,
      url: resolveWsUrl(options.url),
    }
  }

  get connectionStatus(): WsConnectionStatus {
    return this.status
  }

  connect() {
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return
    }

    this.setStatus('connecting')
    this.socket = new WebSocket(this.options.url, this.options.protocols)

    this.socket.onopen = () => {
      this.reconnectAttempts = 0
      this.setStatus('open')
      this.startHeartbeat()
    }

    this.socket.onmessage = (event) => {
      const payload = this.parseMessage(event.data)
      if (!payload) return

      this.options.onMessage?.(payload)
      this.dispatch(payload.type, payload)
    }

    this.socket.onerror = (event) => {
      this.setStatus('error')
      this.options.onError?.(event)
    }

    this.socket.onclose = () => {
      this.stopHeartbeat()
      this.setStatus('closed')
      this.scheduleReconnect()
    }
  }

  disconnect() {
    this.clearReconnectTimer()
    this.stopHeartbeat()
    if (this.socket) {
      this.socket.onclose = null
      this.socket.close()
      this.socket = null
    }
    this.setStatus('idle')
  }

  send<T>(message: WsEnvelope<T>) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] 未连接，消息未发送:', message.type)
      return false
    }
    this.socket.send(JSON.stringify(message))
    return true
  }

  subscribe(type: string, handler: WsMessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler)

    return () => {
      this.handlers.get(type)?.delete(handler)
    }
  }

  private dispatch(type: string, payload: WsEnvelope) {
    this.handlers.get(type)?.forEach((handler) => handler(payload))
    this.handlers.get('*')?.forEach((handler) => handler(payload))
  }

  private parseMessage(raw: unknown): WsEnvelope | null {
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : null
    } catch {
      console.warn('[WebSocket] 无法解析消息:', raw)
      return null
    }
  }

  private setStatus(status: WsConnectionStatus) {
    this.status = status
    this.options.onStatusChange?.(status)
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.options.reconnectMaxRetries) return

    this.clearReconnectTimer()
    this.setStatus('reconnecting')
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000)
    this.reconnectAttempts += 1

    this.reconnectTimer = setTimeout(() => {
      this.connect()
    }, delay)
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping', timestamp: Date.now() })
    }, this.options.heartbeatInterval)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }
}
