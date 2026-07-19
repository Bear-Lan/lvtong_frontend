import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { appConfig } from '@/config/env'
import {
  WebSocketClient,
  WsMessageType,
  type WsConnectionStatus,
  type WsEnvelope,
  type WsMessageHandler,
} from '@/services/websocket'

let client: WebSocketClient | null = null

export const useWsStore = defineStore('websocket', () => {
  const status = ref<WsConnectionStatus>('idle')
  const lastMessage = ref<WsEnvelope | null>(null)
  const lastError = ref<string | null>(null)

  const isConnected = computed(() => status.value === 'open')

  function ensureClient() {
    if (client) return client

    client = new WebSocketClient({
      url: appConfig.wsUrl,
      reconnectMaxRetries: appConfig.wsReconnectMaxRetries,
      heartbeatInterval: appConfig.wsHeartbeatInterval,
      onStatusChange: (next) => {
        status.value = next
      },
      onMessage: (payload) => {
        lastMessage.value = payload
      },
      onError: () => {
        lastError.value = 'WebSocket 连接异常'
      },
    })

    return client
  }

  function connect() {
    if (appConfig.useMock) {
      console.info('[WebSocket] Mock 模式，跳过连接')
      return
    }
    ensureClient().connect()
  }

  function disconnect() {
    client?.disconnect()
    status.value = 'idle'
  }

  function send<T>(message: WsEnvelope<T>) {
    return ensureClient().send(message)
  }

  function subscribe(type: WsMessageType | string, handler: WsMessageHandler) {
    return ensureClient().subscribe(type, handler)
  }

  /** 订阅全部消息（调试用） */
  function subscribeAll(handler: WsMessageHandler) {
    return ensureClient().subscribe('*', handler)
  }

  return {
    status,
    lastMessage,
    lastError,
    isConnected,
    connect,
    disconnect,
    send,
    subscribe,
    subscribeAll,
  }
})
