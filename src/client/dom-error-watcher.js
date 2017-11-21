// grab dom errors
import UID from './uid.js'
import modal from './modal.js'
import ansiToHtml from './ansi-to-html.js'
import stripAnsi from './strip-ansi.js'
import matchesTargets from './matches-targets.js'
import getFile from './dom-get-file.js'

window.addEventListener( 'error', function ( domError ) {
  console.log( '[miru] DOM Error detected.' )

  var message = domError.message
  var filename = domError.filename
  var lineno = domError.lineno
  var colno = domError.colno
  console.log( '[miru] dom error' )
  console.log( domError )

  console.log( '[miru] getting file... [' + filename + ']' )
  getFile( filename, function ( err, text ) {
    if ( err ) {
      return console.log( '[miru] file get error: ' + err )
    }

    if ( !matchesTargets( filename ) ) {
      // skip non-bundle errors
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

      if ( window.__miru.socket ) {
        // console.log( 'emitting "woosterify"...' )
        window.__miru.socket.emit( 'woosterify', errorId, {
          prettify: true,
          filename: filename,
          message: message,
          text: text,
          lineno: lineno,
          colno: colno
        }, function ( data ) {
          if ( !done ) {
            done = true
            window.__miru.debug( '[miru] got woosterified ( DOM Error parsed through wooster )' )
            // window.__miruErrorHandler( error )
            // modal.update( error )

            let messages = []

            // transform ansi text to html
            let html = stripAnsi( ansiToHtml( data.message ) )

            messages.push( {
              name: '',
              text: html
            } )

            if ( data.origin ) {
              messages.push( {
                name: '(' + filename + ')',
                text: stripAnsi( ansiToHtml( data.origin ) )
              } )
            }

            var basename = (
              filename
                .split( '/' )
                .filter( function ( f ) { return f.trim() } )
                .pop()
            )
            console.log( '[miru] error.target basename: ' + basename )

            var fn = function () {
              // updat the modal with html content
              modal.update( {
                title: 'DOM Error (' + filename + ')',
                messages: messages
              } )
            }
            fn.error = data
            window.__miru.terminalErrors[ basename ] = fn

            fn()
          } else {
            console.log( '[miru] already woosterified' )
          }

          if ( done === true ) window.__miru.socket.emit( 'ack', errorId )
        } )
      }

      if ( done ) {
      } else {
        if ( attemptsCount < maxAttempts ) {
          // console.log( 'not ready, attempting later...' )
          setTimeout( attempt, 5 + attemptsCount )
        } else {
          console.log( '[miru] too many attempts, not sending dom error' )
        }
      }
    } // attempt
  } ) // getFile
} ) // window.addEventListener

