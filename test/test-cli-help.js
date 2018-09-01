const test = require( 'tape' )

const cp = require( 'child_process' )

var path = require( 'path' )

var miruPath = path.join( __dirname, '..', 'srccli.js' )
var publicPath = path.join( __dirname, 'test/stage' )

const fs = require( 'fs' )
const usage = fs.readFileSync( '../dist/usage.txt', 'utf8' ).trim()

let spawns = []

test( 'miru --help', function ( t ) {
  t.timeoutAfter( 3000 )

  const spawn = cp.spawn(
    miruPath,
    `
    --help
    `.trim().split( /\s+/ )
  )
  spawns.push( spawn )

  spawn.stdout.on( 'data', out )
  spawn.stderr.on( 'data', out )

  let log = ''
  function out ( chunk ) {
    let msg = chunk.toString( 'utf8' )
    log += msg
  }

  spawn.on( 'exit', function () {
    t.equal(
      log.trim(),
      usage,
      'cli --help OK!'
    )

    t.end()
  } )
} )

test( 'miru -h', function ( t ) {
  t.timeoutAfter( 3000 )

  const spawn = cp.spawn(
    miruPath,
    `
    -h
    `.trim().split( /\s+/ )
  )
  spawns.push( spawn )

  spawn.stdout.on( 'data', out )
  spawn.stderr.on( 'data', out )

  let log = ''
  function out ( chunk ) {
    let msg = chunk.toString( 'utf8' )
    log += msg
  }

  spawn.on( 'exit', function () {
    t.equal(
      log.trim(),
      usage,
      'cli -h OK!'
    )

    t.end()
  } )
} )

process.on( 'exit', function () {
  try {
    spawn && spawn.kill()
  } catch ( err ) { /* ignore*/ }
} )

