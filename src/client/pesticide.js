const storage = require( './storage.js' )

import { HOST, PORT, URI } from './config.js'

const PESTICIDE_ID = '__miru-pesticide-id'
const PESTICIDE_URL = ( URI + '/__miru/pesticide.css' )

export default {
  savePesticideStatus,
  enablePesticide,
  disablePesticide,
  togglePesticide
}

export function savePesticideStatus () {
  var el = document.getElementById( PESTICIDE_ID )

  var enabled = !!el

  storage.save( '__miru-pesticide-enabled', enabled )
  console.log( '[miru] saved pesticide, enabled: ' + enabled )
}

export function enablePesticide () {
  var el = document.getElementById( PESTICIDE_ID )

  var now = Date.now()
  var cachebuster = '?cachebuster=' + now
  var href = PESTICIDE_URL + cachebuster

  if ( !el ) {
    console.log( '[miru] adding pesticide' )
    var linkEl = document.createElement( 'link' )
    linkEl.id = PESTICIDE_ID
    linkEl.rel = 'stylesheet'
    linkEl.href = href
    document.head.appendChild( linkEl )
  }
}

export function disablePesticide () {
  var el = document.getElementById( PESTICIDE_ID )
  if ( el ) {
    console.log( '[miru] removing pesticide' )
    el.parentNode.removeChild( el )
  }
}

export function togglePesticide () {
  var el = document.getElementById( PESTICIDE_ID )
  if ( el ) {
    disablePesticide()
  } else {
    enablePesticide()
  }
}
