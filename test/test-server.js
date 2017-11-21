const cp = require( 'child_process' )

var path = require( 'path' )

var miruPath = path.join( __dirname, '..', 'index.js' )
var publicPath = path.join( __dirname, 'stage' )

const spawn = cp.spawn(
  'node',
  [
    miruPath,
    '-p', publicPath,
    '-e', 'npm run watch:stage',
    '-w', 'bundle.js'
  ]
)

spawn.stdout.on( 'data', out )
spawn.stderr.on( 'data', out )

process.on( 'exit', function () {
  try {
    spawn && spawn.kill()
  } catch ( err ) { /* ignore*/ }
} )

let log = ''
function out ( chunk ) {
  let msg = chunk.toString( 'utf8' )
  log += msg

  console.log( msg )
}
