var foregroundColors = {
  // foreground
  '30': 'black',
  '31': 'maroon',
  '32': 'olivedrab',
  '33': 'orange',
  '34': 'navy',
  '35': 'hotpink',
  '36': 'darkcyan',
  '37': 'lightgray',

  // foreground
  '90': 'gray',
  '91': 'tomato',
  '92': 'chartreuse',
  '93': 'khaki',
  '94': 'royalblue',
  '95': 'pink',
  '96': 'paleturquoise',
  '97': 'lightgray',

  // '0': 'lightgray', // reset (white on black)
  '39': 'lightgray', // default (white) (foreground)
}

var backgroundColors = {
  // background
  '40': 'black',
  '41': 'maroon',
  '42': 'green',
  '43': 'gold',
  '44': 'navy',
  '45': 'purple',
  '46': 'darkcyan',
  '47': 'lightgray',

  // background
  '100': 'gray',
  '101': 'red',
  '102': 'lime',
  '103': 'yellow',
  '104': 'blue',
  '105': 'green',
  '106': 'cyan',
  '107': 'lightgray',

  '49': 'black' // default (black) (background)
}

var _colors = {
  0: '#665c54',
  1: '#cc241d',
  2: '#98971a',
  3: '#d79921',
  4: '#458588',
  5: '#b16286',
  6: '#689d6a',
  7: '#a89984',
  8: '#928374',
  9: '#fb4934',
  10: '#b8bb26',
  11: '#fabd2f',
  12: '#83a598',
  13: '#d3869b',
  14: '#8ec97c',
  15: '#ebdbb2'
}

var targetErrors = {}

function hasErrors () {
  var keys = Object.keys( targetErrors )
  for (var i = 0; i < keys.length; i++) {
    var key = keys[ i ]
    if ( targetErrors[ key ] ) {
      console.log('has errors: ' + key)
      return true
    }
  }
  return false
}

var AnsiToHtmlFilter = require('ansi-to-html')
var ansiToHtmlFilter = new AnsiToHtmlFilter({
  fg: '#fbf1c7',
  bg: '#1d2021',
  colors: Object.assign({}, _colors), // override color palette
  stream: false // do not save style state across invocations of toHtml()
})

console.log('miru livereload.js loaded')
// this file is sent and run on the client

// https://github.com/chalk/ansi-regex
var ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-PRZcf-nqry=><]/g

function stripAnsi (str) {
  return str.replace(ansiRegex, '')
}

var xtermAnsiRegex = /\[[0-9]{1,3};[0-9]{1,3};[0-9]{1,3}m/g
function stripXtermAnsi (str) {
  return str.replace(xtermAnsiRegex, '')
}

// clc.reset, clc.erase.screen
var ansiSpecial = /\[[0-9]?[A-Z]?(;[0-9][A-Z])?/g
function stripAnsiSpecial (str) {
  return str.replace(ansiSpecial, '')
}

function stripYouBee (str) {
  return str.replace(/\u001b/g, '')
}

function ansiToHtml (text) {
  return ansiToHtmlFilter.toHtml(text)
}

function saveScrollTop () {
  if (window.localStorage) {
    window.localStorage.setItem('__miru_scrollTop', JSON.stringify({
      scrollTop: document.body.scrollTop,
      time: Date.now()
    }))
  }
}

var UID = (function UID () {
  var counter = 0
  var size = (1 << 16)
  return function () {
    var date = Date.now().toString(16).slice(-10)
    var rnd = String(Math.floor(Math.random() * size))
    return ('uid' + date + String(counter++) + rnd)
  }
})()

function initAttempt () {
  console.log('init attempt')
  if (window.io && window.__miruHost) return init()
  setTimeout(initAttempt, 33)
}
initAttempt()

function findElement (elements, field, target) {
  target = ('/' + target)
  target = target.slice(target.lastIndexOf('/'))
  target = target.toLowerCase().split('/').join('')
  console.log('findElement target: ' + target)
  for (var i = 0; i < elements.length; i++) {
    var t = elements[i][field].toLowerCase().split('/').join('')
    // console.log('t: ' + t)
    if (t.length < target.length) {
      if (target.indexOf(t) >= 0) return elements[i]
    } else {
      if (t.indexOf(target) >= 0) return elements[i]
    }
  }
  return undefined // not found
}

var _lastTimeoutId = window.setTimeout(function () {}, 0) // get current timeout id

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

window.__miruProgressTargetTimeouts = {}
window.__miruTargetTimes = {}
window.__miruModificationTimeout = undefined
window.__miruModalTimeout = undefined
function init () {
  console.log('miru initliazing')
  window.__miruInitTime = Date.now()

  function showModal (show, type) {
    clearTimeout(window.__miruModalTimeout)
    // console.log((show === false ? 'hiding' : 'showing') + ' error modal')
    window.__miruModalTimeout = setTimeout(function () {
      var el = undefined
      var modalId = '__miruErrorModalEl'
      el = document.getElementById(modalId)

      if (!el) {
        el = document.createElement('div')
        el.id = modalId
        document.body.appendChild(el)
      }

      el.style['transition'] = 'none'
      el.style['opacity'] = 0.0
      el.style['display'] = (show === false ? 'none' : 'block')
      el.style['position'] = 'fixed'
      el.style['top'] = 0
      el.style['left'] = 0
      el.style['width'] = '100%'
      el.style['height'] = '100%'

      el.style['margin'] = 0
      el.style['padding'] = '0.475rem'
      el.style['padding'] = 0

      el.style['background-color'] = '#b6442f'
      el.style['opacity'] = 0.9625
      el.style['opacity'] = 0.9725
      el.style['white-space'] = 'pre-wrap'
      el.style['color'] = 'white'
      el.style['z-index'] = 2147483646 // ((2^32 / 2) - 2)

      el.style['font-family'] = 'monospace'

      switch (type) {
        case 'progress':
          el.style['opacity'] = 0.0
          el.style['background-color'] = 'rgba(110, 136, 153, 0.75)'
          el.style['transition'] = 'opacity .5s ease-in'
          window.__miruModalTimeout = setTimeout(function () {
            el.style['opacity'] = 0.90
            el.style['width'] = '100%'
            // el.style['height'] = '32px'
          }, 0)
          break
      }
    }, 0)

    // a bit of dom hax to make sure we've correctly hidden or shown the modal
    // var counter = 0
    // function loop () {
    //   // console.log('looping')
    //   var el = document.getElementById(modalId)
    //   if (el) {
    //     el.style.display = (show === false ? 'none' : 'block')
    //   } else {
    //     counter++
    //     if (counter < 5) setTimeout(loop, 10) // force it down...
    //   }
    // }
    // loop()
  }
  showModal(false)

  var socket = io(window.__miruHost)

  socket.on('connect', function () {
    console.log('socket connected to: ' + window.__miruHost)
  })

  socket.on('tick', function (data) {
    // console.log('miru ticking: ' + data.length)
  })

  var _progressTimeout
  socket.on('progress', function (opts) {

    var now = Date.now()
    var target = opts.target

    var t = window.__miruTargetTimes[target]
    if ((t === undefined) || (t - now > 2500)) {
      var lines = removeColors(opts.lines)

      var el = document.getElementById('__miruErrorModalEl')
      if (el) {
        var name = target
        var text = lines.join('\n')

        // clear previous
        el.innerHTML = ''
        showModal(true, 'progress')

        clearTimeout( _progressTimeout )
        _progressTimeout = setTimeout(function () {
          if (!hasErrors()) showModal(false)
        }, 1000)

        var titleEl = document.createElement('pre')
        titleEl.style['padding'] = '0.675rem'
        titleEl.style['border'] = '0px solid black !important'
        titleEl.style['border-bottom'] = '1px solid #bb4444'
        titleEl.textContent = 'miru progress modal (from terminal)'
        el.appendChild(titleEl)

        var contentEl = document.createElement('pre')
        contentEl.style['opacity'] = 1.00
        contentEl.style['white-space'] = 'pre-wrap'
        contentEl.style['color'] = 'white'
        // TODO parse and prettify error?
        contentEl.textContent = text
        el.appendChild(contentEl)
      } else {
        console.warn('miru terminal progress received but modal id was not found.')
        console.log(error)
      }
    }
  })

  var reloadTimeout = null

  socket.on('reload', function () {
    showModal(false)
    console.log('--- miru wants to reload the page! ---')

    clearTimeout(reloadTimeout)
    reloadTimeout = setTimeout(function () {
      window.location.reload()
    }, 125)
  })

  // if long runing process re-connects, reload full page
  socket.on('init_reload', function () {
    var now = Date.now()
    var lastTime = window.__miruInitTime
    if (!lastTime || (now - lastTime > 3000)) {
      clearTimeout(reloadTimeout)
      console.log()
      console.log('-----------------')
      console.log('  init reloading...')
      console.log()
      reloadTimeout = setTimeout(function () {
        window.location.reload()
      }, 1000)
    }
  })

  var _lastErrorText
  socket.on('error', function (error) {
    var el = document.getElementById('__miruErrorModalEl')

    targetErrors[error.target] = error

    if (el) {
      var name = error.name
      var text = error.message || error.err || error

      var syntax = ansiToHtml(text)
      text = ansiToHtml( text ) + '\n\n'

      if (_lastErrorText === text) {
        console.log('error text already shown')
        return undefined
      }

      clearTimeout(window.__miruModificationTimeout)
      console.log('received error: ', error)

      _lastErrorText = text

      // clear previous
      el.innerHTML = ''
      showModal(true)

      var titleEl = document.createElement('div')
      titleEl.style['white-space'] = 'pre'
      titleEl.style['font-family'] = 'monospace'
      titleEl.style['padding'] = '0.675rem'
      titleEl.style['border'] = '0px solid black !important'
      titleEl.style['border-bottom'] = '1px solid #bb4444'
      titleEl.textContent = 'miru error modal (from terminal)'
      el.appendChild(titleEl)

      var contentEl = document.createElement('div')
      contentEl.style['opacity'] = 1.00
      contentEl.style['white-space'] = 'pre'
      contentEl.style['font-family'] = 'monospace'
      contentEl.style['color'] = '#fbf1c7'
      contentEl.style['background'] = '#1d2021'
      contentEl.style['padding'] = '4px'
      // TODO parse and prettify error?
      contentEl.innerHTML = text
      el.appendChild(contentEl)
    } else {
      console.warn('error received but miru option showErrors was turned off')
      console.log(error)
    }
  })

  socket.on('modification', function (target) {
    var scrollTop = document.body.scrollTop
    clearTimeout(window.__miruModificationTimeout)
    console.log('modification event received')
    console.log(target)

    targetErrors[target] = undefined

    // if (!hasErrors()) {
    //   showModal(false)
    // }

    window.__miruModificationTimeout = setTimeout(function () {
      window.__miruTargetTimes[target] = Date.now()
      // create some white space in the console
      console.log(new Array(24).join('\n'))
      console.log(' --- [' + (new Date().toLocaleString()) + '] --- ')

      var scripts = document.querySelectorAll('script')
      var styles = document.querySelectorAll('link')

      var el = (
        findElement(scripts, 'src', target) ||
        findElement(styles, 'href', target)
      )

      var suffix = target.slice(target.lastIndexOf('.') + 1)
      var cacheaway = UID()

      if (el) {
        switch (suffix) {
          case 'css':
            saveScrollTop()
            // window.location.reload()
            // return undefined

            var url = el.href.split('?')[0] + '?cacheaway=' + cacheaway
            var styleEl = el.cloneNode()
            styleEl.href = url

            ;(function () {
              var finished = false
              var CSSDone = function () {
                if (finished) return undefined
                console.log('CSSDone called')
                finished = true
                setTimeout(function () {
                  // document.documentElement.style.opacity = 1.0 // [1]
                  window.dispatchEvent(new Event('resize'))
                  document.body.scrollTop = scrollTop

                  if (!hasErrors()) {
                    showModal(false)
                  }

                  setTimeout(function () {
                    el.parentNode.removeChild(el)
                    window.dispatchEvent(new Event('resize'))
                    document.body.scrollTop = scrollTop
                    console.log('injection success -- [%s]', target)

                    if (!hasErrors()) {
                      showModal(false)
                    }
                  }, 25)
                }, 25)
              }

              setTimeout(function () {
                CSSDone()
              }, 500)

              styleEl.onload = function () {
                CSSDone()
              }
              styleEl.addEventListener && styleEl.addEventListener('load', function () {
                CSSDone()
              }, false)
              styleEl.onreadystatechange = function () {
                var state = styleEl.readyState
                if (state === 'loaded' || state === 'complete') {
                  styleEl.onreadystatechange = null
                  CSSDone('onreadystatechange')
                }
              }

              var _opacity = document.documentElement.style.opacity
              document.documentElement.style.opacity = 0.0
              setTimeout(function () {
                document.documentElement.style.opacity = _opacity
                el.parentNode.appendChild(styleEl)
              }, 5)
            })()
            break

          case 'js':
            saveScrollTop()
            setTimeout(function () {
              window.location.reload()
            }, 125)
            return undefined
            break

          default:
              // unrecgonized target
              console.warn('unrecognized file suffix on inject [$]'.replace('$', target))
        }
      } else {
        // unrecgonized target
        console.warn('no element satisfying livereload event found [$]'.replace('$', target))
      }
    }, 50) // modification timeout
  })

  socket.on('inject', function (list) {
    console.log('injection received')
    var scrollTop = document.body.scrollTop

    // create some white space in the console
    console.log(new Array(24).join('\n'))
    console.log('---[' + (new Date().toLocaleString()) + ']---')

    showModal(false)
    // inject elements
    list.forEach(function (fileName) {
      console.log('injecting: %s', fileName)

      var el = undefined
      var scripts = document.querySelectorAll('script')

      el = [].filter.call(scripts, function (script) {
        var target = fileName.toLowerCase()
        return script.src.toLowerCase().indexOf(target) !== -1
      }).sort()[0] // grab first satisfying script in alphabetical order

      if (el === undefined) { // search styles
        var styles = document.querySelectorAll('link')
        el = [].filter.call(styles, function (style) {
          var target = fileName.toLowerCase()
          return style.href.toLowerCase().indexOf(target) !== -1
        }).sort()[0] // grab first satisfying style in alphabetical order
      }

      var suffix = fileName.slice(fileName.lastIndexOf('.') + 1)
      // console.log('suffix: %s', suffix)

      var cacheaway = String(Date.now()) + '_' + Math.floor(Math.random() * 1000000)

      if (el) {
        switch (suffix) {
          case 'css':
            var url = el.href.split('?')[0] + '?cacheaway=' + cacheaway
            el.href = '' // unreload
            /* The reason we want to unreload by setting el.href = '' instead of
            * simply overwriting the current one with a cachebuster query parameter
            * is so that the css is quickly reset -- this also resets
            * keyframe animations which would not otherwise be refreshed (but stuck
            * using the old animations)
            * doing this creates a slighy "blink" when the css is refreshed
            * but I think that is only an improvement since u'll know the css is fresh
            * plus it will properly reload key frame animations
            * */
            setTimeout(function () {
              el.href = url
              console.log('injection success -- [%s]', fileName)
              document.body.scrollTop = scrollTop
              // trigger window resize event (reloads css)
              setTimeout(function () {
                window.dispatchEvent(new Event('resize'))
                document.body.scrollTop = scrollTop
                setTimeout(function () {
                  window.dispatchEvent(new Event('resize'))
                  document.body.scrollTop = scrollTop
                }, 200)
              }, 50)
            }, 1)
            break

          case 'js':
            var _src = el.src
            var _id = el.id
            var parentNode = el.parentNode
            var scriptEl = document.createElement('script')

            // safe raf for our own use
            var raf = window.requestAnimationFrame
            // disable raf and let all previous raf loops terminate
            window.requestAnimationFrame = function () {}
            // run on next raf
            setTimeout(function () {
              // re-enable raf
              window.requestAnimationFrame = raf
              // remove app content
              var appEl = (
                document.getElementById( 'root' ) ||
                document.getElementById('app') ||
                document.body.children[0]
              )
              var p = appEl.parentNode
              p.removeChild(appEl) // also removes event listeners
              appEl = document.createElement('div')
              appEl.id = 'root'
              p.appendChild(appEl)

              // get current timeout id
              var timeoutId = window.setTimeout(function () {}, 0)
              // remove all previous timeouts
              while (timeoutId-- >= _lastTimeoutId) window.clearTimeout(timeoutId)
              // remember fresh timeout starting point
              var _lastTimeoutId = window.setTimeout(function () {}, 0)

              parentNode.removeChild(el)

              // update current miru build time.
              // this effectively nullifies/removes global timeouts and
              // global event listeners such as window.onresize etc
              // since our miru.init.js script attached global wrappers
              // to these event emitters
              window.__miruCurrentBuildTime = Date.now()

              setTimeout(function () {
                scriptEl.src = _src.split('?')[0] + '?cacheaway=' + cacheaway
                scriptEl.id = _id
                parentNode.appendChild(scriptEl)
                console.log('injection success -- [%s]', fileName)
              }, 50)
            }, 15)
            break
          default: console.warn('unrecognized file suffix on inject')
        }
        el.src = ''
      } else {
        console.warn('inject failed -- no such element with source [%s] found', fileName)
      }
    })
  })
}
