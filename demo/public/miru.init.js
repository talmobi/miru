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
overloadAddEventListeners([window, document && document.body])

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
          console.log('calling valid wrappedListener')
          listener(e) // run the callback
        } else {
          console.log('removing invalid wrappedListener')
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
r.open('GET', 'http://localhost:4040/__miru/livereload.js?cachebuster=' + now)
r.onerror = function () {
  // assume hosted on current domain
  console.log('default miru host location failed to connect, trying current domain')
  attachLivereloadScripts()
}
r.onload = function () {
  var statusCode = r.status || r.statusCode
  if (statusCode >= 200 && statusCode < 400) {
    attachLivereloadScripts('http://localhost:4040')
  } else {
    // for when connecting from devices on the same network
    console.log('default miru host location failed, trying current domain')
    attachLivereloadScripts()
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

  console.log('Live Relaod Scripts Attached!! from [' + libs + ']')
}
