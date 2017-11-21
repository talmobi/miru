/* gobal window */

var api = {}

api.get = function ( key ) {
  if ( window && window.localStorage ) {
    var data = window.localStorage.getItem( key )
    try {
      return JSON.parse( data )
    } catch ( err ) { /* ignore */ }
    return data
  }
  return undefined
}

api.set = function ( key, data ) {
  if ( window && window.localStorage ) {
    if ( typeof data === 'object' ) {
      data = JSON.stringify( data )
    }
    window.localStorage.setItem( key, data )
  }
  return undefined
}
api.save = api.set

module.exports = api
