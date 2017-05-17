var path = require('path')
var fs = require('fs')
var clc = require('cli-color')

// var rePath = /[\S]*\.[a-zA-Z]+/g
// var rePosition = /[(]?\s{0,5}\d+.{0,5}?\d+\s{0,5}[)]?/g
var hljs = require('highlight.js')


var browserifyString = 'SyntaxError: /Users/mollie/temp/miru/demos/webpack/scripts/mods/module.js: Unexpected token, expected ; (4:25) while parsing file: /Users/mollie/temp/miru/demos/webpack/scripts/mods/module.js'

var webpackString = [
  'ERROR in ./scripts/mods/module.js',
  'Module build failed: SyntaxError: Unexpected token, expected ; (4:25)'
].join('\n')

var standardString = 'standard: Use JavaScript Standard Style (https://standardjs.com) /Users/mollie/temp/miru/demos/webpack/scripts/mods/module.js:4:26: Parsing error: Unexpected token :'

var _resolved = []
var _positions = []
var _lastMode = 'normal'
var _likelyErrorDescription = ''

function transformToRelativePaths (text, process) {
  if (!process) {
    process = function (str) { return str }
  }
  if (typeof process !== 'function') {
    throw new Error('process parameter must be of type "function"')
  }

  var match
  var urls = []
  var rePath = /[\S]*\.[a-zA-Z]+/g
  while (match = rePath.exec(text)) {
    urls.push({
      match: match[0],
      absolutePath: path.resolve(match[0])
    })
  }
  urls = urls.filter(function (url) {
    // filter out non-file paths
    try {
      return fs.existsSync(url.absolutePath)
      return true
    } catch (err) {
      return false
    }
  })

  urls.forEach(function (url) {
    // console.log(url.match)
    // replace matches path with a transformed path.relative path
    var relativePath = './' + path.relative(__dirname, url.absolutePath)
    text = text.split(url.match).join( process(relativePath) )
  })

  // console.log(urls)

  return text
}

function init (text) {
  _resolved = []
  _positions = []
  _lastMode = 'normal'
  _likelyErrorDescription = ''

  var match
  var urls = []
  var rePath = /[\S]*\.[a-zA-Z]+/g
  while (match = rePath.exec(text)) {
    urls.push(match[0])
  }
  urls = urls.map(function (url) {
    // resolve to absolute paths
    return path.resolve(url)
  }).filter(function (url, index, arr) {
    // filter out duplicates
    return arr.indexOf(url) === index
  }).filter(function (url) {
    // filter out non-files
    try {
      return fs.existsSync(url)
      // fs.readFileSync(url, { encoding: 'utf8' })
      return true
    } catch (err) {
      return false
    }
  })

  if (!urls[0]) return

  var p = urls[0]
  // console.log('_resolved: ' + p)

  var rePosition = /[(]?\s{0,5}\d+\s{0,5}?[:]\s{0,5}?\d+\s{0,5}[)]?/g
  match = rePosition.exec(text)
  // console.log(match)
  if (!match) return
  if (!match[0]) return

  _resolved.push({
    url: urls[0],
    pos: parsePosition(match[0])
  })

  text.split('\n').forEach(function (line) {
    var prettyLine = parseOutput(line)
    if (prettyLine !== undefined) console.log(prettyLine)
  })

  text.split('\n').forEach(function (line) {
    if (line.indexOf('Error') >= 0) _likelyErrorDescription = line
  })

  trigger()
}

function parsePosition (pos) {
  var split = pos.split(':')
  // console.log(split)
  return {
    line: /\d+/.exec(split[0])[0],
    column: /\d+/.exec(split[1])[0]
  }
}

var _timeout
function trigger () {
  clearTimeout(_timeout)
  _timeout = setTimeout(function () {
    _resolved.forEach(function (r) {
      var { url, pos } = r
      var buffer = fs.readFileSync(url, { encoding: 'utf8' })
      var lines = buffer.split('\n')
      var i = Math.max(0, pos.line - 4)
      var j = Math.min(lines.length - 1, i + 4 + 3)
      // console.log('pos.line: ' + pos.line)
      // console.log('i: ' + i)
      // console.log('j: ' + j)

      var minOffset = String(j).trim().length

      console.log()
      if (_likelyErrorDescription.length > 0) {
        // shorten urls in error description
        // (path/to/file -> p/t/file)
        var words = _likelyErrorDescription.split(/\s+/)
        words = words.map(function (word) {
          if (word.indexOf('.') >= 0 || word.indexOf('/') >= 0) {
            word = transformToRelativePaths(word)
            if (testToken(url, word + '/ti')) {
              var split = word.split('/')
              var lastFileName = split.pop()
              var result = ''
              split.forEach(function (fileName) {
                if (fileName) {
                  result += fileName[0] + '/'
                }
              })
              result += lastFileName
              return clc.magenta(result)
            } else {
              return word
            }
          } else {
            return word
          }
        })
        console.log(
          ' ' + clc.redBright(words.join(' '))
        )
      }
      console.log()
      console.log(
        ' @ ' +
        transformToRelativePaths(url, strToMagenta) +
        ' ' + clc.redBright(pos.line) +
        ':' + clc.redBright(pos.column)
      )
      // console.log('---')
      var result = []
      for (; i < j; i++) {
        var lineNumber = String(i + 1).trim()
        while (lineNumber.length < minOffset) lineNumber = (' ' + lineNumber)

        if (i === pos.line - 1) {
          lineNumber = clc.redBright('> ') + clc.whiteBright(lineNumber)
        } else {
          lineNumber = '  ' + lineNumber
        }

        lineNumber += ' | '

        result.push(lineNumber + lines[i])
        // console.log(lines[i])

        // draw an arrow pointing upward to column location
        if (i === pos.line - 1) {
          var pointerOffset = ''
          for (var x = 0; x < pos.column; x++) {
            pointerOffset += ' '
          }
          var _o = String(j).trim().split(/./).join(' ') + '   | '
          // console.log(pointerOffset + '^')
          result.push(_o + pointerOffset + '^')
        }
      }

      result.forEach(function (line) {
        var prettyLine = parsePrettyLine(line)
        console.log(prettyLine)
      })

      // console.log('---')
    })
    // console.log('_resolved: ' + _resolved.length)
  }, 5)
}

function testToken (str, tests) {
  if (typeof tests === 'string') tests = [tests]

  var i, test, t, split, r, s, j
  for (i = 0; i < tests.length; i++) {
    test = tests[i]
    s = str

    split = test.split('/')
    t = split[0]
    r = split[1] || ''

    for (j = 0; j < r.length; j++) {
      var c = r[j]
      switch (c) {
        case 'i':
          t = t.toLowerCase()
          s = s.toLowerCase()
          break
        case 't':
          t = t.trim()
          s = s.toLowerCase()
          break
      }
    }

    if (s.indexOf(t) >= 0) return true
  }

  return false
}

function prettifyCodeLine (line, initialMode) {
  var prettyLine = ''
  var words = line.split(' ')

  var buffer = ''
  var penColor = 'whiteBright'
  var mode = initialMode || 'normal'

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

          // special case comment blocks
          case '/':
            if ((i + 1) < line.length) {
              var nextC = line[i + 1]
              switch (nextC) {
                case '/':
                  prettyLine += parseToken(buffer, penColor)
                  prettyLine += clc['black'](line.slice(i))
                  i = line.length // end of line
                  buffer = ''
                  break

                case '*':
                  prettyLine += clc[penColor](buffer)
                  buffer = '' // reset buffer
                  // enter new mode
                  mode = 'commentstar'
                  penColor = 'black'
                  buffer += c
                  break

                default:
                  prettyLine += parseToken(buffer, penColor)
                  prettyLine += clc['yellow'](c)
                  buffer = ''
              }
            } else {
              prettyLine += parseToken(buffer, penColor)
              prettyLine += clc['yellow'](c)
              buffer = ''
            }
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

      case 'commentstar':
        switch (c) {
          case '*':
            if ((i + 1) < line.length) {
              var nextC = line[i + 1]
              if (nextC === '/') {
                buffer += c
                buffer += nextC
                i += 1
                prettyLine += clc['black'](buffer)
                buffer = '' // reset buffer
                // enter new mode
                mode = 'normal'
                penColor = 'whiteBright'
                break
              }
            }

          default:
            buffer += c
        }
        break

      default:
        throw new Error('prettifyCodeLine error')
    }
  }

  prettyLine += parseToken(buffer, penColor)
  // prettyLine += clc[penColor](buffer)

  _lastMode = mode
  return prettyLine
}

function parseToken (token, penColor) {
  if (testToken(token, [
    'function',
    'atob',
    'btoa',
    'decodeURI',
    'decodeURIComponent',
    'encodeURI',
    'encodeURIComponent',
    'document'
  ])) {
    return clc.cyan(token)
  }

  if (testToken(token, [
    'return',
    'var',
    'new',
    'do',
    'void',
    'else',
    'break',
    'catch',
    'instanceof',
    'with',
    'throw',
    'case',
    'default',
    'try',
    'this',
    'switch',
    'continue',
    'typeof',
    'delete',
    'let',
    'yield',
    'const',
    'export',
    'super',
    'debugger',
    'as',
    'async',
    'await',
    'static',
    'import',
    'from',
    'arguments',
    'window'
  ])) {
    return clc.redBright(token)
  }

  if (testToken(token, [
    'true',
    'false',
    'null',
    'undefined'
  ])) {
    return clc.magentaBright(token)
  }

  if (testToken(token, [
    'Date',
    'Object',
    'Function',
    'Number',
    'Math',
    'String',
    'RegExp',
    'Array',
    'Boolean'
  ])) {
    return clc['yellow'](token)
  }

  return clc[penColor](token)
}

function isCodeSnippetLine (line) {
  var header = line.trim().substring(0, 8)
  if (header.split(/[^\d|>]/).join('').trim().length < 1) return false
  var helmet = header.split(/[^\d|> ]/).join('').trim()
  var split = header.split(helmet)
  if (split[0].split(/[^\d|>]/).join('').length > 0) return false
  // if (split[1].split(/[^\d|> ]/).join('').length < 1) return false
  return true
}

function parseOutput (line) {
  var trimmedLine = line.trim()

  if (isCodeSnippetLine(line)) return undefined

  if (testToken(trimmedLine, [
    'error /i',
    'SyntaxError',
    'Unexpected'
  ])) {
    return clc.redBright( transformToRelativePaths(line, strToMagenta) )
  }

  return line // do nothing
}

function strToMagenta (str) {
  return clc.magenta(str)
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

    var right = prettifyCodeLine(split[1], _lastMode)
    right = right.replace('^', clc.redBright('^'))
    prettyLine += right
    return prettyLine
  }

  if (testToken(trimmedLine, [
    'error /i',
    'SyntaxError',
    'Unexpected'
  ])) {
    return clc.redBright( transformToRelativePaths(line, strToMagenta) )
  }

  return line // do nothing
}

// console.log(__dirname)
// init(browserifyString)
// init(standardString)

module.exports = init
