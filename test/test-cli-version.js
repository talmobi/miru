const test = require( 'tape' )

const cp = require( 'child_process' )

const fs = require( 'fs' )
const path = require( 'path' )

const miruPath = path.join( __dirname, '..', 'srccli.js' )
const publicPath = path.join( __dirname, 'test/stage' )

let spawns = []

process.on( 'exit', function () {
  try {
    spawn && spawn.kill()
  } catch ( err ) { /* ignore*/ }
} )

const pkgj = require( '../package.json' )

test( 'miru --version', function ( t ) {
  t.timeoutAfter( 3000 )

  const spawn = cp.spawn(
    miruPath,
    `
    --version
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
      'miru version: ' + pkgj.version,
      'cli --version OK!'
    )

    t.end()
  } )
} )

test( 'miru -V', function ( t ) {
  t.timeoutAfter( 3000 )

  const spawn = cp.spawn(
    miruPath,
    `
    -V
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
      'miru version: ' + pkgj.version,
      'cli -V OK!'
    )

    t.end()
  } )
} )
