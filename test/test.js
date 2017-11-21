const test = require( 'tape' )

const fs = require( 'fs' )
const path = require( 'path' )

var rimraf = require( 'rimraf' )
var mkdirp = require( 'mkdirp' )
var ncp = require( 'ncp' ).ncp

function cleanStage ( done ) {
  rimraf(
    path.join( __dirname, 'stage', 'app.js' ),
    function ( err ) {
      if ( err ) throw err

      ncp(
        path.join( __dirname, 'src', 'app.js' ),
        path.join( __dirname, 'stage', 'app.js' ),
        function ( err ) {
          if ( err ) throw err

          done()
        }
      )
    }
  )
}

// TODO app1.js test etc

test( 'succesful build', function ( t ) {
} )
