var os = require( 'os' )

function getNetworkIpAddresses () {
  var interfaces = os.networkInterfaces()
  var addresses = []

  var k, k2
  for ( k in interfaces ) {
    for ( k2 in interfaces[ k ] ) {
      var address = interfaces[ k ][ k2 ]
      if ( address.family === 'IPv4' && !address.internal ) {
        addresses.push( address.address )
      }
    }
  }

  return addresses
}

module.exports = getNetworkIpAddresses
