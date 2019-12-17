import modal from './modal.js'
import ansiToHtml from './ansi-to-html.js'
import stripAnsi from './strip-ansi.js'

import * as pesticide from './pesticide.js'

// import io from 'socket.io-client'
// var kiite = require( '/Users/mollie/code/kiite/dist/kiite.min.js' )
const kiite = require( 'kiite' )

import { getUri } from './config.js'

// console.log( '[miru] socket connecting to: ' + URI )
const socket = kiite.connect( {
  protocol: 'http',
  host: window.location.hostname,
  port: window.__miru.port
} )

window.__miru.terminalErrors = {}
let _connected = false

// only send connecting message if connecting takesl longer than
// 1500 milliseconds -- in order to reduce console.log bloat
let _sendConnectingMessageTimeout
if ( !window.__miru.verbose ) {
  _sendConnectingMessageTimeout = setTimeout( function () {
    console.log( '[miru] connecting to: ' + getUri() )
  }, 1500 )
} else {
  window.__miru.debug( '[miru] connecting to: ' + getUri() )
}

socket.on( 'connect', function () {
  // no need to send connecting message anymore
  clearTimeout( _sendConnectingMessageTimeout )

  // should already be set by IIFE concated to the head of miru-connect.js
  window.__miru = ( window.__miru || {} )
  window.__miru.socket = socket

  var uri = ( 'http://' + window.location.hostname + ':' + window.__miru.port )
  console.log( '[miru] connected to: ' + uri )
  _connected = true
  window.__miru.connected = true
} )

socket.on( 'disconnect', function () {
  _connected = false
  window.__miru.connected = false
} )

socket.on( 'info', function ( text ) {
  // used to send info and usage recommendations
  // to the developer.
  console.log( '[miru][INFO]: ' + text )
} )

let _reloadTimeout
function triggerReload () {
  clearTimeout( _reloadTimeout )
  _reloadTimeout = setTimeout( function () {
    window.location.reload()
  }, 16 )
}

socket.on( 'reload', function ( evt ) {
  console.log( '[miru] reloading the page now!' )
  triggerReload()
} )

socket.on( 'target-build', function ( evt ) {
  console.log( '[miru] target-build' )

  // console.log( 'forceReload: ' + window.__miru.forceReload )

  if ( window.__miru.forceReload ) {
    console.log( '[miru] forcing reload!' )
    return triggerReload()
  }

  var target = ( evt.target || '' )

  var basename = (
    target
      .split( '/' )
      .filter( function ( f ) { return f.trim() } )
      .pop()
  )

  delete window.__miru.terminalErrors[ basename ]

  // clear modal if all errors have been cleared
  setTimeout( function () {
    var keys = Object.keys( window.__miru.terminalErrors )
    if ( keys.length === 0 ) {
      console.log( 'clearing modal' )
      modal.update()
    } else {
      console.log( 'old errors still active' )
      var errFn = window.__miru.terminalErrors[ keys[ 0 ] ]

      if ( errFn ) {
        errFn()
      }
    }
  }, 16 )

  var links = document.querySelectorAll( 'link' )
  var styles = (
    [].filter.call( links, function ( el ) {
      return (
        ( typeof el.href === 'string' ) &&
        ( el.href.indexOf( basename ) >= 0 )
      )
    } )
  )

  if ( styles.length > 0 ) {
    // matched a link tag ( style )
    console.log( '[miru] found matching style tags -- refreshing styles [ ' + styles.length + ' ]' )

    if ( window.__miru.styleFlicker ) {
      /*
      * By unloading the previous styles and delaying the
      * reload slightly will force the styles to fully reload
      * and reset -- usually you can just simply overwrite
      * the style.href directly but certain things like
      * animations and transformation may reload and/or
      * take effect.
      */
      ;[].forEach.call( styles, function ( el ) {
        // save the new href into memory while we unload the current one
        el.__miru_href = (
          el.href.split( '?' )[ 0 ] + '?cachebuster=' + Date.now()
        )

        el.href = '' // unload the previous styles
      } )

      var background = document.documentElement.style.background
      // make sure the background flickers white to easily
      // see that the styles were refreshed
      // document.documentElement.style.background = 'gray'

      setTimeout( function () {
        ;[].forEach.call( styles, function ( el ) {
          el.href = el.__miru_href
          delete el.__miru_href
        } )

        // setTimeout( function () {
        //   document.documentElement.style.background = background
        // }, 33 )
      }, 0 )
    } else {
      /*
       * With directly re-setting the href the css will reload
       * but there are 2 caveats
       *  1. The style reload is instant and may be hard to detect
       *     if the style has actually reloaded.
       *  2. Certain things will not be reloaded such as
       *     certain animation or animation keyframes.
       */
      ;[].forEach.call( styles, function ( el ) {
        el.href = (
          el.href.split( '?' )[ 0 ] + '?cachebuster=' + Date.now()
        )
      } )
    }

    return
  }

  var scripts = document.querySelectorAll( 'script' )
  var script = (
    [].filter.call( scripts, function ( el ) {
      return (
        ( typeof el.src === 'string' ) &&
        ( el.src.indexOf( basename ) >= 0 )
      )
    } )[ 0 ]
  )

  if ( script ) {
    console.log( '[miru] found matching script tag -- reloading page' )
    clearTimeout( _reloadTimeout )
    _reloadTimeout = setTimeout( function () {
      window.location.reload()
    }, 16 )

    return
  }

  console.log('[miru] no matches found -- reloading page' )
  clearTimeout( _reloadTimeout )
  _reloadTimeout = setTimeout( function () {
    window.location.reload()
  }, 16 )
} )

socket.on( 'terminal-error', function ( error ) {
  handleError( error )
} )

socket.on( 'pesticide', function ( isEnabled ) {
  pesticide.update( isEnabled )
} )

socket.on( 'cssreload', function ( isEnabled ) {
  window.__miru.forceReload = !!isEnabled
} )

let _lastErrorTimestamp = 0
let _handleErrorAttempts = 0
export function handleError ( err ) {
  if ( err.timestamp <= _lastErrorTimestamp ) {
    // console.log( 'ignoring old error' )
    return // ignore same errors
  }
  _lastErrorTimestamp = err.timestamp

  _handleErrorAttempts++

  if ( !_connected ) {
    let timeout = ( _handleErrorAttempts + 1 )
    if ( timeout > 100 ) timeout = 100

    return setTimeout( function () {
      console.log( '[miru] not connected yet' )
      handleError( err )
    }, timeout )
  }

  _handleErrorAttempts = 0 // reset attempts

  let _text = ( err.message || err.output || err.err || err.text || err )

  _text += '\n'

  // console.log( ' === TERMINAL ERROR ' )
  // console.log( err.message )
  // console.log( err.output )
  // console.log( ' ===            === ' )

  let html = stripAnsi( ansiToHtml( _text ) )

  var fn = function () {
    // update the modal with html content
    modal.update( {
      name: 'Terminal Error',
      text: _text
      // html: html
    } )
  }
  fn.error = err

  if ( err.target ) {
    var basename = (
      err.target
        .split( '/' )
        .filter( function ( f ) { return f.trim() } )
        .pop()
    )
    console.log( '[miru] error.target basename: ' + basename )
    window.__miru.terminalErrors[ basename ] = fn
  }

  fn()
}
