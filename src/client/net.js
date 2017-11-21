import modal from './modal.js'
import ansiToHtml from './ansi-to-html.js'
import stripAnsi from './strip-ansi.js'

import * as pesticide from './pesticide.js'

import io from 'socket.io-client'

import { HOST, PORT, URI } from './config.js'

console.log( '[miru] socket connecting to: ' + URI )
let socket = io( URI )

window.__miru.terminalErrors = {}
let _connected = false

socket.on( 'connect', function () {
  // should already be set by IIFE concated to the head of miru-connect.js
  window.__miru = ( window.__miru || {} )
  window.__miru.socket = socket

  console.log( '[miru] socket connected to: ' + socket.io.uri )
  _connected = true
  window.__miru.connected = true
} )

socket.on( 'disconnect', function () {
  _connected = false
  window.__miru.connected = false
} )

let _reloadTimeout
socket.on( 'reload', function ( evt ) {
  console.log( '[miru] reloading the page now!' )

  clearTimeout( _reloadTimeout )
  _reloadTimeout = setTimeout( function () {
    window.location.reload()
  }, 16 )
} )

socket.on( 'success', function ( evt ) {
  console.log( '[miru] success' )
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

  var styles = document.querySelectorAll( 'link' )
  var style = (
    [].filter.call( styles, function ( el ) {
      return ( el.href.indexOf( basename ) >= 0 )
    } )[ 0 ]
  )

  if ( style ) {
    // matched a link tag ( style )
    console.log( '[miru] found matching style tag -- refreshing styles' )

    var href = style.href // remember the href

    if ( window.__miru.styleFlicker ) {
      /*
      * By unloading the previous styles and delaying the
      * reload slightly will force the styles to fully reload
      * and reset -- usually you can just simply overwrite
      * the style.href directly but certain things like
      * animations and transformation may reload and/or
      * take effect.
      */
      style.href = '' // unload the previous styles first

      var background = document.documentElement.style.background
      // make sure the background flickers white to easily
      // see that the styles were refreshed
      // document.documentElement.style.background = 'gray'

      setTimeout( function () {
        style.href = (
          href.split( '?' )[ 0 ] + '?cachebuster=' + Date.now()
        )

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
      style.href = (
        href.split( '?' )[ 0 ] + '?cachebuster=' + Date.now()
      )
    }

    return
  }

  var scripts = document.querySelectorAll( 'script' )
  var script = (
    [].filter.call( scripts, function ( el ) {
      return ( el.src.indexOf( basename ) >= 0 )
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

socket.on( 'pesticide', function ( enable ) {
  if ( enable ) {
    pesticide.enablePesticide()
  } else {
    pesticide.disablePesticide()
  }
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

  let html = stripAnsi( ansiToHtml( _text ) )

  var fn = function () {
    // updat the modal with html content
    modal.update( {
      name: 'Terminal Error',
      text: html
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