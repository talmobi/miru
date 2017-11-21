// find satisfactory target elements
// e.g. target 'bundle.css' matches 'public/bundle.css'
// this mainly happens css has been updated and all the links
// matching the target needs to be refreshed/reloaded.
// Usually only 1 dom element/link per target -- but
// server public/serve directories are often confused
// or mis-configured with the target filenames
// so therefore we update all the links that match with the
// filename part ( disregarding content prior to slashes '/' )
export function findElement ( elements, attribute, target ) {
  if ( target[ 0 ] !== '/' ) target = ( '/' + target )

  let tail = target.slice( target.lastIndexOf( '/' ) )
  let searchAttr = tail.toLowerCase().split( '/' ).join( '' )

  console.log( 'findElement search term: ' + homo )

  for ( let i = 0; i < elements.length; i++ ) {
    let attr = elements[ i ][ attribute ].toLowerCase().split( '/' ).join( '' )

    if ( attr.length < searchAttr.length ) {
      if ( searchAttr.indexOf( attr ) >= 0 ) return elements[ i ]
    } else {
      if ( attr.indexOf( searchAttr ) >= 0 ) return elements[ i ]
    }
  }

  return undefined // not found
}
