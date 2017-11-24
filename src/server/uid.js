var counter = 0
var size = ( 1 << 16 )

module.exports = function UID () {
  var date = Date.now().toString( 16 ).slice( -10 )
  var rnd = String( Math.floor( Math.random() * size ) )
  return ( 'uid' + date + String( counter++ ) + rnd )
}

