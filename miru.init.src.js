var wooster = require( '../wooster/dist/bundle.min.js' ) // TODO

var initLivereload = require( './livereload.src.js' )

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
  // var r = new XMLHttpRequest()
  // r.open('GET', window.location.protocol + '//' + window.location.hostname + ':4040/__miru/livereload.js?cachebuster=' + now)
  // r.onerror = function () {
  //   // try localhost
  //   console.log('default miru host location failed to connect, trying localhost')
  //   attachLivereloadScripts('http://localhost:4040')
  // }
  // r.onload = function () {
  //   var statusCode = r.status || r.statusCode
  //   if (statusCode >= 200 && statusCode < 400) {
  //     // try current domain (window.location.hostname)
  //     attachLivereloadScripts()
  //   } else {
  //     // try localhost
  //     console.log('default miru host location failed to connect, trying localhost')
  //     attachLivereloadScripts('http://localhost:4040')
  //   }
  // }
  // r.send()
  console.log('trying to attach live reload scripts...')

  attachLivereloadScripts()

  var loc = window.location
  var host = ( loc.protocol + '//' + loc.hostname + ':' + '4040' )
  var libs = host + '/__miru'

  var now = Date.now()
  var cachebuster = '?cachebuster=' + now

  function attachLivereloadScripts () {
    var loc = window.location
    var host = ( loc.protocol + '//' + loc.hostname + ':' + '4040' )

    // add prefix path
    var libs = host + '/__miru'

    window.__miruHost = host

    var scriptEl = null
    var linkEl = null

    var now = Date.now()
    var cachebuster = '?cachebuster=' + now

    // attach better monospace font
    var fontLinkEl = document.createElement('link')
    fontLinkEl.rel = 'stylesheet'
    fontLinkEl.href = 'https://fonts.googleapis.com/css?family=Anonymous+Pro'
    document.head.appendChild(fontLinkEl)

    // pesticide
    try {
      var ls = window.localStorage
      var enabled = !!JSON.parse( ls.getItem( '__miru-pesticide-enabled' ) )
      console.log( 'pesticide enabled: ' + enabled )
      if ( enabled ) {
        enablePesticide()
      } else {
        disablePesticide()
      }
    } catch ( err ) { /* ignored */ }

    console.log('Live Reload Scripts Attached!! from [' + libs + ']')
  }

  function savePesticideStatus () {
    var el = document.getElementById( '__miru-pesticide-id' )
    var enabled = !!el


    try {
      window && window.localStorage && window.localStorage.setItem(
        '__miru-pesticide-enabled',
        enabled
      )

      console.log( 'save pesticide: ' + enabled )
    } catch ( err ) {
      console.log( err )
    }
  }

  function enablePesticide () {
    var el = document.getElementById( '__miru-pesticide-id' )
    if ( !el ) {
      var linkEl = document.createElement( 'link' )
      linkEl.id = '__miru-pesticide-id'
      linkEl.rel = 'stylesheet'
      linkEl.href = libs + '/pesticide.css' + cachebuster
      document.head.appendChild( linkEl )
    }
  }

  function disablePesticide () {
    var el = document.getElementById( '__miru-pesticide-id' )
    if ( el ) {
      el.parentNode.removeChild( el )
    }
  }

  function togglePesticide () {
    var el = document.getElementById( '__miru-pesticide-id' )
    if ( el ) {
      disablePesticide()
    } else {
      enablePesticide()
    }
  }

  window.addEventListener( 'keyup', function ( evt ) {
    var key = evt.keyCode || evt.which

    switch ( key ) {
      case 118: // F7 key
      case 119: // F8 key
      case 120: // F9 key
        togglePesticide()
        savePesticideStatus()
        break
      default:
    }
  })

  window.enablePesticide = enablePesticide
  window.disablePesticide = disablePesticide
  window.togglePesticide = togglePesticide

  function getFile ( filename, callback ) {
    console.log( ' >> getting file: ' + filename )
    var req = new XMLHttpRequest()
    req.open( 'GET', filename, true )

    req.onload = function () {
      console.log( ' << got file' + filename )

      if ( req.status >= 200 && req.status < 500 ) {
        // success
        callback( undefined, req.responseText )
      } else {
        // reached server, but error
        callback( 'error: ' + req.status )
      }
    }

    req.onerror = function () {
      // failed to connect to server
      callback( 'error: failed to connect to server' )
    }

    req.send()
  }

  // grab dom errors
  window.addEventListener( 'error', function ( err ) {
    var message = err.message
    var filename = err.filename
    var lineno = err.lineno
    var colno = err.colno
    console.log( 'miru window error' )
    console.log( err )

    console.log( 'getting file...' )
    getFile( filename, function ( getError, text ) {
      if ( getError ) {
        return console.log( 'file get error: ' + getError )
      }

      var _startTime = Date.now()
      console.log( 'got file, length: ' + text.length )

      var lines = wooster.parseContext({
        path: err.filename,
        prettify: true,
        text: text,
        lineno: err.lineno,
        colno: err.colno
      })

      var context = lines.join( '\n' )

      var description = err.message || '[ Unknown Error ]'
      var colorify = wooster.colorify

      // highlight "error" words
      if ( true ) {
        var lineLength = 0
        var output = ' '
        var words = description.split( /\s+/ )

        words.forEach( function ( word ) {
          var raw = word
          var rawLow = raw.toLowerCase()
          if ( rawLow.indexOf( 'error' ) !== -1 ) {
            word = colorify( raw, 'red' )
          }

          // check if probably path stringy
          if (
            rawLow.indexOf( '/' ) !== -1 ||
            rawLow.indexOf( '.' ) !== -1
          ) {
            word = colorify( raw, 'magentaBright' )
          }

          output += word.trim()

          lineLength += raw.length
          if ( lineLength > 70 ) {
            lineLength = 0
            output += '\n '
          }

          output += ' '
        })

        description = ' ' + output.trim()
      }

      var parsedMessage = [
        colorify( '>> wooster DOM output <<', 'blackBright' ),
        description,
        '',
        ' @ ' + colorify( err.filename, 'magentaBright' ) +
        ' ' + colorify( err.lineno, 'redBright' ) +
        ':' + colorify( err.colno, 'redBright' )
      ].join( '\n' )

      parsedMessage += '\n' + context

      var delta = Date.now() - _startTime
      console.log( 'parsed message in: ' + delta + 'ms' )

      var _startTime = Date.now()
      var _maxTime = 3000

      var attempt = function () {
        console.log( 'attempting to send error' )

        if ( window.__miruErrorHandler ) {
          window.__miruErrorHandler({
            // target: err.filename,
            target: 'DOM',
            name: 'Error',
            message: parsedMessage
          })
        } else {
          var now = Date.now()
          if ( ( now - _startTime ) < _maxTime ) {
            setTimeout( attempt, 33 )
          } else {
            console.log( 'sending DOM error timed out' )
          }
        }
      }

      setTimeout( attempt, 33 )
    } )
  } )

  function parseContext ( opts ) {
    // var url = opts.url
    // var message = opts.message

    var text = opts.text
    var lines = text.split( '\n' )

    var colno = opts.colno
    var lineno = opts.lineno

    var i = Math.max( 0, lineno - 6 ) // first line
    var j = Math.min( lines.length - 1, i + 4 + 2 + 2 ) // last line

    var minLeftPadding = String( j ).trim().length

    var parsedLines = []
    for (; i < j; i++) {
      var head = String( i + 1 ).trim() // line number column
      var body = lines[ i ] // line text content

      // currently parsing target line
      var onTargetLine = ( i === ( lineno - 1 ) )

      // left pad
      while ( head.length < minLeftPadding ) head = (' ' + head )

      // target line
      if ( onTargetLine ) {
        // prepend > arrow
        // head = clc.redBright('> ') + clc.whiteBright( head  )
        head = '> ' + head
      } else { // context line
        // prepend two spaces ( to stay aligned with the targeted line '> ' )
        head = '  ' + head
      }

      // separate line number and line content
      var line = ( head + ' | ' + body )
      parsedLines.push( line )
      // log(lines[i])

      // draw an arrow pointing upward to column location
      if ( onTargetLine ) {
        var offset = '' // ^ pointer offset
        for (var x = 0; x < colno; x++) {
          offset += ' '
        }
        var _head = String( j ).trim().split( /./ ).join(' ') + '   | '
        parsedLines.push( _head + offset + '^' )
      }
    }

    return parsedLines
  }
})()

initLivereload()
