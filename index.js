'use strict'

var express = require('express')
var cp = require('child_process')

// var miteru = require('miteru')
// var glob = require('glob')

// var chokidar = require('chokidar')
var miteru = require( '/Users/mollie/code/miteru/src/index.js' )

// var wooster = require('wooster')
// var wooster = require('../wooster/snippet.js') // TODO
// var wooster = require('../wooster/dist/bundle.js') // TODO
var wooster = require('../wooster/dist/bundle.min.js') // TODO

var targetWatchers = {}
var recoveryWatchers = {}
var recoveryTimeouts = {}

var __process_exiting = false

var spawns = []
// cleanup
process.on('exit', function () {
  __process_exiting = true
  spawns.forEach(function (spawn) {
    spawn.__enable_auto_recover = false
    try {
      spawn.kill()
    } catch (err) {
    }
  })
})

var clc = require('cli-color')
clc.grey = clc.blackBright
clc.gray = clc.blackBright

var mtimes = {}
var fs = require('fs')

var parseArgs = require('minimist')

var app = express()
var http = require('http')
var server = http.createServer(app)
var io = require('socket.io')(server) // livereload

var path = require('path')

var argv = parseArgs(process.argv.slice(2), {
  alias: {
    'watch': ['w', 'target', 't'],
    'execute': ['e', 'source', 's']
  }
})

var sampleScripts = [
  , '  Sample npm scripts:'
  , ''
  , '    {'
  , '     "scripts": {'
  , '        "webpack:dev": "miru -p public -w bundle.js -w bundle.css -e \'npm run webpack:watch-js\' -e \'npm run watch-css\'",'
  , '        "browserify:dev": "miru -p public -w bundle.js -w bundle.css -e \'npm run browserify:watch-js\' -e \'npm run watch-css\'",'
  , '        "rollup:dev": "miru -p public -w bundle.js -w bundle.css -e \'npm run rollup:watch-js\' -e \'npm run watch-css\'",'
  , ''
  , '        "webpack:build-js": "webpack --config webpack.config.js",'
  , '        "webpack:watch-js": "webpack -w --config webpack.config.js",'
  , ''
  , '        "browserify:build-js": "browserify scripts/app.js -t babelify -o public/bundle.js",'
  , '        "browserify:watch-js": "watchify scripts/app.js -v -t babelify -o public/bundle.js",'
  , ''
  , '        "rollup:build-js": "rollup -c rollup.config.js",'
  , '        "rollup:watch-js": "wrollup -c rollup.config.js",'
  , ''
  , '        "build-css": "stylus -u nib -r styles/app.styl -o public/bundle.css",'
  , '        "watch-css": "stylus -u nib -w -r styles/app.styl -o public/bundle.css",'
  , '     }'
  , '    }'
].join('\n');

var usage = [
    ''
  , '  Usage: miru [options]'
  , ''
  , sampleScripts
  , ''
  , '  Options:'
  , ''
  , '    -p, --path <dir>               Specify path (current directory by default)'
  , '                                   Usually path to public directory.'
  , ''
  , '                                   This is also the path where miru creates "miru.init.js"'
  , '                                   which you should <script src="miru.init.js"> on your html'
  , '                                   page to enable live reloads and error reporting directly'
  , '                                   within the page/browser.'
  , ''
  , '                                   ![Required]'
  , '    -w, --watch <file>             Specify path to target output bundle/file to watch'
  , '                                   and keep up to date when live reloading.'
  , ''
  , '                                   Live reloads refresh corresponding <link href="fileName.css">'
  , '                                   or <script src="fileName.js"> tags on the html page where'
  , '                                   <script src="miru.init.js"> is loaded.'
  , ''
  , '                                   "miru.init.js" is created inside the --path directory'
  , '                                   when miru starts'
  , ''
  , '                                   Note! Every -w needs a corresponding -e in the same order'
  , ''
  , '                                   ![Required]'
  , '    -e, --execute <string>         Command (string) to execute with child_process.spawn'
  , '                                   usually an npm script like \'npm run watch-js\''
  , ''
  , '                                   Note! Every -w needs a corresponding -e in the same order'
  , ''
  , '    -t, --target <file>            [Deprecated] alias for [-w, --watch]'
  , '    -s, --source <string>          [Deprecated] alias for [-e, --execute]'
  , ''
  , '    -V, --verbose                  Enable verbose mode'
  , '    --throttle-timeout             Specify throttle timeout (Default 600ms)'
  , ''
  , '    -v, --version                  Display miru version'
  , '    -h, --help                     Display help information'
  , ''
  , '    --sample                       Print out sample npm scripts'
  , ''
].join('\n');

if (!!argv['help'] || !!argv['h']) {
  console.error(usage)
  return undefined // exit success
}

if (!!argv['version'] || !!argv['v']) {
  var packageJson = require('./package.json')
  console.error('miru version: ' + (packageJson['VERSION'] || packageJson['version']))
  return undefined // exit success
}

if (!!argv['sample']) {
  console.log(sampleScripts)
  return undefined // exit success
}

var throttleTimeout = 1000
if (argv['throttle-timeout'] !== undefined) {
  throttleTimeout = Number(argv['throttleTimeout'])
}

// var _targets = Array.isArray(argv.t) ? argv.t || [argv.t]
// var _scripts = Array.isArray(argv.s) ? argv.s || [argv.s]

var opts = {
  publicPath: argv.p || argv.path || argv.public || argv.root || '.',
  targets: (typeof argv.watch === 'string') ? [argv.watch] : argv.watch,
  scripts: (typeof argv.execute === 'string') ? [argv.execute] : argv.execute
}

var sourcePath, sourceCode, targetPath
// copy miru.init.js script into the public path
try {
  // make sure we can access public directory
  fs.accessSync(opts.publicPath) // throws an error on failure

  sourcePath = path.join(__dirname, 'miru.init.js') // copy from
  sourceCode = fs.readFileSync(sourcePath, 'utf8') // read contents from
  targetPath = path.join(opts.publicPath, 'miru.init.js') // paste to
  fs.writeFileSync(targetPath, sourceCode, 'utf8') // write contents to
  console.log('miru.init.js file created at [' + targetPath + ']')
} catch (err) {
  var name = path.join(opts.publicPath, 'miru.init.js')
  var msg = 'failed to cteate miru client side initialization script [$1]'
  console.error(msg.replace('$1', name))
  console.error('  --------  ')
  console.error(err)
  throw err
}


// allow CORS
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
})

// access log (console)
app.use(function (req, res, next) { // same as app.use('*', functi...)
  // console.log(req.originalUrl)
  next()
})

// app.use(function () {})

// prioritize public static files
app.use(express.static(opts.publicPath))

// this initialization script is usually served from the projects
// web server (in dev mode) and not by the miru dev itself
// (at least for more complicated apps)
app.get('/miru.init.js', function (req, res, next) {
  res.sendFile(path.join(opts.publicPath, 'miru.init.js'))
})

app.get('/__miru/pesticide.css', function (req, res) {
  // console.log('sending pesticide.css')
  res.header('cache-control', 'private, no-cache, no-store, must-revalidate')
  res.header('expires', '-1')
  res.header('pragma', 'no-cache')
  res.sendFile(path.join(__dirname, 'pesticide.css'))
})

app.get('/__miru/livereload.js', function (req, res) {
  // console.log('sending livereload.js file')
  res.header('cache-control', 'private, no-cache, no-store, must-revalidate')
  res.header('expires', '-1')
  res.header('pragma', 'no-cache')
  res.sendFile(path.join(__dirname, 'livereload.js'))
})

// serve miru page with basic guidelines
app.get('/', function (req, res, next) {
  console.log('no public index.html file found -- serving miru guideline index.html')
  res.sendFile(__dirname + '/index.html')
})

app.use(function (req, res) {
  console.log('warning: 404 -- [$]'.replace('$', req.originalUrl))
  // console.log([
  //   'You seem to be accessing your application directly though the miru',
  //   'web server (miru by default server the -p directory) -- this is not',
  //   'recommended -- please use your own web server'
  // ].join('\n'))
  res.status(404).end()
})

// handle socket.io
io.on('connection', function (socket) {
  console.log('new connection')

  Object.keys( targetHasError ).forEach(function ( target ) {
    if ( targetHasError[ target ] && emittedErrors[ target ] ) {
      console.log( 'emitting error [on connection]' )
      io.emit( 'error', {
        target: target,
        err: emittedErrors[target]
      } )
    }
  })
})

var host = '0.0.0.0'
var port = 4040

var debug = false
var pipe = false

var targetHasError = {}

var flickerDelay = 0
var emitDelay = 5
var iterations = 0
var iterationsLimit = 4

// draw a little progress bar box thing
// to more easily see when a something has changed
// ( instead of looking at the bundle generation timestamp which
// is a bit hard to have a quick glance at )
function getIterationBox (targets) {
  var box = ''
  targets.forEach(function (target) {
    box += clc[getIterationBoxColor(target, true)]('  ')
  })

  iterations = (++iterations % iterationsLimit)
  var msg = ''
  for (var i = 0; i < iterationsLimit; i++) {
    if (i === iterations) {
      msg += box
    } else {
      msg += ('       ')
    }
  }
  return msg
}

// error iteration box
var _iterationBoxErrorCounter = 0
var _iterationBoxErrorCounterLimit = 4
function getErrorIterationBox () {
  _iterationBoxErrorCounter = (_iterationBoxErrorCounter + 1) % _iterationBoxErrorCounterLimit

  var box = ''
  for (var i = 0; i < _iterationBoxErrorCounterLimit; i++) {
    if (i === _iterationBoxErrorCounter) {
      box += clc.bgMagentaBright('  ')
    } else {
      box += '     '
    }
  }

  return box
}

function getIterationBoxColor (target, bg) {
  if (bg) {
    if (target.toLowerCase().indexOf('css') >= 0) return 'bgGreen'
    if (target.toLowerCase().indexOf('js') >= 0) return 'bgBlue'
    return 'bgMagenta'
  } else {
    if (target.toLowerCase().indexOf('css') >= 0) return 'green'
    if (target.toLowerCase().indexOf('js') >= 0) return 'blue'
    return 'magenta'
  }
}

var c = {
  'cyan': '36m',
  'magenta': '35m',
  'blue': '34m',
  'yellow': '33m',
  'green': '32m',
  'red': '31m',
  'gray': '90m',
}

function cc (text, code) {
  return ('\u001b[' + code + text + '\u001b[0m')
}

function clearConsole () {
  var timestring = ( new Date() ).toTimeString().split( ' ' )[ 0 ]
  // console.log( '   - ' + ( timestring ) + ' -   ')

  // This seems to work best on Windows and other systems.
  // The intention is to clear the output so you can focus on most recent build.
  if ( process.env.MIRU_NOCLEAR ) {
    console.log()
    console.log( ' === CLEAR === ' + timestring )
    console.log()
  } else {
    process.stdout.write('\x1bc');
  }
}

var args = process.argv.slice(2)

var verbose = !!(argv['verbose'] || argv['V'])
var debug = verbose

console.log(opts)

opts.targets.forEach(function (target, i) {
  var t = opts.targets[i]
  var s = opts.scripts && opts.scripts[i]

  if ( !t ) throw new Error('no -w target found')
  // if (!t || !s) throw new Error('-w, -e mismatch')

  var t = path.join(opts.publicPath, t)
  watch(t)
  if ( s ) exec(s, t)
})

// send reload/inject to client
var emit_targets = {}
var emit_timeouts = {}
var emit_timeout = undefined
function emit ( target ) {
  // if (emit_timeout === undefined) clearConsole()
  clearTimeout(emit_timeout)

  console.log(clc.yellow('changed in [' + clc.magenta(target) + ']'))

  emit_targets[target] = target // save emitted targets
  targetHasError[target] = false // successful build on target

  emit_timeout = setTimeout( function () {
    emit_timeout = undefined
    clearConsole()
    var addresses = getNetworkIpAddresses()

    var targets = Object.keys(emit_targets)
    emit_targets = {}

    console.log(getIterationBox(targets))
    console.log(
      'host was set to ' + host + ':' + port + '\n' +
      ' -> [%s]', addresses.join(', ')
    )
    console.log()

    targets.forEach(function (target) {
      var color = getIterationBoxColor(target, false)
      var msg = ('modification [' + clc[color](target) + ']')
      console.log(msg + ' [' + clc.cyan(new Date().toLocaleTimeString()) + ']')
      io.emit('modification', target)
    })

    // check if other errors still exist
    var errors = Object.keys( targetHasError )

    for (let i = 0; i < errors.length; i++) {
      let target = errors[i]
      let err = targetHasError[target]

      // TODO
      if ( err ) {
        console.log('remaining error found at target [' + clc.magenta(target) + ']')
        handleError(err, target, true)
        // console.log(err)
      }
    }
  }, emitDelay )
}

var targetStates = {}
function watch ( target ) {
  var process = function () {
    debug && console.log(
      clc.yellow( 'watch event on target [' + clc.magenta( target ) + ']' )
    )

    fs.stat( target, function ( err, stats ) {
      if (err) throw err

      var state = targetStates[ target ] || {
        timeout: undefined,
        mtime: undefined,
        throttled: false
      }
      targetStates[ target ] = state

      var mtime = state.mtime

      var attempts = 0
      var maxAttempts = 5

      if ( mtime === undefined || stats.mtime > mtime ) {
        // if (mtime !== undefined) targetHasError[target] = false
        state.mtime = stats.mtime

        if ( !state.throttled ) {

          var attempt = function () {
            attempts++
            if ( attempts > maxAttempts ) {
              clc.yellow(
                '[ignored] too many attempts: [' + clc.magenta( target ) + ']'
              )
              return undefined
            }
            // console.log('attempting')
            // io.emit('progress', target)

            try {
              var text = fs.readFileSync( target, 'utf-8' )
            } catch ( err ) {
              clc.yellow(
                '[ignored] error during attempt: [' + clc.magenta( target ) + ']'
              )
              return undefined
            }

            if ( !text.length ) {
              verbose && console.log(
                clc.yellow(
                  '[ignored] text.length: ' + text.length + ' [' + clc.magenta(target) + ']'
                )
              )

              // attempt again soon
              setTimeout( attempt, 25 )
            } else {
              state.lastTextLength = state.lastTextLength || 0

              var _emitDelay = ( state.lastTextLength - text.length )
              if ( _emitDelay < 0 ) _emitDelay = -_emitDelay // abs
              if ( _emitDelay > 250 ) _emitDelay = 250 // max
              if ( _emitDelay < 100 ) _emitDelay = 75 // min

              state.lastTextLength = text.length

              setTimeout( function () {
                if ( !state.throttled ) {
                  debug && console.log( ' == THROTTLE ON == ' )
                  state.throttled = true

                  clearTimeout( state.throttleTimeout )
                  state.throttleTimeout = setTimeout( function () {
                    debug && console.log( ' == THROTTLE OFF == ' )
                    state.throttled = false
                  }, throttleTimeout )

                  debug && console.log( ' == EMITTING == ' )
                  emit( target )
                } else {
                  debug && setTimeout( function () {
                    console.log(
                      clc.yellow(
                        '[throttled] [' + clc.magenta(target) + ']'
                      )
                    )
                  }, 75 )
                }
              }, _emitDelay )
            }
          }

          setTimeout( attempt, 25 )
        } else {
          verbose && setTimeout( function () {
            console.log(
              clc.yellow( '[throttled] [' + clc.magenta( target ) + ']' )
            )
          }, 75 )
        }
      } else {
        // ignore, nothing modified
        debug && console.log('-- nothing modified --')
      }
    } )
  }

  // var watcher = targetWatchers[target] || chokidar.watch('', {
  //   // TODO
  //   usePolling: true
  //   // followSymlinks: true
  // })

  var watcher = targetWatchers[target] || miteru.watch('', {
    // TODO
    usePolling: true
    // followSymlinks: true
  })
  // TODO watcher.on

  watcher.unwatch( '*' )
  if ( Object.keys( watcher.getWatched() ).length !== 0 ) throw new Error( 'watcher not cleared.' )

  targetWatchers[target] = watcher

  watcher.add( target )

  setTimeout(function () {
    console.log( watcher.getWatched() )
  }, 1000)

  watcher.on('change', function ( path, stats ) {
    debug && console.log( '== change watcher event ==' )
    process()
  })

  watcher.on('add', function ( path, stats ) {
    debug && console.log( '== add watcher event ==' )
    process()
  })

  // attach watchers
  // 
  //   chokidar.watch(target, {
  //     usePolling: true,
  //     interval: 66
  //   })
  //     .on('add', process)
  //     .on('change', process)
} // watch

// https://github.com/chalk/ansi-regex
var ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-PRZcf-nqry=><]/g

function stripAnsi (str) {
  return str.replace(ansiRegex, '')
}

var errorTimeouts = {}
var previousErrors = {}
var emittedErrors = {}
var lastError = undefined
function handleError (err, target, remaining, initMode) {
 // if (previousErrors[target] == err && !remaining) {
 //   verbose && console.log(clc.yellow('skipping error print (same error)'))
 //   console.log(clc.yellow('skipping error print (same error)'))
 //   return undefined // dont reprint same error
 // }


  var state = targetStates[ target ] || {
    timeout: undefined,
    mtime: undefined,
    throttled: false
  }
  targetStates[ target ] = state

  clearTimeout(errorTimeouts[target])
  // io.emit('error', { log: log })

  errorTimeouts[target] = setTimeout(function () {
    // if (!remaining) clearConsole()
    clearConsole()

    previousErrors[target] = err
    lastError = target

    var m = 'error'
    if (remaining) m = 'remaining error'

    var s = clc.gray(' >> ' + m + ' [' + clc.magenta(target) + ']')
    console.log(s)
    console.log('')
    targetHasError[target] = err

    if (typeof err !== 'string') err = 'Error: Unknown error.'

    var e = getErrorIterationBox() + '\n' + wooster( err )

    console.log( e )
    emittedErrors[ target ] = e

    debug && console.log( ' == THROTTLE ON == ' )
    state.throttled = true

    clearTimeout( state.throttleTimeout )
    state.throttleTimeout = setTimeout( function () {
      debug && console.log( ' == THROTTLE OFF == ' )
      state.throttled = false
    }, throttleTimeout )

    // TODO emit error
    debug && console.log( 'emitting error' )
    io.emit( 'error', {
      target: target,
      err: e
    } )

    // setTimeout( function () {
    //   console.log( 'emitting error again'  )
    //   io.emit('error', {
    //     target: target,
    //     err: e
    //   })
    // }, 100)

  }, 33)
} // handleError

function parseError (lines) {
  lines = removeColors(lines)

  var listLongWords = lines.map(function (line) {
    return line.split(' ').join(' <del>').split('<del>')
  })

  var tokens = []
  listLongWords.forEach(function (longWords) {
    longWords.forEach(function (longWord) {
      var re = /[A-Za-z0-9._-]+/g
      let arr, lastMatchIndex = 0
      while ((arr = re.exec(longWord)) !== null) {
        let match = arr[0]
        let i = re.lastIndex - match.length
        let li = re.lastIndex

        let color = undefined, deltaColor = undefined
        if (match.toLowerCase().indexOf('error') !== -1) color = 'red'

        if (match.toLowerCase().search(/.+\.(css|styl|js|jsx)$/) != -1) color = 'magenta'

        tokens.push({ text: longWord.substring(lastMatchIndex, i) })

        tokens.push({ text: match, color: color })
        lastMatchIndex = re.lastIndex
      }

      tokens.push({ text: longWord.substring(lastMatchIndex, longWord.length) })
    })

    tokens.push({ text: '\n' })
  })

  var msg = ''
  tokens.forEach(function (token) {
    if (token.color) {
      msg += clc[token.color](token.text)
    } else {
      msg += token.text
    }
  })

  //console.log(lines.join('\n'))

  var prettyLines = msg.trim().split('\n').map(function (line) {
    var match = line.match(/[0-9]*[|]/)
    var matchIndex = 0
    if (match) matchIndex = (match.index + match[0].length + 1)

    var t = line.slice(matchIndex).trim()

    if (t.startsWith('//') ||
        t.startsWith('/*') ||
        t.startsWith('*')) {
      return (line.slice(0, matchIndex) + clc.gray(removeColors([line.slice(matchIndex)])))
    }

    var indexOf
    ;[line.indexOf('//'), line.indexOf('/*')]
      .filter(function (i) {
        return i !== -1
      })
      .forEach(function (i) {
        indexOf = indexOf || i
        indexOf = Math.min(indexOf, i)
      })

    if (indexOf) {
      return (line.slice(0, indexOf) + clc.gray(removeColors([line.slice(indexOf)])))
    }

    return line
  })

  return prettyLines.join('\n')
}

function removeColors (lines) {
  var parsedLines = []
  lines.forEach(function (line) {
      var prettyLine = line
                    .split(/\033/).join('')
                    .split('/\u001b/').join('')
                    .split(/\[0m/).join('')
                    .split(/\[..m/).join('')
      parsedLines.push(prettyLine)
  })

  return parsedLines
}

function recover (cmd, target) {
  console.log(clc.yellow('attaching recovery watcher for [' + cmd + '] (' + target + ')'))

  // var watcher = recoveryWatchers[cmd] || chokidar.watch()
  var watcher = recoveryWatchers[cmd] || miteru.watch()

  watcher.unwatch( '*' )
  if ( Object.keys( watcher.getWatched() ).length !== 0 ) throw new Error( 'watcher not cleared.' )

  recoveryWatchers[cmd] = watcher

  clearTimeout(recoveryTimeouts[cmd])

  // target suffix
  var suffix = target.slice(target.lastIndexOf('.') + 1)

  // add glob patterns based on the target suffix
  switch (suffix) {
    case 'js':
      watcher.add( '**/*.js' )
      watcher.add( '**/*.jsx' ) // common suffix

      // var files = glob.sync('**/*.js')
      // files.forEach(function (file) {
      //   watcher.watch(file)
      // })

      break

    case 'css':
      watcher.add( '**/*.+(css|scss|styl|less)' )
      watcher.add( '**/*.css' )
      watcher.add( '**/*.scss' )
      watcher.add( '**/*.sass' )
      watcher.add( '**/*.less' )
      watcher.add( '**/*.styl' )

      // var files = glob.sync('**/*.+(css|scss|styl|less)')
      // files.forEach(function (file) {
      //   watcher.watch(file)
      // })

      break

    default:
      watcher.add( '**/*.js' )
      watcher.add( '**/*.css' )
      watcher.add( '**/*.scss' )
      watcher.add( '**/*.sass' )
      watcher.add( '**/*.less' )
      watcher.add( '**/*.styl' )

      // var files = glob.sync('**/*+(js|css|scss|styl|less|' + suffix + ')') // all js, css and 'suffix' files
      // files.forEach(function (file) {
      //   watcher.watch(file)
      // })

      break
  }

  watcher.unwatch( target ) // don't watch targets

  // recoveryWatchers[cmd].unwatch('**/bundle.js')
  // recoveryWatchers[cmd].unwatch('**/bundle.css')

  function process () {
    console.log(clc.yellow('modification at: ' + clc.cyan( target )))

    clearTimeout(recoveryTimeouts[cmd])
    recoveryTimeouts[cmd] = setTimeout(function () {
      watcher.close()
      // watcher.unwatch( '*' )

      console.log(clc.yellow('closing recovery watcher, executing recovery cmd [' + cmd + ']'))
      setTimeout(function () {
        exec(cmd, target)
      }, 50)
    }, 100)
  }

  watcher.on( 'add', function ( path, stats ) {
    process()
  })

  watcher.on( 'change', function ( path, stats ) {
    process()
  })

  // bind to fs change events
  // watcher.on('modification', function (info) {
  //   console.log(clc.yellow('modification at: ' + clc.cyan(info.filepath)))

  //   clearTimeout(recoveryTimeouts[cmd])
  //   recoveryTimeouts[cmd] = setTimeout(function () {
  //     watcher.close()
  //     console.log(clc.yellow('closing recovery watcher, executing recovery cmd [' + cmd + ']'))
  //     setTimeout(function () {
  //       exec(cmd, target)
  //     }, 50)
  //   }, 100)
  // })
}

function exec (cmd, target) {
  if (typeof cmd === 'string') cmd = cmd.split(' ')

  var child = cp.spawn(cmd[0], cmd.slice(1))
  child.__enable_auto_recover = true
  child.__id = spawns.length
  spawns.push(child)
  console.log(clc.yellow('exec cmd [' + cmd + ']'))

  // TODO check for error, send error log to client through sockets
  var buffer = ''
  var timeout = undefined
  var bufferResetTimeout = undefined
  var initMode = true

  function process (chunk) {
    var now = Date.now()
    // console.log(clc.yellow('exec process cmd [' + cmd + ']') + ' ' + chunk.toString('utf8').substr(0, 10))

    var str = chunk.toString('utf8')
    buffer += str

    var isError = false

    buffer.split('\n').forEach(function (line) {
      if (line.startsWith('[DEBUG]')) {
        console.log(line)
      } else {
        if (line.toLowerCase().indexOf('error') !== -1) isError = true
      }
    })

    clearTimeout(timeout)
    timeout = setTimeout(function () {
      var lines = buffer.split('\n')
            .filter(function (line) {
              return line.toLowerCase().indexOf('node_modules') === -1
            })
            .filter(function (line) {
              return line.toLowerCase().indexOf('[debug]') === -1
            })
      buffer = ''

      // console.log(' === child.__id: ' + child.__id)
      // console.log(lines.join('\n'))

      if (isError) {
        // console.log(result.join('\n'))
        var err = parseError(lines)
        handleError(err, target, undefined) // emits to connected clients also
      } else {
        if (lines && lines.length > 0 && lines[0].trim().length > 1) {
          console.log(lines.join('\n'))

          console.log( 'emitting progress' )
          io.emit( 'progress', {
            target: target,
            lines: lines
          } )
        }

        initMode = false
      }
    }, 66)

    clearTimeout(bufferResetTimeout)
    bufferResetTimeout = setTimeout(function () {
      if (!isError) buffer = ''
    }, 133)
  } // fn process

  child.stdout.on('data', process)
  child.stderr.on('data', process)

  var destroyTimeout = undefined
  function destroy () {
    clearTimeout(destroyTimeout)
    if (!child.__enable_auto_recover) return undefined // no need to recover on reset
    destroyTimeout = setTimeout(function () {

      console.log('child destroyed, recoery error')
      // handleError(targetHasError[target], target, undefined)
      setTimeout(function () {
        recover(cmd, target)
      }, 100)
    }, 500)
  }

  child.on('exit', function (code) {
    console.log(clc.grey('SPAWN EXITED'))
    if (child.__enable_auto_recover) destroy() // auto recover
  })
} // exec

// change host to 0.0.0.0 to access it on other machines on the same network
// (when testing on a tablet, mobile app or another computer (on the same network))
server.listen(port, host, function () {
  clearConsole()

  setTimeout(function () {
    clearConsole()
    console.log('server listening on %s:%s', host, port)
    if (host === '0.0.0.0') {
      var addresses = getNetworkIpAddresses()

      // host was set to 0.0.0.0, access it on other machines
      // on the same network (using your machines network ip address of)
      console.log(
        'host was set to ' + host + ':' + port + '\n' +
        ' -> [%s]', addresses.join(', ')
      )
      console.log()
    }
  }, 100)
})

function getNetworkIpAddresses () {
  var interfaces = require('os').networkInterfaces()
  var addresses = []
  for (var k in interfaces) {
    for (var k2 in interfaces[k]) {
      var address = interfaces[k][k2]
      if (address.family === 'IPv4' && !address.internal) {
        addresses.push(address.address)
      }
    }
  }
  return addresses
}
