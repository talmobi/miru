import UID from './uid.js'
import modal from './modal.js'
import ansiToHtml from './ansi-to-html.js'
import stripAnsi from './strip-ansi.js'
import matchesTargets from './matches-targets.js'

import getFile from './dom-get-file.js'

// ref: https://stackoverflow.com/questions/8000009/is-there-a-way-in-javascript-to-listen-console-events
// this method will proxy your custom method with the original one
function proxy( context, method, callback ) {
  return function () {
    var args = [].slice.apply( arguments )

    // do something
    var newArgs = callback( args )

    // patch and run the original
    method.apply(
      context,
      newArgs
    )
  }
}

window.__miru.logs = []
window.__miru.debug = console.log

if ( !window.__miru.verbose ) {
  window.__miru.debug = function () {}
}

window.__miru._console = Object.assign( {}, console )

/*
 * overwrite console methods ( log, error, warn )
 * with our custom proxy
 */
console.log = proxy( console, console.log, function ( args ) {
  push( {
    type: 'log',
    args: args,
    timestamp: Date.now()
  } )
  return args
} )

console.error = proxy( console, console.error, function ( args ) {
  push( {
    type: 'error',
    args: args,
    timestamp: Date.now()
  } )
  return args
} )

console.warn = proxy( console, console.warn, function ( args ) {
  push( {
    type: 'warn',
    args: args,
    timestamp: Date.now()
  } )
  return args
} )

function push ( data ) {
  window.__miru.logs.push( data )

  if ( window.__miru.logs.length > 300 ) {
    window.__miru.logs = window.__miru.logs.slice( -120 )
  }

  sendLogs()
}

var sendLogsTimeout
var sendLogsDebounceTime = 500
var sendLogsLastSentTime = Date.now()
function sendLogs () {
  var now = Date.now()
  clearTimeout( sendLogsTimeout )

  var timeout = sendLogsDebounceTime

  var delta = ( now - sendLogsLastSentTime )
  if ( delta > 1500 ) timeout = 0

  sendLogsTimeout = setTimeout( function () {
    window.__miru.debug( '[miru] logs sent' )
    sendLogsLastSentTime = Date.now()
    window.__miru.socket.emit( 'console', {
      host: window.location.host,
      ua: window.navigator.userAgent,
      logs: window.__miru.logs.slice( -100 ) // send last 100 logs
    } )
  }, timeout )
}