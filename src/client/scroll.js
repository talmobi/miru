const storage = require( './storage.js' )

const SCROLL_TOP_ID = '__miru-scroll-top-id'
const MAX_SCROLL_DELTA = 5000

function saveScrollTop () {
  storage.save(
    SCROLL_TOP_ID,
    {
      timestamp: Date.now(),
      scrollTop: document.body.scrollTop
    }
  )
}

function loadScrollTop () {
  let data = storage.get( SCROLL_TOP_ID )
  if ( data ) {
    let delta = ( Date.now() - data.timestamp )
    if ( delta < MAX_SCROLL_DELTA ) {
      document.body.scrollTop = data.scrollTop
    }
  }
}

window.addEventListener( 'load', function () {
  setTimeout( function () {
    loadScrollTop()
  }, 16 )
} )
