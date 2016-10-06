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
var emit_timeouts = {}
function emit (target) {
  clearTimeout(emit_timeouts[target])
  emit_timeouts[target] = setTimeout(function () {
    targetHasError[target] = false

    var msg = ('modification on target [' + chalk.magenta(target) + ']')
    console.log(msg + chalk.cyan(' [' + new Date().toLocaleTimeString() + ']'))
    io.emit('modification', target)

    // check if other errors still exist
    var targets = Object.keys(targetHasError)

    for (let i = 0; i < targets.length; i++) {
      let target = targets[i]
      var err = targetHasError[target]

      // TODO
      if (err) {
        console.log('  remaining error found at target [' + chalk.magenta(target) + ']')
        console.log(err)
      }
    }
  }, 5)
}

function watch (target) {
  chokidar.watch(target).on('change', function () {
    debug && console.log('change on target [' + target + ']')
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

function handleError (err) {
  // io.emit('error', { log: log })
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
        console.log('')
        console.log(' >> error detected [' + chalk.magenta(target) + '] << ')
        console.log('')
        // console.log(result.join('\n'))
        var err = parseError(lines)
        targetHasError[target] = err
        console.log(err)

        handleError(err)
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
