;(function () {
  /*
  * Template script to initialize and connect with the miru dev server
  * from the front-end. Saved to disk in the current directory as 'miru.init.js'
  *
  * Usage:
  * link to the script in your html
  * (usually your index.html or dev.index.html)
  *
  * eg: <script src='miru.init.js'></script>
  * */

  // keep track of bundle build times
  window.__miruCurrentBuildTime = Date.now()

  // overload global event listeners
  // so that we can track and clean them up on js injections
  // overloadAddEventListeners([window, document && document.body])

  var __miruLogs = {}
  var __miruLogTimeout
  function __miruLog (msg) {
    __miruLogs[msg] = (__miruLogs[msg] + 1) || 1
    clearTimeout(__miruLogTimeout)
    __miruLogTimeout = setTimeout(function () {
      Object.keys(__miruLogs).forEach(function (key) {
        console.log(key + ' [' + __miruLogs[key] + ']')
      })
      __miruLogs = {}
    }, 100)
  }

  if (window.localStorage) {
    var _scrollTop = JSON.parse(window.localStorage.getItem('__miru_scrollTop'))

    if (_scrollTop && (Date.now() - _scrollTop.time) < 5000) {
      var tries = []
      for (var i = 0; i < 10; i++) {
        setTimeout(function () {
          if (document.body.scrollTop !== _scrollTop.scrollTop) {
            document.body.scrollTop = _scrollTop.scrollTop
          }
        }, i * 50)
      }
    }
  }

  function overloadAddEventListeners (doms) {
    // console.log('overloading addEventListeners for [' + doms.join(',') + ']')

    if (!Array.isArray(doms)) doms = [doms]
    doms.forEach(function (dom) {
      if (!dom) return // skip falsy

      var _addEventListener = dom.addEventListener
      dom._addEventListener = _addEventListener

      dom.addEventListener = function (type, listener, useCapture, wantsUntrusted) {
        // console.log('overloaded addEventListener callback')
        var attachedTime = window.__miruCurrentBuildTime

        function wrappedListener (e) {
          var isValid = attachedTime === window.__miruCurrentBuildTime
          if (isValid) {
            __miruLog('calling valid wrappedListener')
            listener(e) // run the callback
          } else {
            __miruLog('removing invalid wrappedListener')
            dom.removeEventListener(type, wrappedListener)
          }
        }

        // console.log('attaching wrappedListener')
        dom._addEventListener(type, wrappedListener, useCapture, wantsUntrusted)
      }
    })
  }

  // find the running miru dev server and connect to its socket.io server
  // to get realtime events on the bulid processes (live reloads)
  var now = Date.now()
  var r = new XMLHttpRequest()
  r.open('GET', window.location.protocol + '//' + window.location.hostname + ':4040/__miru/livereload.js?cachebuster=' + now)
  r.onerror = function () {
    // try localhost
    console.log('default miru host location failed to connect, trying localhost')
    attachLivereloadScripts('http://localhost:4040')
  }
  r.onload = function () {
    var statusCode = r.status || r.statusCode
    if (statusCode >= 200 && statusCode < 400) {
      // try current domain (window.location.hostname)
      attachLivereloadScripts()
    } else {
      // try localhost
      console.log('default miru host location failed to connect, trying localhost')
      attachLivereloadScripts('http://localhost:4040')
    }
  }
  console.log('trying to attach live reload scripts...')
  r.send()

  function attachLivereloadScripts (url) {
    var loc = window.location
    var host = url || (loc.protocol + '//' + loc.hostname + ':' + '4040')

    // add prefix path
    var libs = host + '/__miru'

    window.__miruHost = host

    var scriptEl = null
    var linkEl = null

    var now = Date.now()
    var cachebuster = '?cachebuster=' + now

    // this is required in order to connect to miru's dev server's
    // socket.io server to receive events for changes/updates to source files
    // and then trigger injections/page reloads on the client side
    scriptEl = document.createElement('script')
    scriptEl.src = host + '/socket.io/socket.io.js' + cachebuster
    document.body.appendChild(scriptEl)
    console.log('Socket IO Attached!! from [' + host + ']')

    
    

    // this is mandatory, listens for socket.io events and
    // updates/injects bundles and/or reloads the page
    scriptEl = document.createElement('script')
    scriptEl.src = libs + '/livereload.js' + cachebuster
    document.body.appendChild(scriptEl)

    console.log('Live Reload Scripts Attached!! from [' + libs + ']')
  }
})()
