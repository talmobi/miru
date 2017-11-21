let counter = 0
let size = ( 1 << 16 )

export default function UID () {
  var date = Date.now().toString( 16 ).slice( -10 )
  var rnd = String( Math.floor( Math.random() * size ) )
  return ( 'uid' + date + String( counter++ ) + rnd )
}
