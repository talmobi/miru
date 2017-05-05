var path = require('path')
var fs = require('fs')
var clc = require('cli-color')

var rePath = /[\S]*\.[a-zA-Z]+/g

var rePosition = /[(]?\s{0,5}\d.{0,5}?\d+\s{0,5}[)]?/g

var browserifyString = 'SyntaxError: /Users/mollie/temp/miru/demos/webpack/scripts/mods/module.js: Unexpected token, expected ; (2:25) while parsing file: /Users/mollie/temp/miru/demos/webpack/scripts/mods/module.js'

var webpackString = [
  'ERROR in ./scripts/mods/module.js',
  'Module build failed: SyntaxError: Unexpected token, expected ; (2:25)'
].join('\n')

var resolved = []
var positions = []

function init (str) {
  var match
  var urls = []
  var rePath = /[\S]*\.[a-zA-Z]+/g
  while (match = rePath.exec(str)) {
    urls.push(match[0])
  }
  urls = urls.map(function (url) {
    return path.resolve(url)
  }).filter(function (url, index, arr) {
    return arr.indexOf(url) === index
  })

  var p = urls[0]
  console.log('resolved: ' + p)

  var rePosition = /[(]?\s{0,5}\d.{0,5}?\d+\s{0,5}[)]?/g
  match = rePosition.exec(str)
  console.log(match)

  resolved.push({
    url: urls[0],
    pos: parsePosition(match[0])
  })
  trigger()
}

function parsePosition (pos) {
  var split = pos.split(':')
  return {
    line: /\d+/.exec(split[0])[0],
    column: /\d+/.exec(split[1])[0]
  }
}

console.log(__dirname)
init(browserifyString)
init(webpackString)

var _timeout
function trigger () {
  clearTimeout(_timeout)
  _timeout = setTimeout(function () {
    resolved.forEach(function (r) {
      var { url, pos } = r
      var buffer = fs.readFileSync(url, { encoding: 'utf8' })
      var lines = buffer.split('\n')
      var i = Math.max(0, pos.line - 6)
      var j = Math.min(lines.length - 1, pos.line + 6)

      var minOffset = String(j).trim().length

      console.log()
      console.log('---')
      var result = []
      for (; i < j; i++) {
        var lineNumber = String(i).trim()
        while (lineNumber.length < minOffset) lineNumber = (' ' + lineNumber)

        lineNumber += ' | '

        result.push(lineNumber + lines[i])
        // console.log(lines[i])

        if (i === pos.line - 1) {
          var pointerOffset = ''
          for (var x = 0; x < pos.column; x++) {
            pointerOffset += ' '
          }
          var _o = String(j).trim().split(/./).join(' ') + ' | '
          // console.log(pointerOffset + '^')
          result.push(_o + pointerOffset + '^')
        }
      }

      result.forEach(function (line) {
        var prettyLine = parsePrettyLine(line)
        console.log(prettyLine)
      })

      console.log('---')
      console.log()
    })
  }, 25)
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

          case '{':
          case '}':
            // TODO unsure to include braces?

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

          case '(':
          case ')':
            // TODO unsure to include parens?
            prettyLine += parseToken(buffer, penColor)
            prettyLine += clc['white'](c)
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
    'export',
    'default',
    'return'
  ])) {
    return clc.redBright(token)
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

    var split = line.split('|', 2)
    var left = clc.xterm(246)(split[0] + '|')
    left = left.replace('>', clc.redBright('>'))
    prettyLine += left

    var right = prettifyCodeLine(split[1])
    right = right.replace('^', clc.redBright('^'))
    prettyLine += right
    return prettyLine
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
