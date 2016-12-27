'use strict'

var chokidar = require('chokidar')
var express = require('express')
var cp = require('child_process')

var chalk = require('chalk')

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

var usage = [
    ''
  , '  Usage: miru [options]'
  , ''
  , '  Sample package.json:'
  , ''
  , '    {'
  , '     "scripts": {'
  , '       "watch": "miru -p public -w bundle.js -w bundle.css -e \'npm run watch-js\' -e \'npm run watch-css\'"'
  , '       "watch-js": "webpack -w --entry ./scripts/app.js --output ./public/bundle.js",'
  , '       "watch-css": "stylus -u nib -w ./styles/app.styl -o ./public/bundle.css",'
  , '     }'
  , '    }'
  , ''
  , '  Options:'
  , ''
  , '    -p, --path                     Specify path (current directory by default)'
  , ''
  , '                                   This is also the path where miru creates "miru.init.js"'
  , '                                   which you can <script src=""> on your html page to enable'
  , '                                   live reloads and error reporting within the page/browser.'
  , ''
  , '                                   ![Required]'
  , '    -w, --watch                    Specify path to target output file/bundle to watch'
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
  , '    -t, --target                   [Deprecated] alias for [-w, --watch]'
  , ''
  , '                                   ![Required]'
  , '    -e, --execute                  Command (string) to execute with child_process.spawn'
  , '                                   usually an npm script like \'npm run watch-js\''
  , ''
  , '                                   Note! Every -w needs a corresponding -e in the same order'
  , ''
  , '    -s, --source                   [Deprecated] alias for [-e, --execute]'
  , ''
  , '    -v, --version                  Display miru version'
  , '    -h, --help                     Display help information'
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

// var _targets = Array.isArray(argv.t) ? argv.t || [argv.t]
// var _scripts = Array.isArray(argv.s) ? argv.s || [argv.s]

var opts = {
  publicPath: argv.p || argv.path || argv.public || argv.root || '.',
  targets: argv.watch,
  scripts: argv.execute
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
  console.log('catch-all [$]'.replace('$', req.originalUrl))
  res.status(404).end()
})

// handle socket.io
io.on('connection', function (socket) {
  console.log('new connection')
  Object.keys(targetHasError).forEach(function (target) {
    if (targetHasError[target] && emittedErrors[target]) {
      io.emit('error', {
        target: target,
        err: emittedErrors[target]
      })
    }
  })
})

var host = '0.0.0.0'
var port = 4040

var debug = true
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
    box += chalk[getIterationBoxColor(target, true)]('  ')
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

function clearConsole() {
  // This seems to work best on Windows and other systems.
  // The intention is to clear the output so you can focus on most recent build.
  process.stdout.write('\x1bc');
  // console.log()
  // console.log()
  // console.log()
}

var args = process.argv.slice(2)

var verbose = true // TODO !!args.verbose

opts.targets.forEach(function (target, i) {
  var t = opts.targets[i]
  var s = opts.scripts[i]

  if (!t || !s) throw new Error('-t, -s mismatch')

  var t = path.join(opts.publicPath, t)
  watch(t)
  exec(s, t)
})

// send reload/inject to client
var emit_targets = {}
var emit_timeouts = {}
var emit_timeout = undefined
function emit (target) {
  if (emit_timeout === undefined) clearConsole()
  clearTimeout(emit_timeout)

  console.log(chalk.yellow('changed in [' + chalk.magenta(target) + ']'))

  emit_targets[target] = target // save emitted targets
  targetHasError[target] = false // successful build on target

  emit_timeout = setTimeout(function () {
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
      var msg = ('modification [' + chalk[color](target) + ']')
      console.log(msg + ' [' + chalk.cyan(new Date().toLocaleTimeString()) + ']')
      io.emit('modification', target)
    })

    // check if other errors still exist
    var errors = Object.keys(targetHasError)

    for (let i = 0; i < errors.length; i++) {
      let target = errors[i]
      let err = targetHasError[target]

      // TODO
      if (err) {
        console.log('remaining error found at target [' + chalk.magenta(target) + ']')
        handleError(err, target, true)
        // console.log(err)
      }
    }
  }, emitDelay)
}

function watch (target) {
  var process = function (path) {
    // debug && console.log(chalk.yellow('path [' + chalk.magenta(path) + ']'))
    debug && console.log(chalk.yellow('change on target [' + chalk.magenta(target) + ']'))
    fs.stat(target, function (err, stats) {
      if (err) throw err

      if (mtimes[target] === undefined || stats.mtime > mtimes[target]) {
        if (mtimes[target] !== undefined) targetHasError[target] = false
        mtimes[target] = stats.mtime
        emit(target)
      } else {
        // ignore, nothing modified
        debug && console.log('-- nothing modified --')
      }
    })
  }

  // attach watchers
  chokidar.watch(target)
    .on('add', process)
    .on('change', process)
} // watch


var errorTimeouts = {}
var previousErrors = {}
var emittedErrors = {}
var lastError = undefined
function handleError (err, target, remaining, initMode) {
 //  if (previousErrors[target] == err && !remaining) {
 //    // TODO -- this is useless? (since we are usin clearConsole)
 //    // verbose && console.log(chalk.yellow('skipping error print (same error)'))
 //    // return undefined // dont reprint same error
 //  }

  clearTimeout(errorTimeouts[target])
  // io.emit('error', { log: log })

  errorTimeouts[target] = setTimeout(function () {
    // if (!remaining) clearConsole()
    clearConsole()

    previousErrors[target] = err
    lastError = target

    var m = 'error'
    if (remaining) m = 'remaining error'

    var s = chalk.gray(' >> ' + m + ' [' + chalk.magenta(target) + ']')
    console.log(s)
    console.log('')
    targetHasError[target] = err
    console.log(err)

    var lines = removeColors([s, ''].concat(err.split('\n')))
    var e = lines.join('\n')

    emittedErrors[target] = e

    // TODO emit error
    io.emit('error', {
      target: target,
      err: e
    })
  }, 100)
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
      msg += chalk[token.color](token.text)
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
      return (line.slice(0, matchIndex) + chalk.gray(removeColors([line.slice(matchIndex)])))
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
      return (line.slice(0, indexOf) + chalk.gray(removeColors([line.slice(indexOf)])))
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

var recoveryWatchers = {}
var recoveryTimeouts = {}
function recover (cmd, target) {
  console.log(chalk.yellow('attatching recovery watcher for [' + cmd + '] (' + target + ')'))

  var watcher = recoveryWatchers[cmd]
  if (watcher && watcher.close) watcher.close()
  clearTimeout(recoveryTimeouts[cmd])


  recoveryWatchers[cmd] = chokidar.watch()

  // target suffix
  var suffix = target.slice(target.lastIndexOf('.') + 1)

  // add glob patterns based on the target suffix
  switch (suffix) {
    case 'js':
      recoveryWatchers[cmd].add('**/*.js*')
      break
    case 'css':
      recoveryWatchers[cmd].add('**/*.css')
      recoveryWatchers[cmd].add('**/*.scss')
      recoveryWatchers[cmd].add('**/*.sass')
      recoveryWatchers[cmd].add('**/*.styl')
      break
    default:
      recoveryWatchers[cmd].add('**/*') // all
  }

  // recoveryWatchers[cmd].unwatch('**/bundle.js')
  // recoveryWatchers[cmd].unwatch('**/bundle.css')

  // bind to fs change events
  recoveryWatchers[cmd].on('change', function (path) {
    recoveryWatchers[cmd].close()
    console.log(chalk.yellow('closing recovery watcher, executing recovery cmd [' + cmd + ']'))

    clearTimeout(recoveryTimeouts[cmd])
    recoveryTimeouts[cmd] = setTimeout(function () {
      exec(cmd, target)
    }, 500)
  })
}

function exec (cmd, target) {
  if (typeof cmd === 'string') cmd = cmd.split(' ')

  var child = cp.spawn(cmd[0], cmd.slice(1))
  console.log(chalk.yellow('exec cmd [' + cmd + ']'))

  // TODO check for error, send error log to client through sockets
  var buffer = ''
  var timeout = undefined
  var bufferResetTimeout = undefined
  var initMode = true

  function process (chunk) {
    var str = chunk.toString('utf8')
    buffer += str

    var isError = false

    buffer.split('\n').forEach(function (line) {
      if (line.toLowerCase().indexOf('error') !== -1) isError = true
    })

    clearTimeout(timeout)
    timeout = setTimeout(function () {
      var lines = buffer.split('\n').filter(function (line) {
        return line.toLowerCase().indexOf('node_modules') === -1
      })
      buffer = ''

      pipe && console.log(lines.join('\n'))

      if (isError) {
        // console.log(result.join('\n'))
        var err = parseError(lines)
        handleError(err, target, undefined)

        // TODO emit error log to clients
        // handleError fn
      } else {
        initMode = false
      }
    }, 100)

    clearTimeout(bufferResetTimeout)
    bufferResetTimeout = setTimeout(function () {
      if (!isError) buffer = ''
    }, 200)
  } // fn process

  child.stdout.on('data', process)
  child.stderr.on('data', process)

  var destroyTimeout = undefined
  function destroy () {
    clearTimeout(destroyTimeout)
    destroyTimeout = setTimeout(function () {
      child.kill()

      handleError(targetHasError[target], target, undefined)
      setTimeout(function () {
        recover(cmd, target)
      }, 100)
    }, 500)
  }

  child.on('exit', function (code) {
    console.log(chalk.grey('SPAWN EXITED'))
    destroy()
  })

  child.on('close', function (code) {
    console.log(chalk.grey('SPAWN CLOSED'))
    destroy()
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
