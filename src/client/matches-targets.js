/*
 * Used to check if a given filename matches
 * that of supplied argument variables during miru start.
 *
 * Usually a bundle.js or bundle.css file.
 *
 * This way we avoid parsing errors for files
 * that we are not developing against.
 */
export default function matchesTarget ( filename ) {
  var matchesTarget = false

  if ( typeof filepath !== 'string' ) return false

  window.__miru.targets.forEach( function ( filepath ) {
    var split = filepath.split( /[/\\]/ )
    for ( let i = split.length; i > 0; --i ) {
      var last = split[ i  - 1 ].trim()
      if ( last && last.length > 1 ) {
        i = 0
        if ( filename.indexOf( last ) > 0 ) {
          console.log( '[miru] matches: ' + last )
          matchesTarget = true
        }
      }
    }
  } )

  return matchesTarget
}
