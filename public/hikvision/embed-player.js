/**
 * 海康插件嵌入页 —— 对齐官方 demo，并通过 hik-layout 把画面摆到父页黑色预览区坐标。
 */
(function () {
  var g_iWndIndex = 0
  var g_deviceIdentify = ''
  var g_inited = false
  var g_playing = false
  var g_busy = false
  var g_layout = null
  var g_layoutWaiters = []
  var g_analogInfoReady = false
  /** 当前预览通道，供云台 ISAPI 使用 */
  var g_playChannelId = 1

  function post(msg) {
    try {
      parent.postMessage(Object.assign({ source: 'hik-embed' }, msg), '*')
    } catch (e) {}
  }

  function status(text, state) {
    post({ type: 'hik-status', text: text, status: state || 'loading' })
  }

  function applyLayout(rect, forceResize) {
    if (!rect) return false
    var left = Math.round(Number(rect.left) || 0)
    var top = Math.round(Number(rect.top) || 0)
    var width = Math.max(1, Math.round(Number(rect.width) || 0))
    var height = Math.max(1, Math.round(Number(rect.height) || 0))

    var prev = g_layout
    var posChanged =
      !prev ||
      Math.abs(prev.left - left) > 1 ||
      Math.abs(prev.top - top) > 1
    var sizeChanged =
      !prev ||
      Math.abs(prev.width - width) > 1 ||
      Math.abs(prev.height - height) > 1

    // 坐标几乎不变时直接跳过，避免反复 I_Resize 导致黑闪
    if (!forceResize && !posChanged && !sizeChanged) {
      return false
    }

    g_layout = { left: left, top: top, width: width, height: height }

    var el = document.getElementById('divPlugin')
    if (!el) return false
    el.style.position = 'absolute'
    el.style.left = left + 'px'
    el.style.top = top + 'px'
    el.style.width = width + 'px'
    el.style.height = height + 'px'
    el.style.pointerEvents = 'auto'

    // 仅尺寸变化时 Resize；纯位移只改 DOM，减少插件重绘闪烁
    if (g_inited && (forceResize || sizeChanged)) {
      try {
        if (typeof WebVideoCtrl !== 'undefined' && WebVideoCtrl.I_Resize) {
          WebVideoCtrl.I_Resize(width, height)
        }
      } catch (e) {}
    }

    var waiters = g_layoutWaiters
    g_layoutWaiters = []
    for (var i = 0; i < waiters.length; i++) {
      try {
        waiters[i](g_layout)
      } catch (e2) {}
    }
    return true
  }

  function waitForLayout(timeoutMs) {
    return new Promise(function (resolve) {
      if (g_layout && g_layout.width >= 80 && g_layout.height >= 80) {
        resolve(g_layout)
        return
      }
      var done = false
      var timer = setTimeout(function () {
        if (done) return
        done = true
        resolve(g_layout)
      }, timeoutMs || 3000)
      g_layoutWaiters.push(function (layout) {
        if (done) return
        done = true
        clearTimeout(timer)
        resolve(layout)
      })
    })
  }

  function initPlugin() {
    return new Promise(function (resolve, reject) {
      if (g_inited) {
        resolve()
        return
      }
      if (typeof WebVideoCtrl === 'undefined') {
        reject(new Error('WebVideoCtrl 未加载'))
        return
      }
      var installRet = -1
      try {
        installRet = WebVideoCtrl.I_CheckPluginInstall()
      } catch (e) {}
      if (installRet === -1) {
        reject(new Error('未安装海康浏览插件，请安装 HCWebSDKPlugin.exe 后重启浏览器'))
        return
      }

      var timer = setTimeout(function () {
        reject(new Error('插件初始化超时'))
      }, 15000)

      try {
        WebVideoCtrl.I_InitPlugin({
          bWndFull: true,
          iWndowType: 1,
          cbSelWnd: function (xmlDoc) {
            try {
              g_iWndIndex = parseInt($(xmlDoc).find('SelectWnd').eq(0).text(), 10) || 0
            } catch (e) {
              g_iWndIndex = 0
            }
          },
          cbDoubleClickWnd: function () {},
          cbEvent: function () {},
          cbInitPluginComplete: function () {
            WebVideoCtrl.I_InsertOBJECTPlugin('divPlugin').then(
              function () {
                clearTimeout(timer)
                g_inited = true
                resolve()
              },
              function () {
                clearTimeout(timer)
                reject(new Error('插件插入失败，请确认已安装 HCWebSDKPlugin.exe'))
              },
            )
          },
        })
      } catch (e) {
        clearTimeout(timer)
        reject(e)
      }
    })
  }

  function login(cfg) {
    return new Promise(function (resolve, reject) {
      var ip = cfg.ip
      var port = String(cfg.port || 80)
      var username = cfg.username
      var password = cfg.password
      g_deviceIdentify = ip + '_' + port

      var timer = setTimeout(function () {
        reject(new Error('设备登录超时'))
      }, 10000)

      WebVideoCtrl.I_Login(ip, 1, port, username, password, {
        timeout: 3000,
        success: function () {
          clearTimeout(timer)
          resolve()
        },
        error: function (oError) {
          clearTimeout(timer)
          if (oError && oError.errorCode === 2001) {
            resolve()
            return
          }
          reject(new Error((oError && oError.errorMsg) || '设备登录失败'))
        },
      })
    })
  }

  function getFirstChannelId() {
    return new Promise(function (resolve) {
      var fallback = 1
      var settled = false
      function done(id) {
        if (settled) return
        settled = true
        resolve(id > 0 ? id : fallback)
      }
      setTimeout(function () {
        done(fallback)
      }, 2000)

      try {
        WebVideoCtrl.I_GetAnalogChannelInfo(g_deviceIdentify, {
          success: function (xmlDoc) {
            var id = parseInt($(xmlDoc).find('VideoInputChannel').eq(0).find('id').eq(0).text(), 10)
            if (id > 0) done(id)
          },
          error: function () {},
        })
      } catch (e) {}

      try {
        WebVideoCtrl.I_GetDigitalChannelInfo(g_deviceIdentify, {
          success: function (xmlDoc) {
            var id = parseInt(
              $(xmlDoc).find('InputProxyChannelStatus').eq(0).find('id').eq(0).text(),
              10,
            )
            if (id > 0) done(id)
          },
          error: function () {},
        })
      } catch (e) {}
    })
  }

  /**
   * 登录后必须拉一次模拟通道信息，写入 iAnalogChannelNum。
   * 否则该值保持 0，云台会走 PTZCtrlProxy（NVR 数字通道）地址，
   * 独立 IPC/球机上会返回 HTTP 403，表现为云台无反应。
   */
  function ensureAnalogChannelInfo() {
    if (g_analogInfoReady) return Promise.resolve()
    return new Promise(function (resolve) {
      var settled = false
      function done() {
        if (settled) return
        settled = true
        g_analogInfoReady = true
        resolve()
      }
      setTimeout(done, 2000)
      try {
        WebVideoCtrl.I_GetAnalogChannelInfo(g_deviceIdentify, {
          success: function () {
            done()
          },
          error: function () {
            done()
          },
        })
      } catch (e) {
        done()
      }
    })
  }

  function startPlay(channelId, streamType) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        reject(new Error('开启预览超时'))
      }, 15000)

      function doPlay() {
        WebVideoCtrl.I_StartRealPlay(g_deviceIdentify, {
          iStreamType: streamType || 1,
          iChannelID: channelId || 1,
          bZeroChannel: false,
          success: function () {
            clearTimeout(timer)
            g_playing = true
            resolve()
          },
          error: function (oError) {
            clearTimeout(timer)
            reject(new Error((oError && oError.errorMsg) || '开启预览失败'))
          },
        })
      }

      var oWndInfo = null
      try {
        oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex)
      } catch (e) {}
      if (oWndInfo != null) {
        WebVideoCtrl.I_Stop({
          success: function () {
            doPlay()
          },
          error: function () {
            doPlay()
          },
        })
      } else {
        doPlay()
      }
    })
  }

  function destroyAll() {
    return new Promise(function (resolve) {
      function finish() {
        g_playing = false
        g_inited = false
        g_deviceIdentify = ''
        g_analogInfoReady = false
        g_playChannelId = 1
        try {
          var el = document.getElementById('divPlugin')
          if (el) el.innerHTML = ''
        } catch (e) {}
        resolve()
      }

      try {
        WebVideoCtrl.I_Stop({
          success: function () {},
          error: function () {},
        })
      } catch (e) {
        try {
          WebVideoCtrl.I_Stop()
        } catch (e2) {}
      }

      setTimeout(function () {
        if (g_deviceIdentify) {
          try {
            WebVideoCtrl.I_Logout(g_deviceIdentify)
          } catch (e) {}
        }
        setTimeout(function () {
          try {
            if (typeof WebVideoCtrl.I_DestroyPlugin === 'function') {
              WebVideoCtrl.I_DestroyPlugin()
            }
          } catch (e) {}
          setTimeout(finish, 100)
        }, 150)
      }, 150)
    })
  }

  function capture() {
    return new Promise(function (resolve, reject) {
      var oWndInfo = null
      try {
        oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex)
      } catch (e) {}
      if (!oWndInfo) {
        reject(new Error('当前无预览画面'))
        return
      }
      WebVideoCtrl.I_CapturePicData().then(
        function (data) {
          if (!data) {
            reject(new Error('抓图为空'))
            return
          }
          resolve(data.indexOf('data:') === 0 ? data : 'data:image/jpeg;base64,' + data)
        },
        function () {
          reject(new Error('抓图失败'))
        },
      )
    })
  }

  async function handleStart(cfg) {
    if (g_busy) return
    g_busy = true
    g_analogInfoReady = false
    try {
      status('正在定位预览区域…', 'loading')
      await waitForLayout(4000)
      if (g_layout) applyLayout(g_layout, true)

      status('正在初始化插件…', 'loading')
      await initPlugin()
      // Insert 后强制对齐一次即可，之后无变化不再 Resize
      if (g_layout) applyLayout(g_layout, true)

      status('正在登录设备…', 'loading')
      await login(cfg)

      // 无论 config 是否带 channelId，都要先拉模拟通道以填充 iAnalogChannelNum
      status('正在获取通道…', 'loading')
      await ensureAnalogChannelInfo()
      await new Promise(function (r) {
        setTimeout(r, 300)
      })
      var channelId = cfg.channelId || (await getFirstChannelId())
      g_playChannelId = channelId > 0 ? channelId : 1
      status('正在开启预览(通道' + g_playChannelId + ')…', 'loading')
      await new Promise(function (r) {
        setTimeout(r, 300)
      })
      await startPlay(g_playChannelId, cfg.streamType || 1)
      status('预览中', 'playing')
      post({ type: 'hik-playing' })
    } catch (e) {
      status((e && e.message) || '启动失败', 'error')
      try {
        await destroyAll()
      } catch (e2) {}
      post({ type: 'hik-error', message: (e && e.message) || '启动失败' })
    } finally {
      g_busy = false
    }
  }

  async function handleStop() {
    try {
      await destroyAll()
    } catch (e) {}
    post({ type: 'hik-stopped' })
  }

  async function handleCapture() {
    try {
      var dataUrl = await capture()
      post({ type: 'hik-capture-result', ok: true, dataUrl: dataUrl })
    } catch (e) {
      post({ type: 'hik-capture-result', ok: false, message: (e && e.message) || '抓图失败' })
    }
  }

  /**
   * 云台：不走 I_PTZControl（其在 iAnalogChannelNum=0 时会误用 NVR Proxy 地址导致 403）。
   * 直接对 IPC 常用模拟通道 ISAPI 发 PUT；失败再试数字通道代理。
   * 热路径禁止 await，避免按下后还在等通道探测、松开停止已先发出。
   *
   * index: 1上 2下 3左 4右 5左上 6左下 7右上 8右下 9自动 10变焦+ 11变焦-
   */
  function formatPtzError(oError) {
    if (!oError) return '云台控制失败'
    var code = oError.errorCode
    var msg = oError.errorMsg
    if (msg && typeof msg === 'object') {
      try {
        var statusString = ''
        var subStatus = ''
        if (window.$ && msg.nodeType) {
          statusString = $(msg).find('statusString').eq(0).text() || ''
          subStatus = $(msg).find('subStatusCode').eq(0).text() || ''
        }
        if (statusString) {
          return (
            '云台失败 ' +
            code +
            ': ' +
            statusString +
            (subStatus ? ' (' + subStatus + ')' : '')
          )
        }
      } catch (e) {}
      return '云台控制失败 (' + code + ')'
    }
    if (typeof msg === 'string' && msg && msg !== 'document') {
      return '云台失败 ' + code + ': ' + msg
    }
    return '云台控制失败 (' + (code || '?') + ')'
  }

  function ptzSpeedValue(speed, stop) {
    if (stop) return 0
    var s = typeof speed === 'number' ? speed : 4
    return s < 7 ? s * 15 : 100
  }

  function buildPtzBody(index, speed, stop) {
    var v = ptzSpeedValue(speed, stop)
    // 与 SDK ptzControl 方向表一致
    var dir = [
      null,
      { pan: 0, tilt: v },
      { pan: 0, tilt: -v },
      { pan: -v, tilt: 0 },
      { pan: v, tilt: 0 },
      { pan: -v, tilt: v },
      { pan: -v, tilt: -v },
      { pan: v, tilt: v },
      { pan: v, tilt: -v },
    ]
    if (index >= 1 && index <= 8) {
      return (
        "<?xml version='1.0' encoding='UTF-8'?>" +
        '<PTZData><pan>' +
        dir[index].pan +
        '</pan><tilt>' +
        dir[index].tilt +
        '</tilt></PTZData>'
      )
    }
    if (index === 10 || index === 11) {
      var zoom = stop ? 0 : index === 10 ? v : -v
      return (
        "<?xml version='1.0' encoding='UTF-8'?>" +
        '<PTZData><zoom>' +
        zoom +
        '</zoom></PTZData>'
      )
    }
    if (index === 9) {
      return (
        "<?xml version='1.0' encoding='UTF-8'?>" +
        '<autoPanData><autoPan>' +
        v +
        '</autoPan></autoPanData>'
      )
    }
    return ''
  }

  function sendHttp(szURI, szData) {
    return WebVideoCtrl.I_SendHTTPRequest(g_deviceIdentify, szURI, {
      type: 'PUT',
      data: szData,
    })
  }

  function sendPtzIsapi(index, stop, speed) {
    var channelId = g_playChannelId || 1
    var oWndInfo = null
    try {
      oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex)
    } catch (e) {}
    if (oWndInfo && oWndInfo.iChannelID > 0) {
      channelId = oWndInfo.iChannelID
      g_playChannelId = channelId
    }

    var szData = buildPtzBody(index, speed, stop)
    if (!szData) {
      return Promise.reject({ errorCode: 1002, errorMsg: '不支持的云台指令' })
    }

    var analogUri
    var digitalUri
    if (index === 9) {
      analogUri = 'ISAPI/PTZCtrl/channels/' + channelId + '/autoPan'
      digitalUri = 'ISAPI/ContentMgmt/PTZCtrlProxy/channels/' + channelId + '/autoPan'
    } else {
      analogUri = 'ISAPI/PTZCtrl/channels/' + channelId + '/continuous'
      digitalUri = 'ISAPI/ContentMgmt/PTZCtrlProxy/channels/' + channelId + '/continuous'
    }

    // 独立球机优先模拟通道；403 时再试数字通道代理
    return sendHttp(analogUri, szData).then(
      function (ok) {
        return ok
      },
      function () {
        return sendHttp(digitalUri, szData)
      },
    )
  }

  function handlePtz(payload) {
    var p = payload || {}
    var index = parseInt(p.index, 10)
    var stop = !!p.stop
    var speed = typeof p.speed === 'number' ? p.speed : 4
    if (!g_deviceIdentify || !index) return
    if (typeof WebVideoCtrl === 'undefined' || !WebVideoCtrl.I_SendHTTPRequest) {
      post({ type: 'hik-status', text: '当前插件不支持云台控制', status: 'playing' })
      return
    }

    var oWndInfo = null
    try {
      oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex)
    } catch (e) {}
    if (!oWndInfo) {
      post({ type: 'hik-status', text: '预览窗口未就绪，无法云台', status: 'playing' })
      return
    }

    // 自动巡航：父页用 speed=0 表示关闭
    if (index === 9 && (stop || speed === 0)) {
      stop = true
      speed = 0
    }

    try {
      sendPtzIsapi(index, stop, speed).then(
        function () {},
        function (oError) {
          if (stop) return
          post({
            type: 'hik-status',
            text: formatPtzError(oError),
            status: 'playing',
          })
        },
      )
    } catch (e) {
      post({
        type: 'hik-status',
        text: (e && e.message) || '云台控制异常',
        status: 'playing',
      })
    }
  }

  window.addEventListener('message', function (ev) {
    var data = ev.data
    if (!data || data.target !== 'hik-embed') return
    if (data.type === 'hik-layout') {
      applyLayout(data.rect || null)
    } else if (data.type === 'hik-start') {
      handleStart(data.payload || {})
    } else if (data.type === 'hik-stop') {
      handleStop()
    } else if (data.type === 'hik-capture') {
      handleCapture()
    } else if (data.type === 'hik-ptz') {
      handlePtz(data)
    }
  })

  post({ type: 'hik-ready' })
})()
