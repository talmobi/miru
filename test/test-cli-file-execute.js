const test = require( 'tape' )

// const cp = {
//   spawn: require( 'spawn-command-with-kill' )
// }

const cp = require( 'child_process' )
const kill = require( 'tree-kill' )
// var crossSpawn = require( 'cross-spawn-with-kill' )

const fs = require( 'fs' )
const path = require( 'path' )

const rimraf = require( 'rimraf' )
const cpy = require( 'cpy' )

const miruPath = path.join( __dirname, '..', 'srccli.js' )
const publicPath = path.join( __dirname, 'stage' )

let spawns = []

require( './on-exit.js' )( function () {
  kill( process.pid )
} )

// https://github.com/chalk/ansi-regex
const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-PRZcf-nqry=><]/g
function stripAnsi ( str ) {
  return str.replace( ansiRegex, '' )
}

function prepareStage ( done ) {
  rimraf(
    path.join( __dirname, 'stage/*' ),
    function ( err ) {
      if ( err ) return done( err )

      cpy(
        path.join( __dirname, 'src', 'app0/*' ),
        path.join( __dirname, 'stage' )
      )
      .then( function () {
        done()
      } )
      .catch( function ( err ) {
        done( err )
      } )
    }
  )
}

test( 'test -f,--file and -e,--execute', function ( t ) {
  t.timeoutAfter( 1000 * 25 )
  t.plan( 7 )

  prepareStage( function ( err ) {
    t.error( err, 'stage prepared without errors' )

    const spawn = cp.spawn(
      miruPath,
      [
        '-P', 40666,
        '-p', `${ publicPath }`,
        '-f', `${ path.join( publicPath, 'app.js' ) }`,
        '-e', 'echo "giraffes are great"'
      ]
    )
    spawns.push( spawn )

    // console.log( 'process PID: ' + process.pid )
    // console.log( 'spawn PID: ' + spawn.pid )

    var exited = false
    spawn.on( 'exit', function () {
      if ( !exited ) {
        console.log( 'spawn exited.' )
        t.pass( 'spawn exited' )
        t.end()
      }
    } )

    spawn.stdout.on( 'data', out )
    spawn.stderr.on( 'data', out )

    let log = ''
    function out ( chunk ) {
      let msg = chunk.toString( 'utf8' )
      log += msg

      // console.log( msg )

      if ( msg.indexOf( 'no need for server' ) >= 0 ) {
        setTimeout( function () {
          triggerFile(
            function () {
              end()
            }
          )
        }, 1000 * 1 )
      }

      if ( _stdoutTriggerCallback ) {
        var fn = _stdoutTriggerCallback
        _stdoutTriggerCallback = undefined

        setTimeout( function () {
          fn()
        }, 1000 * 2 ) // TODO unsure of this timeout, dynamically set through arg?
      }
    }

    let _stdoutTriggerCallback
    function _triggerOnStdout ( callback ) {
      _stdoutTriggerCallback = callback
    }

    function triggerFile ( done ) {
      // rewrite file to trigger file watcher and target-build event
      var text = fs.readFileSync( path.join( __dirname, 'stage', 'app.js' ), 'utf8' )
      fs.writeFileSync( path.join( __dirname, 'stage', 'app.js' ), text, 'utf8' )

      _triggerOnStdout( done )
    }

    function end () {
      t.ok(
        stripAnsi( log ).indexOf( 'server not started' ) >= 0,
        'server not started ( no targets, only files and executions )'
      )

      t.ok(
        stripAnsi( log ).indexOf( 'command: echo \"giraffes are great\"' ) >= 0,
        'command log OK'
      )

      t.ok(
        stripAnsi( log ).indexOf( 'executing: echo \"giraffes are great\"' ) >= 0,
        'executing log OK'
      )

      t.ok(
        stripAnsi( log ).indexOf( '\ngiraffes are great' ) >= 0,
        'echo output correct'
      )

      t.ok(
        stripAnsi( log ).indexOf( 'number of --files watched: 1' ) >= 0,
        'number of --files correct'
      )

      // spawn.kill()
      // process.kill( spawn.pid )
      kill( spawn.pid )
    }
  } )
} )
