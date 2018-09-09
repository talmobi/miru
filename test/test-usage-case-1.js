const test = require( 'tape' )
const puppeteer = require( 'puppeteer' )

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
        path.join( __dirname, 'src', 'pup1/*' ), // puppeteer test sources
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

test( 'puppeteer', function ( t ) {
  t.timeoutAfter( 1000 * 45 )

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
        startPuppeteer()
      }
    }

    let browser
    let page

    function startPuppeteer () {
      ;( async function () {
        browser = await puppeteer.launch( { headless: true } )
        page = await browser.newPage()

        setTimeout( function () {
          // reset log
          log = ''
          updateJs()
        }, 1000 * 2 )
      } )()
    }

    async function updateJs () {
      // reset log
      console.log( 'clearing log' )
      log = ''

      await page.goto( 'http://localhost:4050' )
      console.log( ' === page opened === ' )

      const bodyInnerHTML = await page.evaluate( function () {
        return document.body.innerHTML
      } )

      t.ok(
        bodyInnerHTML.indexOf( 'whale' ) >= 0,
        'page loaded properly OK!'
      )

      // rewrite file to trigger file watcher and target-build event
      var text = fs.readFileSync( path.join( __dirname, 'stage', 'app.js' ), 'utf8' )
      fs.writeFileSync( path.join( __dirname, 'stage', 'app.js' ), text, 'utf8' )

      setTimeout( function () {
        checkJs()
      }, 1000 * 2 )
    }

    function checkJs () {
      t.ok(
        stripAnsi( log ).indexOf( 'bytes written' ) >= 0,
        'app.js bytes written OK!'
      )

      t.ok(
        stripAnsi( log ).indexOf( '(stdout regex matched) broadcasting: test/stage/bundle.js' ) >= 0,
        'app.js target-build watch OK!'
      )

      t.ok(
        stripAnsi( log ).indexOf( 'client connected' ) >= 0,
        'client connected aka reload was successful'
      )

      updateCss()
    }

    function updateCss () {
      // reset log
      console.log( 'clearing log' )
      log = ''

      ;( async function () {
        const headInnerHTML = await page.evaluate( function () {
          return document.head.innerHTML
        } )

        console.log( headInnerHTML )

        t.ok(
          headInnerHTML.indexOf( 'bundle.css?cachebuster=' ) === -1,
          'css not refreshed yet OK!'
        )

        // rewrite file to trigger file watcher and target-build event
        var text = fs.readFileSync( path.join( __dirname, 'stage', 'app.styl' ), 'utf8' )
        fs.writeFileSync( path.join( __dirname, 'stage', 'app.styl' ), text, 'utf8' )

        setTimeout( function () {
          checkCss()
        }, 1000 * 2 )
      } )()
    }

    function checkCss () {
      t.ok(
        stripAnsi( log ).indexOf( 'compiled' ) >= 0,
        'app.styl compiled OK!'
      )

      t.ok(
        stripAnsi( log ).indexOf( '(file change detected) broadcasting: test/stage/bundle.css' ) >= 0,
        'app.styl target-build watch OK!'
      )

      ;( async function () {
        const headInnerHTML = await page.evaluate( function () {
          return document.head.innerHTML
        } )

        // css was refreshed
        t.ok(
          headInnerHTML.indexOf( 'bundle.css?cachebuster=' ) >= 0,
          'css refreshed!'
        )

        setTimeout( function () {
          jsError()
        }, 1000 )
      } )()
    }

    function jsError () {
      // rewrite file with syntax error in it
      var text = fs.readFileSync( path.join( __dirname, 'src', 'pup2', 'app.js' ), 'utf8' )
      fs.writeFileSync( path.join( __dirname, 'stage', 'app.js' ), text, 'utf8' )

      setTimeout( function () {
        jsErrorCheck()
      }, 1000 * 1 )
    }

    function jsErrorCheck () {
      t.ok(
        stripAnsi( log ).indexOf( 'SyntaxError:  ./tes/sta/app.js: Unexpected token' ) >= 0,
        'app.js SyntaxError OK!'
      )

      t.ok(
        stripAnsi( log ).indexOf( '@  ./test/stage/app.js 4:22' ) >= 0,
        'app.js wooster source file OK!'
      )

      t.ok(
        stripAnsi( log ).indexOf( `> 4 | el.innerHTML = 'whale':` ) >= 0,
        'app.js wooster context OK!'
      )

      setTimeout( function () {
        cssError()
      }, 1000 * 1 )
    }

    function cssError () {
      // rewrite file with syntax error in it
      var text = fs.readFileSync( path.join( __dirname, 'src', 'pup2', 'app.styl' ), 'utf8' )
      fs.writeFileSync( path.join( __dirname, 'stage', 'app.styl' ), text, 'utf8' )

      setTimeout( function () {
        cssErrorCheck()
      }, 1000 * 1 )
    }

    function cssErrorCheck () {
      t.ok(
        stripAnsi( log ).indexOf( 'TypeError:  ./tes/sta/app.styl:4:21' ) >= 0,
        'app.styl error detected and reported OK!'
      )

      t.ok(
        stripAnsi( log ).indexOf( '@  ./test/stage/app.styl 4:21' ) >= 0,
        'app.styl wooster source file OK!'
      )

      t.ok(
        stripAnsi( log ).indexOf( '> 4 |   background: salmon%' ) >= 0,
        'app.styl wooster context OK!'
      )

      end()
    }

    function end () {
      // TODO fix the app errors and expect changes to appear
      // in the DOM ( styles and javascript )

      spawn.kill()
    }

    spawn.on( 'exit', async function () {
      console.log( 'spawn exited.' )

      console.log( 'closing browser...' )
      await browser.close()
      console.log( 'browser closed.' )

      t.end()
    } )
  } )
} )
