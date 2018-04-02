/*
 * Used to download <script> src file during a DOM Error.
 * The src file is then sent to the miru server which then
 * parses the contents of that file with wooster and
 * returns the output back to the client/DOM.
 */
export default function getFile ( filename, callback ) {
  window.__miru.debug( '  << [miru] << requesting file... ' + filename )
  var req = new XMLHttpRequest()
  req.open( 'GET', filename, true )

  req.onload = function () {
    window.__miru.debug( '  >> [miru] >> file received! ' + filename )
    window.__miru.debug( '  >> [miru] >> status: ' + req.status )

    if ( req.status >= 200 && req.status < 500 ) {
      // success
      callback( undefined, req.responseText )
    } else {
      // reached server, but error
      callback( 'error: ' + req.status )
    }
  }

  req.onerror = function () {
    // failed to connect to server
    callback( 'error: failed to connect to server' )
  }

  // launch request
  req.send()
}
