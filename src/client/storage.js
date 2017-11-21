/* gobal window */

var api = {}

api.get = function ( key ) {
  if ( window && window.localStorage ) {
    window.localStorage.getItem( key )
  }
  return undefined
}

api.set = function ( key, data ) {
  if ( window && window.localStorage ) {
    window.localStorage.setItem( key, data )
  }
  return undefined
}

module.exports = api
