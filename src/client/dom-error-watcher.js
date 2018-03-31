// grab dom errors
import UID from './uid.js'
import modal from './modal.js'
import ansiToHtml from './ansi-to-html.js'
import stripAnsi from './strip-ansi.js'
import matchesTargets from './matches-targets.js'
import getFile from './dom-get-file.js'

import dasu from 'dasu'

import { HOST, PORT, URI } from './config.js'

window.addEventListener( 'error', function ( domError ) {
  var message = domError.message
  var filename = domError.filename
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

      // console.log( 'emitting "woosterify"...' )
      dasu.req( {
        method: 'POST',
        protocol: 'http',
        host: window.location.hostname,
        port: PORT,
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
          window.__miru.debug( '[miru] got woosterified ( DOM Error parsed through wooster )' )

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
        }
      } )
    } // attempt
  } ) // getFile
} ) // window.addEventListener

