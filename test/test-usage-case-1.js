const test = require( 'tape' )
const puppeteer = require( 'puppeteer' )

const cp = require( 'child_process' )
const kill = require( 'tree-kill' )

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

// debug
var console = {
  log: function () {
  }
}

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
        const opts = {
          headless: true,
          args: [ '--no-sandbox' ]
        }

        browser = await puppeteer.launch( opts )
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

      const rootInnerHTML = await page.evaluate( function () {
        return document.getElementById( 'root' ).innerHTML
      } )

      t.ok(
        rootInnerHTML.indexOf( 'whale' ) >= 0,
        'root content is whale still OK!'
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

    async function updateCss () {
      // reset log
      console.log( 'clearing log' )
      log = ''

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
    }

    async function checkCss () {
      t.ok(
        stripAnsi( log ).indexOf( 'compiled' ) >= 0,
        'app.styl compiled OK!'
      )

      t.ok(
        stripAnsi( log ).indexOf( '(file change detected) broadcasting: test/stage/bundle.css' ) >= 0,
        'app.styl target-build watch OK!'
      )

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
      }, 1000 * 2 )
    }

    function jsError () {
      // rewrite file with syntax error in it
      var text = fs.readFileSync( path.join( __dirname, 'src', 'pup2', 'app.js' ), 'utf8' )
      fs.writeFileSync( path.join( __dirname, 'stage', 'app.js' ), text, 'utf8' )

      setTimeout( function () {
        jsErrorCheck()
      }, 1000 * 3 )
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
      }, 1000 * 2 )
    }

    function cssError () {
      // rewrite file with syntax error in it
      var text = fs.readFileSync( path.join( __dirname, 'src', 'pup2', 'app.styl' ), 'utf8' )
      fs.writeFileSync( path.join( __dirname, 'stage', 'app.styl' ), text, 'utf8' )

      setTimeout( function () {
        cssErrorCheck()
      }, 1000 * 3 )
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

      setTimeout( function () {
        startFixes()
      }, 1000 * 2 )
    }

    async function startFixes () {
      // check current css result
      const backgroundColor = await page.evaluate( function () {
        return window.getComputedStyle(
          document.body
        )[ 'background-color' ]
      } )

      // salmon rgba -> rgb(250, 128, 114)

      t.equal(
        backgroundColor,
        'rgb(250, 128, 114)',
        'body background-color was salmon OK!'
      )

      // check current js result
      const rootInnerHTML = await page.evaluate( function () {
        return document.getElementById( 'root' ).innerHTML
      } )

      console.log( rootInnerHTML )

      t.ok(
        rootInnerHTML.indexOf( 'whale' ) >= 0,
        'root content is whale still OK!'
      )

      // fix js
      fixJs()
    }

    function fixJs () {
      // reset log
      log = ''

      // rewrite with fix
      var text = fs.readFileSync( path.join( __dirname, 'src', 'pup3', 'app.js' ), 'utf8' )
      fs.writeFileSync( path.join( __dirname, 'stage', 'app.js' ), text, 'utf8' )

      setTimeout( function () {
        checkFixJs()
      }, 1000 * 2 )
    }

    async function checkFixJs () {
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

      // critical check that the content has updated successfully
      const rootInnerHTML = await page.evaluate( function () {
        return document.getElementById( 'root' ).innerHTML
      } )

      t.ok(
        rootInnerHTML.indexOf( '猿が一番だ！' ) >= 0,
        'root content was changed OK!'
      )

      fixCss()
    }

    function fixCss () {
      // reset log
      log = ''

      // rewrite with fix
      var text = fs.readFileSync( path.join( __dirname, 'src', 'pup3', 'app.styl' ), 'utf8' )
      fs.writeFileSync( path.join( __dirname, 'stage', 'app.styl' ), text, 'utf8' )

      setTimeout( function () {
        checkFixCss()
      }, 1000 * 2 )
    }

    async function checkFixCss () {
      t.ok(
        stripAnsi( log ).indexOf( 'compiled' ) >= 0,
        'app.styl compiled OK!'
      )

      t.ok(
        stripAnsi( log ).indexOf( '(file change detected) broadcasting: test/stage/bundle.css' ) >= 0,
        'app.styl target-build watch OK!'
      )

      const backgroundColor = await page.evaluate( function () {
        return window.getComputedStyle(
          document.body
        )[ 'background-color' ]
      } )

      // salmon rgba -> rgb(250, 128, 114)

      t.equal(
        backgroundColor,
        'rgb(0, 0, 255)',
        'body background-color was blue OK!'
      )

      end()
    }

    function end () {
      // spawn.kill()
      kill( spawn.pid )
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
