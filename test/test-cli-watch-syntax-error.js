const test = require( 'tape' )

const cp = require( 'child_process' )

const fs = require( 'fs' )
const path = require( 'path' )

const rimraf = require( 'rimraf' )
const cpy = require( 'cpy' )

const miruPath = path.join( __dirname, '..', 'srccli.js' )
const publicPath = path.join( __dirname, 'stage' )

let spawns = []

process.on( 'exit', function () {
  try {
    spawn && spawn.kill()
  } catch ( err ) { /* ignore*/ }
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
        path.join( __dirname, 'src', 'app1/*' ),
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

test( 'test -w,--watch with syntax error reporting', function ( t ) {
  t.timeoutAfter( 1000 * 20 )

  prepareStage( function ( err ) {
    t.error( err, 'stage prepared without errors' )

    const spawn = cp.spawn(
      'npm',
      [
        'run', 'watch:stage'
      ]
    )
    spawns.push( spawn )

    spawn.stdout.on( 'data', out )
    spawn.stderr.on( 'data', out )

    let log = ''
    function out ( chunk ) {
      let msg = chunk.toString( 'utf8' )
      log += msg

      // console.log( msg )

      if ( msg.indexOf( 'server listening' ) >= 0 ) {
        setTimeout( function () {
          triggerFile(
            function () {
              end()
            }
          )
        }, 1000 * 1 )
      }
    }

    function triggerFile ( done ) {
      // reset log
      // console.log( 'clearing log' )
      log = ''

      // rewrite file to trigger file watcher and target-build event
      var text = fs.readFileSync( path.join( __dirname, 'stage', 'app.js' ), 'utf8' )
      fs.writeFileSync( path.join( __dirname, 'stage', 'app.js' ), text, 'utf8' )

      setTimeout( function () {
        // rewrite file to trigger file watcher and target-build event
        var text = fs.readFileSync( path.join( __dirname, 'stage', 'app.styl' ), 'utf8' )
        fs.writeFileSync( path.join( __dirname, 'stage', 'app.styl' ), text, 'utf8' )

        setTimeout( function () {
          start()
        }, 1000 * 2 )
      }, 1000 * 2 )
    }

    function start () {
      t.ok(
        stripAnsi( log ).indexOf( 'bytes written' ) > 0,
        'app.js bytes written OK!'
      )

      t.ok(
        stripAnsi( log ).indexOf( '(stdout regex matched) broadcasting: test/stage/bundle.js' ) > 0,
        'app.js target-build watch OK!'
      )

      t.ok(
        stripAnsi( log ).indexOf( 'compiled' ) > 0,
        'app.css compiled OK!'
      )

      t.ok(
        stripAnsi( log ).indexOf( '(file change detected) broadcasting: test/stage/bundle.css' ) > 0,
        'app.css target-build watch OK!'
      )

      // reset log
      log = ''

      // introduce syntax errors to source files
      setTimeout( function () {
        jsError()
      }, 1000 * 3 )
    }

    function jsError () {
      // rewrite file with syntax error in it
      var text = fs.readFileSync( path.join( __dirname, 'src', 'app2', 'app.js' ), 'utf8' )
      fs.writeFileSync( path.join( __dirname, 'stage', 'app.js' ), text, 'utf8' )

      setTimeout( function () {
        cssError()
      }, 1000 * 1 )
    }

    function cssError () {
      // rewrite file with syntax error in it
      var text = fs.readFileSync( path.join( __dirname, 'src', 'app2', 'app.styl' ), 'utf8' )
      fs.writeFileSync( path.join( __dirname, 'stage', 'app.styl' ), text, 'utf8' )

      setTimeout( function () {
        end()
      }, 1000 * 1 )
    }

    function end () {
      t.ok(
        stripAnsi( log ).indexOf( 'SyntaxError:  ./tes/sta/app.js: Unexpected token' ) > 0,
        'app.js SyntaxError OK!'
      )

      t.ok(
        stripAnsi( log ).indexOf( '@  ./test/stage/app.js 2:20' ) > 0,
        'app.js wooster source file OK!'
      )

      t.ok(
        stripAnsi( log ).indexOf( `> 2 | var text = 'giraffe':` ) > 0,
        'app.js wooster context OK!'
      )

      t.ok(
        stripAnsi( log ).indexOf( 'TypeError:  ./tes/sta/app.styl:2:21' ) > 0,
        'app.styl error detected and reported OK!'
      )

      t.ok(
        stripAnsi( log ).indexOf( '@  ./test/stage/app.styl 2:21' ) > 0,
        'app.styl wooster source file OK!'
      )

      t.ok(
        stripAnsi( log ).indexOf( '> 2 |   background: salmon%' ) > 0,
        'app.styl wooster context OK!'
      )

      spawn.kill()
    }

    spawn.on( 'exit', function () {
      console.log( 'spawn exited.' )
      t.end()
    } )
  } )
} )
