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
            var id = parseInt($(xmlDoc).find('InputProxyChannelStatus').eq(0).find('id').eq(0).text(), 10)
            if (id > 0) done(id)
          },
          error: function () {},
        })
      } catch (e) {}
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

      status('正在获取通道…', 'loading')
      await new Promise(function (r) {
        setTimeout(r, 1000)
      })
      var channelId = cfg.channelId || (await getFirstChannelId())
      status('正在开启预览(通道' + channelId + ')…', 'loading')
      await new Promise(function (r) {
        setTimeout(r, 500)
      })
      await startPlay(channelId, cfg.streamType || 1)
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
    }
  })

  post({ type: 'hik-ready' })
})()
