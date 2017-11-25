import './polyfills.js'

import * as pesticide from './pesticide.js'

import './dom-error-watcher.js'
import './dom-console-watcher.js'
import './net.js'

// attach better monospace font if possible
// the error modal.js uses Monaco ( OSX terminal font ) if available
// otherwise 'Space Mono' or monospace
var fontLinkEl = document.createElement( 'link' )
fontLinkEl.rel = 'stylesheet'
fontLinkEl.href = 'https://fonts.googleapis.com/css?family=Space+Mono'
setTimeout( function () {
  document.head.appendChild( fontLinkEl )
}, 1 )

// process.env.FONT_FAMILY = 'Space Mono' TODO ? unnecessary?

function attemptResize () {
  try {
    var evt = document.createEvent( 'HTMLEvents' )
    evt.initEvent( 'resize', true, false )
    window.dispatchEvent && window.dispatchEvent( evt )
  } catch ( err ) {
    console.log( err )
  }
}

window.addEventListener( 'keyup', function ( evt ) {
  var key = ( evt.keyCode || evt.which )
  switch ( key ) {
    case 117: // F6
    case 118: // F7
    case 119: // F8
      pesticide.togglePesticide()
      break
  }
} )

// TODO keep scroll position
// TODO
