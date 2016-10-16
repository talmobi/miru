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

var host = '0.0.0.0'
var port = 4040

var debug = true
var pipe = false

var targetHasError = {}

var flickerDelay = 0
var emitDelay = 25
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
}

var args = process.argv.slice(2)

var verbose = true // TODO !!args.verbose

args.forEach(function (arg) {
  var split = arg.split(':')

  var config = {
    target: split[0],
    cmd: split[1]
  }

  console.log(config)

  watch(config.target)
  exec(config.cmd, config.target) // TODO
})

// send reload/inject to client
var emit_targets = {}
var emit_timeouts = {}
var emit_timeout = undefined
function emit (target) {
  if (emit_timeout === undefined) clearConsole()
  clearTimeout(emit_timeout)

  console.log(chalk.yellow('changed in [' + chalk.magenta(target) + ']'))

  emit_targets[target] = target
  targetHasError[target] = false

  emit_timeout = setTimeout(function () {
    emit_timeout = undefined
    clearConsole()
    var addresses = getNetworkIpAddresses()

    var targets = Object.keys(emit_targets)
    emit_targets = {}

    console.log(getIterationBox(targets))
    console.log(
      'host was set to 0.0.0.0\n' +
      ' -> access from other machines on the same network' +
      ' by your machines network' +
      ' ip address,\n    list of your network IPv4 addresses:\n    [%s]', addresses.join(', ')
    )
    console.log()

    targets.forEach(function (target) {
      var color = getIterationBoxColor(target, false)
      var msg = ('modification on target [' + chalk[color](target) + ']')
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
  chokidar.watch(target).on('change', function () {
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
  })
} // watch


var errorTimeouts = {}
var previousErrors = {}
function handleError (err, target, remaining) {
  if (previousErrors[target] == err && !remaining) {
    // TODO -- this is useless? (since we are usin clearConsole)
    // verbose && console.log(chalk.yellow('skipping error print (same error)'))
    // return undefined // dont reprint same error
  }

  clearTimeout(errorTimeouts[target])
  // io.emit('error', { log: log })

  errorTimeouts[target] = setTimeout(function () {
    if (!remaining) clearConsole()

    previousErrors[target] = err
    console.log('')
    console.log(' >> error detected [' + chalk.magenta(target) + '] << ')
    console.log('')
    targetHasError[target] = err
    console.log(err)
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
    if (token.color) msg += chalk[token.color](token.text)
    else msg += token.text
  })

  //console.log(lines.join('\n'))

  return msg
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
  console.log(chalk.yellow('attatching recovery watcher for [' + cmd + '] (' + target + ')'))
  var watcher = chokidar.watch('*').on('change', function () {
    watcher.close()
    console.log(chalk.yellow('closing recovery watcher, executing recovery cmd [' + cmd + ']'))

    setTimeout(function () {
      exec(cmd, target)
    }, 0)
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
        handleError(err, target)

        // TODO emit error log to clients
        // handleError fn
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

      recover(cmd, target)
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
        'host was set to 0.0.0.0\n' +
        ' -> access from other machines on the same network' +
        ' by your machines network' +
        ' ip address,\n    list of your network IPv4 addresses:\n    [%s]', addresses.join(', ')
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
