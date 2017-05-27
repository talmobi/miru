var childProcess = require('child_process')
var clc = require('cli-color')

var spawn = childProcess.spawn('npm', ['run', 'watch-js'])

var buffer = ''

// var snippet = require('./snippet.js')
var snippet = require('/Users/mollie/code/wooster/snippet.js')

spawn.stdout.on('data', handleIO)
spawn.stderr.on('data', handleIO)

var _timeout

function handleIO (chunk) {
  buffer += chunk.toString('utf8')
  clearTimeout(_timeout)
  _timeout = setTimeout(function () {
    var lines = buffer.split('\n')
    buffer = lines.pop() // rewind buffer and parse complete lines

    lines.forEach(function (line) {
      var prettyLine = parsePrettyLine(line)
      if (prettyLine !== undefined) {
        console.log(prettyLine)
      }
    })

    var text = lines.join('\n')
    if (text.toLowerCase().indexOf('error') >= 0) {
      snippet(text)
    } else {
      console.log(text)
    }
    // console.log('--text--')
    // console.log(text)
    // console.log('--/text--')
  }, 15)
}

function testToken (str, tests) {
  if (typeof tests === 'string') tests = [tests]

  var i, test, t, split, r, s
  for (i = 0; i < tests.length; i++) {
    test = tests[i]
    s = str

    split = test.split('/')
    t = split[0]
    r = split[1]

    switch (r) {
      case 'i':
        t = t.toLowerCase()
        s = s.toLowerCase()
        break
      case 't':
        t = t.trim()
        s = s.toLowerCase()
        break
    }

    if (s.indexOf(t) >= 0) return true
  }

  return false
}

function prettifyCodeLine (line) {
  var prettyLine = ''
  var words = line.split(' ')

  var buffer = ''
  var penColor = 'whiteBright'
  var mode = 'normal'

  var i, c
  for (i = 0; i < line.length; i++) {
    c = line[i]

    switch (mode) {
      case 'normal':
        switch (c) {
          case "'":
          case '"':
            prettyLine += clc[penColor](buffer)
            buffer = '' // reset buffer
            // enter new mode
            mode = 'quotes'
            penColor = 'green'
            buffer += c
            break

          case '+':
          case '-':
          case '*':
          case '/':
          case '%':
          case '=':
          case ':':
          case '.':
          case ',':
          case '?':
          case '!':
            prettyLine += parseToken(buffer, penColor)
            prettyLine += clc['yellow'](c)
            buffer = ''
            break

          case ' ':
            buffer += c
            prettyLine += parseToken(buffer, penColor)
            buffer = '' // reset buffer
            break

          default:
            buffer += c
        }
        break

      case 'quotes':
        switch (c) {
          case "'":
          case '"':
            buffer += c
            prettyLine += clc[penColor](buffer)
            buffer = '' // reset buffer
            // enter new mode
            mode = 'normal'
            penColor = 'whiteBright'
            break

          default:
            buffer += c
        }
        break

      default:
        throw new Error('prettifyCodeLine error')
    }
  }

  prettyLine += clc[penColor](buffer)


  return prettyLine
}

function parseToken (token, penColor) {
  if (testToken(token, [
    'function',
    'new'
  ])) {
    return clc.cyan(token)
  }

  if (testToken(token, [
    'Date'
  ])) {
    return clc['yellow'](token.slice(0, -2)) + token.slice(4)
  }

  return clc[penColor](token)
}

function parsePrettyLine (line) {
  var trimmedLine = line.trim()

  if (testToken(trimmedLine, '|')) {
    // probably code snippet
    var prettyLine = ''
    // TODO
    return undefined

    // var split = line.split('|', 2)
    // var left = clc.xterm(246)(split[0] + '|')
    // left = left.replace('>', clc.redBright('>'))
    // prettyLine += left

    // var right = prettifyCodeLine(split[1])
    // right = right.replace('^', clc.redBright('^'))
    // prettyLine += right
    // return prettyLine
  }

  if (testToken(trimmedLine, [
    'error /i',
    'SyntaxError',
    'Unexpected',
  ])) {
    return clc.redBright(line)
  }

  return line // do nothing
}

function contains (source, tests) {
  if (typeof tests === 'string') tests = [tests]

  var i, test
  for (i = 0; i < tests.length; i++) {
    test = tests[i]
    if (source.indexOf(test) >= 0) return true
  }

  return false
}
