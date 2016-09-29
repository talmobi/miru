var chokidar = require('chokidar')
var express = require('express')
var cp = require('child_process')

var parseArgs = require('minimist')

var app = express()
var http = require('http')
var server = http.createServer(app)
var io = require('socket.io')(server) // livereload

var host = '0.0.0.0'
var port = 4040

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

args.forEach(function (arg) {
  var split = arg.split(':')

  var config = {
    target: split[0],
    cmd: split[1]
  }

  console.log(config)

  watch(config.target)
  exec(config.cmd) // TODO
})

function watch (target) {
  chokidar.watch(target).on('change', function () {
    console.log('change on target [' + target + ']')
  })
} // watch

function handleError (log) {
  io.emit('error', { log: log })
} // handleError

function exec (cmd) {
  if (typeof cmd === 'string') cmd = cmd.split(' ')
  var child = cp.spawn(cmd[0], cmd.slice(1))
  console.log('exec cmd [' + cmd + ']')

  // TODO check for error, send error log to client through sockets
  var buffer = ''
  var timeout = undefined
  function process (chunk) {
    var str = chunk.toString('utf8')
    buffer += str

    var split = buffer.split('\n')

    var isError = false

    var result = []
    split.forEach(function (line) {
      line = line.toLowerCase()
      if (line.indexOf('error') !== -1) isError = true
      if (line.indexOf('node_modules') === -1) {
        result.push(line)
      }
    })

    clearTimeout(timeout)
    timeout = setTimeout(function () {
      console.log(result.join('\n'))
      buffer = ''

      if (isError) {
        console.log('----')
        console.log('- error -')
      }
    }, 100)
  }

  child.stdout.on('data', process)
  child.stderr.on('data', process)

  child.on('close', function (code) {
    console.log('SPAWN CLOSED')
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
