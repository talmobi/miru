// grab dom errors
import UID from './uid.js'
import modal from './modal.js'
import ansiToHtml from './ansi-to-html.js'
import stripAnsi from './strip-ansi.js'
import matchesTargets from './matches-targets.js'
import getFile from './dom-get-file.js'

import dasu from 'dasu'


// reset and keep track of DOM Errors after a reload
window.__miru.domErrors = []

function handleDOMError ( domError )
{
  var message = domError.message
  var filename = domError.filename || domError.source
  var lineno = domError.lineno
  var colno = domError.colno

  // handle implicit index.html filenames
  if ( filename && filename[ filename.length - 1 ] === '/' ) {
    filename += 'index.html'
  }

  var span = '( ' + filename + ' ' + lineno + ':' + colno + ' )'
  console.log( '[miru] DOM Error detected: ' + span )
  console.log( domError )

  if ( typeof filename === 'undefined' ) {
    return console.log( 'Unknown DOM Error' )
  }

  getFile( filename, function ( err, text ) {
    if ( err ) {
      return console.log( '[miru] file get error: ' + err )
    }

    if ( !matchesTargets( filename ) ) {
      // skip non-bundle errors
      window.__miru.debug( '[miru] skipping file, did not match targets' )
      return undefined
    }

    var maxAttempts = 100
    var attemptsCount = 0
    var done = false

    var errorId = UID()

    attempt()
    function attempt () {
      if ( attemptsCount % 10 === 0 ) {
        window.__miru.debug(
          '[miru] [' + errorId + '] ' +
          'attempting to woosterify, attempts: ' +
          attemptsCount
        )
      }
      attemptsCount++

      // console.log( 'emitting "woosterify"...' )
      dasu.req( {
        method: 'POST',
        protocol: 'http',
        host: window.location.hostname,
        port: window.__miru.port,
        path: '/__miru/woosterify',
        data: {
          errorId: errorId,
          prettify: true,
          filename: filename,
          message: message,
          text: text,
          lineno: lineno,
          colno: colno
        }
      }, function ( err, res, body ) {
        if ( err ) {
          if ( attemptsCount < maxAttempts ) {
            // console.log( 'not ready, attempting later...' )
            setTimeout( attempt, 5 + attemptsCount )
          } else {
            console.log( '[miru] too many attempts, not sending dom error' )
          }
        } else {
          let data = JSON.parse( body )
          console.log( '[miru] success! ( DOM Error parsed through wooster )' )

          let messages = []

          // transform ansi text to html
          let html = stripAnsi( ansiToHtml( data.message ) )

          messages.push( {
            name: '',
            text: data.message
          } )

          if ( data.origin ) {
            messages.push( {
              name: '(' + filename + ')',
              text: data.origin
              // text: stripAnsi( ansiToHtml( data.origin ) )
            } )
          }

          var basename = (
            filename
              .split( '/' )
              .filter( function ( f ) { return f.trim() } )
              .pop()
          )
          window.__miru.debug( '[miru] error.target basename: ' + basename )

          // create a helper function to display this error
          // ( for use now and later )
          var fn = function () {
            // update the modal with html content
            modal.update( {
              title: 'DOM Error (' + filename + ')',
              messages: messages
            } )

            // console.log( 'in DOM error function' )
            // console.log( 'miru connection status: ' + window.__miru.connected )
            // console.log( data.message )
            // send the error message we received from the server as is
            // so that it can print it to the terminal at the same time
            // as it is shown in here on the client side error modal UI
            if ( !window.__miru._reloading && window.__miru.socket && window.__miru.connected ) {
              window.__miru.debug( '[miru] sending DOM Error' )
              window.__miru.socket.emit( 'print-dom-error-message', data.message )
            }
          }
          fn.error = data

          window.__miru.debug( '[miru] saving dom error' )
          // save the DOM Error
          window.__miru.domErrors.push({
            basename: basename,
            fn: fn,
            data: data
          })

          // show DOM Error if no terminal errors are currently being shown
          setTimeout( function () {
            var terminalErrorCount = Object.keys( window.__miru.terminalErrors )
            if ( terminalErrorCount.length === 0 ) {
              // no terminal errors -> display the DOM Error now
              // ( terminal errors are more important/relevant
              //   so we don't want them to show up unless all
              //   terminal errors have been cleared )
              fn()
            }
          }, 16 )
        }
      } )
    } // attempt
  } ) // getFile
}

window.addEventListener( 'error', function ( domError ) {
  handleDOMError( domError )
} ) // window.addEventListener

