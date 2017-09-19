(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var AnsiToHtmlFilter = require('ansi-to-html');
var io = require('socket.io-client');

function init() {
  // Object.assign polyfill
  // https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
  if (typeof Object.assign != 'function') {
    // Must be writable: true, enumerable: false, configurable: true
    Object.defineProperty(Object, "assign", {
      value: function assign(target, varArgs) {
        // .length of function is 2
        'use strict';

        if (target == null) {
          // TypeError if undefined or null
          throw new TypeError('Cannot convert undefined or null to object');
        }

        var to = Object(target);

        for (var index = 1; index < arguments.length; index++) {
          var nextSource = arguments[index];

          if (nextSource != null) {
            // Skip over if undefined or null
            for (var nextKey in nextSource) {
              // Avoid bugs when hasOwnProperty is shadowed
              if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                to[nextKey] = nextSource[nextKey];
              }
            }
          }
        }
        return to;
      },
      writable: true,
      configurable: true
    });
  }

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
    '39': 'lightgray' // default (white) (foreground)
  };

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
  };

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
  };

  var targetErrors = {};

  // ansi-to-html relies on String.prototype.trimRight
  // it doesn't exist on IE9 though so we polyfill it if necessary
  if (!String.prototype.trimRight) {
    String.prototype.trimRight = function () {
      return this.replace(/\s+$/, '');
    };
  }

  window.__miruInitialized = false;

  function attemptResize() {
    try {
      var evt = document.createEvent('HTMLEvents');
      evt.initEvent('resize', true, false);
      window.dispatchEvent && window.dispatchEvent(evt);
    } catch (err) {
      console.log(err);
    }
  }

  function hasErrors() {
    var keys = Object.keys(targetErrors);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (targetErrors[key]) {
        console.log('has errors: ' + key);
        return true;
      }
    }
    return false;
  }

  var ansiToHtmlFilter = new AnsiToHtmlFilter({
    fg: '#fbf1c7',
    bg: '#1d2021',
    colors: Object.assign({}, _colors), // override color palette
    stream: false // do not save style state across invocations of toHtml()
  });

  console.log('miru livereload.js loaded');
  // this file is sent and run on the client

  // https://github.com/chalk/ansi-regex
  var ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-PRZcf-nqry=><]/g;

  function stripAnsi(str) {
    return str.replace(ansiRegex, '');
  }

  var xtermAnsiRegex = /\[[0-9]{1,3};[0-9]{1,3};[0-9]{1,3}m/g;
  function stripXtermAnsi(str) {
    return str.replace(xtermAnsiRegex, '');
  }

  // clc.reset, clc.erase.screen
  var ansiSpecial = /\[[0-9]?[A-Z]?(;[0-9][A-Z])?/g;
  function stripAnsiSpecial(str) {
    return str.replace(ansiSpecial, '');
  }

  function stripYouBee(str) {
    return str.replace(/\u001b/g, '');
  }

  function ansiToHtml(text) {
    return ansiToHtmlFilter.toHtml(text);
  }

  window.ansiToHtml = ansiToHtml;

  function saveScrollTop() {
    if (window.localStorage) {
      try {
        window.localStorage.setItem('__miru_scrollTop', JSON.stringify({
          scrollTop: document.body.scrollTop,
          time: Date.now()
        }));
      } catch (err) {}
    }
  }

  setTimeout(function () {
    if (window.localStorage) {
      try {
        var val = JSON.stringify(window.localStorage.getItem('__miru_scrollTop'));

        var delta = Date.now() - val.time;
        if (delta < 3000) {
          document.body.scrollTop = val.scrollTop;
        }
      } catch (err) {}
    }
  }, 500);

  var UID = function UID() {
    var counter = 0;
    var size = 1 << 16;
    return function () {
      var date = Date.now().toString(16).slice(-10);
      var rnd = String(Math.floor(Math.random() * size));
      return 'uid' + date + String(counter++) + rnd;
    };
  }();

  function initAttempt() {
    console.log('init attempt');
    if (window.__miruHost) return init();
    setTimeout(initAttempt, 1);
  }
  initAttempt();

  function findElement(elements, field, target) {
    target = '/' + target;
    target = target.slice(target.lastIndexOf('/'));
    target = target.toLowerCase().split('/').join('');
    console.log('findElement target: ' + target);
    for (var i = 0; i < elements.length; i++) {
      var t = elements[i][field].toLowerCase().split('/').join('');
      // console.log('t: ' + t)
      if (t.length < target.length) {
        if (target.indexOf(t) >= 0) return elements[i];
      } else {
        if (t.indexOf(target) >= 0) return elements[i];
      }
    }
    return undefined; // not found
  }

  var _lastTimeoutId = window.setTimeout(function () {}, 0); // get current timeout id

  function removeColors(lines) {
    var parsedLines = [];
    lines.forEach(function (line) {
      var prettyLine = line.split(/\033/).join('').split('/\x1B/').join('').split(/\[0m/).join('').split(/\[..m/).join('');
      parsedLines.push(prettyLine);
    });

    return parsedLines;
  }

  function autoAdjustFontSize() {
    var modalId = '__miruErrorModalEl';
    var el = document.getElementById(modalId);

    // if ( el ) {
    //   if ( window.innerWidth < 1340 ) {
    //     el.style['font-size'] = '21px'
    //   }

    //   if ( window.innerWidth < 1280 ) {
    //     el.style['font-size'] = '20px'
    //   }

    //   if ( window.innerWidth < 1180 ) {
    //     el.style['font-size'] = '19px'
    //   }

    //   if ( window.innerWidth < 1095 ) {
    //     el.style['font-size'] = '17px'
    //   }

    //   if ( window.innerWidth < 1015 ) {
    //     el.style['font-size'] = '16px'
    //   }
    // }

    var zoom = window.innerWidth / 720;

    // some reasonable zoom limits
    if (zoom > 9) zoom = 9;
    if (zoom < 1) zoom = 1.25;

    if (el) {
      var size = 12 * zoom | 0;
      // if ( size >= 20 ) size = 20
      el.style['font-size'] = size + 'px';
    }

    // console.log( window.innerWidth )
    // console.log( zoom )
  }

  function startProgressBar(target) {
    // TODO
    var el = getElementById('__miruProgressBarEl');

    if (!el) {
      el = document.createElement('div');
      el.id = '__miruProgressBarEl';
      document.body.appendChild(el);
    }

    el.style['transition'] = 'none';
    el.style['opacity'] = 0;
    el.style['display'] = 'block';
    el.style['position'] = 'fixed';
    el.style['top'] = 0;
    el.style['left'] = 0;
    el.style['width'] = '100%';
    el.style['height'] = '100%';

    el.style['margin'] = 0;
    el.style['padding'] = '0.475rem';
    el.style['padding'] = 0;

    el.style['background-color'] = '#2f44b6';
    // el.style['opacity'] = 0.9625
    el.style['opacity'] = 0.9725;
    el.style['white-space'] = 'pre-wrap';
    el.style['color'] = 'white';
    el.style['z-index'] = 2147483646 - 1; // ((2^32 / 2) - 2)

    el.style['font-family'] = 'monospace';
    el.style['font-size'] = '16px';

    el.style['opacity'] = 1;
  }

  window.__miruProgressTargetTimeouts = {};
  window.__miruTargetTimes = {};
  window.__miruModificationTimeout = undefined;
  window.__miruModalTimeout = undefined;
  function init() {
    console.log('miru initliazing');

    setTimeout(function () {
      window.__miruInitialized = true;
    }, 0);

    window.addEventListener('resize', function () {
      autoAdjustFontSize();
    });

    window.__miruInitTime = Date.now();

    function showModal(show, type) {
      clearTimeout(window.__miruModalTimeout);
      // console.log((show === false ? 'hiding' : 'showing') + ' error modal')
      window.__miruModalTimeout = setTimeout(function () {
        var el = undefined;
        var modalId = '__miruErrorModalEl';
        el = document.getElementById(modalId);

        if (!el) {
          el = document.createElement('div');
          el.id = modalId;
          document.body.appendChild(el);
        }

        el.style['transition'] = 'none';
        el.style['opacity'] = 0.0;
        el.style['display'] = show === false ? 'none' : 'block';
        el.style['position'] = 'fixed';
        el.style['top'] = 0;
        el.style['left'] = 0;
        el.style['width'] = '100%';
        el.style['height'] = '100%';

        el.style['margin'] = 0;
        el.style['padding'] = 0;

        el.style['background-color'] = '#b6442f';
        // el.style['opacity'] = 0.9625
        el.style['opacity'] = 0.9725;
        el.style['white-space'] = 'pre-wrap';
        el.style['color'] = 'white';
        el.style['z-index'] = 2147483646 - 2; // ((2^32 / 2) - 2)

        // el.style['font-family'] = 'monospace'
        el.style['font-family'] = "'Anonymous Pro', monospace";
        el.style['font-size'] = '22px';

        el.style['line-height'] = '1.65em';

        autoAdjustFontSize();

        switch (type) {
          case 'progress':
            return undefined; // TODO

            el.style['opacity'] = 0.0;
            el.style['background-color'] = 'rgba(110, 136, 153, 0.75)';
            el.style['transition'] = 'opacity .5s ease-in';
            window.__miruModalTimeout = setTimeout(function () {
              el.style['opacity'] = 0.90;
              el.style['width'] = '100%';
              // el.style['height'] = '32px'
            }, 0);
            break;
        }
      }, 0);

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
    showModal(false);

    var socket = io(window.__miruHost);

    socket.on('connect', function () {
      autoAdjustFontSize();
      console.log('socket connected to: ' + window.__miruHost);
    });

    socket.on('tick', function (data) {
      // console.log('miru ticking: ' + data.length)
    });

    var _progressTimeout;
    socket.on('progress', function (opts) {
      return undefined; // TODO

      autoAdjustFontSize();

      console.log('socket.on: "progress"');
      // TODO
      startProgressBar(opts.target);

      var now = Date.now();
      var target = opts.target;

      var t = window.__miruTargetTimes[target];
      if (t === undefined || t - now > 2500) {
        var lines = removeColors(opts.lines);

        var el = document.getElementById('__miruErrorModalEl');
        if (el) {
          var name = target;
          var text = lines.join('\n');

          // clear previous
          el.innerHTML = '';
          showModal(true, 'progress');

          clearTimeout(_progressTimeout);
          _progressTimeout = setTimeout(function () {
            if (!hasErrors()) showModal(false);
          }, 1000);

          var titleEl = document.createElement('pre');
          titleEl.style['padding'] = '0.675rem';
          titleEl.style['border'] = '0px solid black !important';
          titleEl.style['border-bottom'] = '1px solid #bb4444';
          titleEl.textContent = 'miru progress modal (from terminal)';
          el.appendChild(titleEl);

          var contentEl = document.createElement('pre');
          contentEl.style['opacity'] = 1.00;
          contentEl.style['white-space'] = 'pre-wrap';
          contentEl.style['color'] = 'white';
          // TODO parse and prettify error?
          contentEl.textContent = text;
          el.appendChild(contentEl);
        } else {
          console.warn('miru terminal progress received but modal id was not found.');
          console.log(error);
        }
      }
    });

    var reloadTimeout = null;

    socket.on('reload', function () {
      showModal(false);
      console.log('--- miru wants to reload the page! ---');

      clearTimeout(reloadTimeout);
      reloadTimeout = setTimeout(function () {
        window.location.reload();
      }, 125);
    });

    // if long runing process re-connects, reload full page
    socket.on('init_reload', function () {
      var now = Date.now();
      var lastTime = window.__miruInitTime;
      if (!lastTime || now - lastTime > 3000) {
        clearTimeout(reloadTimeout);
        console.log();
        console.log('-----------------');
        console.log('  init reloading...');
        console.log();
        reloadTimeout = setTimeout(function () {
          window.location.reload();
        }, 1000);
      }
    });

    var _lastErrorText;
    socket.on('error', function (error) {
      window.__miruErrorHandler(error);
    });

    window.__miruErrorHandler = function (error) {
      autoAdjustFontSize();

      var el = document.getElementById('__miruErrorModalEl');

      if (!el) {
        showModal(false);
      }

      el = document.getElementById('__miruErrorModalEl');

      if (error.target && error.target !== 'DOM') {
        console.log(' ERROR TARGET: ' + error.target);
        targetErrors[error.target] = error;
      }

      if (!window.__miruInitialized) {
        return setTimeout(function () {
          console.log('backup emit ========== ');
          window.__miruErrorHandler(error);
          // socket.emit( 'error', error )
        }, 1);
      }

      if (el) {
        console.log('starting erorr modal paint');
        var name = error.name;
        var text = error.message || error.err || error;

        var syntax = ansiToHtml(text);
        text = ansiToHtml(text) + '\n\n';

        console.log('ansi done');

        if (_lastErrorText === text) {
          console.log('error text already shown');
          showModal(true);
          return undefined;
        }

        clearTimeout(window.__miruModificationTimeout);
        console.log('received error: ', error);

        _lastErrorText = text;

        // clear previous
        el.innerHTML = '';
        showModal(true);

        var titleEl = document.createElement('div');
        titleEl.style['white-space'] = 'pre';
        titleEl.style['font-family'] = 'monospace';
        titleEl.style['padding'] = '0.675rem';
        titleEl.style['border'] = '0px solid black !important';
        titleEl.style['border-bottom'] = '1px solid #bb4444';
        titleEl.textContent = 'miru error modal (from terminal)';
        el.appendChild(titleEl);

        var contentEl = document.createElement('div');
        contentEl.style['opacity'] = 1.00;
        contentEl.style['white-space'] = 'pre';
        contentEl.style['font-family'] = 'monospace';
        contentEl.style['color'] = '#fbf1c7';
        contentEl.style['background'] = '#1d2021';
        contentEl.style['padding'] = '4px';
        // TODO parse and prettify error?
        contentEl.innerHTML = text;
        el.appendChild(contentEl);
      } else {
        console.warn('error received but miru option showErrors was turned off');
        console.log(error);
      }
    };

    socket.on('modification', function (target) {
      autoAdjustFontSize();

      var scrollTop = document.body.scrollTop;
      clearTimeout(window.__miruModificationTimeout);
      console.log('modification event received');
      console.log(target);

      targetErrors[target] = undefined;

      // if (!hasErrors()) {
      //   showModal(false)
      // }

      window.__miruModificationTimeout = setTimeout(function () {
        window.__miruTargetTimes[target] = Date.now();
        // create some white space in the console
        console.log(new Array(24 + 12).join('\n'));
        console.log(' --- [' + new Date().toLocaleString() + '] --- ');

        var scripts = document.querySelectorAll('script');
        var styles = document.querySelectorAll('link');

        var el = findElement(scripts, 'src', target) || findElement(styles, 'href', target);

        var suffix = target.slice(target.lastIndexOf('.') + 1);
        var cacheaway = UID();

        if (el) {
          switch (suffix) {
            case 'css':
              saveScrollTop();
              // window.location.reload()
              // return undefined

              var url = el.href.split('?')[0] + '?cacheaway=' + cacheaway;
              var styleEl = el.cloneNode();
              styleEl.href = url;(function () {
                var finished = false;
                var CSSDone = function CSSDone() {
                  if (finished) return undefined;
                  console.log('CSSDone called');
                  finished = true;
                  setTimeout(function () {
                    // document.documentElement.style.opacity = 1.0 // [1]
                    // window.dispatchEvent(new Event('resize'))
                    attemptResize();
                    document.body.scrollTop = scrollTop;

                    if (!hasErrors()) {
                      showModal(false);
                    }

                    setTimeout(function () {
                      el && el.parentNode && el.parentNode.removeChild(el);
                      // window.dispatchEvent(new Event('resize'))
                      attemptResize();
                      document.body.scrollTop = scrollTop;
                      console.log('injection success -- [%s]', target);

                      if (!hasErrors()) {
                        showModal(false);
                      }
                    }, 25);
                  }, 25);
                };

                setTimeout(function () {
                  CSSDone();
                }, 500);

                styleEl.onload = function () {
                  CSSDone();
                };

                // styleEl.addEventListener && styleEl.addEventListener('load', function () {
                //   CSSDone()
                // }, false)

                styleEl.onreadystatechange = function () {
                  var state = styleEl.readyState;
                  if (state === 'loaded' || state === 'complete') {
                    styleEl.onreadystatechange = null;
                    CSSDone('onreadystatechange');
                  }
                };

                var _opacity = document.documentElement.style.opacity;
                document.documentElement.style.opacity = 0.0;
                setTimeout(function () {
                  document.documentElement.style.opacity = _opacity;
                  el.parentNode.appendChild(styleEl);
                }, 5);
              })();
              break;

            case 'js':
              saveScrollTop();
              setTimeout(function () {
                if (!hasErrors()) {
                  showModal(false);
                  window.location.reload();
                }
              }, 1);
              break;

            default:
              // unrecgonized target
              console.warn('unrecognized file suffix on inject [$]'.replace('$', target));
          }
        } else {
          // unrecgonized target
          console.warn('no element satisfying livereload event found [$]'.replace('$', target));
        }
      }, 1); // modification timeout
    });

    socket.on('inject', function (list) {
      console.log('injection received');
      var scrollTop = document.body.scrollTop;

      // create some white space in the console
      console.log(new Array(24).join('\n'));
      console.log('---[' + new Date().toLocaleString() + ']---');

      showModal(false);
      // inject elements
      list.forEach(function (fileName) {
        console.log('injecting: %s', fileName);

        var el = undefined;
        var scripts = document.querySelectorAll('script');

        el = [].filter.call(scripts, function (script) {
          var target = fileName.toLowerCase();
          return script.src.toLowerCase().indexOf(target) !== -1;
        }).sort()[0]; // grab first satisfying script in alphabetical order

        if (el === undefined) {
          // search styles
          var styles = document.querySelectorAll('link');
          el = [].filter.call(styles, function (style) {
            var target = fileName.toLowerCase();
            return style.href.toLowerCase().indexOf(target) !== -1;
          }).sort()[0]; // grab first satisfying style in alphabetical order
        }

        var suffix = fileName.slice(fileName.lastIndexOf('.') + 1);
        // console.log('suffix: %s', suffix)

        var cacheaway = String(Date.now()) + '_' + Math.floor(Math.random() * 1000000);

        if (el) {
          switch (suffix) {
            case 'css':
              var url = el.href.split('?')[0] + '?cacheaway=' + cacheaway;
              el.href = ''; // unreload
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
                el.href = url;
                console.log('injection success -- [%s]', fileName);
                document.body.scrollTop = scrollTop;
                // trigger window resize event (reloads css)
                setTimeout(function () {
                  // window.dispatchEvent(new Event('resize'))
                  attemptResize();
                  document.body.scrollTop = scrollTop;
                  setTimeout(function () {
                    // window.dispatchEvent(new Event('resize'))
                    attemptResize();
                    document.body.scrollTop = scrollTop;
                  }, 200);
                }, 50);
              }, 1);
              break;

            case 'js':
              var _src = el.src;
              var _id = el.id;
              var parentNode = el.parentNode;
              var scriptEl = document.createElement('script');

              // safe raf for our own use
              var raf = window.requestAnimationFrame;
              // disable raf and let all previous raf loops terminate
              window.requestAnimationFrame = function () {};
              // run on next raf
              setTimeout(function () {
                // re-enable raf
                window.requestAnimationFrame = raf;
                // remove app content
                var appEl = document.getElementById('root') || document.getElementById('app') || document.body.children[0];
                var p = appEl.parentNode;
                p.removeChild(appEl); // also removes event listeners
                appEl = document.createElement('div');
                appEl.id = 'root';
                p.appendChild(appEl);

                // get current timeout id
                var timeoutId = window.setTimeout(function () {}, 0);
                // remove all previous timeouts
                while (timeoutId-- >= _lastTimeoutId) {
                  window.clearTimeout(timeoutId);
                } // remember fresh timeout starting point
                var _lastTimeoutId = window.setTimeout(function () {}, 0);

                parentNode.removeChild(el);

                // update current miru build time.
                // this effectively nullifies/removes global timeouts and
                // global event listeners such as window.onresize etc
                // since our miru.init.js script attached global wrappers
                // to these event emitters
                window.__miruCurrentBuildTime = Date.now();

                setTimeout(function () {
                  scriptEl.src = _src.split('?')[0] + '?cacheaway=' + cacheaway;
                  scriptEl.id = _id;
                  parentNode.appendChild(scriptEl);
                  console.log('injection success -- [%s]', fileName);
                }, 50);
              }, 15);
              break;
            default:
              console.warn('unrecognized file suffix on inject');
          }
          el.src = '';
        } else {
          console.warn('inject failed -- no such element with source [%s] found', fileName);
        }
      });
    });
  }
}

module.exports = init;

},{"ansi-to-html":4,"socket.io-client":45}],2:[function(require,module,exports){
'use strict';

var wooster = require('../wooster/dist/bundle.min.js'); // TODO

var initLivereload = require('./livereload.src.js');(function () {
  /*
  * Template script to initialize and connect with the miru dev server
  * from the front-end. Saved to disk in the current directory as 'miru.init.js'
  *
  * Usage:
  * link to the script in your html
  * (usually your index.html or dev.index.html)
  *
  * eg: <script src='miru.init.js'></script>
  * */

  // keep track of bundle build times
  window.__miruCurrentBuildTime = Date.now();

  // overload global event listeners
  // so that we can track and clean them up on js injections
  // overloadAddEventListeners([window, document && document.body])

  var __miruLogs = {};
  var __miruLogTimeout;
  function __miruLog(msg) {
    __miruLogs[msg] = __miruLogs[msg] + 1 || 1;
    clearTimeout(__miruLogTimeout);
    __miruLogTimeout = setTimeout(function () {
      Object.keys(__miruLogs).forEach(function (key) {
        console.log(key + ' [' + __miruLogs[key] + ']');
      });
      __miruLogs = {};
    }, 100);
  }

  if (window.localStorage) {
    var _scrollTop = JSON.parse(window.localStorage.getItem('__miru_scrollTop'));

    if (_scrollTop && Date.now() - _scrollTop.time < 5000) {
      var tries = [];
      for (var i = 0; i < 10; i++) {
        setTimeout(function () {
          if (document.body.scrollTop !== _scrollTop.scrollTop) {
            document.body.scrollTop = _scrollTop.scrollTop;
          }
        }, i * 50);
      }
    }
  }

  function overloadAddEventListeners(doms) {
    // console.log('overloading addEventListeners for [' + doms.join(',') + ']')

    if (!Array.isArray(doms)) doms = [doms];
    doms.forEach(function (dom) {
      if (!dom) return; // skip falsy

      var _addEventListener = dom.addEventListener;
      dom._addEventListener = _addEventListener;

      dom.addEventListener = function (type, listener, useCapture, wantsUntrusted) {
        // console.log('overloaded addEventListener callback')
        var attachedTime = window.__miruCurrentBuildTime;

        function wrappedListener(e) {
          var isValid = attachedTime === window.__miruCurrentBuildTime;
          if (isValid) {
            __miruLog('calling valid wrappedListener');
            listener(e); // run the callback
          } else {
            __miruLog('removing invalid wrappedListener');
            dom.removeEventListener(type, wrappedListener);
          }
        }

        // console.log('attaching wrappedListener')
        dom._addEventListener(type, wrappedListener, useCapture, wantsUntrusted);
      };
    });
  }

  // find the running miru dev server and connect to its socket.io server
  // to get realtime events on the bulid processes (live reloads)
  var now = Date.now();
  // var r = new XMLHttpRequest()
  // r.open('GET', window.location.protocol + '//' + window.location.hostname + ':4040/__miru/livereload.js?cachebuster=' + now)
  // r.onerror = function () {
  //   // try localhost
  //   console.log('default miru host location failed to connect, trying localhost')
  //   attachLivereloadScripts('http://localhost:4040')
  // }
  // r.onload = function () {
  //   var statusCode = r.status || r.statusCode
  //   if (statusCode >= 200 && statusCode < 400) {
  //     // try current domain (window.location.hostname)
  //     attachLivereloadScripts()
  //   } else {
  //     // try localhost
  //     console.log('default miru host location failed to connect, trying localhost')
  //     attachLivereloadScripts('http://localhost:4040')
  //   }
  // }
  // r.send()
  console.log('trying to attach live reload scripts...');

  attachLivereloadScripts();

  var loc = window.location;
  var host = loc.protocol + '//' + loc.hostname + ':' + '4040';
  var libs = host + '/__miru';

  var now = Date.now();
  var cachebuster = '?cachebuster=' + now;

  function attachLivereloadScripts() {
    var loc = window.location;
    var host = loc.protocol + '//' + loc.hostname + ':' + '4040';

    // add prefix path
    var libs = host + '/__miru';

    window.__miruHost = host;

    var scriptEl = null;
    var linkEl = null;

    var now = Date.now();
    var cachebuster = '?cachebuster=' + now;

    // attach better monospace font
    var fontLinkEl = document.createElement('link');
    fontLinkEl.rel = 'stylesheet';
    fontLinkEl.href = 'https://fonts.googleapis.com/css?family=Anonymous+Pro';
    document.head.appendChild(fontLinkEl);

    // pesticide
    try {
      var ls = window.localStorage;
      var enabled = !!JSON.parse(ls.getItem('__miru-pesticide-enabled'));
      console.log('pesticide enabled: ' + enabled);
      if (enabled) {
        enablePesticide();
      } else {
        disablePesticide();
      }
    } catch (err) {/* ignored */}

    console.log('Live Reload Scripts Attached!! from [' + libs + ']');
  }

  function savePesticideStatus() {
    var el = document.getElementById('__miru-pesticide-id');
    var enabled = !!el;

    try {
      window && window.localStorage && window.localStorage.setItem('__miru-pesticide-enabled', enabled);

      console.log('save pesticide: ' + enabled);
    } catch (err) {
      console.log(err);
    }
  }

  function enablePesticide() {
    var el = document.getElementById('__miru-pesticide-id');
    if (!el) {
      var linkEl = document.createElement('link');
      linkEl.id = '__miru-pesticide-id';
      linkEl.rel = 'stylesheet';
      linkEl.href = libs + '/pesticide.css' + cachebuster;
      document.head.appendChild(linkEl);
    }
  }

  function disablePesticide() {
    var el = document.getElementById('__miru-pesticide-id');
    if (el) {
      el.parentNode.removeChild(el);
    }
  }

  function togglePesticide() {
    var el = document.getElementById('__miru-pesticide-id');
    if (el) {
      disablePesticide();
    } else {
      enablePesticide();
    }
  }

  window.addEventListener('keyup', function (evt) {
    var key = evt.keyCode || evt.which;

    switch (key) {
      case 118: // F7 key
      case 119: // F8 key
      case 120:
        // F9 key
        togglePesticide();
        savePesticideStatus();
        break;
      default:
    }
  });

  window.enablePesticide = enablePesticide;
  window.disablePesticide = disablePesticide;
  window.togglePesticide = togglePesticide;

  function getFile(filename, callback) {
    console.log(' >> getting file: ' + filename);
    var req = new XMLHttpRequest();
    req.open('GET', filename, true);

    req.onload = function () {
      console.log(' << got file' + filename);

      if (req.status >= 200 && req.status < 500) {
        // success
        callback(undefined, req.responseText);
      } else {
        // reached server, but error
        callback('error: ' + req.status);
      }
    };

    req.onerror = function () {
      // failed to connect to server
      callback('error: failed to connect to server');
    };

    req.send();
  }

  // grab dom errors
  window.addEventListener('error', function (err) {
    var message = err.message;
    var filename = err.filename;
    var lineno = err.lineno;
    var colno = err.colno;
    console.log('miru window error');
    console.log(err);

    console.log('getting file...');
    getFile(filename, function (getError, text) {
      if (getError) {
        return console.log('file get error: ' + getError);
      }

      var _startTime = Date.now();
      console.log('got file, length: ' + text.length);

      var lines = wooster.parseContext({
        path: err.filename,
        prettify: true,
        text: text,
        lineno: err.lineno,
        colno: err.colno
      });

      var context = lines.join('\n');

      var description = err.message || '[ Unknown Error ]';
      var colorify = wooster.colorify;

      // highlight "error" words
      if (true) {
        var lineLength = 0;
        var output = ' ';
        var words = description.split(/\s+/);

        words.forEach(function (word) {
          var raw = word;
          var rawLow = raw.toLowerCase();
          if (rawLow.indexOf('error') !== -1) {
            word = colorify(raw, 'red');
          }

          // check if probably path stringy
          if (rawLow.indexOf('/') !== -1 || rawLow.indexOf('.') !== -1) {
            word = colorify(raw, 'magentaBright');
          }

          output += word.trim();

          lineLength += raw.length;
          if (lineLength > 70) {
            lineLength = 0;
            output += '\n ';
          }

          output += ' ';
        });

        description = ' ' + output.trim();
      }

      var parsedMessage = [colorify('>> wooster DOM output <<', 'blackBright'), description, '', ' @ ' + colorify(err.filename, 'magentaBright') + ' ' + colorify(err.lineno, 'redBright') + ':' + colorify(err.colno, 'redBright')].join('\n');

      parsedMessage += '\n' + context;

      var delta = Date.now() - _startTime;
      console.log('parsed message in: ' + delta + 'ms');

      var _startTime = Date.now();
      var _maxTime = 3000;

      var attempt = function attempt() {
        console.log('attempting to send error');

        if (window.__miruErrorHandler) {
          window.__miruErrorHandler({
            // target: err.filename,
            target: 'DOM',
            name: 'Error',
            message: parsedMessage
          });
        } else {
          var now = Date.now();
          if (now - _startTime < _maxTime) {
            setTimeout(attempt, 33);
          } else {
            console.log('sending DOM error timed out');
          }
        }
      };

      setTimeout(attempt, 33);
    });
  });

  function parseContext(opts) {
    // var url = opts.url
    // var message = opts.message

    var text = opts.text;
    var lines = text.split('\n');

    var colno = opts.colno;
    var lineno = opts.lineno;

    var i = Math.max(0, lineno - 6); // first line
    var j = Math.min(lines.length - 1, i + 4 + 2 + 2); // last line

    var minLeftPadding = String(j).trim().length;

    var parsedLines = [];
    for (; i < j; i++) {
      var head = String(i + 1).trim(); // line number column
      var body = lines[i]; // line text content

      // currently parsing target line
      var onTargetLine = i === lineno - 1;

      // left pad
      while (head.length < minLeftPadding) {
        head = ' ' + head;
      } // target line
      if (onTargetLine) {
        // prepend > arrow
        // head = clc.redBright('> ') + clc.whiteBright( head  )
        head = '> ' + head;
      } else {
        // context line
        // prepend two spaces ( to stay aligned with the targeted line '> ' )
        head = '  ' + head;
      }

      // separate line number and line content
      var line = head + ' | ' + body;
      parsedLines.push(line);
      // log(lines[i])

      // draw an arrow pointing upward to column location
      if (onTargetLine) {
        var offset = ''; // ^ pointer offset
        for (var x = 0; x < colno; x++) {
          offset += ' ';
        }
        var _head = String(j).trim().split(/./).join(' ') + '   | ';
        parsedLines.push(_head + offset + '^');
      }
    }

    return parsedLines;
  }
})();

initLivereload();

},{"../wooster/dist/bundle.min.js":57,"./livereload.src.js":1}],3:[function(require,module,exports){
module.exports = after

function after(count, callback, err_cb) {
    var bail = false
    err_cb = err_cb || noop
    proxy.count = count

    return (count === 0) ? callback() : proxy

    function proxy(err, result) {
        if (proxy.count <= 0) {
            throw new Error('after called too many times')
        }
        --proxy.count

        // after first error, rest are passed to err_cb
        if (err) {
            bail = true
            callback(err)
            // future error callbacks will go to error handler
            callback = err_cb
        } else if (proxy.count === 0 && !bail) {
            callback(null, result)
        }
    }
}

function noop() {}

},{}],4:[function(require,module,exports){
'use strict';

var entities = require('entities');
var defaults = {
    fg: '#FFF',
    bg: '#000',
    newline: false,
    escapeXML: false,
    stream: false,
    colors: getDefaultColors()
};

function getDefaultColors() {
    var colors = {
        0: '#000',
        1: '#A00',
        2: '#0A0',
        3: '#A50',
        4: '#00A',
        5: '#A0A',
        6: '#0AA',
        7: '#AAA',
        8: '#555',
        9: '#F55',
        10: '#5F5',
        11: '#FF5',
        12: '#55F',
        13: '#F5F',
        14: '#5FF',
        15: '#FFF'
    };

    range(0, 5).forEach(function (red) {
        range(0, 5).forEach(function (green) {
            range(0, 5).forEach(function (blue) {
                return setStyleColor(red, green, blue, colors);
            });
        });
    });

    range(0, 23).forEach(function (gray) {
        var c = gray + 232;
        var l = toHexString(gray * 10 + 8);

        colors[c] = '#' + l + l + l;
    });

    return colors;
}

/**
 * @param {number} red
 * @param {number} green
 * @param {number} blue
 * @param {object} colors
 */
function setStyleColor(red, green, blue, colors) {
    var c = 16 + red * 36 + green * 6 + blue;
    var r = red > 0 ? red * 40 + 55 : 0;
    var g = green > 0 ? green * 40 + 55 : 0;
    var b = blue > 0 ? blue * 40 + 55 : 0;

    colors[c] = toColorHexString([r, g, b]);
}

/**
 * Converts from a number like 15 to a hex string like 'F'
 * @param {number} num
 * @returns {string}
 */
function toHexString(num) {
    var str = num.toString(16);

    while (str.length < 2) {
        str = '0' + str;
    }

    return str;
}

/**
 * Converts from an array of numbers like [15, 15, 15] to a hex string like 'FFF'
 * @param {[red, green, blue]} ref
 * @returns {string}
 */
function toColorHexString(ref) {
    var results = [];

    for (var j = 0, len = ref.length; j < len; j++) {
        results.push(toHexString(ref[j]));
    }

    return '#' + results.join('');
}

/**
 * @param {Array} stack
 * @param {string} token
 * @param {*} data
 * @param {object} options
 */
function generateOutput(stack, token, data, options) {
    var result;

    if (token === 'text') {
        result = pushText(data, options);
    } else if (token === 'display') {
        result = handleDisplay(stack, data, options);
    } else if (token === 'xterm256') {
        result = pushForegroundColor(stack, options.colors[data]);
    }

    return result;
}

/**
 * @param {Array} stack
 * @param {number} code
 * @param {object} options
 * @returns {*}
 */
function handleDisplay(stack, code, options) {
    code = parseInt(code, 10);
    var result;

    var codeMap = {
        '-1': function _() {
            return '<br/>';
        },
        0: function _() {
            return stack.length && resetStyles(stack);
        },
        1: function _() {
            return pushTag(stack, 'b');
        },
        3: function _() {
            return pushTag(stack, 'i');
        },
        4: function _() {
            return pushTag(stack, 'u');
        },
        8: function _() {
            return pushStyle(stack, 'display:none');
        },
        9: function _() {
            return pushTag(stack, 'strike');
        },
        22: function _() {
            return closeTag(stack, 'b');
        },
        23: function _() {
            return closeTag(stack, 'i');
        },
        24: function _() {
            return closeTag(stack, 'u');
        },
        39: function _() {
            return pushForegroundColor(stack, options.fg);
        },
        49: function _() {
            return pushBackgroundColor(stack, options.bg);
        }
    };

    if (codeMap[code]) {
        result = codeMap[code]();
    } else if (4 < code && code < 7) {
        result = pushTag(stack, 'blink');
    } else if (29 < code && code < 38) {
        result = pushForegroundColor(stack, options.colors[code - 30]);
    } else if (39 < code && code < 48) {
        result = pushBackgroundColor(stack, options.colors[code - 40]);
    } else if (89 < code && code < 98) {
        result = pushForegroundColor(stack, options.colors[8 + (code - 90)]);
    } else if (99 < code && code < 108) {
        result = pushBackgroundColor(stack, options.colors[8 + (code - 100)]);
    }

    return result;
}

/**
 * Clear all the styles
 * @returns {string}
 */
function resetStyles(stack) {
    var stackClone = stack.slice(0);

    stack.length = 0;

    return stackClone.reverse().map(function (tag) {
        return '</' + tag + '>';
    }).join('');
}

/**
 * Creates an array of numbers ranging from low to high
 * @param {number} low
 * @param {number} high
 * @returns {Array}
 * @example range(3, 7); // creates [3, 4, 5, 6, 7]
 */
function range(low, high) {
    var results = [];

    for (var j = low; j <= high; j++) {
        results.push(j);
    }

    return results;
}

/**
 * Returns a new function that is true if value is NOT the same category
 * @param {string} category
 * @returns {function}
 */
function notCategory(category) {
    return function (e) {
        return (category === null || e.category !== category) && category !== 'all';
    };
}

/**
 * Converts a code into an ansi token type
 * @param {number} code
 * @returns {string}
 */
function categoryForCode(code) {
    code = parseInt(code, 10);
    var result = null;

    if (code === 0) {
        result = 'all';
    } else if (code === 1) {
        result = 'bold';
    } else if (2 < code && code < 5) {
        result = 'underline';
    } else if (4 < code && code < 7) {
        result = 'blink';
    } else if (code === 8) {
        result = 'hide';
    } else if (code === 9) {
        result = 'strike';
    } else if (29 < code && code < 38 || code === 39 || 89 < code && code < 98) {
        result = 'foreground-color';
    } else if (39 < code && code < 48 || code === 49 || 99 < code && code < 108) {
        result = 'background-color';
    }

    return result;
}

/**
 * @param {string} text
 * @param {object} options
 * @returns {string}
 */
function pushText(text, options) {
    if (options.escapeXML) {
        return entities.encodeXML(text);
    }

    return text;
}

/**
 * @param {Array} stack
 * @param {string} tag
 * @param {string} [style='']
 * @returns {string}
 */
function pushTag(stack, tag, style) {
    if (!style) {
        style = '';
    }

    stack.push(tag);

    return ['<' + tag, style ? ' style="' + style + '"' : void 0, '>'].join('');
}

/**
 * @param {Array} stack
 * @param {string} style
 * @returns {string}
 */
function pushStyle(stack, style) {
    return pushTag(stack, 'span', style);
}

function pushForegroundColor(stack, color) {
    return pushTag(stack, 'span', 'color:' + color);
}

function pushBackgroundColor(stack, color) {
    return pushTag(stack, 'span', 'background-color:' + color);
}

/**
 * @param {Array} stack
 * @param {string} style
 * @returns {string}
 */
function closeTag(stack, style) {
    var last;

    if (stack.slice(-1)[0] === style) {
        last = stack.pop();
    }

    if (last) {
        return '</' + style + '>';
    }
}

/**
 * @param {string} text
 * @param {object} options
 * @param {function} callback
 * @returns {Array}
 */
function tokenize(text, options, callback) {
    var ansiMatch = false;
    var ansiHandler = 3;

    function remove() {
        return '';
    }

    function removeXterm256(m, g1) {
        callback('xterm256', g1);
        return '';
    }

    function newline(m) {
        if (options.newline) {
            callback('display', -1);
        } else {
            callback('text', m);
        }

        return '';
    }

    function ansiMess(m, g1) {
        ansiMatch = true;
        if (g1.trim().length === 0) {
            g1 = '0';
        }

        g1 = g1.trimRight(';').split(';');

        for (var o = 0, len = g1.length; o < len; o++) {
            callback('display', g1[o]);
        }

        return '';
    }

    function realText(m) {
        callback('text', m);

        return '';
    }

    /* eslint no-control-regex:0 */
    var tokens = [{
        pattern: /^\x08+/,
        sub: remove
    }, {
        pattern: /^\x1b\[[012]?K/,
        sub: remove
    }, {
        pattern: /^\x1b\[38;5;(\d+)m/,
        sub: removeXterm256
    }, {
        pattern: /^\n/,
        sub: newline
    }, {
        pattern: /^\x1b\[((?:\d{1,3};?)+|)m/,
        sub: ansiMess
    }, {
        pattern: /^\x1b\[?[\d;]{0,3}/,
        sub: remove
    }, {
        pattern: /^([^\x1b\x08\n]+)/,
        sub: realText
    }];

    function process(handler, i) {
        if (i > ansiHandler && ansiMatch) {
            return;
        }

        ansiMatch = false;

        text = text.replace(handler.pattern, handler.sub);
    }

    var handler;
    var results1 = [];
    var length = text.length;

    outer: while (length > 0) {
        for (var i = 0, o = 0, len = tokens.length; o < len; i = ++o) {
            handler = tokens[i];
            process(handler, i);

            if (text.length !== length) {
                // We matched a token and removed it from the text. We need to
                // start matching *all* tokens against the new text.
                length = text.length;
                continue outer;
            }
        }

        if (text.length === length) {
            break;
        } else {
            results1.push(0);
        }

        length = text.length;
    }

    return results1;
}

/**
 * If streaming, then the stack is "sticky"
 *
 * @param {Array} stickyStack
 * @param {string} token
 * @param {*} data
 * @returns {Array}
 */
function updateStickyStack(stickyStack, token, data) {
    if (token !== 'text') {
        stickyStack = stickyStack.filter(notCategory(categoryForCode(data)));
        stickyStack.push({ token: token, data: data, category: categoryForCode(data) });
    }

    return stickyStack;
}

function Filter(options) {
    options = options || {};

    if (options.colors) {
        options.colors = Object.assign({}, defaults.colors, options.colors);
    }

    this.opts = Object.assign({}, defaults, options);
    this.stack = [];
    this.stickyStack = [];
}

Filter.prototype = {
    toHtml: function toHtml(input) {
        var _this = this;

        input = typeof input === 'string' ? [input] : input;
        var stack = this.stack;
        var options = this.opts;
        var buf = [];

        this.stickyStack.forEach(function (element) {
            var output = generateOutput(stack, element.token, element.data, options);

            if (output) {
                buf.push(output);
            }
        });

        tokenize(input.join(''), options, function (token, data) {
            var output = generateOutput(stack, token, data, options);

            if (output) {
                buf.push(output);
            }

            if (options.stream) {
                _this.stickyStack = updateStickyStack(_this.stickyStack, token, data);
            }
        });

        if (stack.length) {
            buf.push(resetStyles(stack));
        }

        return buf.join('');
    }
};

module.exports = Filter;
},{"entities":28}],5:[function(require,module,exports){
/**
 * An abstraction for slicing an arraybuffer even when
 * ArrayBuffer.prototype.slice is not supported
 *
 * @api public
 */

module.exports = function(arraybuffer, start, end) {
  var bytes = arraybuffer.byteLength;
  start = start || 0;
  end = end || bytes;

  if (arraybuffer.slice) { return arraybuffer.slice(start, end); }

  if (start < 0) { start += bytes; }
  if (end < 0) { end += bytes; }
  if (end > bytes) { end = bytes; }

  if (start >= bytes || start >= end || bytes === 0) {
    return new ArrayBuffer(0);
  }

  var abv = new Uint8Array(arraybuffer);
  var result = new Uint8Array(end - start);
  for (var i = start, ii = 0; i < end; i++, ii++) {
    result[ii] = abv[i];
  }
  return result.buffer;
};

},{}],6:[function(require,module,exports){

/**
 * Expose `Backoff`.
 */

module.exports = Backoff;

/**
 * Initialize backoff timer with `opts`.
 *
 * - `min` initial timeout in milliseconds [100]
 * - `max` max timeout [10000]
 * - `jitter` [0]
 * - `factor` [2]
 *
 * @param {Object} opts
 * @api public
 */

function Backoff(opts) {
  opts = opts || {};
  this.ms = opts.min || 100;
  this.max = opts.max || 10000;
  this.factor = opts.factor || 2;
  this.jitter = opts.jitter > 0 && opts.jitter <= 1 ? opts.jitter : 0;
  this.attempts = 0;
}

/**
 * Return the backoff duration.
 *
 * @return {Number}
 * @api public
 */

Backoff.prototype.duration = function(){
  var ms = this.ms * Math.pow(this.factor, this.attempts++);
  if (this.jitter) {
    var rand =  Math.random();
    var deviation = Math.floor(rand * this.jitter * ms);
    ms = (Math.floor(rand * 10) & 1) == 0  ? ms - deviation : ms + deviation;
  }
  return Math.min(ms, this.max) | 0;
};

/**
 * Reset the number of attempts.
 *
 * @api public
 */

Backoff.prototype.reset = function(){
  this.attempts = 0;
};

/**
 * Set the minimum duration
 *
 * @api public
 */

Backoff.prototype.setMin = function(min){
  this.ms = min;
};

/**
 * Set the maximum duration
 *
 * @api public
 */

Backoff.prototype.setMax = function(max){
  this.max = max;
};

/**
 * Set the jitter
 *
 * @api public
 */

Backoff.prototype.setJitter = function(jitter){
  this.jitter = jitter;
};


},{}],7:[function(require,module,exports){
/*
 * base64-arraybuffer
 * https://github.com/niklasvh/base64-arraybuffer
 *
 * Copyright (c) 2012 Niklas von Hertzen
 * Licensed under the MIT license.
 */
(function(){
  "use strict";

  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  // Use a lookup table to find the index.
  var lookup = new Uint8Array(256);
  for (var i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  exports.encode = function(arraybuffer) {
    var bytes = new Uint8Array(arraybuffer),
    i, len = bytes.length, base64 = "";

    for (i = 0; i < len; i+=3) {
      base64 += chars[bytes[i] >> 2];
      base64 += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
      base64 += chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
      base64 += chars[bytes[i + 2] & 63];
    }

    if ((len % 3) === 2) {
      base64 = base64.substring(0, base64.length - 1) + "=";
    } else if (len % 3 === 1) {
      base64 = base64.substring(0, base64.length - 2) + "==";
    }

    return base64;
  };

  exports.decode =  function(base64) {
    var bufferLength = base64.length * 0.75,
    len = base64.length, i, p = 0,
    encoded1, encoded2, encoded3, encoded4;

    if (base64[base64.length - 1] === "=") {
      bufferLength--;
      if (base64[base64.length - 2] === "=") {
        bufferLength--;
      }
    }

    var arraybuffer = new ArrayBuffer(bufferLength),
    bytes = new Uint8Array(arraybuffer);

    for (i = 0; i < len; i+=4) {
      encoded1 = lookup[base64.charCodeAt(i)];
      encoded2 = lookup[base64.charCodeAt(i+1)];
      encoded3 = lookup[base64.charCodeAt(i+2)];
      encoded4 = lookup[base64.charCodeAt(i+3)];

      bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }

    return arraybuffer;
  };
})();

},{}],8:[function(require,module,exports){
(function (global){
/**
 * Create a blob builder even when vendor prefixes exist
 */

var BlobBuilder = global.BlobBuilder
  || global.WebKitBlobBuilder
  || global.MSBlobBuilder
  || global.MozBlobBuilder;

/**
 * Check if Blob constructor is supported
 */

var blobSupported = (function() {
  try {
    var a = new Blob(['hi']);
    return a.size === 2;
  } catch(e) {
    return false;
  }
})();

/**
 * Check if Blob constructor supports ArrayBufferViews
 * Fails in Safari 6, so we need to map to ArrayBuffers there.
 */

var blobSupportsArrayBufferView = blobSupported && (function() {
  try {
    var b = new Blob([new Uint8Array([1,2])]);
    return b.size === 2;
  } catch(e) {
    return false;
  }
})();

/**
 * Check if BlobBuilder is supported
 */

var blobBuilderSupported = BlobBuilder
  && BlobBuilder.prototype.append
  && BlobBuilder.prototype.getBlob;

/**
 * Helper function that maps ArrayBufferViews to ArrayBuffers
 * Used by BlobBuilder constructor and old browsers that didn't
 * support it in the Blob constructor.
 */

function mapArrayBufferViews(ary) {
  for (var i = 0; i < ary.length; i++) {
    var chunk = ary[i];
    if (chunk.buffer instanceof ArrayBuffer) {
      var buf = chunk.buffer;

      // if this is a subarray, make a copy so we only
      // include the subarray region from the underlying buffer
      if (chunk.byteLength !== buf.byteLength) {
        var copy = new Uint8Array(chunk.byteLength);
        copy.set(new Uint8Array(buf, chunk.byteOffset, chunk.byteLength));
        buf = copy.buffer;
      }

      ary[i] = buf;
    }
  }
}

function BlobBuilderConstructor(ary, options) {
  options = options || {};

  var bb = new BlobBuilder();
  mapArrayBufferViews(ary);

  for (var i = 0; i < ary.length; i++) {
    bb.append(ary[i]);
  }

  return (options.type) ? bb.getBlob(options.type) : bb.getBlob();
};

function BlobConstructor(ary, options) {
  mapArrayBufferViews(ary);
  return new Blob(ary, options || {});
};

module.exports = (function() {
  if (blobSupported) {
    return blobSupportsArrayBufferView ? global.Blob : BlobConstructor;
  } else if (blobBuilderSupported) {
    return BlobBuilderConstructor;
  } else {
    return undefined;
  }
})();

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],9:[function(require,module,exports){

},{}],10:[function(require,module,exports){
/**
 * Slice reference.
 */

var slice = [].slice;

/**
 * Bind `obj` to `fn`.
 *
 * @param {Object} obj
 * @param {Function|String} fn or string
 * @return {Function}
 * @api public
 */

module.exports = function(obj, fn){
  if ('string' == typeof fn) fn = obj[fn];
  if ('function' != typeof fn) throw new Error('bind() requires a function');
  var args = slice.call(arguments, 2);
  return function(){
    return fn.apply(obj, args.concat(slice.call(arguments)));
  }
};

},{}],11:[function(require,module,exports){

module.exports = function(a, b){
  var fn = function(){};
  fn.prototype = b.prototype;
  a.prototype = new fn;
  a.prototype.constructor = a;
};
},{}],12:[function(require,module,exports){
(function (process){
/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // NB: In an Electron preload script, document will be defined but not fully
  // initialized. Since we know we're in Chrome, we'll just detect this case
  // explicitly
  if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
    return true;
  }

  // is webkit? http://stackoverflow.com/a/16459606/376773
  // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
  return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
    // double check webkit in userAgent just in case we are in a worker
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  try {
    return JSON.stringify(v);
  } catch (err) {
    return '[UnexpectedJSONParseError]: ' + err.message;
  }
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs(args) {
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return;

  var c = 'color: ' + this.color;
  args.splice(1, 0, c, 'color: inherit')

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-zA-Z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = exports.storage.debug;
  } catch(e) {}

  // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
  if (!r && typeof process !== 'undefined' && 'env' in process) {
    r = process.env.DEBUG;
  }

  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage() {
  try {
    return window.localStorage;
  } catch (e) {}
}

}).call(this,require('_process'))
},{"./debug":13,"_process":44}],13:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = createDebug.debug = createDebug['default'] = createDebug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = require('ms');

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
 */

exports.formatters = {};

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 * @param {String} namespace
 * @return {Number}
 * @api private
 */

function selectColor(namespace) {
  var hash = 0, i;

  for (i in namespace) {
    hash  = ((hash << 5) - hash) + namespace.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  return exports.colors[Math.abs(hash) % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function createDebug(namespace) {

  function debug() {
    // disabled?
    if (!debug.enabled) return;

    var self = debug;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // turn the `arguments` into a proper Array
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %O
      args.unshift('%O');
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-zA-Z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    // apply env-specific formatting (colors, etc.)
    exports.formatArgs.call(self, args);

    var logFn = debug.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }

  debug.namespace = namespace;
  debug.enabled = exports.enabled(namespace);
  debug.useColors = exports.useColors();
  debug.color = selectColor(namespace);

  // env-specific initialization logic for debug instances
  if ('function' === typeof exports.init) {
    exports.init(debug);
  }

  return debug;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  exports.names = [];
  exports.skips = [];

  var split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

},{"ms":40}],14:[function(require,module,exports){

module.exports = require('./lib/index');

},{"./lib/index":15}],15:[function(require,module,exports){

module.exports = require('./socket');

/**
 * Exports parser
 *
 * @api public
 *
 */
module.exports.parser = require('engine.io-parser');

},{"./socket":16,"engine.io-parser":25}],16:[function(require,module,exports){
(function (global){
/**
 * Module dependencies.
 */

var transports = require('./transports/index');
var Emitter = require('component-emitter');
var debug = require('debug')('engine.io-client:socket');
var index = require('indexof');
var parser = require('engine.io-parser');
var parseuri = require('parseuri');
var parsejson = require('parsejson');
var parseqs = require('parseqs');

/**
 * Module exports.
 */

module.exports = Socket;

/**
 * Socket constructor.
 *
 * @param {String|Object} uri or options
 * @param {Object} options
 * @api public
 */

function Socket (uri, opts) {
  if (!(this instanceof Socket)) return new Socket(uri, opts);

  opts = opts || {};

  if (uri && 'object' === typeof uri) {
    opts = uri;
    uri = null;
  }

  if (uri) {
    uri = parseuri(uri);
    opts.hostname = uri.host;
    opts.secure = uri.protocol === 'https' || uri.protocol === 'wss';
    opts.port = uri.port;
    if (uri.query) opts.query = uri.query;
  } else if (opts.host) {
    opts.hostname = parseuri(opts.host).host;
  }

  this.secure = null != opts.secure ? opts.secure
    : (global.location && 'https:' === location.protocol);

  if (opts.hostname && !opts.port) {
    // if no port is specified manually, use the protocol default
    opts.port = this.secure ? '443' : '80';
  }

  this.agent = opts.agent || false;
  this.hostname = opts.hostname ||
    (global.location ? location.hostname : 'localhost');
  this.port = opts.port || (global.location && location.port
      ? location.port
      : (this.secure ? 443 : 80));
  this.query = opts.query || {};
  if ('string' === typeof this.query) this.query = parseqs.decode(this.query);
  this.upgrade = false !== opts.upgrade;
  this.path = (opts.path || '/engine.io').replace(/\/$/, '') + '/';
  this.forceJSONP = !!opts.forceJSONP;
  this.jsonp = false !== opts.jsonp;
  this.forceBase64 = !!opts.forceBase64;
  this.enablesXDR = !!opts.enablesXDR;
  this.timestampParam = opts.timestampParam || 't';
  this.timestampRequests = opts.timestampRequests;
  this.transports = opts.transports || ['polling', 'websocket'];
  this.transportOptions = opts.transportOptions || {};
  this.readyState = '';
  this.writeBuffer = [];
  this.prevBufferLen = 0;
  this.policyPort = opts.policyPort || 843;
  this.rememberUpgrade = opts.rememberUpgrade || false;
  this.binaryType = null;
  this.onlyBinaryUpgrades = opts.onlyBinaryUpgrades;
  this.perMessageDeflate = false !== opts.perMessageDeflate ? (opts.perMessageDeflate || {}) : false;

  if (true === this.perMessageDeflate) this.perMessageDeflate = {};
  if (this.perMessageDeflate && null == this.perMessageDeflate.threshold) {
    this.perMessageDeflate.threshold = 1024;
  }

  // SSL options for Node.js client
  this.pfx = opts.pfx || null;
  this.key = opts.key || null;
  this.passphrase = opts.passphrase || null;
  this.cert = opts.cert || null;
  this.ca = opts.ca || null;
  this.ciphers = opts.ciphers || null;
  this.rejectUnauthorized = opts.rejectUnauthorized === undefined ? true : opts.rejectUnauthorized;
  this.forceNode = !!opts.forceNode;

  // other options for Node.js client
  var freeGlobal = typeof global === 'object' && global;
  if (freeGlobal.global === freeGlobal) {
    if (opts.extraHeaders && Object.keys(opts.extraHeaders).length > 0) {
      this.extraHeaders = opts.extraHeaders;
    }

    if (opts.localAddress) {
      this.localAddress = opts.localAddress;
    }
  }

  // set on handshake
  this.id = null;
  this.upgrades = null;
  this.pingInterval = null;
  this.pingTimeout = null;

  // set on heartbeat
  this.pingIntervalTimer = null;
  this.pingTimeoutTimer = null;

  this.open();
}

Socket.priorWebsocketSuccess = false;

/**
 * Mix in `Emitter`.
 */

Emitter(Socket.prototype);

/**
 * Protocol version.
 *
 * @api public
 */

Socket.protocol = parser.protocol; // this is an int

/**
 * Expose deps for legacy compatibility
 * and standalone browser access.
 */

Socket.Socket = Socket;
Socket.Transport = require('./transport');
Socket.transports = require('./transports/index');
Socket.parser = require('engine.io-parser');

/**
 * Creates transport of the given type.
 *
 * @param {String} transport name
 * @return {Transport}
 * @api private
 */

Socket.prototype.createTransport = function (name) {
  debug('creating transport "%s"', name);
  var query = clone(this.query);

  // append engine.io protocol identifier
  query.EIO = parser.protocol;

  // transport name
  query.transport = name;

  // per-transport options
  var options = this.transportOptions[name] || {};

  // session id if we already have one
  if (this.id) query.sid = this.id;

  var transport = new transports[name]({
    query: query,
    socket: this,
    agent: options.agent || this.agent,
    hostname: options.hostname || this.hostname,
    port: options.port || this.port,
    secure: options.secure || this.secure,
    path: options.path || this.path,
    forceJSONP: options.forceJSONP || this.forceJSONP,
    jsonp: options.jsonp || this.jsonp,
    forceBase64: options.forceBase64 || this.forceBase64,
    enablesXDR: options.enablesXDR || this.enablesXDR,
    timestampRequests: options.timestampRequests || this.timestampRequests,
    timestampParam: options.timestampParam || this.timestampParam,
    policyPort: options.policyPort || this.policyPort,
    pfx: options.pfx || this.pfx,
    key: options.key || this.key,
    passphrase: options.passphrase || this.passphrase,
    cert: options.cert || this.cert,
    ca: options.ca || this.ca,
    ciphers: options.ciphers || this.ciphers,
    rejectUnauthorized: options.rejectUnauthorized || this.rejectUnauthorized,
    perMessageDeflate: options.perMessageDeflate || this.perMessageDeflate,
    extraHeaders: options.extraHeaders || this.extraHeaders,
    forceNode: options.forceNode || this.forceNode,
    localAddress: options.localAddress || this.localAddress,
    requestTimeout: options.requestTimeout || this.requestTimeout,
    protocols: options.protocols || void (0)
  });

  return transport;
};

function clone (obj) {
  var o = {};
  for (var i in obj) {
    if (obj.hasOwnProperty(i)) {
      o[i] = obj[i];
    }
  }
  return o;
}

/**
 * Initializes transport to use and starts probe.
 *
 * @api private
 */
Socket.prototype.open = function () {
  var transport;
  if (this.rememberUpgrade && Socket.priorWebsocketSuccess && this.transports.indexOf('websocket') !== -1) {
    transport = 'websocket';
  } else if (0 === this.transports.length) {
    // Emit error on next tick so it can be listened to
    var self = this;
    setTimeout(function () {
      self.emit('error', 'No transports available');
    }, 0);
    return;
  } else {
    transport = this.transports[0];
  }
  this.readyState = 'opening';

  // Retry with the next transport if the transport is disabled (jsonp: false)
  try {
    transport = this.createTransport(transport);
  } catch (e) {
    this.transports.shift();
    this.open();
    return;
  }

  transport.open();
  this.setTransport(transport);
};

/**
 * Sets the current transport. Disables the existing one (if any).
 *
 * @api private
 */

Socket.prototype.setTransport = function (transport) {
  debug('setting transport %s', transport.name);
  var self = this;

  if (this.transport) {
    debug('clearing existing transport %s', this.transport.name);
    this.transport.removeAllListeners();
  }

  // set up transport
  this.transport = transport;

  // set up transport listeners
  transport
  .on('drain', function () {
    self.onDrain();
  })
  .on('packet', function (packet) {
    self.onPacket(packet);
  })
  .on('error', function (e) {
    self.onError(e);
  })
  .on('close', function () {
    self.onClose('transport close');
  });
};

/**
 * Probes a transport.
 *
 * @param {String} transport name
 * @api private
 */

Socket.prototype.probe = function (name) {
  debug('probing transport "%s"', name);
  var transport = this.createTransport(name, { probe: 1 });
  var failed = false;
  var self = this;

  Socket.priorWebsocketSuccess = false;

  function onTransportOpen () {
    if (self.onlyBinaryUpgrades) {
      var upgradeLosesBinary = !this.supportsBinary && self.transport.supportsBinary;
      failed = failed || upgradeLosesBinary;
    }
    if (failed) return;

    debug('probe transport "%s" opened', name);
    transport.send([{ type: 'ping', data: 'probe' }]);
    transport.once('packet', function (msg) {
      if (failed) return;
      if ('pong' === msg.type && 'probe' === msg.data) {
        debug('probe transport "%s" pong', name);
        self.upgrading = true;
        self.emit('upgrading', transport);
        if (!transport) return;
        Socket.priorWebsocketSuccess = 'websocket' === transport.name;

        debug('pausing current transport "%s"', self.transport.name);
        self.transport.pause(function () {
          if (failed) return;
          if ('closed' === self.readyState) return;
          debug('changing transport and sending upgrade packet');

          cleanup();

          self.setTransport(transport);
          transport.send([{ type: 'upgrade' }]);
          self.emit('upgrade', transport);
          transport = null;
          self.upgrading = false;
          self.flush();
        });
      } else {
        debug('probe transport "%s" failed', name);
        var err = new Error('probe error');
        err.transport = transport.name;
        self.emit('upgradeError', err);
      }
    });
  }

  function freezeTransport () {
    if (failed) return;

    // Any callback called by transport should be ignored since now
    failed = true;

    cleanup();

    transport.close();
    transport = null;
  }

  // Handle any error that happens while probing
  function onerror (err) {
    var error = new Error('probe error: ' + err);
    error.transport = transport.name;

    freezeTransport();

    debug('probe transport "%s" failed because of error: %s', name, err);

    self.emit('upgradeError', error);
  }

  function onTransportClose () {
    onerror('transport closed');
  }

  // When the socket is closed while we're probing
  function onclose () {
    onerror('socket closed');
  }

  // When the socket is upgraded while we're probing
  function onupgrade (to) {
    if (transport && to.name !== transport.name) {
      debug('"%s" works - aborting "%s"', to.name, transport.name);
      freezeTransport();
    }
  }

  // Remove all listeners on the transport and on self
  function cleanup () {
    transport.removeListener('open', onTransportOpen);
    transport.removeListener('error', onerror);
    transport.removeListener('close', onTransportClose);
    self.removeListener('close', onclose);
    self.removeListener('upgrading', onupgrade);
  }

  transport.once('open', onTransportOpen);
  transport.once('error', onerror);
  transport.once('close', onTransportClose);

  this.once('close', onclose);
  this.once('upgrading', onupgrade);

  transport.open();
};

/**
 * Called when connection is deemed open.
 *
 * @api public
 */

Socket.prototype.onOpen = function () {
  debug('socket open');
  this.readyState = 'open';
  Socket.priorWebsocketSuccess = 'websocket' === this.transport.name;
  this.emit('open');
  this.flush();

  // we check for `readyState` in case an `open`
  // listener already closed the socket
  if ('open' === this.readyState && this.upgrade && this.transport.pause) {
    debug('starting upgrade probes');
    for (var i = 0, l = this.upgrades.length; i < l; i++) {
      this.probe(this.upgrades[i]);
    }
  }
};

/**
 * Handles a packet.
 *
 * @api private
 */

Socket.prototype.onPacket = function (packet) {
  if ('opening' === this.readyState || 'open' === this.readyState ||
      'closing' === this.readyState) {
    debug('socket receive: type "%s", data "%s"', packet.type, packet.data);

    this.emit('packet', packet);

    // Socket is live - any packet counts
    this.emit('heartbeat');

    switch (packet.type) {
      case 'open':
        this.onHandshake(parsejson(packet.data));
        break;

      case 'pong':
        this.setPing();
        this.emit('pong');
        break;

      case 'error':
        var err = new Error('server error');
        err.code = packet.data;
        this.onError(err);
        break;

      case 'message':
        this.emit('data', packet.data);
        this.emit('message', packet.data);
        break;
    }
  } else {
    debug('packet received with socket readyState "%s"', this.readyState);
  }
};

/**
 * Called upon handshake completion.
 *
 * @param {Object} handshake obj
 * @api private
 */

Socket.prototype.onHandshake = function (data) {
  this.emit('handshake', data);
  this.id = data.sid;
  this.transport.query.sid = data.sid;
  this.upgrades = this.filterUpgrades(data.upgrades);
  this.pingInterval = data.pingInterval;
  this.pingTimeout = data.pingTimeout;
  this.onOpen();
  // In case open handler closes socket
  if ('closed' === this.readyState) return;
  this.setPing();

  // Prolong liveness of socket on heartbeat
  this.removeListener('heartbeat', this.onHeartbeat);
  this.on('heartbeat', this.onHeartbeat);
};

/**
 * Resets ping timeout.
 *
 * @api private
 */

Socket.prototype.onHeartbeat = function (timeout) {
  clearTimeout(this.pingTimeoutTimer);
  var self = this;
  self.pingTimeoutTimer = setTimeout(function () {
    if ('closed' === self.readyState) return;
    self.onClose('ping timeout');
  }, timeout || (self.pingInterval + self.pingTimeout));
};

/**
 * Pings server every `this.pingInterval` and expects response
 * within `this.pingTimeout` or closes connection.
 *
 * @api private
 */

Socket.prototype.setPing = function () {
  var self = this;
  clearTimeout(self.pingIntervalTimer);
  self.pingIntervalTimer = setTimeout(function () {
    debug('writing ping packet - expecting pong within %sms', self.pingTimeout);
    self.ping();
    self.onHeartbeat(self.pingTimeout);
  }, self.pingInterval);
};

/**
* Sends a ping packet.
*
* @api private
*/

Socket.prototype.ping = function () {
  var self = this;
  this.sendPacket('ping', function () {
    self.emit('ping');
  });
};

/**
 * Called on `drain` event
 *
 * @api private
 */

Socket.prototype.onDrain = function () {
  this.writeBuffer.splice(0, this.prevBufferLen);

  // setting prevBufferLen = 0 is very important
  // for example, when upgrading, upgrade packet is sent over,
  // and a nonzero prevBufferLen could cause problems on `drain`
  this.prevBufferLen = 0;

  if (0 === this.writeBuffer.length) {
    this.emit('drain');
  } else {
    this.flush();
  }
};

/**
 * Flush write buffers.
 *
 * @api private
 */

Socket.prototype.flush = function () {
  if ('closed' !== this.readyState && this.transport.writable &&
    !this.upgrading && this.writeBuffer.length) {
    debug('flushing %d packets in socket', this.writeBuffer.length);
    this.transport.send(this.writeBuffer);
    // keep track of current length of writeBuffer
    // splice writeBuffer and callbackBuffer on `drain`
    this.prevBufferLen = this.writeBuffer.length;
    this.emit('flush');
  }
};

/**
 * Sends a message.
 *
 * @param {String} message.
 * @param {Function} callback function.
 * @param {Object} options.
 * @return {Socket} for chaining.
 * @api public
 */

Socket.prototype.write =
Socket.prototype.send = function (msg, options, fn) {
  this.sendPacket('message', msg, options, fn);
  return this;
};

/**
 * Sends a packet.
 *
 * @param {String} packet type.
 * @param {String} data.
 * @param {Object} options.
 * @param {Function} callback function.
 * @api private
 */

Socket.prototype.sendPacket = function (type, data, options, fn) {
  if ('function' === typeof data) {
    fn = data;
    data = undefined;
  }

  if ('function' === typeof options) {
    fn = options;
    options = null;
  }

  if ('closing' === this.readyState || 'closed' === this.readyState) {
    return;
  }

  options = options || {};
  options.compress = false !== options.compress;

  var packet = {
    type: type,
    data: data,
    options: options
  };
  this.emit('packetCreate', packet);
  this.writeBuffer.push(packet);
  if (fn) this.once('flush', fn);
  this.flush();
};

/**
 * Closes the connection.
 *
 * @api private
 */

Socket.prototype.close = function () {
  if ('opening' === this.readyState || 'open' === this.readyState) {
    this.readyState = 'closing';

    var self = this;

    if (this.writeBuffer.length) {
      this.once('drain', function () {
        if (this.upgrading) {
          waitForUpgrade();
        } else {
          close();
        }
      });
    } else if (this.upgrading) {
      waitForUpgrade();
    } else {
      close();
    }
  }

  function close () {
    self.onClose('forced close');
    debug('socket closing - telling transport to close');
    self.transport.close();
  }

  function cleanupAndClose () {
    self.removeListener('upgrade', cleanupAndClose);
    self.removeListener('upgradeError', cleanupAndClose);
    close();
  }

  function waitForUpgrade () {
    // wait for upgrade to finish since we can't send packets while pausing a transport
    self.once('upgrade', cleanupAndClose);
    self.once('upgradeError', cleanupAndClose);
  }

  return this;
};

/**
 * Called upon transport error
 *
 * @api private
 */

Socket.prototype.onError = function (err) {
  debug('socket error %j', err);
  Socket.priorWebsocketSuccess = false;
  this.emit('error', err);
  this.onClose('transport error', err);
};

/**
 * Called upon transport close.
 *
 * @api private
 */

Socket.prototype.onClose = function (reason, desc) {
  if ('opening' === this.readyState || 'open' === this.readyState || 'closing' === this.readyState) {
    debug('socket close with reason: "%s"', reason);
    var self = this;

    // clear timers
    clearTimeout(this.pingIntervalTimer);
    clearTimeout(this.pingTimeoutTimer);

    // stop event from firing again for transport
    this.transport.removeAllListeners('close');

    // ensure transport won't stay open
    this.transport.close();

    // ignore further transport communication
    this.transport.removeAllListeners();

    // set ready state
    this.readyState = 'closed';

    // clear session id
    this.id = null;

    // emit close event
    this.emit('close', reason, desc);

    // clean buffers after, so users can still
    // grab the buffers on `close` event
    self.writeBuffer = [];
    self.prevBufferLen = 0;
  }
};

/**
 * Filters upgrades, returning only those matching client transports.
 *
 * @param {Array} server upgrades
 * @api private
 *
 */

Socket.prototype.filterUpgrades = function (upgrades) {
  var filteredUpgrades = [];
  for (var i = 0, j = upgrades.length; i < j; i++) {
    if (~index(this.transports, upgrades[i])) filteredUpgrades.push(upgrades[i]);
  }
  return filteredUpgrades;
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./transport":17,"./transports/index":18,"component-emitter":24,"debug":12,"engine.io-parser":25,"indexof":39,"parsejson":41,"parseqs":42,"parseuri":43}],17:[function(require,module,exports){
/**
 * Module dependencies.
 */

var parser = require('engine.io-parser');
var Emitter = require('component-emitter');

/**
 * Module exports.
 */

module.exports = Transport;

/**
 * Transport abstract constructor.
 *
 * @param {Object} options.
 * @api private
 */

function Transport (opts) {
  this.path = opts.path;
  this.hostname = opts.hostname;
  this.port = opts.port;
  this.secure = opts.secure;
  this.query = opts.query;
  this.timestampParam = opts.timestampParam;
  this.timestampRequests = opts.timestampRequests;
  this.readyState = '';
  this.agent = opts.agent || false;
  this.socket = opts.socket;
  this.enablesXDR = opts.enablesXDR;

  // SSL options for Node.js client
  this.pfx = opts.pfx;
  this.key = opts.key;
  this.passphrase = opts.passphrase;
  this.cert = opts.cert;
  this.ca = opts.ca;
  this.ciphers = opts.ciphers;
  this.rejectUnauthorized = opts.rejectUnauthorized;
  this.forceNode = opts.forceNode;

  // other options for Node.js client
  this.extraHeaders = opts.extraHeaders;
  this.localAddress = opts.localAddress;
}

/**
 * Mix in `Emitter`.
 */

Emitter(Transport.prototype);

/**
 * Emits an error.
 *
 * @param {String} str
 * @return {Transport} for chaining
 * @api public
 */

Transport.prototype.onError = function (msg, desc) {
  var err = new Error(msg);
  err.type = 'TransportError';
  err.description = desc;
  this.emit('error', err);
  return this;
};

/**
 * Opens the transport.
 *
 * @api public
 */

Transport.prototype.open = function () {
  if ('closed' === this.readyState || '' === this.readyState) {
    this.readyState = 'opening';
    this.doOpen();
  }

  return this;
};

/**
 * Closes the transport.
 *
 * @api private
 */

Transport.prototype.close = function () {
  if ('opening' === this.readyState || 'open' === this.readyState) {
    this.doClose();
    this.onClose();
  }

  return this;
};

/**
 * Sends multiple packets.
 *
 * @param {Array} packets
 * @api private
 */

Transport.prototype.send = function (packets) {
  if ('open' === this.readyState) {
    this.write(packets);
  } else {
    throw new Error('Transport not open');
  }
};

/**
 * Called upon open
 *
 * @api private
 */

Transport.prototype.onOpen = function () {
  this.readyState = 'open';
  this.writable = true;
  this.emit('open');
};

/**
 * Called with data.
 *
 * @param {String} data
 * @api private
 */

Transport.prototype.onData = function (data) {
  var packet = parser.decodePacket(data, this.socket.binaryType);
  this.onPacket(packet);
};

/**
 * Called with a decoded packet.
 */

Transport.prototype.onPacket = function (packet) {
  this.emit('packet', packet);
};

/**
 * Called upon close.
 *
 * @api private
 */

Transport.prototype.onClose = function () {
  this.readyState = 'closed';
  this.emit('close');
};

},{"component-emitter":24,"engine.io-parser":25}],18:[function(require,module,exports){
(function (global){
/**
 * Module dependencies
 */

var XMLHttpRequest = require('xmlhttprequest-ssl');
var XHR = require('./polling-xhr');
var JSONP = require('./polling-jsonp');
var websocket = require('./websocket');

/**
 * Export transports.
 */

exports.polling = polling;
exports.websocket = websocket;

/**
 * Polling transport polymorphic constructor.
 * Decides on xhr vs jsonp based on feature detection.
 *
 * @api private
 */

function polling (opts) {
  var xhr;
  var xd = false;
  var xs = false;
  var jsonp = false !== opts.jsonp;

  if (global.location) {
    var isSSL = 'https:' === location.protocol;
    var port = location.port;

    // some user agents have empty `location.port`
    if (!port) {
      port = isSSL ? 443 : 80;
    }

    xd = opts.hostname !== location.hostname || port !== opts.port;
    xs = opts.secure !== isSSL;
  }

  opts.xdomain = xd;
  opts.xscheme = xs;
  xhr = new XMLHttpRequest(opts);

  if ('open' in xhr && !opts.forceJSONP) {
    return new XHR(opts);
  } else {
    if (!jsonp) throw new Error('JSONP disabled');
    return new JSONP(opts);
  }
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./polling-jsonp":19,"./polling-xhr":20,"./websocket":22,"xmlhttprequest-ssl":23}],19:[function(require,module,exports){
(function (global){

/**
 * Module requirements.
 */

var Polling = require('./polling');
var inherit = require('component-inherit');

/**
 * Module exports.
 */

module.exports = JSONPPolling;

/**
 * Cached regular expressions.
 */

var rNewline = /\n/g;
var rEscapedNewline = /\\n/g;

/**
 * Global JSONP callbacks.
 */

var callbacks;

/**
 * Noop.
 */

function empty () { }

/**
 * JSONP Polling constructor.
 *
 * @param {Object} opts.
 * @api public
 */

function JSONPPolling (opts) {
  Polling.call(this, opts);

  this.query = this.query || {};

  // define global callbacks array if not present
  // we do this here (lazily) to avoid unneeded global pollution
  if (!callbacks) {
    // we need to consider multiple engines in the same page
    if (!global.___eio) global.___eio = [];
    callbacks = global.___eio;
  }

  // callback identifier
  this.index = callbacks.length;

  // add callback to jsonp global
  var self = this;
  callbacks.push(function (msg) {
    self.onData(msg);
  });

  // append to query string
  this.query.j = this.index;

  // prevent spurious errors from being emitted when the window is unloaded
  if (global.document && global.addEventListener) {
    global.addEventListener('beforeunload', function () {
      if (self.script) self.script.onerror = empty;
    }, false);
  }
}

/**
 * Inherits from Polling.
 */

inherit(JSONPPolling, Polling);

/*
 * JSONP only supports binary as base64 encoded strings
 */

JSONPPolling.prototype.supportsBinary = false;

/**
 * Closes the socket.
 *
 * @api private
 */

JSONPPolling.prototype.doClose = function () {
  if (this.script) {
    this.script.parentNode.removeChild(this.script);
    this.script = null;
  }

  if (this.form) {
    this.form.parentNode.removeChild(this.form);
    this.form = null;
    this.iframe = null;
  }

  Polling.prototype.doClose.call(this);
};

/**
 * Starts a poll cycle.
 *
 * @api private
 */

JSONPPolling.prototype.doPoll = function () {
  var self = this;
  var script = document.createElement('script');

  if (this.script) {
    this.script.parentNode.removeChild(this.script);
    this.script = null;
  }

  script.async = true;
  script.src = this.uri();
  script.onerror = function (e) {
    self.onError('jsonp poll error', e);
  };

  var insertAt = document.getElementsByTagName('script')[0];
  if (insertAt) {
    insertAt.parentNode.insertBefore(script, insertAt);
  } else {
    (document.head || document.body).appendChild(script);
  }
  this.script = script;

  var isUAgecko = 'undefined' !== typeof navigator && /gecko/i.test(navigator.userAgent);

  if (isUAgecko) {
    setTimeout(function () {
      var iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      document.body.removeChild(iframe);
    }, 100);
  }
};

/**
 * Writes with a hidden iframe.
 *
 * @param {String} data to send
 * @param {Function} called upon flush.
 * @api private
 */

JSONPPolling.prototype.doWrite = function (data, fn) {
  var self = this;

  if (!this.form) {
    var form = document.createElement('form');
    var area = document.createElement('textarea');
    var id = this.iframeId = 'eio_iframe_' + this.index;
    var iframe;

    form.className = 'socketio';
    form.style.position = 'absolute';
    form.style.top = '-1000px';
    form.style.left = '-1000px';
    form.target = id;
    form.method = 'POST';
    form.setAttribute('accept-charset', 'utf-8');
    area.name = 'd';
    form.appendChild(area);
    document.body.appendChild(form);

    this.form = form;
    this.area = area;
  }

  this.form.action = this.uri();

  function complete () {
    initIframe();
    fn();
  }

  function initIframe () {
    if (self.iframe) {
      try {
        self.form.removeChild(self.iframe);
      } catch (e) {
        self.onError('jsonp polling iframe removal error', e);
      }
    }

    try {
      // ie6 dynamic iframes with target="" support (thanks Chris Lambacher)
      var html = '<iframe src="javascript:0" name="' + self.iframeId + '">';
      iframe = document.createElement(html);
    } catch (e) {
      iframe = document.createElement('iframe');
      iframe.name = self.iframeId;
      iframe.src = 'javascript:0';
    }

    iframe.id = self.iframeId;

    self.form.appendChild(iframe);
    self.iframe = iframe;
  }

  initIframe();

  // escape \n to prevent it from being converted into \r\n by some UAs
  // double escaping is required for escaped new lines because unescaping of new lines can be done safely on server-side
  data = data.replace(rEscapedNewline, '\\\n');
  this.area.value = data.replace(rNewline, '\\n');

  try {
    this.form.submit();
  } catch (e) {}

  if (this.iframe.attachEvent) {
    this.iframe.onreadystatechange = function () {
      if (self.iframe.readyState === 'complete') {
        complete();
      }
    };
  } else {
    this.iframe.onload = complete;
  }
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./polling":21,"component-inherit":11}],20:[function(require,module,exports){
(function (global){
/**
 * Module requirements.
 */

var XMLHttpRequest = require('xmlhttprequest-ssl');
var Polling = require('./polling');
var Emitter = require('component-emitter');
var inherit = require('component-inherit');
var debug = require('debug')('engine.io-client:polling-xhr');

/**
 * Module exports.
 */

module.exports = XHR;
module.exports.Request = Request;

/**
 * Empty function
 */

function empty () {}

/**
 * XHR Polling constructor.
 *
 * @param {Object} opts
 * @api public
 */

function XHR (opts) {
  Polling.call(this, opts);
  this.requestTimeout = opts.requestTimeout;
  this.extraHeaders = opts.extraHeaders;

  if (global.location) {
    var isSSL = 'https:' === location.protocol;
    var port = location.port;

    // some user agents have empty `location.port`
    if (!port) {
      port = isSSL ? 443 : 80;
    }

    this.xd = opts.hostname !== global.location.hostname ||
      port !== opts.port;
    this.xs = opts.secure !== isSSL;
  }
}

/**
 * Inherits from Polling.
 */

inherit(XHR, Polling);

/**
 * XHR supports binary
 */

XHR.prototype.supportsBinary = true;

/**
 * Creates a request.
 *
 * @param {String} method
 * @api private
 */

XHR.prototype.request = function (opts) {
  opts = opts || {};
  opts.uri = this.uri();
  opts.xd = this.xd;
  opts.xs = this.xs;
  opts.agent = this.agent || false;
  opts.supportsBinary = this.supportsBinary;
  opts.enablesXDR = this.enablesXDR;

  // SSL options for Node.js client
  opts.pfx = this.pfx;
  opts.key = this.key;
  opts.passphrase = this.passphrase;
  opts.cert = this.cert;
  opts.ca = this.ca;
  opts.ciphers = this.ciphers;
  opts.rejectUnauthorized = this.rejectUnauthorized;
  opts.requestTimeout = this.requestTimeout;

  // other options for Node.js client
  opts.extraHeaders = this.extraHeaders;

  return new Request(opts);
};

/**
 * Sends data.
 *
 * @param {String} data to send.
 * @param {Function} called upon flush.
 * @api private
 */

XHR.prototype.doWrite = function (data, fn) {
  var isBinary = typeof data !== 'string' && data !== undefined;
  var req = this.request({ method: 'POST', data: data, isBinary: isBinary });
  var self = this;
  req.on('success', fn);
  req.on('error', function (err) {
    self.onError('xhr post error', err);
  });
  this.sendXhr = req;
};

/**
 * Starts a poll cycle.
 *
 * @api private
 */

XHR.prototype.doPoll = function () {
  debug('xhr poll');
  var req = this.request();
  var self = this;
  req.on('data', function (data) {
    self.onData(data);
  });
  req.on('error', function (err) {
    self.onError('xhr poll error', err);
  });
  this.pollXhr = req;
};

/**
 * Request constructor
 *
 * @param {Object} options
 * @api public
 */

function Request (opts) {
  this.method = opts.method || 'GET';
  this.uri = opts.uri;
  this.xd = !!opts.xd;
  this.xs = !!opts.xs;
  this.async = false !== opts.async;
  this.data = undefined !== opts.data ? opts.data : null;
  this.agent = opts.agent;
  this.isBinary = opts.isBinary;
  this.supportsBinary = opts.supportsBinary;
  this.enablesXDR = opts.enablesXDR;
  this.requestTimeout = opts.requestTimeout;

  // SSL options for Node.js client
  this.pfx = opts.pfx;
  this.key = opts.key;
  this.passphrase = opts.passphrase;
  this.cert = opts.cert;
  this.ca = opts.ca;
  this.ciphers = opts.ciphers;
  this.rejectUnauthorized = opts.rejectUnauthorized;

  // other options for Node.js client
  this.extraHeaders = opts.extraHeaders;

  this.create();
}

/**
 * Mix in `Emitter`.
 */

Emitter(Request.prototype);

/**
 * Creates the XHR object and sends the request.
 *
 * @api private
 */

Request.prototype.create = function () {
  var opts = { agent: this.agent, xdomain: this.xd, xscheme: this.xs, enablesXDR: this.enablesXDR };

  // SSL options for Node.js client
  opts.pfx = this.pfx;
  opts.key = this.key;
  opts.passphrase = this.passphrase;
  opts.cert = this.cert;
  opts.ca = this.ca;
  opts.ciphers = this.ciphers;
  opts.rejectUnauthorized = this.rejectUnauthorized;

  var xhr = this.xhr = new XMLHttpRequest(opts);
  var self = this;

  try {
    debug('xhr open %s: %s', this.method, this.uri);
    xhr.open(this.method, this.uri, this.async);
    try {
      if (this.extraHeaders) {
        xhr.setDisableHeaderCheck && xhr.setDisableHeaderCheck(true);
        for (var i in this.extraHeaders) {
          if (this.extraHeaders.hasOwnProperty(i)) {
            xhr.setRequestHeader(i, this.extraHeaders[i]);
          }
        }
      }
    } catch (e) {}

    if ('POST' === this.method) {
      try {
        if (this.isBinary) {
          xhr.setRequestHeader('Content-type', 'application/octet-stream');
        } else {
          xhr.setRequestHeader('Content-type', 'text/plain;charset=UTF-8');
        }
      } catch (e) {}
    }

    try {
      xhr.setRequestHeader('Accept', '*/*');
    } catch (e) {}

    // ie6 check
    if ('withCredentials' in xhr) {
      xhr.withCredentials = true;
    }

    if (this.requestTimeout) {
      xhr.timeout = this.requestTimeout;
    }

    if (this.hasXDR()) {
      xhr.onload = function () {
        self.onLoad();
      };
      xhr.onerror = function () {
        self.onError(xhr.responseText);
      };
    } else {
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 2) {
          var contentType;
          try {
            contentType = xhr.getResponseHeader('Content-Type');
          } catch (e) {}
          if (contentType === 'application/octet-stream') {
            xhr.responseType = 'arraybuffer';
          }
        }
        if (4 !== xhr.readyState) return;
        if (200 === xhr.status || 1223 === xhr.status) {
          self.onLoad();
        } else {
          // make sure the `error` event handler that's user-set
          // does not throw in the same tick and gets caught here
          setTimeout(function () {
            self.onError(xhr.status);
          }, 0);
        }
      };
    }

    debug('xhr data %s', this.data);
    xhr.send(this.data);
  } catch (e) {
    // Need to defer since .create() is called directly fhrom the constructor
    // and thus the 'error' event can only be only bound *after* this exception
    // occurs.  Therefore, also, we cannot throw here at all.
    setTimeout(function () {
      self.onError(e);
    }, 0);
    return;
  }

  if (global.document) {
    this.index = Request.requestsCount++;
    Request.requests[this.index] = this;
  }
};

/**
 * Called upon successful response.
 *
 * @api private
 */

Request.prototype.onSuccess = function () {
  this.emit('success');
  this.cleanup();
};

/**
 * Called if we have data.
 *
 * @api private
 */

Request.prototype.onData = function (data) {
  this.emit('data', data);
  this.onSuccess();
};

/**
 * Called upon error.
 *
 * @api private
 */

Request.prototype.onError = function (err) {
  this.emit('error', err);
  this.cleanup(true);
};

/**
 * Cleans up house.
 *
 * @api private
 */

Request.prototype.cleanup = function (fromError) {
  if ('undefined' === typeof this.xhr || null === this.xhr) {
    return;
  }
  // xmlhttprequest
  if (this.hasXDR()) {
    this.xhr.onload = this.xhr.onerror = empty;
  } else {
    this.xhr.onreadystatechange = empty;
  }

  if (fromError) {
    try {
      this.xhr.abort();
    } catch (e) {}
  }

  if (global.document) {
    delete Request.requests[this.index];
  }

  this.xhr = null;
};

/**
 * Called upon load.
 *
 * @api private
 */

Request.prototype.onLoad = function () {
  var data;
  try {
    var contentType;
    try {
      contentType = this.xhr.getResponseHeader('Content-Type');
    } catch (e) {}
    if (contentType === 'application/octet-stream') {
      data = this.xhr.response || this.xhr.responseText;
    } else {
      data = this.xhr.responseText;
    }
  } catch (e) {
    this.onError(e);
  }
  if (null != data) {
    this.onData(data);
  }
};

/**
 * Check if it has XDomainRequest.
 *
 * @api private
 */

Request.prototype.hasXDR = function () {
  return 'undefined' !== typeof global.XDomainRequest && !this.xs && this.enablesXDR;
};

/**
 * Aborts the request.
 *
 * @api public
 */

Request.prototype.abort = function () {
  this.cleanup();
};

/**
 * Aborts pending requests when unloading the window. This is needed to prevent
 * memory leaks (e.g. when using IE) and to ensure that no spurious error is
 * emitted.
 */

Request.requestsCount = 0;
Request.requests = {};

if (global.document) {
  if (global.attachEvent) {
    global.attachEvent('onunload', unloadHandler);
  } else if (global.addEventListener) {
    global.addEventListener('beforeunload', unloadHandler, false);
  }
}

function unloadHandler () {
  for (var i in Request.requests) {
    if (Request.requests.hasOwnProperty(i)) {
      Request.requests[i].abort();
    }
  }
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./polling":21,"component-emitter":24,"component-inherit":11,"debug":12,"xmlhttprequest-ssl":23}],21:[function(require,module,exports){
/**
 * Module dependencies.
 */

var Transport = require('../transport');
var parseqs = require('parseqs');
var parser = require('engine.io-parser');
var inherit = require('component-inherit');
var yeast = require('yeast');
var debug = require('debug')('engine.io-client:polling');

/**
 * Module exports.
 */

module.exports = Polling;

/**
 * Is XHR2 supported?
 */

var hasXHR2 = (function () {
  var XMLHttpRequest = require('xmlhttprequest-ssl');
  var xhr = new XMLHttpRequest({ xdomain: false });
  return null != xhr.responseType;
})();

/**
 * Polling interface.
 *
 * @param {Object} opts
 * @api private
 */

function Polling (opts) {
  var forceBase64 = (opts && opts.forceBase64);
  if (!hasXHR2 || forceBase64) {
    this.supportsBinary = false;
  }
  Transport.call(this, opts);
}

/**
 * Inherits from Transport.
 */

inherit(Polling, Transport);

/**
 * Transport name.
 */

Polling.prototype.name = 'polling';

/**
 * Opens the socket (triggers polling). We write a PING message to determine
 * when the transport is open.
 *
 * @api private
 */

Polling.prototype.doOpen = function () {
  this.poll();
};

/**
 * Pauses polling.
 *
 * @param {Function} callback upon buffers are flushed and transport is paused
 * @api private
 */

Polling.prototype.pause = function (onPause) {
  var self = this;

  this.readyState = 'pausing';

  function pause () {
    debug('paused');
    self.readyState = 'paused';
    onPause();
  }

  if (this.polling || !this.writable) {
    var total = 0;

    if (this.polling) {
      debug('we are currently polling - waiting to pause');
      total++;
      this.once('pollComplete', function () {
        debug('pre-pause polling complete');
        --total || pause();
      });
    }

    if (!this.writable) {
      debug('we are currently writing - waiting to pause');
      total++;
      this.once('drain', function () {
        debug('pre-pause writing complete');
        --total || pause();
      });
    }
  } else {
    pause();
  }
};

/**
 * Starts polling cycle.
 *
 * @api public
 */

Polling.prototype.poll = function () {
  debug('polling');
  this.polling = true;
  this.doPoll();
  this.emit('poll');
};

/**
 * Overloads onData to detect payloads.
 *
 * @api private
 */

Polling.prototype.onData = function (data) {
  var self = this;
  debug('polling got data %s', data);
  var callback = function (packet, index, total) {
    // if its the first message we consider the transport open
    if ('opening' === self.readyState) {
      self.onOpen();
    }

    // if its a close packet, we close the ongoing requests
    if ('close' === packet.type) {
      self.onClose();
      return false;
    }

    // otherwise bypass onData and handle the message
    self.onPacket(packet);
  };

  // decode payload
  parser.decodePayload(data, this.socket.binaryType, callback);

  // if an event did not trigger closing
  if ('closed' !== this.readyState) {
    // if we got data we're not polling
    this.polling = false;
    this.emit('pollComplete');

    if ('open' === this.readyState) {
      this.poll();
    } else {
      debug('ignoring poll - transport state "%s"', this.readyState);
    }
  }
};

/**
 * For polling, send a close packet.
 *
 * @api private
 */

Polling.prototype.doClose = function () {
  var self = this;

  function close () {
    debug('writing close packet');
    self.write([{ type: 'close' }]);
  }

  if ('open' === this.readyState) {
    debug('transport open - closing');
    close();
  } else {
    // in case we're trying to close while
    // handshaking is in progress (GH-164)
    debug('transport not open - deferring close');
    this.once('open', close);
  }
};

/**
 * Writes a packets payload.
 *
 * @param {Array} data packets
 * @param {Function} drain callback
 * @api private
 */

Polling.prototype.write = function (packets) {
  var self = this;
  this.writable = false;
  var callbackfn = function () {
    self.writable = true;
    self.emit('drain');
  };

  parser.encodePayload(packets, this.supportsBinary, function (data) {
    self.doWrite(data, callbackfn);
  });
};

/**
 * Generates uri for connection.
 *
 * @api private
 */

Polling.prototype.uri = function () {
  var query = this.query || {};
  var schema = this.secure ? 'https' : 'http';
  var port = '';

  // cache busting is forced
  if (false !== this.timestampRequests) {
    query[this.timestampParam] = yeast();
  }

  if (!this.supportsBinary && !query.sid) {
    query.b64 = 1;
  }

  query = parseqs.encode(query);

  // avoid port if default for schema
  if (this.port && (('https' === schema && Number(this.port) !== 443) ||
     ('http' === schema && Number(this.port) !== 80))) {
    port = ':' + this.port;
  }

  // prepend ? to query
  if (query.length) {
    query = '?' + query;
  }

  var ipv6 = this.hostname.indexOf(':') !== -1;
  return schema + '://' + (ipv6 ? '[' + this.hostname + ']' : this.hostname) + port + this.path + query;
};

},{"../transport":17,"component-inherit":11,"debug":12,"engine.io-parser":25,"parseqs":42,"xmlhttprequest-ssl":23,"yeast":56}],22:[function(require,module,exports){
(function (global){
/**
 * Module dependencies.
 */

var Transport = require('../transport');
var parser = require('engine.io-parser');
var parseqs = require('parseqs');
var inherit = require('component-inherit');
var yeast = require('yeast');
var debug = require('debug')('engine.io-client:websocket');
var BrowserWebSocket = global.WebSocket || global.MozWebSocket;
var NodeWebSocket;
if (typeof window === 'undefined') {
  try {
    NodeWebSocket = require('ws');
  } catch (e) { }
}

/**
 * Get either the `WebSocket` or `MozWebSocket` globals
 * in the browser or try to resolve WebSocket-compatible
 * interface exposed by `ws` for Node-like environment.
 */

var WebSocket = BrowserWebSocket;
if (!WebSocket && typeof window === 'undefined') {
  WebSocket = NodeWebSocket;
}

/**
 * Module exports.
 */

module.exports = WS;

/**
 * WebSocket transport constructor.
 *
 * @api {Object} connection options
 * @api public
 */

function WS (opts) {
  var forceBase64 = (opts && opts.forceBase64);
  if (forceBase64) {
    this.supportsBinary = false;
  }
  this.perMessageDeflate = opts.perMessageDeflate;
  this.usingBrowserWebSocket = BrowserWebSocket && !opts.forceNode;
  this.protocols = opts.protocols;
  if (!this.usingBrowserWebSocket) {
    WebSocket = NodeWebSocket;
  }
  Transport.call(this, opts);
}

/**
 * Inherits from Transport.
 */

inherit(WS, Transport);

/**
 * Transport name.
 *
 * @api public
 */

WS.prototype.name = 'websocket';

/*
 * WebSockets support binary
 */

WS.prototype.supportsBinary = true;

/**
 * Opens socket.
 *
 * @api private
 */

WS.prototype.doOpen = function () {
  if (!this.check()) {
    // let probe timeout
    return;
  }

  var uri = this.uri();
  var protocols = this.protocols;
  var opts = {
    agent: this.agent,
    perMessageDeflate: this.perMessageDeflate
  };

  // SSL options for Node.js client
  opts.pfx = this.pfx;
  opts.key = this.key;
  opts.passphrase = this.passphrase;
  opts.cert = this.cert;
  opts.ca = this.ca;
  opts.ciphers = this.ciphers;
  opts.rejectUnauthorized = this.rejectUnauthorized;
  if (this.extraHeaders) {
    opts.headers = this.extraHeaders;
  }
  if (this.localAddress) {
    opts.localAddress = this.localAddress;
  }

  try {
    this.ws = this.usingBrowserWebSocket ? (protocols ? new WebSocket(uri, protocols) : new WebSocket(uri)) : new WebSocket(uri, protocols, opts);
  } catch (err) {
    return this.emit('error', err);
  }

  if (this.ws.binaryType === undefined) {
    this.supportsBinary = false;
  }

  if (this.ws.supports && this.ws.supports.binary) {
    this.supportsBinary = true;
    this.ws.binaryType = 'nodebuffer';
  } else {
    this.ws.binaryType = 'arraybuffer';
  }

  this.addEventListeners();
};

/**
 * Adds event listeners to the socket
 *
 * @api private
 */

WS.prototype.addEventListeners = function () {
  var self = this;

  this.ws.onopen = function () {
    self.onOpen();
  };
  this.ws.onclose = function () {
    self.onClose();
  };
  this.ws.onmessage = function (ev) {
    self.onData(ev.data);
  };
  this.ws.onerror = function (e) {
    self.onError('websocket error', e);
  };
};

/**
 * Writes data to socket.
 *
 * @param {Array} array of packets.
 * @api private
 */

WS.prototype.write = function (packets) {
  var self = this;
  this.writable = false;

  // encodePacket efficient as it uses WS framing
  // no need for encodePayload
  var total = packets.length;
  for (var i = 0, l = total; i < l; i++) {
    (function (packet) {
      parser.encodePacket(packet, self.supportsBinary, function (data) {
        if (!self.usingBrowserWebSocket) {
          // always create a new object (GH-437)
          var opts = {};
          if (packet.options) {
            opts.compress = packet.options.compress;
          }

          if (self.perMessageDeflate) {
            var len = 'string' === typeof data ? global.Buffer.byteLength(data) : data.length;
            if (len < self.perMessageDeflate.threshold) {
              opts.compress = false;
            }
          }
        }

        // Sometimes the websocket has already been closed but the browser didn't
        // have a chance of informing us about it yet, in that case send will
        // throw an error
        try {
          if (self.usingBrowserWebSocket) {
            // TypeError is thrown when passing the second argument on Safari
            self.ws.send(data);
          } else {
            self.ws.send(data, opts);
          }
        } catch (e) {
          debug('websocket closed before onclose event');
        }

        --total || done();
      });
    })(packets[i]);
  }

  function done () {
    self.emit('flush');

    // fake drain
    // defer to next tick to allow Socket to clear writeBuffer
    setTimeout(function () {
      self.writable = true;
      self.emit('drain');
    }, 0);
  }
};

/**
 * Called upon close
 *
 * @api private
 */

WS.prototype.onClose = function () {
  Transport.prototype.onClose.call(this);
};

/**
 * Closes socket.
 *
 * @api private
 */

WS.prototype.doClose = function () {
  if (typeof this.ws !== 'undefined') {
    this.ws.close();
  }
};

/**
 * Generates uri for connection.
 *
 * @api private
 */

WS.prototype.uri = function () {
  var query = this.query || {};
  var schema = this.secure ? 'wss' : 'ws';
  var port = '';

  // avoid port if default for schema
  if (this.port && (('wss' === schema && Number(this.port) !== 443) ||
    ('ws' === schema && Number(this.port) !== 80))) {
    port = ':' + this.port;
  }

  // append timestamp to URI
  if (this.timestampRequests) {
    query[this.timestampParam] = yeast();
  }

  // communicate binary support capabilities
  if (!this.supportsBinary) {
    query.b64 = 1;
  }

  query = parseqs.encode(query);

  // prepend ? to query
  if (query.length) {
    query = '?' + query;
  }

  var ipv6 = this.hostname.indexOf(':') !== -1;
  return schema + '://' + (ipv6 ? '[' + this.hostname + ']' : this.hostname) + port + this.path + query;
};

/**
 * Feature detection for WebSocket.
 *
 * @return {Boolean} whether this transport is available.
 * @api public
 */

WS.prototype.check = function () {
  return !!WebSocket && !('__initialize' in WebSocket && this.name === WS.prototype.name);
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../transport":17,"component-inherit":11,"debug":12,"engine.io-parser":25,"parseqs":42,"ws":9,"yeast":56}],23:[function(require,module,exports){
(function (global){
// browser shim for xmlhttprequest module

var hasCORS = require('has-cors');

module.exports = function (opts) {
  var xdomain = opts.xdomain;

  // scheme must be same when usign XDomainRequest
  // http://blogs.msdn.com/b/ieinternals/archive/2010/05/13/xdomainrequest-restrictions-limitations-and-workarounds.aspx
  var xscheme = opts.xscheme;

  // XDomainRequest has a flow of not sending cookie, therefore it should be disabled as a default.
  // https://github.com/Automattic/engine.io-client/pull/217
  var enablesXDR = opts.enablesXDR;

  // XMLHttpRequest can be disabled on IE
  try {
    if ('undefined' !== typeof XMLHttpRequest && (!xdomain || hasCORS)) {
      return new XMLHttpRequest();
    }
  } catch (e) { }

  // Use XDomainRequest for IE8 if enablesXDR is true
  // because loading bar keeps flashing when using jsonp-polling
  // https://github.com/yujiosaka/socke.io-ie8-loading-example
  try {
    if ('undefined' !== typeof XDomainRequest && !xscheme && enablesXDR) {
      return new XDomainRequest();
    }
  } catch (e) { }

  if (!xdomain) {
    try {
      return new global[['Active'].concat('Object').join('X')]('Microsoft.XMLHTTP');
    } catch (e) { }
  }
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"has-cors":38}],24:[function(require,module,exports){

/**
 * Expose `Emitter`.
 */

if (typeof module !== 'undefined') {
  module.exports = Emitter;
}

/**
 * Initialize a new `Emitter`.
 *
 * @api public
 */

function Emitter(obj) {
  if (obj) return mixin(obj);
};

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

function mixin(obj) {
  for (var key in Emitter.prototype) {
    obj[key] = Emitter.prototype[key];
  }
  return obj;
}

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.on =
Emitter.prototype.addEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};
  (this._callbacks['$' + event] = this._callbacks['$' + event] || [])
    .push(fn);
  return this;
};

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.once = function(event, fn){
  function on() {
    this.off(event, on);
    fn.apply(this, arguments);
  }

  on.fn = fn;
  this.on(event, on);
  return this;
};

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.off =
Emitter.prototype.removeListener =
Emitter.prototype.removeAllListeners =
Emitter.prototype.removeEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};

  // all
  if (0 == arguments.length) {
    this._callbacks = {};
    return this;
  }

  // specific event
  var callbacks = this._callbacks['$' + event];
  if (!callbacks) return this;

  // remove all handlers
  if (1 == arguments.length) {
    delete this._callbacks['$' + event];
    return this;
  }

  // remove specific handler
  var cb;
  for (var i = 0; i < callbacks.length; i++) {
    cb = callbacks[i];
    if (cb === fn || cb.fn === fn) {
      callbacks.splice(i, 1);
      break;
    }
  }
  return this;
};

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 * @return {Emitter}
 */

Emitter.prototype.emit = function(event){
  this._callbacks = this._callbacks || {};
  var args = [].slice.call(arguments, 1)
    , callbacks = this._callbacks['$' + event];

  if (callbacks) {
    callbacks = callbacks.slice(0);
    for (var i = 0, len = callbacks.length; i < len; ++i) {
      callbacks[i].apply(this, args);
    }
  }

  return this;
};

/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

Emitter.prototype.listeners = function(event){
  this._callbacks = this._callbacks || {};
  return this._callbacks['$' + event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

Emitter.prototype.hasListeners = function(event){
  return !! this.listeners(event).length;
};

},{}],25:[function(require,module,exports){
(function (global){
/**
 * Module dependencies.
 */

var keys = require('./keys');
var hasBinary = require('has-binary2');
var sliceBuffer = require('arraybuffer.slice');
var after = require('after');
var utf8 = require('./utf8');

var base64encoder;
if (global && global.ArrayBuffer) {
  base64encoder = require('base64-arraybuffer');
}

/**
 * Check if we are running an android browser. That requires us to use
 * ArrayBuffer with polling transports...
 *
 * http://ghinda.net/jpeg-blob-ajax-android/
 */

var isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

/**
 * Check if we are running in PhantomJS.
 * Uploading a Blob with PhantomJS does not work correctly, as reported here:
 * https://github.com/ariya/phantomjs/issues/11395
 * @type boolean
 */
var isPhantomJS = typeof navigator !== 'undefined' && /PhantomJS/i.test(navigator.userAgent);

/**
 * When true, avoids using Blobs to encode payloads.
 * @type boolean
 */
var dontSendBlobs = isAndroid || isPhantomJS;

/**
 * Current protocol version.
 */

exports.protocol = 3;

/**
 * Packet types.
 */

var packets = exports.packets = {
    open:     0    // non-ws
  , close:    1    // non-ws
  , ping:     2
  , pong:     3
  , message:  4
  , upgrade:  5
  , noop:     6
};

var packetslist = keys(packets);

/**
 * Premade error packet.
 */

var err = { type: 'error', data: 'parser error' };

/**
 * Create a blob api even for blob builder when vendor prefixes exist
 */

var Blob = require('blob');

/**
 * Encodes a packet.
 *
 *     <packet type id> [ <data> ]
 *
 * Example:
 *
 *     5hello world
 *     3
 *     4
 *
 * Binary is encoded in an identical principle
 *
 * @api private
 */

exports.encodePacket = function (packet, supportsBinary, utf8encode, callback) {
  if (typeof supportsBinary === 'function') {
    callback = supportsBinary;
    supportsBinary = false;
  }

  if (typeof utf8encode === 'function') {
    callback = utf8encode;
    utf8encode = null;
  }

  var data = (packet.data === undefined)
    ? undefined
    : packet.data.buffer || packet.data;

  if (global.ArrayBuffer && data instanceof ArrayBuffer) {
    return encodeArrayBuffer(packet, supportsBinary, callback);
  } else if (Blob && data instanceof global.Blob) {
    return encodeBlob(packet, supportsBinary, callback);
  }

  // might be an object with { base64: true, data: dataAsBase64String }
  if (data && data.base64) {
    return encodeBase64Object(packet, callback);
  }

  // Sending data as a utf-8 string
  var encoded = packets[packet.type];

  // data fragment is optional
  if (undefined !== packet.data) {
    encoded += utf8encode ? utf8.encode(String(packet.data), { strict: false }) : String(packet.data);
  }

  return callback('' + encoded);

};

function encodeBase64Object(packet, callback) {
  // packet data is an object { base64: true, data: dataAsBase64String }
  var message = 'b' + exports.packets[packet.type] + packet.data.data;
  return callback(message);
}

/**
 * Encode packet helpers for binary types
 */

function encodeArrayBuffer(packet, supportsBinary, callback) {
  if (!supportsBinary) {
    return exports.encodeBase64Packet(packet, callback);
  }

  var data = packet.data;
  var contentArray = new Uint8Array(data);
  var resultBuffer = new Uint8Array(1 + data.byteLength);

  resultBuffer[0] = packets[packet.type];
  for (var i = 0; i < contentArray.length; i++) {
    resultBuffer[i+1] = contentArray[i];
  }

  return callback(resultBuffer.buffer);
}

function encodeBlobAsArrayBuffer(packet, supportsBinary, callback) {
  if (!supportsBinary) {
    return exports.encodeBase64Packet(packet, callback);
  }

  var fr = new FileReader();
  fr.onload = function() {
    packet.data = fr.result;
    exports.encodePacket(packet, supportsBinary, true, callback);
  };
  return fr.readAsArrayBuffer(packet.data);
}

function encodeBlob(packet, supportsBinary, callback) {
  if (!supportsBinary) {
    return exports.encodeBase64Packet(packet, callback);
  }

  if (dontSendBlobs) {
    return encodeBlobAsArrayBuffer(packet, supportsBinary, callback);
  }

  var length = new Uint8Array(1);
  length[0] = packets[packet.type];
  var blob = new Blob([length.buffer, packet.data]);

  return callback(blob);
}

/**
 * Encodes a packet with binary data in a base64 string
 *
 * @param {Object} packet, has `type` and `data`
 * @return {String} base64 encoded message
 */

exports.encodeBase64Packet = function(packet, callback) {
  var message = 'b' + exports.packets[packet.type];
  if (Blob && packet.data instanceof global.Blob) {
    var fr = new FileReader();
    fr.onload = function() {
      var b64 = fr.result.split(',')[1];
      callback(message + b64);
    };
    return fr.readAsDataURL(packet.data);
  }

  var b64data;
  try {
    b64data = String.fromCharCode.apply(null, new Uint8Array(packet.data));
  } catch (e) {
    // iPhone Safari doesn't let you apply with typed arrays
    var typed = new Uint8Array(packet.data);
    var basic = new Array(typed.length);
    for (var i = 0; i < typed.length; i++) {
      basic[i] = typed[i];
    }
    b64data = String.fromCharCode.apply(null, basic);
  }
  message += global.btoa(b64data);
  return callback(message);
};

/**
 * Decodes a packet. Changes format to Blob if requested.
 *
 * @return {Object} with `type` and `data` (if any)
 * @api private
 */

exports.decodePacket = function (data, binaryType, utf8decode) {
  if (data === undefined) {
    return err;
  }
  // String data
  if (typeof data === 'string') {
    if (data.charAt(0) === 'b') {
      return exports.decodeBase64Packet(data.substr(1), binaryType);
    }

    if (utf8decode) {
      data = tryDecode(data);
      if (data === false) {
        return err;
      }
    }
    var type = data.charAt(0);

    if (Number(type) != type || !packetslist[type]) {
      return err;
    }

    if (data.length > 1) {
      return { type: packetslist[type], data: data.substring(1) };
    } else {
      return { type: packetslist[type] };
    }
  }

  var asArray = new Uint8Array(data);
  var type = asArray[0];
  var rest = sliceBuffer(data, 1);
  if (Blob && binaryType === 'blob') {
    rest = new Blob([rest]);
  }
  return { type: packetslist[type], data: rest };
};

function tryDecode(data) {
  try {
    data = utf8.decode(data, { strict: false });
  } catch (e) {
    return false;
  }
  return data;
}

/**
 * Decodes a packet encoded in a base64 string
 *
 * @param {String} base64 encoded message
 * @return {Object} with `type` and `data` (if any)
 */

exports.decodeBase64Packet = function(msg, binaryType) {
  var type = packetslist[msg.charAt(0)];
  if (!base64encoder) {
    return { type: type, data: { base64: true, data: msg.substr(1) } };
  }

  var data = base64encoder.decode(msg.substr(1));

  if (binaryType === 'blob' && Blob) {
    data = new Blob([data]);
  }

  return { type: type, data: data };
};

/**
 * Encodes multiple messages (payload).
 *
 *     <length>:data
 *
 * Example:
 *
 *     11:hello world2:hi
 *
 * If any contents are binary, they will be encoded as base64 strings. Base64
 * encoded strings are marked with a b before the length specifier
 *
 * @param {Array} packets
 * @api private
 */

exports.encodePayload = function (packets, supportsBinary, callback) {
  if (typeof supportsBinary === 'function') {
    callback = supportsBinary;
    supportsBinary = null;
  }

  var isBinary = hasBinary(packets);

  if (supportsBinary && isBinary) {
    if (Blob && !dontSendBlobs) {
      return exports.encodePayloadAsBlob(packets, callback);
    }

    return exports.encodePayloadAsArrayBuffer(packets, callback);
  }

  if (!packets.length) {
    return callback('0:');
  }

  function setLengthHeader(message) {
    return message.length + ':' + message;
  }

  function encodeOne(packet, doneCallback) {
    exports.encodePacket(packet, !isBinary ? false : supportsBinary, false, function(message) {
      doneCallback(null, setLengthHeader(message));
    });
  }

  map(packets, encodeOne, function(err, results) {
    return callback(results.join(''));
  });
};

/**
 * Async array map using after
 */

function map(ary, each, done) {
  var result = new Array(ary.length);
  var next = after(ary.length, done);

  var eachWithIndex = function(i, el, cb) {
    each(el, function(error, msg) {
      result[i] = msg;
      cb(error, result);
    });
  };

  for (var i = 0; i < ary.length; i++) {
    eachWithIndex(i, ary[i], next);
  }
}

/*
 * Decodes data when a payload is maybe expected. Possible binary contents are
 * decoded from their base64 representation
 *
 * @param {String} data, callback method
 * @api public
 */

exports.decodePayload = function (data, binaryType, callback) {
  if (typeof data !== 'string') {
    return exports.decodePayloadAsBinary(data, binaryType, callback);
  }

  if (typeof binaryType === 'function') {
    callback = binaryType;
    binaryType = null;
  }

  var packet;
  if (data === '') {
    // parser error - ignoring payload
    return callback(err, 0, 1);
  }

  var length = '', n, msg;

  for (var i = 0, l = data.length; i < l; i++) {
    var chr = data.charAt(i);

    if (chr !== ':') {
      length += chr;
      continue;
    }

    if (length === '' || (length != (n = Number(length)))) {
      // parser error - ignoring payload
      return callback(err, 0, 1);
    }

    msg = data.substr(i + 1, n);

    if (length != msg.length) {
      // parser error - ignoring payload
      return callback(err, 0, 1);
    }

    if (msg.length) {
      packet = exports.decodePacket(msg, binaryType, false);

      if (err.type === packet.type && err.data === packet.data) {
        // parser error in individual packet - ignoring payload
        return callback(err, 0, 1);
      }

      var ret = callback(packet, i + n, l);
      if (false === ret) return;
    }

    // advance cursor
    i += n;
    length = '';
  }

  if (length !== '') {
    // parser error - ignoring payload
    return callback(err, 0, 1);
  }

};

/**
 * Encodes multiple messages (payload) as binary.
 *
 * <1 = binary, 0 = string><number from 0-9><number from 0-9>[...]<number
 * 255><data>
 *
 * Example:
 * 1 3 255 1 2 3, if the binary contents are interpreted as 8 bit integers
 *
 * @param {Array} packets
 * @return {ArrayBuffer} encoded payload
 * @api private
 */

exports.encodePayloadAsArrayBuffer = function(packets, callback) {
  if (!packets.length) {
    return callback(new ArrayBuffer(0));
  }

  function encodeOne(packet, doneCallback) {
    exports.encodePacket(packet, true, true, function(data) {
      return doneCallback(null, data);
    });
  }

  map(packets, encodeOne, function(err, encodedPackets) {
    var totalLength = encodedPackets.reduce(function(acc, p) {
      var len;
      if (typeof p === 'string'){
        len = p.length;
      } else {
        len = p.byteLength;
      }
      return acc + len.toString().length + len + 2; // string/binary identifier + separator = 2
    }, 0);

    var resultArray = new Uint8Array(totalLength);

    var bufferIndex = 0;
    encodedPackets.forEach(function(p) {
      var isString = typeof p === 'string';
      var ab = p;
      if (isString) {
        var view = new Uint8Array(p.length);
        for (var i = 0; i < p.length; i++) {
          view[i] = p.charCodeAt(i);
        }
        ab = view.buffer;
      }

      if (isString) { // not true binary
        resultArray[bufferIndex++] = 0;
      } else { // true binary
        resultArray[bufferIndex++] = 1;
      }

      var lenStr = ab.byteLength.toString();
      for (var i = 0; i < lenStr.length; i++) {
        resultArray[bufferIndex++] = parseInt(lenStr[i]);
      }
      resultArray[bufferIndex++] = 255;

      var view = new Uint8Array(ab);
      for (var i = 0; i < view.length; i++) {
        resultArray[bufferIndex++] = view[i];
      }
    });

    return callback(resultArray.buffer);
  });
};

/**
 * Encode as Blob
 */

exports.encodePayloadAsBlob = function(packets, callback) {
  function encodeOne(packet, doneCallback) {
    exports.encodePacket(packet, true, true, function(encoded) {
      var binaryIdentifier = new Uint8Array(1);
      binaryIdentifier[0] = 1;
      if (typeof encoded === 'string') {
        var view = new Uint8Array(encoded.length);
        for (var i = 0; i < encoded.length; i++) {
          view[i] = encoded.charCodeAt(i);
        }
        encoded = view.buffer;
        binaryIdentifier[0] = 0;
      }

      var len = (encoded instanceof ArrayBuffer)
        ? encoded.byteLength
        : encoded.size;

      var lenStr = len.toString();
      var lengthAry = new Uint8Array(lenStr.length + 1);
      for (var i = 0; i < lenStr.length; i++) {
        lengthAry[i] = parseInt(lenStr[i]);
      }
      lengthAry[lenStr.length] = 255;

      if (Blob) {
        var blob = new Blob([binaryIdentifier.buffer, lengthAry.buffer, encoded]);
        doneCallback(null, blob);
      }
    });
  }

  map(packets, encodeOne, function(err, results) {
    return callback(new Blob(results));
  });
};

/*
 * Decodes data when a payload is maybe expected. Strings are decoded by
 * interpreting each byte as a key code for entries marked to start with 0. See
 * description of encodePayloadAsBinary
 *
 * @param {ArrayBuffer} data, callback method
 * @api public
 */

exports.decodePayloadAsBinary = function (data, binaryType, callback) {
  if (typeof binaryType === 'function') {
    callback = binaryType;
    binaryType = null;
  }

  var bufferTail = data;
  var buffers = [];

  while (bufferTail.byteLength > 0) {
    var tailArray = new Uint8Array(bufferTail);
    var isString = tailArray[0] === 0;
    var msgLength = '';

    for (var i = 1; ; i++) {
      if (tailArray[i] === 255) break;

      // 310 = char length of Number.MAX_VALUE
      if (msgLength.length > 310) {
        return callback(err, 0, 1);
      }

      msgLength += tailArray[i];
    }

    bufferTail = sliceBuffer(bufferTail, 2 + msgLength.length);
    msgLength = parseInt(msgLength);

    var msg = sliceBuffer(bufferTail, 0, msgLength);
    if (isString) {
      try {
        msg = String.fromCharCode.apply(null, new Uint8Array(msg));
      } catch (e) {
        // iPhone Safari doesn't let you apply to typed arrays
        var typed = new Uint8Array(msg);
        msg = '';
        for (var i = 0; i < typed.length; i++) {
          msg += String.fromCharCode(typed[i]);
        }
      }
    }

    buffers.push(msg);
    bufferTail = sliceBuffer(bufferTail, msgLength);
  }

  var total = buffers.length;
  buffers.forEach(function(buffer, i) {
    callback(exports.decodePacket(buffer, binaryType, true), i, total);
  });
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./keys":26,"./utf8":27,"after":3,"arraybuffer.slice":5,"base64-arraybuffer":7,"blob":8,"has-binary2":36}],26:[function(require,module,exports){

/**
 * Gets the keys for an object.
 *
 * @return {Array} keys
 * @api private
 */

module.exports = Object.keys || function keys (obj){
  var arr = [];
  var has = Object.prototype.hasOwnProperty;

  for (var i in obj) {
    if (has.call(obj, i)) {
      arr.push(i);
    }
  }
  return arr;
};

},{}],27:[function(require,module,exports){
(function (global){
/*! https://mths.be/utf8js v2.1.2 by @mathias */
;(function(root) {

	// Detect free variables `exports`
	var freeExports = typeof exports == 'object' && exports;

	// Detect free variable `module`
	var freeModule = typeof module == 'object' && module &&
		module.exports == freeExports && module;

	// Detect free variable `global`, from Node.js or Browserified code,
	// and use it as `root`
	var freeGlobal = typeof global == 'object' && global;
	if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
		root = freeGlobal;
	}

	/*--------------------------------------------------------------------------*/

	var stringFromCharCode = String.fromCharCode;

	// Taken from https://mths.be/punycode
	function ucs2decode(string) {
		var output = [];
		var counter = 0;
		var length = string.length;
		var value;
		var extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				// high surrogate, and there is a next character
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					// unmatched surrogate; only append this code unit, in case the next
					// code unit is the high surrogate of a surrogate pair
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}

	// Taken from https://mths.be/punycode
	function ucs2encode(array) {
		var length = array.length;
		var index = -1;
		var value;
		var output = '';
		while (++index < length) {
			value = array[index];
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
		}
		return output;
	}

	function checkScalarValue(codePoint, strict) {
		if (codePoint >= 0xD800 && codePoint <= 0xDFFF) {
			if (strict) {
				throw Error(
					'Lone surrogate U+' + codePoint.toString(16).toUpperCase() +
					' is not a scalar value'
				);
			}
			return false;
		}
		return true;
	}
	/*--------------------------------------------------------------------------*/

	function createByte(codePoint, shift) {
		return stringFromCharCode(((codePoint >> shift) & 0x3F) | 0x80);
	}

	function encodeCodePoint(codePoint, strict) {
		if ((codePoint & 0xFFFFFF80) == 0) { // 1-byte sequence
			return stringFromCharCode(codePoint);
		}
		var symbol = '';
		if ((codePoint & 0xFFFFF800) == 0) { // 2-byte sequence
			symbol = stringFromCharCode(((codePoint >> 6) & 0x1F) | 0xC0);
		}
		else if ((codePoint & 0xFFFF0000) == 0) { // 3-byte sequence
			if (!checkScalarValue(codePoint, strict)) {
				codePoint = 0xFFFD;
			}
			symbol = stringFromCharCode(((codePoint >> 12) & 0x0F) | 0xE0);
			symbol += createByte(codePoint, 6);
		}
		else if ((codePoint & 0xFFE00000) == 0) { // 4-byte sequence
			symbol = stringFromCharCode(((codePoint >> 18) & 0x07) | 0xF0);
			symbol += createByte(codePoint, 12);
			symbol += createByte(codePoint, 6);
		}
		symbol += stringFromCharCode((codePoint & 0x3F) | 0x80);
		return symbol;
	}

	function utf8encode(string, opts) {
		opts = opts || {};
		var strict = false !== opts.strict;

		var codePoints = ucs2decode(string);
		var length = codePoints.length;
		var index = -1;
		var codePoint;
		var byteString = '';
		while (++index < length) {
			codePoint = codePoints[index];
			byteString += encodeCodePoint(codePoint, strict);
		}
		return byteString;
	}

	/*--------------------------------------------------------------------------*/

	function readContinuationByte() {
		if (byteIndex >= byteCount) {
			throw Error('Invalid byte index');
		}

		var continuationByte = byteArray[byteIndex] & 0xFF;
		byteIndex++;

		if ((continuationByte & 0xC0) == 0x80) {
			return continuationByte & 0x3F;
		}

		// If we end up here, it’s not a continuation byte
		throw Error('Invalid continuation byte');
	}

	function decodeSymbol(strict) {
		var byte1;
		var byte2;
		var byte3;
		var byte4;
		var codePoint;

		if (byteIndex > byteCount) {
			throw Error('Invalid byte index');
		}

		if (byteIndex == byteCount) {
			return false;
		}

		// Read first byte
		byte1 = byteArray[byteIndex] & 0xFF;
		byteIndex++;

		// 1-byte sequence (no continuation bytes)
		if ((byte1 & 0x80) == 0) {
			return byte1;
		}

		// 2-byte sequence
		if ((byte1 & 0xE0) == 0xC0) {
			byte2 = readContinuationByte();
			codePoint = ((byte1 & 0x1F) << 6) | byte2;
			if (codePoint >= 0x80) {
				return codePoint;
			} else {
				throw Error('Invalid continuation byte');
			}
		}

		// 3-byte sequence (may include unpaired surrogates)
		if ((byte1 & 0xF0) == 0xE0) {
			byte2 = readContinuationByte();
			byte3 = readContinuationByte();
			codePoint = ((byte1 & 0x0F) << 12) | (byte2 << 6) | byte3;
			if (codePoint >= 0x0800) {
				return checkScalarValue(codePoint, strict) ? codePoint : 0xFFFD;
			} else {
				throw Error('Invalid continuation byte');
			}
		}

		// 4-byte sequence
		if ((byte1 & 0xF8) == 0xF0) {
			byte2 = readContinuationByte();
			byte3 = readContinuationByte();
			byte4 = readContinuationByte();
			codePoint = ((byte1 & 0x07) << 0x12) | (byte2 << 0x0C) |
				(byte3 << 0x06) | byte4;
			if (codePoint >= 0x010000 && codePoint <= 0x10FFFF) {
				return codePoint;
			}
		}

		throw Error('Invalid UTF-8 detected');
	}

	var byteArray;
	var byteCount;
	var byteIndex;
	function utf8decode(byteString, opts) {
		opts = opts || {};
		var strict = false !== opts.strict;

		byteArray = ucs2decode(byteString);
		byteCount = byteArray.length;
		byteIndex = 0;
		var codePoints = [];
		var tmp;
		while ((tmp = decodeSymbol(strict)) !== false) {
			codePoints.push(tmp);
		}
		return ucs2encode(codePoints);
	}

	/*--------------------------------------------------------------------------*/

	var utf8 = {
		'version': '2.1.2',
		'encode': utf8encode,
		'decode': utf8decode
	};

	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define(function() {
			return utf8;
		});
	}	else if (freeExports && !freeExports.nodeType) {
		if (freeModule) { // in Node.js or RingoJS v0.8.0+
			freeModule.exports = utf8;
		} else { // in Narwhal or RingoJS v0.7.0-
			var object = {};
			var hasOwnProperty = object.hasOwnProperty;
			for (var key in utf8) {
				hasOwnProperty.call(utf8, key) && (freeExports[key] = utf8[key]);
			}
		}
	} else { // in Rhino or a web browser
		root.utf8 = utf8;
	}

}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],28:[function(require,module,exports){
var encode = require("./lib/encode.js"),
    decode = require("./lib/decode.js");

exports.decode = function(data, level){
	return (!level || level <= 0 ? decode.XML : decode.HTML)(data);
};

exports.decodeStrict = function(data, level){
	return (!level || level <= 0 ? decode.XML : decode.HTMLStrict)(data);
};

exports.encode = function(data, level){
	return (!level || level <= 0 ? encode.XML : encode.HTML)(data);
};

exports.encodeXML = encode.XML;

exports.encodeHTML4 =
exports.encodeHTML5 =
exports.encodeHTML  = encode.HTML;

exports.decodeXML =
exports.decodeXMLStrict = decode.XML;

exports.decodeHTML4 =
exports.decodeHTML5 =
exports.decodeHTML = decode.HTML;

exports.decodeHTML4Strict =
exports.decodeHTML5Strict =
exports.decodeHTMLStrict = decode.HTMLStrict;

exports.escape = encode.escape;

},{"./lib/decode.js":29,"./lib/encode.js":31}],29:[function(require,module,exports){
var entityMap = require("../maps/entities.json"),
    legacyMap = require("../maps/legacy.json"),
    xmlMap    = require("../maps/xml.json"),
    decodeCodePoint = require("./decode_codepoint.js");

var decodeXMLStrict  = getStrictDecoder(xmlMap),
    decodeHTMLStrict = getStrictDecoder(entityMap);

function getStrictDecoder(map){
	var keys = Object.keys(map).join("|"),
	    replace = getReplacer(map);

	keys += "|#[xX][\\da-fA-F]+|#\\d+";

	var re = new RegExp("&(?:" + keys + ");", "g");

	return function(str){
		return String(str).replace(re, replace);
	};
}

var decodeHTML = (function(){
	var legacy = Object.keys(legacyMap)
		.sort(sorter);

	var keys = Object.keys(entityMap)
		.sort(sorter);

	for(var i = 0, j = 0; i < keys.length; i++){
		if(legacy[j] === keys[i]){
			keys[i] += ";?";
			j++;
		} else {
			keys[i] += ";";
		}
	}

	var re = new RegExp("&(?:" + keys.join("|") + "|#[xX][\\da-fA-F]+;?|#\\d+;?)", "g"),
	    replace = getReplacer(entityMap);

	function replacer(str){
		if(str.substr(-1) !== ";") str += ";";
		return replace(str);
	}

	//TODO consider creating a merged map
	return function(str){
		return String(str).replace(re, replacer);
	};
}());

function sorter(a, b){
	return a < b ? 1 : -1;
}

function getReplacer(map){
	return function replace(str){
		if(str.charAt(1) === "#"){
			if(str.charAt(2) === "X" || str.charAt(2) === "x"){
				return decodeCodePoint(parseInt(str.substr(3), 16));
			}
			return decodeCodePoint(parseInt(str.substr(2), 10));
		}
		return map[str.slice(1, -1)];
	};
}

module.exports = {
	XML: decodeXMLStrict,
	HTML: decodeHTML,
	HTMLStrict: decodeHTMLStrict
};
},{"../maps/entities.json":33,"../maps/legacy.json":34,"../maps/xml.json":35,"./decode_codepoint.js":30}],30:[function(require,module,exports){
var decodeMap = require("../maps/decode.json");

module.exports = decodeCodePoint;

// modified version of https://github.com/mathiasbynens/he/blob/master/src/he.js#L94-L119
function decodeCodePoint(codePoint){

	if((codePoint >= 0xD800 && codePoint <= 0xDFFF) || codePoint > 0x10FFFF){
		return "\uFFFD";
	}

	if(codePoint in decodeMap){
		codePoint = decodeMap[codePoint];
	}

	var output = "";

	if(codePoint > 0xFFFF){
		codePoint -= 0x10000;
		output += String.fromCharCode(codePoint >>> 10 & 0x3FF | 0xD800);
		codePoint = 0xDC00 | codePoint & 0x3FF;
	}

	output += String.fromCharCode(codePoint);
	return output;
}

},{"../maps/decode.json":32}],31:[function(require,module,exports){
var inverseXML = getInverseObj(require("../maps/xml.json")),
    xmlReplacer = getInverseReplacer(inverseXML);

exports.XML = getInverse(inverseXML, xmlReplacer);

var inverseHTML = getInverseObj(require("../maps/entities.json")),
    htmlReplacer = getInverseReplacer(inverseHTML);

exports.HTML = getInverse(inverseHTML, htmlReplacer);

function getInverseObj(obj){
	return Object.keys(obj).sort().reduce(function(inverse, name){
		inverse[obj[name]] = "&" + name + ";";
		return inverse;
	}, {});
}

function getInverseReplacer(inverse){
	var single = [],
	    multiple = [];

	Object.keys(inverse).forEach(function(k){
		if(k.length === 1){
			single.push("\\" + k);
		} else {
			multiple.push(k);
		}
	});

	//TODO add ranges
	multiple.unshift("[" + single.join("") + "]");

	return new RegExp(multiple.join("|"), "g");
}

var re_nonASCII = /[^\0-\x7F]/g,
    re_astralSymbols = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;

function singleCharReplacer(c){
	return "&#x" + c.charCodeAt(0).toString(16).toUpperCase() + ";";
}

function astralReplacer(c){
	// http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
	var high = c.charCodeAt(0);
	var low  = c.charCodeAt(1);
	var codePoint = (high - 0xD800) * 0x400 + low - 0xDC00 + 0x10000;
	return "&#x" + codePoint.toString(16).toUpperCase() + ";";
}

function getInverse(inverse, re){
	function func(name){
		return inverse[name];
	}

	return function(data){
		return data
				.replace(re, func)
				.replace(re_astralSymbols, astralReplacer)
				.replace(re_nonASCII, singleCharReplacer);
	};
}

var re_xmlChars = getInverseReplacer(inverseXML);

function escapeXML(data){
	return data
			.replace(re_xmlChars, singleCharReplacer)
			.replace(re_astralSymbols, astralReplacer)
			.replace(re_nonASCII, singleCharReplacer);
}

exports.escape = escapeXML;

},{"../maps/entities.json":33,"../maps/xml.json":35}],32:[function(require,module,exports){
module.exports={"0":65533,"128":8364,"130":8218,"131":402,"132":8222,"133":8230,"134":8224,"135":8225,"136":710,"137":8240,"138":352,"139":8249,"140":338,"142":381,"145":8216,"146":8217,"147":8220,"148":8221,"149":8226,"150":8211,"151":8212,"152":732,"153":8482,"154":353,"155":8250,"156":339,"158":382,"159":376}
},{}],33:[function(require,module,exports){
module.exports={"Aacute":"\u00C1","aacute":"\u00E1","Abreve":"\u0102","abreve":"\u0103","ac":"\u223E","acd":"\u223F","acE":"\u223E\u0333","Acirc":"\u00C2","acirc":"\u00E2","acute":"\u00B4","Acy":"\u0410","acy":"\u0430","AElig":"\u00C6","aelig":"\u00E6","af":"\u2061","Afr":"\uD835\uDD04","afr":"\uD835\uDD1E","Agrave":"\u00C0","agrave":"\u00E0","alefsym":"\u2135","aleph":"\u2135","Alpha":"\u0391","alpha":"\u03B1","Amacr":"\u0100","amacr":"\u0101","amalg":"\u2A3F","amp":"&","AMP":"&","andand":"\u2A55","And":"\u2A53","and":"\u2227","andd":"\u2A5C","andslope":"\u2A58","andv":"\u2A5A","ang":"\u2220","ange":"\u29A4","angle":"\u2220","angmsdaa":"\u29A8","angmsdab":"\u29A9","angmsdac":"\u29AA","angmsdad":"\u29AB","angmsdae":"\u29AC","angmsdaf":"\u29AD","angmsdag":"\u29AE","angmsdah":"\u29AF","angmsd":"\u2221","angrt":"\u221F","angrtvb":"\u22BE","angrtvbd":"\u299D","angsph":"\u2222","angst":"\u00C5","angzarr":"\u237C","Aogon":"\u0104","aogon":"\u0105","Aopf":"\uD835\uDD38","aopf":"\uD835\uDD52","apacir":"\u2A6F","ap":"\u2248","apE":"\u2A70","ape":"\u224A","apid":"\u224B","apos":"'","ApplyFunction":"\u2061","approx":"\u2248","approxeq":"\u224A","Aring":"\u00C5","aring":"\u00E5","Ascr":"\uD835\uDC9C","ascr":"\uD835\uDCB6","Assign":"\u2254","ast":"*","asymp":"\u2248","asympeq":"\u224D","Atilde":"\u00C3","atilde":"\u00E3","Auml":"\u00C4","auml":"\u00E4","awconint":"\u2233","awint":"\u2A11","backcong":"\u224C","backepsilon":"\u03F6","backprime":"\u2035","backsim":"\u223D","backsimeq":"\u22CD","Backslash":"\u2216","Barv":"\u2AE7","barvee":"\u22BD","barwed":"\u2305","Barwed":"\u2306","barwedge":"\u2305","bbrk":"\u23B5","bbrktbrk":"\u23B6","bcong":"\u224C","Bcy":"\u0411","bcy":"\u0431","bdquo":"\u201E","becaus":"\u2235","because":"\u2235","Because":"\u2235","bemptyv":"\u29B0","bepsi":"\u03F6","bernou":"\u212C","Bernoullis":"\u212C","Beta":"\u0392","beta":"\u03B2","beth":"\u2136","between":"\u226C","Bfr":"\uD835\uDD05","bfr":"\uD835\uDD1F","bigcap":"\u22C2","bigcirc":"\u25EF","bigcup":"\u22C3","bigodot":"\u2A00","bigoplus":"\u2A01","bigotimes":"\u2A02","bigsqcup":"\u2A06","bigstar":"\u2605","bigtriangledown":"\u25BD","bigtriangleup":"\u25B3","biguplus":"\u2A04","bigvee":"\u22C1","bigwedge":"\u22C0","bkarow":"\u290D","blacklozenge":"\u29EB","blacksquare":"\u25AA","blacktriangle":"\u25B4","blacktriangledown":"\u25BE","blacktriangleleft":"\u25C2","blacktriangleright":"\u25B8","blank":"\u2423","blk12":"\u2592","blk14":"\u2591","blk34":"\u2593","block":"\u2588","bne":"=\u20E5","bnequiv":"\u2261\u20E5","bNot":"\u2AED","bnot":"\u2310","Bopf":"\uD835\uDD39","bopf":"\uD835\uDD53","bot":"\u22A5","bottom":"\u22A5","bowtie":"\u22C8","boxbox":"\u29C9","boxdl":"\u2510","boxdL":"\u2555","boxDl":"\u2556","boxDL":"\u2557","boxdr":"\u250C","boxdR":"\u2552","boxDr":"\u2553","boxDR":"\u2554","boxh":"\u2500","boxH":"\u2550","boxhd":"\u252C","boxHd":"\u2564","boxhD":"\u2565","boxHD":"\u2566","boxhu":"\u2534","boxHu":"\u2567","boxhU":"\u2568","boxHU":"\u2569","boxminus":"\u229F","boxplus":"\u229E","boxtimes":"\u22A0","boxul":"\u2518","boxuL":"\u255B","boxUl":"\u255C","boxUL":"\u255D","boxur":"\u2514","boxuR":"\u2558","boxUr":"\u2559","boxUR":"\u255A","boxv":"\u2502","boxV":"\u2551","boxvh":"\u253C","boxvH":"\u256A","boxVh":"\u256B","boxVH":"\u256C","boxvl":"\u2524","boxvL":"\u2561","boxVl":"\u2562","boxVL":"\u2563","boxvr":"\u251C","boxvR":"\u255E","boxVr":"\u255F","boxVR":"\u2560","bprime":"\u2035","breve":"\u02D8","Breve":"\u02D8","brvbar":"\u00A6","bscr":"\uD835\uDCB7","Bscr":"\u212C","bsemi":"\u204F","bsim":"\u223D","bsime":"\u22CD","bsolb":"\u29C5","bsol":"\\","bsolhsub":"\u27C8","bull":"\u2022","bullet":"\u2022","bump":"\u224E","bumpE":"\u2AAE","bumpe":"\u224F","Bumpeq":"\u224E","bumpeq":"\u224F","Cacute":"\u0106","cacute":"\u0107","capand":"\u2A44","capbrcup":"\u2A49","capcap":"\u2A4B","cap":"\u2229","Cap":"\u22D2","capcup":"\u2A47","capdot":"\u2A40","CapitalDifferentialD":"\u2145","caps":"\u2229\uFE00","caret":"\u2041","caron":"\u02C7","Cayleys":"\u212D","ccaps":"\u2A4D","Ccaron":"\u010C","ccaron":"\u010D","Ccedil":"\u00C7","ccedil":"\u00E7","Ccirc":"\u0108","ccirc":"\u0109","Cconint":"\u2230","ccups":"\u2A4C","ccupssm":"\u2A50","Cdot":"\u010A","cdot":"\u010B","cedil":"\u00B8","Cedilla":"\u00B8","cemptyv":"\u29B2","cent":"\u00A2","centerdot":"\u00B7","CenterDot":"\u00B7","cfr":"\uD835\uDD20","Cfr":"\u212D","CHcy":"\u0427","chcy":"\u0447","check":"\u2713","checkmark":"\u2713","Chi":"\u03A7","chi":"\u03C7","circ":"\u02C6","circeq":"\u2257","circlearrowleft":"\u21BA","circlearrowright":"\u21BB","circledast":"\u229B","circledcirc":"\u229A","circleddash":"\u229D","CircleDot":"\u2299","circledR":"\u00AE","circledS":"\u24C8","CircleMinus":"\u2296","CirclePlus":"\u2295","CircleTimes":"\u2297","cir":"\u25CB","cirE":"\u29C3","cire":"\u2257","cirfnint":"\u2A10","cirmid":"\u2AEF","cirscir":"\u29C2","ClockwiseContourIntegral":"\u2232","CloseCurlyDoubleQuote":"\u201D","CloseCurlyQuote":"\u2019","clubs":"\u2663","clubsuit":"\u2663","colon":":","Colon":"\u2237","Colone":"\u2A74","colone":"\u2254","coloneq":"\u2254","comma":",","commat":"@","comp":"\u2201","compfn":"\u2218","complement":"\u2201","complexes":"\u2102","cong":"\u2245","congdot":"\u2A6D","Congruent":"\u2261","conint":"\u222E","Conint":"\u222F","ContourIntegral":"\u222E","copf":"\uD835\uDD54","Copf":"\u2102","coprod":"\u2210","Coproduct":"\u2210","copy":"\u00A9","COPY":"\u00A9","copysr":"\u2117","CounterClockwiseContourIntegral":"\u2233","crarr":"\u21B5","cross":"\u2717","Cross":"\u2A2F","Cscr":"\uD835\uDC9E","cscr":"\uD835\uDCB8","csub":"\u2ACF","csube":"\u2AD1","csup":"\u2AD0","csupe":"\u2AD2","ctdot":"\u22EF","cudarrl":"\u2938","cudarrr":"\u2935","cuepr":"\u22DE","cuesc":"\u22DF","cularr":"\u21B6","cularrp":"\u293D","cupbrcap":"\u2A48","cupcap":"\u2A46","CupCap":"\u224D","cup":"\u222A","Cup":"\u22D3","cupcup":"\u2A4A","cupdot":"\u228D","cupor":"\u2A45","cups":"\u222A\uFE00","curarr":"\u21B7","curarrm":"\u293C","curlyeqprec":"\u22DE","curlyeqsucc":"\u22DF","curlyvee":"\u22CE","curlywedge":"\u22CF","curren":"\u00A4","curvearrowleft":"\u21B6","curvearrowright":"\u21B7","cuvee":"\u22CE","cuwed":"\u22CF","cwconint":"\u2232","cwint":"\u2231","cylcty":"\u232D","dagger":"\u2020","Dagger":"\u2021","daleth":"\u2138","darr":"\u2193","Darr":"\u21A1","dArr":"\u21D3","dash":"\u2010","Dashv":"\u2AE4","dashv":"\u22A3","dbkarow":"\u290F","dblac":"\u02DD","Dcaron":"\u010E","dcaron":"\u010F","Dcy":"\u0414","dcy":"\u0434","ddagger":"\u2021","ddarr":"\u21CA","DD":"\u2145","dd":"\u2146","DDotrahd":"\u2911","ddotseq":"\u2A77","deg":"\u00B0","Del":"\u2207","Delta":"\u0394","delta":"\u03B4","demptyv":"\u29B1","dfisht":"\u297F","Dfr":"\uD835\uDD07","dfr":"\uD835\uDD21","dHar":"\u2965","dharl":"\u21C3","dharr":"\u21C2","DiacriticalAcute":"\u00B4","DiacriticalDot":"\u02D9","DiacriticalDoubleAcute":"\u02DD","DiacriticalGrave":"`","DiacriticalTilde":"\u02DC","diam":"\u22C4","diamond":"\u22C4","Diamond":"\u22C4","diamondsuit":"\u2666","diams":"\u2666","die":"\u00A8","DifferentialD":"\u2146","digamma":"\u03DD","disin":"\u22F2","div":"\u00F7","divide":"\u00F7","divideontimes":"\u22C7","divonx":"\u22C7","DJcy":"\u0402","djcy":"\u0452","dlcorn":"\u231E","dlcrop":"\u230D","dollar":"$","Dopf":"\uD835\uDD3B","dopf":"\uD835\uDD55","Dot":"\u00A8","dot":"\u02D9","DotDot":"\u20DC","doteq":"\u2250","doteqdot":"\u2251","DotEqual":"\u2250","dotminus":"\u2238","dotplus":"\u2214","dotsquare":"\u22A1","doublebarwedge":"\u2306","DoubleContourIntegral":"\u222F","DoubleDot":"\u00A8","DoubleDownArrow":"\u21D3","DoubleLeftArrow":"\u21D0","DoubleLeftRightArrow":"\u21D4","DoubleLeftTee":"\u2AE4","DoubleLongLeftArrow":"\u27F8","DoubleLongLeftRightArrow":"\u27FA","DoubleLongRightArrow":"\u27F9","DoubleRightArrow":"\u21D2","DoubleRightTee":"\u22A8","DoubleUpArrow":"\u21D1","DoubleUpDownArrow":"\u21D5","DoubleVerticalBar":"\u2225","DownArrowBar":"\u2913","downarrow":"\u2193","DownArrow":"\u2193","Downarrow":"\u21D3","DownArrowUpArrow":"\u21F5","DownBreve":"\u0311","downdownarrows":"\u21CA","downharpoonleft":"\u21C3","downharpoonright":"\u21C2","DownLeftRightVector":"\u2950","DownLeftTeeVector":"\u295E","DownLeftVectorBar":"\u2956","DownLeftVector":"\u21BD","DownRightTeeVector":"\u295F","DownRightVectorBar":"\u2957","DownRightVector":"\u21C1","DownTeeArrow":"\u21A7","DownTee":"\u22A4","drbkarow":"\u2910","drcorn":"\u231F","drcrop":"\u230C","Dscr":"\uD835\uDC9F","dscr":"\uD835\uDCB9","DScy":"\u0405","dscy":"\u0455","dsol":"\u29F6","Dstrok":"\u0110","dstrok":"\u0111","dtdot":"\u22F1","dtri":"\u25BF","dtrif":"\u25BE","duarr":"\u21F5","duhar":"\u296F","dwangle":"\u29A6","DZcy":"\u040F","dzcy":"\u045F","dzigrarr":"\u27FF","Eacute":"\u00C9","eacute":"\u00E9","easter":"\u2A6E","Ecaron":"\u011A","ecaron":"\u011B","Ecirc":"\u00CA","ecirc":"\u00EA","ecir":"\u2256","ecolon":"\u2255","Ecy":"\u042D","ecy":"\u044D","eDDot":"\u2A77","Edot":"\u0116","edot":"\u0117","eDot":"\u2251","ee":"\u2147","efDot":"\u2252","Efr":"\uD835\uDD08","efr":"\uD835\uDD22","eg":"\u2A9A","Egrave":"\u00C8","egrave":"\u00E8","egs":"\u2A96","egsdot":"\u2A98","el":"\u2A99","Element":"\u2208","elinters":"\u23E7","ell":"\u2113","els":"\u2A95","elsdot":"\u2A97","Emacr":"\u0112","emacr":"\u0113","empty":"\u2205","emptyset":"\u2205","EmptySmallSquare":"\u25FB","emptyv":"\u2205","EmptyVerySmallSquare":"\u25AB","emsp13":"\u2004","emsp14":"\u2005","emsp":"\u2003","ENG":"\u014A","eng":"\u014B","ensp":"\u2002","Eogon":"\u0118","eogon":"\u0119","Eopf":"\uD835\uDD3C","eopf":"\uD835\uDD56","epar":"\u22D5","eparsl":"\u29E3","eplus":"\u2A71","epsi":"\u03B5","Epsilon":"\u0395","epsilon":"\u03B5","epsiv":"\u03F5","eqcirc":"\u2256","eqcolon":"\u2255","eqsim":"\u2242","eqslantgtr":"\u2A96","eqslantless":"\u2A95","Equal":"\u2A75","equals":"=","EqualTilde":"\u2242","equest":"\u225F","Equilibrium":"\u21CC","equiv":"\u2261","equivDD":"\u2A78","eqvparsl":"\u29E5","erarr":"\u2971","erDot":"\u2253","escr":"\u212F","Escr":"\u2130","esdot":"\u2250","Esim":"\u2A73","esim":"\u2242","Eta":"\u0397","eta":"\u03B7","ETH":"\u00D0","eth":"\u00F0","Euml":"\u00CB","euml":"\u00EB","euro":"\u20AC","excl":"!","exist":"\u2203","Exists":"\u2203","expectation":"\u2130","exponentiale":"\u2147","ExponentialE":"\u2147","fallingdotseq":"\u2252","Fcy":"\u0424","fcy":"\u0444","female":"\u2640","ffilig":"\uFB03","fflig":"\uFB00","ffllig":"\uFB04","Ffr":"\uD835\uDD09","ffr":"\uD835\uDD23","filig":"\uFB01","FilledSmallSquare":"\u25FC","FilledVerySmallSquare":"\u25AA","fjlig":"fj","flat":"\u266D","fllig":"\uFB02","fltns":"\u25B1","fnof":"\u0192","Fopf":"\uD835\uDD3D","fopf":"\uD835\uDD57","forall":"\u2200","ForAll":"\u2200","fork":"\u22D4","forkv":"\u2AD9","Fouriertrf":"\u2131","fpartint":"\u2A0D","frac12":"\u00BD","frac13":"\u2153","frac14":"\u00BC","frac15":"\u2155","frac16":"\u2159","frac18":"\u215B","frac23":"\u2154","frac25":"\u2156","frac34":"\u00BE","frac35":"\u2157","frac38":"\u215C","frac45":"\u2158","frac56":"\u215A","frac58":"\u215D","frac78":"\u215E","frasl":"\u2044","frown":"\u2322","fscr":"\uD835\uDCBB","Fscr":"\u2131","gacute":"\u01F5","Gamma":"\u0393","gamma":"\u03B3","Gammad":"\u03DC","gammad":"\u03DD","gap":"\u2A86","Gbreve":"\u011E","gbreve":"\u011F","Gcedil":"\u0122","Gcirc":"\u011C","gcirc":"\u011D","Gcy":"\u0413","gcy":"\u0433","Gdot":"\u0120","gdot":"\u0121","ge":"\u2265","gE":"\u2267","gEl":"\u2A8C","gel":"\u22DB","geq":"\u2265","geqq":"\u2267","geqslant":"\u2A7E","gescc":"\u2AA9","ges":"\u2A7E","gesdot":"\u2A80","gesdoto":"\u2A82","gesdotol":"\u2A84","gesl":"\u22DB\uFE00","gesles":"\u2A94","Gfr":"\uD835\uDD0A","gfr":"\uD835\uDD24","gg":"\u226B","Gg":"\u22D9","ggg":"\u22D9","gimel":"\u2137","GJcy":"\u0403","gjcy":"\u0453","gla":"\u2AA5","gl":"\u2277","glE":"\u2A92","glj":"\u2AA4","gnap":"\u2A8A","gnapprox":"\u2A8A","gne":"\u2A88","gnE":"\u2269","gneq":"\u2A88","gneqq":"\u2269","gnsim":"\u22E7","Gopf":"\uD835\uDD3E","gopf":"\uD835\uDD58","grave":"`","GreaterEqual":"\u2265","GreaterEqualLess":"\u22DB","GreaterFullEqual":"\u2267","GreaterGreater":"\u2AA2","GreaterLess":"\u2277","GreaterSlantEqual":"\u2A7E","GreaterTilde":"\u2273","Gscr":"\uD835\uDCA2","gscr":"\u210A","gsim":"\u2273","gsime":"\u2A8E","gsiml":"\u2A90","gtcc":"\u2AA7","gtcir":"\u2A7A","gt":">","GT":">","Gt":"\u226B","gtdot":"\u22D7","gtlPar":"\u2995","gtquest":"\u2A7C","gtrapprox":"\u2A86","gtrarr":"\u2978","gtrdot":"\u22D7","gtreqless":"\u22DB","gtreqqless":"\u2A8C","gtrless":"\u2277","gtrsim":"\u2273","gvertneqq":"\u2269\uFE00","gvnE":"\u2269\uFE00","Hacek":"\u02C7","hairsp":"\u200A","half":"\u00BD","hamilt":"\u210B","HARDcy":"\u042A","hardcy":"\u044A","harrcir":"\u2948","harr":"\u2194","hArr":"\u21D4","harrw":"\u21AD","Hat":"^","hbar":"\u210F","Hcirc":"\u0124","hcirc":"\u0125","hearts":"\u2665","heartsuit":"\u2665","hellip":"\u2026","hercon":"\u22B9","hfr":"\uD835\uDD25","Hfr":"\u210C","HilbertSpace":"\u210B","hksearow":"\u2925","hkswarow":"\u2926","hoarr":"\u21FF","homtht":"\u223B","hookleftarrow":"\u21A9","hookrightarrow":"\u21AA","hopf":"\uD835\uDD59","Hopf":"\u210D","horbar":"\u2015","HorizontalLine":"\u2500","hscr":"\uD835\uDCBD","Hscr":"\u210B","hslash":"\u210F","Hstrok":"\u0126","hstrok":"\u0127","HumpDownHump":"\u224E","HumpEqual":"\u224F","hybull":"\u2043","hyphen":"\u2010","Iacute":"\u00CD","iacute":"\u00ED","ic":"\u2063","Icirc":"\u00CE","icirc":"\u00EE","Icy":"\u0418","icy":"\u0438","Idot":"\u0130","IEcy":"\u0415","iecy":"\u0435","iexcl":"\u00A1","iff":"\u21D4","ifr":"\uD835\uDD26","Ifr":"\u2111","Igrave":"\u00CC","igrave":"\u00EC","ii":"\u2148","iiiint":"\u2A0C","iiint":"\u222D","iinfin":"\u29DC","iiota":"\u2129","IJlig":"\u0132","ijlig":"\u0133","Imacr":"\u012A","imacr":"\u012B","image":"\u2111","ImaginaryI":"\u2148","imagline":"\u2110","imagpart":"\u2111","imath":"\u0131","Im":"\u2111","imof":"\u22B7","imped":"\u01B5","Implies":"\u21D2","incare":"\u2105","in":"\u2208","infin":"\u221E","infintie":"\u29DD","inodot":"\u0131","intcal":"\u22BA","int":"\u222B","Int":"\u222C","integers":"\u2124","Integral":"\u222B","intercal":"\u22BA","Intersection":"\u22C2","intlarhk":"\u2A17","intprod":"\u2A3C","InvisibleComma":"\u2063","InvisibleTimes":"\u2062","IOcy":"\u0401","iocy":"\u0451","Iogon":"\u012E","iogon":"\u012F","Iopf":"\uD835\uDD40","iopf":"\uD835\uDD5A","Iota":"\u0399","iota":"\u03B9","iprod":"\u2A3C","iquest":"\u00BF","iscr":"\uD835\uDCBE","Iscr":"\u2110","isin":"\u2208","isindot":"\u22F5","isinE":"\u22F9","isins":"\u22F4","isinsv":"\u22F3","isinv":"\u2208","it":"\u2062","Itilde":"\u0128","itilde":"\u0129","Iukcy":"\u0406","iukcy":"\u0456","Iuml":"\u00CF","iuml":"\u00EF","Jcirc":"\u0134","jcirc":"\u0135","Jcy":"\u0419","jcy":"\u0439","Jfr":"\uD835\uDD0D","jfr":"\uD835\uDD27","jmath":"\u0237","Jopf":"\uD835\uDD41","jopf":"\uD835\uDD5B","Jscr":"\uD835\uDCA5","jscr":"\uD835\uDCBF","Jsercy":"\u0408","jsercy":"\u0458","Jukcy":"\u0404","jukcy":"\u0454","Kappa":"\u039A","kappa":"\u03BA","kappav":"\u03F0","Kcedil":"\u0136","kcedil":"\u0137","Kcy":"\u041A","kcy":"\u043A","Kfr":"\uD835\uDD0E","kfr":"\uD835\uDD28","kgreen":"\u0138","KHcy":"\u0425","khcy":"\u0445","KJcy":"\u040C","kjcy":"\u045C","Kopf":"\uD835\uDD42","kopf":"\uD835\uDD5C","Kscr":"\uD835\uDCA6","kscr":"\uD835\uDCC0","lAarr":"\u21DA","Lacute":"\u0139","lacute":"\u013A","laemptyv":"\u29B4","lagran":"\u2112","Lambda":"\u039B","lambda":"\u03BB","lang":"\u27E8","Lang":"\u27EA","langd":"\u2991","langle":"\u27E8","lap":"\u2A85","Laplacetrf":"\u2112","laquo":"\u00AB","larrb":"\u21E4","larrbfs":"\u291F","larr":"\u2190","Larr":"\u219E","lArr":"\u21D0","larrfs":"\u291D","larrhk":"\u21A9","larrlp":"\u21AB","larrpl":"\u2939","larrsim":"\u2973","larrtl":"\u21A2","latail":"\u2919","lAtail":"\u291B","lat":"\u2AAB","late":"\u2AAD","lates":"\u2AAD\uFE00","lbarr":"\u290C","lBarr":"\u290E","lbbrk":"\u2772","lbrace":"{","lbrack":"[","lbrke":"\u298B","lbrksld":"\u298F","lbrkslu":"\u298D","Lcaron":"\u013D","lcaron":"\u013E","Lcedil":"\u013B","lcedil":"\u013C","lceil":"\u2308","lcub":"{","Lcy":"\u041B","lcy":"\u043B","ldca":"\u2936","ldquo":"\u201C","ldquor":"\u201E","ldrdhar":"\u2967","ldrushar":"\u294B","ldsh":"\u21B2","le":"\u2264","lE":"\u2266","LeftAngleBracket":"\u27E8","LeftArrowBar":"\u21E4","leftarrow":"\u2190","LeftArrow":"\u2190","Leftarrow":"\u21D0","LeftArrowRightArrow":"\u21C6","leftarrowtail":"\u21A2","LeftCeiling":"\u2308","LeftDoubleBracket":"\u27E6","LeftDownTeeVector":"\u2961","LeftDownVectorBar":"\u2959","LeftDownVector":"\u21C3","LeftFloor":"\u230A","leftharpoondown":"\u21BD","leftharpoonup":"\u21BC","leftleftarrows":"\u21C7","leftrightarrow":"\u2194","LeftRightArrow":"\u2194","Leftrightarrow":"\u21D4","leftrightarrows":"\u21C6","leftrightharpoons":"\u21CB","leftrightsquigarrow":"\u21AD","LeftRightVector":"\u294E","LeftTeeArrow":"\u21A4","LeftTee":"\u22A3","LeftTeeVector":"\u295A","leftthreetimes":"\u22CB","LeftTriangleBar":"\u29CF","LeftTriangle":"\u22B2","LeftTriangleEqual":"\u22B4","LeftUpDownVector":"\u2951","LeftUpTeeVector":"\u2960","LeftUpVectorBar":"\u2958","LeftUpVector":"\u21BF","LeftVectorBar":"\u2952","LeftVector":"\u21BC","lEg":"\u2A8B","leg":"\u22DA","leq":"\u2264","leqq":"\u2266","leqslant":"\u2A7D","lescc":"\u2AA8","les":"\u2A7D","lesdot":"\u2A7F","lesdoto":"\u2A81","lesdotor":"\u2A83","lesg":"\u22DA\uFE00","lesges":"\u2A93","lessapprox":"\u2A85","lessdot":"\u22D6","lesseqgtr":"\u22DA","lesseqqgtr":"\u2A8B","LessEqualGreater":"\u22DA","LessFullEqual":"\u2266","LessGreater":"\u2276","lessgtr":"\u2276","LessLess":"\u2AA1","lesssim":"\u2272","LessSlantEqual":"\u2A7D","LessTilde":"\u2272","lfisht":"\u297C","lfloor":"\u230A","Lfr":"\uD835\uDD0F","lfr":"\uD835\uDD29","lg":"\u2276","lgE":"\u2A91","lHar":"\u2962","lhard":"\u21BD","lharu":"\u21BC","lharul":"\u296A","lhblk":"\u2584","LJcy":"\u0409","ljcy":"\u0459","llarr":"\u21C7","ll":"\u226A","Ll":"\u22D8","llcorner":"\u231E","Lleftarrow":"\u21DA","llhard":"\u296B","lltri":"\u25FA","Lmidot":"\u013F","lmidot":"\u0140","lmoustache":"\u23B0","lmoust":"\u23B0","lnap":"\u2A89","lnapprox":"\u2A89","lne":"\u2A87","lnE":"\u2268","lneq":"\u2A87","lneqq":"\u2268","lnsim":"\u22E6","loang":"\u27EC","loarr":"\u21FD","lobrk":"\u27E6","longleftarrow":"\u27F5","LongLeftArrow":"\u27F5","Longleftarrow":"\u27F8","longleftrightarrow":"\u27F7","LongLeftRightArrow":"\u27F7","Longleftrightarrow":"\u27FA","longmapsto":"\u27FC","longrightarrow":"\u27F6","LongRightArrow":"\u27F6","Longrightarrow":"\u27F9","looparrowleft":"\u21AB","looparrowright":"\u21AC","lopar":"\u2985","Lopf":"\uD835\uDD43","lopf":"\uD835\uDD5D","loplus":"\u2A2D","lotimes":"\u2A34","lowast":"\u2217","lowbar":"_","LowerLeftArrow":"\u2199","LowerRightArrow":"\u2198","loz":"\u25CA","lozenge":"\u25CA","lozf":"\u29EB","lpar":"(","lparlt":"\u2993","lrarr":"\u21C6","lrcorner":"\u231F","lrhar":"\u21CB","lrhard":"\u296D","lrm":"\u200E","lrtri":"\u22BF","lsaquo":"\u2039","lscr":"\uD835\uDCC1","Lscr":"\u2112","lsh":"\u21B0","Lsh":"\u21B0","lsim":"\u2272","lsime":"\u2A8D","lsimg":"\u2A8F","lsqb":"[","lsquo":"\u2018","lsquor":"\u201A","Lstrok":"\u0141","lstrok":"\u0142","ltcc":"\u2AA6","ltcir":"\u2A79","lt":"<","LT":"<","Lt":"\u226A","ltdot":"\u22D6","lthree":"\u22CB","ltimes":"\u22C9","ltlarr":"\u2976","ltquest":"\u2A7B","ltri":"\u25C3","ltrie":"\u22B4","ltrif":"\u25C2","ltrPar":"\u2996","lurdshar":"\u294A","luruhar":"\u2966","lvertneqq":"\u2268\uFE00","lvnE":"\u2268\uFE00","macr":"\u00AF","male":"\u2642","malt":"\u2720","maltese":"\u2720","Map":"\u2905","map":"\u21A6","mapsto":"\u21A6","mapstodown":"\u21A7","mapstoleft":"\u21A4","mapstoup":"\u21A5","marker":"\u25AE","mcomma":"\u2A29","Mcy":"\u041C","mcy":"\u043C","mdash":"\u2014","mDDot":"\u223A","measuredangle":"\u2221","MediumSpace":"\u205F","Mellintrf":"\u2133","Mfr":"\uD835\uDD10","mfr":"\uD835\uDD2A","mho":"\u2127","micro":"\u00B5","midast":"*","midcir":"\u2AF0","mid":"\u2223","middot":"\u00B7","minusb":"\u229F","minus":"\u2212","minusd":"\u2238","minusdu":"\u2A2A","MinusPlus":"\u2213","mlcp":"\u2ADB","mldr":"\u2026","mnplus":"\u2213","models":"\u22A7","Mopf":"\uD835\uDD44","mopf":"\uD835\uDD5E","mp":"\u2213","mscr":"\uD835\uDCC2","Mscr":"\u2133","mstpos":"\u223E","Mu":"\u039C","mu":"\u03BC","multimap":"\u22B8","mumap":"\u22B8","nabla":"\u2207","Nacute":"\u0143","nacute":"\u0144","nang":"\u2220\u20D2","nap":"\u2249","napE":"\u2A70\u0338","napid":"\u224B\u0338","napos":"\u0149","napprox":"\u2249","natural":"\u266E","naturals":"\u2115","natur":"\u266E","nbsp":"\u00A0","nbump":"\u224E\u0338","nbumpe":"\u224F\u0338","ncap":"\u2A43","Ncaron":"\u0147","ncaron":"\u0148","Ncedil":"\u0145","ncedil":"\u0146","ncong":"\u2247","ncongdot":"\u2A6D\u0338","ncup":"\u2A42","Ncy":"\u041D","ncy":"\u043D","ndash":"\u2013","nearhk":"\u2924","nearr":"\u2197","neArr":"\u21D7","nearrow":"\u2197","ne":"\u2260","nedot":"\u2250\u0338","NegativeMediumSpace":"\u200B","NegativeThickSpace":"\u200B","NegativeThinSpace":"\u200B","NegativeVeryThinSpace":"\u200B","nequiv":"\u2262","nesear":"\u2928","nesim":"\u2242\u0338","NestedGreaterGreater":"\u226B","NestedLessLess":"\u226A","NewLine":"\n","nexist":"\u2204","nexists":"\u2204","Nfr":"\uD835\uDD11","nfr":"\uD835\uDD2B","ngE":"\u2267\u0338","nge":"\u2271","ngeq":"\u2271","ngeqq":"\u2267\u0338","ngeqslant":"\u2A7E\u0338","nges":"\u2A7E\u0338","nGg":"\u22D9\u0338","ngsim":"\u2275","nGt":"\u226B\u20D2","ngt":"\u226F","ngtr":"\u226F","nGtv":"\u226B\u0338","nharr":"\u21AE","nhArr":"\u21CE","nhpar":"\u2AF2","ni":"\u220B","nis":"\u22FC","nisd":"\u22FA","niv":"\u220B","NJcy":"\u040A","njcy":"\u045A","nlarr":"\u219A","nlArr":"\u21CD","nldr":"\u2025","nlE":"\u2266\u0338","nle":"\u2270","nleftarrow":"\u219A","nLeftarrow":"\u21CD","nleftrightarrow":"\u21AE","nLeftrightarrow":"\u21CE","nleq":"\u2270","nleqq":"\u2266\u0338","nleqslant":"\u2A7D\u0338","nles":"\u2A7D\u0338","nless":"\u226E","nLl":"\u22D8\u0338","nlsim":"\u2274","nLt":"\u226A\u20D2","nlt":"\u226E","nltri":"\u22EA","nltrie":"\u22EC","nLtv":"\u226A\u0338","nmid":"\u2224","NoBreak":"\u2060","NonBreakingSpace":"\u00A0","nopf":"\uD835\uDD5F","Nopf":"\u2115","Not":"\u2AEC","not":"\u00AC","NotCongruent":"\u2262","NotCupCap":"\u226D","NotDoubleVerticalBar":"\u2226","NotElement":"\u2209","NotEqual":"\u2260","NotEqualTilde":"\u2242\u0338","NotExists":"\u2204","NotGreater":"\u226F","NotGreaterEqual":"\u2271","NotGreaterFullEqual":"\u2267\u0338","NotGreaterGreater":"\u226B\u0338","NotGreaterLess":"\u2279","NotGreaterSlantEqual":"\u2A7E\u0338","NotGreaterTilde":"\u2275","NotHumpDownHump":"\u224E\u0338","NotHumpEqual":"\u224F\u0338","notin":"\u2209","notindot":"\u22F5\u0338","notinE":"\u22F9\u0338","notinva":"\u2209","notinvb":"\u22F7","notinvc":"\u22F6","NotLeftTriangleBar":"\u29CF\u0338","NotLeftTriangle":"\u22EA","NotLeftTriangleEqual":"\u22EC","NotLess":"\u226E","NotLessEqual":"\u2270","NotLessGreater":"\u2278","NotLessLess":"\u226A\u0338","NotLessSlantEqual":"\u2A7D\u0338","NotLessTilde":"\u2274","NotNestedGreaterGreater":"\u2AA2\u0338","NotNestedLessLess":"\u2AA1\u0338","notni":"\u220C","notniva":"\u220C","notnivb":"\u22FE","notnivc":"\u22FD","NotPrecedes":"\u2280","NotPrecedesEqual":"\u2AAF\u0338","NotPrecedesSlantEqual":"\u22E0","NotReverseElement":"\u220C","NotRightTriangleBar":"\u29D0\u0338","NotRightTriangle":"\u22EB","NotRightTriangleEqual":"\u22ED","NotSquareSubset":"\u228F\u0338","NotSquareSubsetEqual":"\u22E2","NotSquareSuperset":"\u2290\u0338","NotSquareSupersetEqual":"\u22E3","NotSubset":"\u2282\u20D2","NotSubsetEqual":"\u2288","NotSucceeds":"\u2281","NotSucceedsEqual":"\u2AB0\u0338","NotSucceedsSlantEqual":"\u22E1","NotSucceedsTilde":"\u227F\u0338","NotSuperset":"\u2283\u20D2","NotSupersetEqual":"\u2289","NotTilde":"\u2241","NotTildeEqual":"\u2244","NotTildeFullEqual":"\u2247","NotTildeTilde":"\u2249","NotVerticalBar":"\u2224","nparallel":"\u2226","npar":"\u2226","nparsl":"\u2AFD\u20E5","npart":"\u2202\u0338","npolint":"\u2A14","npr":"\u2280","nprcue":"\u22E0","nprec":"\u2280","npreceq":"\u2AAF\u0338","npre":"\u2AAF\u0338","nrarrc":"\u2933\u0338","nrarr":"\u219B","nrArr":"\u21CF","nrarrw":"\u219D\u0338","nrightarrow":"\u219B","nRightarrow":"\u21CF","nrtri":"\u22EB","nrtrie":"\u22ED","nsc":"\u2281","nsccue":"\u22E1","nsce":"\u2AB0\u0338","Nscr":"\uD835\uDCA9","nscr":"\uD835\uDCC3","nshortmid":"\u2224","nshortparallel":"\u2226","nsim":"\u2241","nsime":"\u2244","nsimeq":"\u2244","nsmid":"\u2224","nspar":"\u2226","nsqsube":"\u22E2","nsqsupe":"\u22E3","nsub":"\u2284","nsubE":"\u2AC5\u0338","nsube":"\u2288","nsubset":"\u2282\u20D2","nsubseteq":"\u2288","nsubseteqq":"\u2AC5\u0338","nsucc":"\u2281","nsucceq":"\u2AB0\u0338","nsup":"\u2285","nsupE":"\u2AC6\u0338","nsupe":"\u2289","nsupset":"\u2283\u20D2","nsupseteq":"\u2289","nsupseteqq":"\u2AC6\u0338","ntgl":"\u2279","Ntilde":"\u00D1","ntilde":"\u00F1","ntlg":"\u2278","ntriangleleft":"\u22EA","ntrianglelefteq":"\u22EC","ntriangleright":"\u22EB","ntrianglerighteq":"\u22ED","Nu":"\u039D","nu":"\u03BD","num":"#","numero":"\u2116","numsp":"\u2007","nvap":"\u224D\u20D2","nvdash":"\u22AC","nvDash":"\u22AD","nVdash":"\u22AE","nVDash":"\u22AF","nvge":"\u2265\u20D2","nvgt":">\u20D2","nvHarr":"\u2904","nvinfin":"\u29DE","nvlArr":"\u2902","nvle":"\u2264\u20D2","nvlt":"<\u20D2","nvltrie":"\u22B4\u20D2","nvrArr":"\u2903","nvrtrie":"\u22B5\u20D2","nvsim":"\u223C\u20D2","nwarhk":"\u2923","nwarr":"\u2196","nwArr":"\u21D6","nwarrow":"\u2196","nwnear":"\u2927","Oacute":"\u00D3","oacute":"\u00F3","oast":"\u229B","Ocirc":"\u00D4","ocirc":"\u00F4","ocir":"\u229A","Ocy":"\u041E","ocy":"\u043E","odash":"\u229D","Odblac":"\u0150","odblac":"\u0151","odiv":"\u2A38","odot":"\u2299","odsold":"\u29BC","OElig":"\u0152","oelig":"\u0153","ofcir":"\u29BF","Ofr":"\uD835\uDD12","ofr":"\uD835\uDD2C","ogon":"\u02DB","Ograve":"\u00D2","ograve":"\u00F2","ogt":"\u29C1","ohbar":"\u29B5","ohm":"\u03A9","oint":"\u222E","olarr":"\u21BA","olcir":"\u29BE","olcross":"\u29BB","oline":"\u203E","olt":"\u29C0","Omacr":"\u014C","omacr":"\u014D","Omega":"\u03A9","omega":"\u03C9","Omicron":"\u039F","omicron":"\u03BF","omid":"\u29B6","ominus":"\u2296","Oopf":"\uD835\uDD46","oopf":"\uD835\uDD60","opar":"\u29B7","OpenCurlyDoubleQuote":"\u201C","OpenCurlyQuote":"\u2018","operp":"\u29B9","oplus":"\u2295","orarr":"\u21BB","Or":"\u2A54","or":"\u2228","ord":"\u2A5D","order":"\u2134","orderof":"\u2134","ordf":"\u00AA","ordm":"\u00BA","origof":"\u22B6","oror":"\u2A56","orslope":"\u2A57","orv":"\u2A5B","oS":"\u24C8","Oscr":"\uD835\uDCAA","oscr":"\u2134","Oslash":"\u00D8","oslash":"\u00F8","osol":"\u2298","Otilde":"\u00D5","otilde":"\u00F5","otimesas":"\u2A36","Otimes":"\u2A37","otimes":"\u2297","Ouml":"\u00D6","ouml":"\u00F6","ovbar":"\u233D","OverBar":"\u203E","OverBrace":"\u23DE","OverBracket":"\u23B4","OverParenthesis":"\u23DC","para":"\u00B6","parallel":"\u2225","par":"\u2225","parsim":"\u2AF3","parsl":"\u2AFD","part":"\u2202","PartialD":"\u2202","Pcy":"\u041F","pcy":"\u043F","percnt":"%","period":".","permil":"\u2030","perp":"\u22A5","pertenk":"\u2031","Pfr":"\uD835\uDD13","pfr":"\uD835\uDD2D","Phi":"\u03A6","phi":"\u03C6","phiv":"\u03D5","phmmat":"\u2133","phone":"\u260E","Pi":"\u03A0","pi":"\u03C0","pitchfork":"\u22D4","piv":"\u03D6","planck":"\u210F","planckh":"\u210E","plankv":"\u210F","plusacir":"\u2A23","plusb":"\u229E","pluscir":"\u2A22","plus":"+","plusdo":"\u2214","plusdu":"\u2A25","pluse":"\u2A72","PlusMinus":"\u00B1","plusmn":"\u00B1","plussim":"\u2A26","plustwo":"\u2A27","pm":"\u00B1","Poincareplane":"\u210C","pointint":"\u2A15","popf":"\uD835\uDD61","Popf":"\u2119","pound":"\u00A3","prap":"\u2AB7","Pr":"\u2ABB","pr":"\u227A","prcue":"\u227C","precapprox":"\u2AB7","prec":"\u227A","preccurlyeq":"\u227C","Precedes":"\u227A","PrecedesEqual":"\u2AAF","PrecedesSlantEqual":"\u227C","PrecedesTilde":"\u227E","preceq":"\u2AAF","precnapprox":"\u2AB9","precneqq":"\u2AB5","precnsim":"\u22E8","pre":"\u2AAF","prE":"\u2AB3","precsim":"\u227E","prime":"\u2032","Prime":"\u2033","primes":"\u2119","prnap":"\u2AB9","prnE":"\u2AB5","prnsim":"\u22E8","prod":"\u220F","Product":"\u220F","profalar":"\u232E","profline":"\u2312","profsurf":"\u2313","prop":"\u221D","Proportional":"\u221D","Proportion":"\u2237","propto":"\u221D","prsim":"\u227E","prurel":"\u22B0","Pscr":"\uD835\uDCAB","pscr":"\uD835\uDCC5","Psi":"\u03A8","psi":"\u03C8","puncsp":"\u2008","Qfr":"\uD835\uDD14","qfr":"\uD835\uDD2E","qint":"\u2A0C","qopf":"\uD835\uDD62","Qopf":"\u211A","qprime":"\u2057","Qscr":"\uD835\uDCAC","qscr":"\uD835\uDCC6","quaternions":"\u210D","quatint":"\u2A16","quest":"?","questeq":"\u225F","quot":"\"","QUOT":"\"","rAarr":"\u21DB","race":"\u223D\u0331","Racute":"\u0154","racute":"\u0155","radic":"\u221A","raemptyv":"\u29B3","rang":"\u27E9","Rang":"\u27EB","rangd":"\u2992","range":"\u29A5","rangle":"\u27E9","raquo":"\u00BB","rarrap":"\u2975","rarrb":"\u21E5","rarrbfs":"\u2920","rarrc":"\u2933","rarr":"\u2192","Rarr":"\u21A0","rArr":"\u21D2","rarrfs":"\u291E","rarrhk":"\u21AA","rarrlp":"\u21AC","rarrpl":"\u2945","rarrsim":"\u2974","Rarrtl":"\u2916","rarrtl":"\u21A3","rarrw":"\u219D","ratail":"\u291A","rAtail":"\u291C","ratio":"\u2236","rationals":"\u211A","rbarr":"\u290D","rBarr":"\u290F","RBarr":"\u2910","rbbrk":"\u2773","rbrace":"}","rbrack":"]","rbrke":"\u298C","rbrksld":"\u298E","rbrkslu":"\u2990","Rcaron":"\u0158","rcaron":"\u0159","Rcedil":"\u0156","rcedil":"\u0157","rceil":"\u2309","rcub":"}","Rcy":"\u0420","rcy":"\u0440","rdca":"\u2937","rdldhar":"\u2969","rdquo":"\u201D","rdquor":"\u201D","rdsh":"\u21B3","real":"\u211C","realine":"\u211B","realpart":"\u211C","reals":"\u211D","Re":"\u211C","rect":"\u25AD","reg":"\u00AE","REG":"\u00AE","ReverseElement":"\u220B","ReverseEquilibrium":"\u21CB","ReverseUpEquilibrium":"\u296F","rfisht":"\u297D","rfloor":"\u230B","rfr":"\uD835\uDD2F","Rfr":"\u211C","rHar":"\u2964","rhard":"\u21C1","rharu":"\u21C0","rharul":"\u296C","Rho":"\u03A1","rho":"\u03C1","rhov":"\u03F1","RightAngleBracket":"\u27E9","RightArrowBar":"\u21E5","rightarrow":"\u2192","RightArrow":"\u2192","Rightarrow":"\u21D2","RightArrowLeftArrow":"\u21C4","rightarrowtail":"\u21A3","RightCeiling":"\u2309","RightDoubleBracket":"\u27E7","RightDownTeeVector":"\u295D","RightDownVectorBar":"\u2955","RightDownVector":"\u21C2","RightFloor":"\u230B","rightharpoondown":"\u21C1","rightharpoonup":"\u21C0","rightleftarrows":"\u21C4","rightleftharpoons":"\u21CC","rightrightarrows":"\u21C9","rightsquigarrow":"\u219D","RightTeeArrow":"\u21A6","RightTee":"\u22A2","RightTeeVector":"\u295B","rightthreetimes":"\u22CC","RightTriangleBar":"\u29D0","RightTriangle":"\u22B3","RightTriangleEqual":"\u22B5","RightUpDownVector":"\u294F","RightUpTeeVector":"\u295C","RightUpVectorBar":"\u2954","RightUpVector":"\u21BE","RightVectorBar":"\u2953","RightVector":"\u21C0","ring":"\u02DA","risingdotseq":"\u2253","rlarr":"\u21C4","rlhar":"\u21CC","rlm":"\u200F","rmoustache":"\u23B1","rmoust":"\u23B1","rnmid":"\u2AEE","roang":"\u27ED","roarr":"\u21FE","robrk":"\u27E7","ropar":"\u2986","ropf":"\uD835\uDD63","Ropf":"\u211D","roplus":"\u2A2E","rotimes":"\u2A35","RoundImplies":"\u2970","rpar":")","rpargt":"\u2994","rppolint":"\u2A12","rrarr":"\u21C9","Rrightarrow":"\u21DB","rsaquo":"\u203A","rscr":"\uD835\uDCC7","Rscr":"\u211B","rsh":"\u21B1","Rsh":"\u21B1","rsqb":"]","rsquo":"\u2019","rsquor":"\u2019","rthree":"\u22CC","rtimes":"\u22CA","rtri":"\u25B9","rtrie":"\u22B5","rtrif":"\u25B8","rtriltri":"\u29CE","RuleDelayed":"\u29F4","ruluhar":"\u2968","rx":"\u211E","Sacute":"\u015A","sacute":"\u015B","sbquo":"\u201A","scap":"\u2AB8","Scaron":"\u0160","scaron":"\u0161","Sc":"\u2ABC","sc":"\u227B","sccue":"\u227D","sce":"\u2AB0","scE":"\u2AB4","Scedil":"\u015E","scedil":"\u015F","Scirc":"\u015C","scirc":"\u015D","scnap":"\u2ABA","scnE":"\u2AB6","scnsim":"\u22E9","scpolint":"\u2A13","scsim":"\u227F","Scy":"\u0421","scy":"\u0441","sdotb":"\u22A1","sdot":"\u22C5","sdote":"\u2A66","searhk":"\u2925","searr":"\u2198","seArr":"\u21D8","searrow":"\u2198","sect":"\u00A7","semi":";","seswar":"\u2929","setminus":"\u2216","setmn":"\u2216","sext":"\u2736","Sfr":"\uD835\uDD16","sfr":"\uD835\uDD30","sfrown":"\u2322","sharp":"\u266F","SHCHcy":"\u0429","shchcy":"\u0449","SHcy":"\u0428","shcy":"\u0448","ShortDownArrow":"\u2193","ShortLeftArrow":"\u2190","shortmid":"\u2223","shortparallel":"\u2225","ShortRightArrow":"\u2192","ShortUpArrow":"\u2191","shy":"\u00AD","Sigma":"\u03A3","sigma":"\u03C3","sigmaf":"\u03C2","sigmav":"\u03C2","sim":"\u223C","simdot":"\u2A6A","sime":"\u2243","simeq":"\u2243","simg":"\u2A9E","simgE":"\u2AA0","siml":"\u2A9D","simlE":"\u2A9F","simne":"\u2246","simplus":"\u2A24","simrarr":"\u2972","slarr":"\u2190","SmallCircle":"\u2218","smallsetminus":"\u2216","smashp":"\u2A33","smeparsl":"\u29E4","smid":"\u2223","smile":"\u2323","smt":"\u2AAA","smte":"\u2AAC","smtes":"\u2AAC\uFE00","SOFTcy":"\u042C","softcy":"\u044C","solbar":"\u233F","solb":"\u29C4","sol":"/","Sopf":"\uD835\uDD4A","sopf":"\uD835\uDD64","spades":"\u2660","spadesuit":"\u2660","spar":"\u2225","sqcap":"\u2293","sqcaps":"\u2293\uFE00","sqcup":"\u2294","sqcups":"\u2294\uFE00","Sqrt":"\u221A","sqsub":"\u228F","sqsube":"\u2291","sqsubset":"\u228F","sqsubseteq":"\u2291","sqsup":"\u2290","sqsupe":"\u2292","sqsupset":"\u2290","sqsupseteq":"\u2292","square":"\u25A1","Square":"\u25A1","SquareIntersection":"\u2293","SquareSubset":"\u228F","SquareSubsetEqual":"\u2291","SquareSuperset":"\u2290","SquareSupersetEqual":"\u2292","SquareUnion":"\u2294","squarf":"\u25AA","squ":"\u25A1","squf":"\u25AA","srarr":"\u2192","Sscr":"\uD835\uDCAE","sscr":"\uD835\uDCC8","ssetmn":"\u2216","ssmile":"\u2323","sstarf":"\u22C6","Star":"\u22C6","star":"\u2606","starf":"\u2605","straightepsilon":"\u03F5","straightphi":"\u03D5","strns":"\u00AF","sub":"\u2282","Sub":"\u22D0","subdot":"\u2ABD","subE":"\u2AC5","sube":"\u2286","subedot":"\u2AC3","submult":"\u2AC1","subnE":"\u2ACB","subne":"\u228A","subplus":"\u2ABF","subrarr":"\u2979","subset":"\u2282","Subset":"\u22D0","subseteq":"\u2286","subseteqq":"\u2AC5","SubsetEqual":"\u2286","subsetneq":"\u228A","subsetneqq":"\u2ACB","subsim":"\u2AC7","subsub":"\u2AD5","subsup":"\u2AD3","succapprox":"\u2AB8","succ":"\u227B","succcurlyeq":"\u227D","Succeeds":"\u227B","SucceedsEqual":"\u2AB0","SucceedsSlantEqual":"\u227D","SucceedsTilde":"\u227F","succeq":"\u2AB0","succnapprox":"\u2ABA","succneqq":"\u2AB6","succnsim":"\u22E9","succsim":"\u227F","SuchThat":"\u220B","sum":"\u2211","Sum":"\u2211","sung":"\u266A","sup1":"\u00B9","sup2":"\u00B2","sup3":"\u00B3","sup":"\u2283","Sup":"\u22D1","supdot":"\u2ABE","supdsub":"\u2AD8","supE":"\u2AC6","supe":"\u2287","supedot":"\u2AC4","Superset":"\u2283","SupersetEqual":"\u2287","suphsol":"\u27C9","suphsub":"\u2AD7","suplarr":"\u297B","supmult":"\u2AC2","supnE":"\u2ACC","supne":"\u228B","supplus":"\u2AC0","supset":"\u2283","Supset":"\u22D1","supseteq":"\u2287","supseteqq":"\u2AC6","supsetneq":"\u228B","supsetneqq":"\u2ACC","supsim":"\u2AC8","supsub":"\u2AD4","supsup":"\u2AD6","swarhk":"\u2926","swarr":"\u2199","swArr":"\u21D9","swarrow":"\u2199","swnwar":"\u292A","szlig":"\u00DF","Tab":"\t","target":"\u2316","Tau":"\u03A4","tau":"\u03C4","tbrk":"\u23B4","Tcaron":"\u0164","tcaron":"\u0165","Tcedil":"\u0162","tcedil":"\u0163","Tcy":"\u0422","tcy":"\u0442","tdot":"\u20DB","telrec":"\u2315","Tfr":"\uD835\uDD17","tfr":"\uD835\uDD31","there4":"\u2234","therefore":"\u2234","Therefore":"\u2234","Theta":"\u0398","theta":"\u03B8","thetasym":"\u03D1","thetav":"\u03D1","thickapprox":"\u2248","thicksim":"\u223C","ThickSpace":"\u205F\u200A","ThinSpace":"\u2009","thinsp":"\u2009","thkap":"\u2248","thksim":"\u223C","THORN":"\u00DE","thorn":"\u00FE","tilde":"\u02DC","Tilde":"\u223C","TildeEqual":"\u2243","TildeFullEqual":"\u2245","TildeTilde":"\u2248","timesbar":"\u2A31","timesb":"\u22A0","times":"\u00D7","timesd":"\u2A30","tint":"\u222D","toea":"\u2928","topbot":"\u2336","topcir":"\u2AF1","top":"\u22A4","Topf":"\uD835\uDD4B","topf":"\uD835\uDD65","topfork":"\u2ADA","tosa":"\u2929","tprime":"\u2034","trade":"\u2122","TRADE":"\u2122","triangle":"\u25B5","triangledown":"\u25BF","triangleleft":"\u25C3","trianglelefteq":"\u22B4","triangleq":"\u225C","triangleright":"\u25B9","trianglerighteq":"\u22B5","tridot":"\u25EC","trie":"\u225C","triminus":"\u2A3A","TripleDot":"\u20DB","triplus":"\u2A39","trisb":"\u29CD","tritime":"\u2A3B","trpezium":"\u23E2","Tscr":"\uD835\uDCAF","tscr":"\uD835\uDCC9","TScy":"\u0426","tscy":"\u0446","TSHcy":"\u040B","tshcy":"\u045B","Tstrok":"\u0166","tstrok":"\u0167","twixt":"\u226C","twoheadleftarrow":"\u219E","twoheadrightarrow":"\u21A0","Uacute":"\u00DA","uacute":"\u00FA","uarr":"\u2191","Uarr":"\u219F","uArr":"\u21D1","Uarrocir":"\u2949","Ubrcy":"\u040E","ubrcy":"\u045E","Ubreve":"\u016C","ubreve":"\u016D","Ucirc":"\u00DB","ucirc":"\u00FB","Ucy":"\u0423","ucy":"\u0443","udarr":"\u21C5","Udblac":"\u0170","udblac":"\u0171","udhar":"\u296E","ufisht":"\u297E","Ufr":"\uD835\uDD18","ufr":"\uD835\uDD32","Ugrave":"\u00D9","ugrave":"\u00F9","uHar":"\u2963","uharl":"\u21BF","uharr":"\u21BE","uhblk":"\u2580","ulcorn":"\u231C","ulcorner":"\u231C","ulcrop":"\u230F","ultri":"\u25F8","Umacr":"\u016A","umacr":"\u016B","uml":"\u00A8","UnderBar":"_","UnderBrace":"\u23DF","UnderBracket":"\u23B5","UnderParenthesis":"\u23DD","Union":"\u22C3","UnionPlus":"\u228E","Uogon":"\u0172","uogon":"\u0173","Uopf":"\uD835\uDD4C","uopf":"\uD835\uDD66","UpArrowBar":"\u2912","uparrow":"\u2191","UpArrow":"\u2191","Uparrow":"\u21D1","UpArrowDownArrow":"\u21C5","updownarrow":"\u2195","UpDownArrow":"\u2195","Updownarrow":"\u21D5","UpEquilibrium":"\u296E","upharpoonleft":"\u21BF","upharpoonright":"\u21BE","uplus":"\u228E","UpperLeftArrow":"\u2196","UpperRightArrow":"\u2197","upsi":"\u03C5","Upsi":"\u03D2","upsih":"\u03D2","Upsilon":"\u03A5","upsilon":"\u03C5","UpTeeArrow":"\u21A5","UpTee":"\u22A5","upuparrows":"\u21C8","urcorn":"\u231D","urcorner":"\u231D","urcrop":"\u230E","Uring":"\u016E","uring":"\u016F","urtri":"\u25F9","Uscr":"\uD835\uDCB0","uscr":"\uD835\uDCCA","utdot":"\u22F0","Utilde":"\u0168","utilde":"\u0169","utri":"\u25B5","utrif":"\u25B4","uuarr":"\u21C8","Uuml":"\u00DC","uuml":"\u00FC","uwangle":"\u29A7","vangrt":"\u299C","varepsilon":"\u03F5","varkappa":"\u03F0","varnothing":"\u2205","varphi":"\u03D5","varpi":"\u03D6","varpropto":"\u221D","varr":"\u2195","vArr":"\u21D5","varrho":"\u03F1","varsigma":"\u03C2","varsubsetneq":"\u228A\uFE00","varsubsetneqq":"\u2ACB\uFE00","varsupsetneq":"\u228B\uFE00","varsupsetneqq":"\u2ACC\uFE00","vartheta":"\u03D1","vartriangleleft":"\u22B2","vartriangleright":"\u22B3","vBar":"\u2AE8","Vbar":"\u2AEB","vBarv":"\u2AE9","Vcy":"\u0412","vcy":"\u0432","vdash":"\u22A2","vDash":"\u22A8","Vdash":"\u22A9","VDash":"\u22AB","Vdashl":"\u2AE6","veebar":"\u22BB","vee":"\u2228","Vee":"\u22C1","veeeq":"\u225A","vellip":"\u22EE","verbar":"|","Verbar":"\u2016","vert":"|","Vert":"\u2016","VerticalBar":"\u2223","VerticalLine":"|","VerticalSeparator":"\u2758","VerticalTilde":"\u2240","VeryThinSpace":"\u200A","Vfr":"\uD835\uDD19","vfr":"\uD835\uDD33","vltri":"\u22B2","vnsub":"\u2282\u20D2","vnsup":"\u2283\u20D2","Vopf":"\uD835\uDD4D","vopf":"\uD835\uDD67","vprop":"\u221D","vrtri":"\u22B3","Vscr":"\uD835\uDCB1","vscr":"\uD835\uDCCB","vsubnE":"\u2ACB\uFE00","vsubne":"\u228A\uFE00","vsupnE":"\u2ACC\uFE00","vsupne":"\u228B\uFE00","Vvdash":"\u22AA","vzigzag":"\u299A","Wcirc":"\u0174","wcirc":"\u0175","wedbar":"\u2A5F","wedge":"\u2227","Wedge":"\u22C0","wedgeq":"\u2259","weierp":"\u2118","Wfr":"\uD835\uDD1A","wfr":"\uD835\uDD34","Wopf":"\uD835\uDD4E","wopf":"\uD835\uDD68","wp":"\u2118","wr":"\u2240","wreath":"\u2240","Wscr":"\uD835\uDCB2","wscr":"\uD835\uDCCC","xcap":"\u22C2","xcirc":"\u25EF","xcup":"\u22C3","xdtri":"\u25BD","Xfr":"\uD835\uDD1B","xfr":"\uD835\uDD35","xharr":"\u27F7","xhArr":"\u27FA","Xi":"\u039E","xi":"\u03BE","xlarr":"\u27F5","xlArr":"\u27F8","xmap":"\u27FC","xnis":"\u22FB","xodot":"\u2A00","Xopf":"\uD835\uDD4F","xopf":"\uD835\uDD69","xoplus":"\u2A01","xotime":"\u2A02","xrarr":"\u27F6","xrArr":"\u27F9","Xscr":"\uD835\uDCB3","xscr":"\uD835\uDCCD","xsqcup":"\u2A06","xuplus":"\u2A04","xutri":"\u25B3","xvee":"\u22C1","xwedge":"\u22C0","Yacute":"\u00DD","yacute":"\u00FD","YAcy":"\u042F","yacy":"\u044F","Ycirc":"\u0176","ycirc":"\u0177","Ycy":"\u042B","ycy":"\u044B","yen":"\u00A5","Yfr":"\uD835\uDD1C","yfr":"\uD835\uDD36","YIcy":"\u0407","yicy":"\u0457","Yopf":"\uD835\uDD50","yopf":"\uD835\uDD6A","Yscr":"\uD835\uDCB4","yscr":"\uD835\uDCCE","YUcy":"\u042E","yucy":"\u044E","yuml":"\u00FF","Yuml":"\u0178","Zacute":"\u0179","zacute":"\u017A","Zcaron":"\u017D","zcaron":"\u017E","Zcy":"\u0417","zcy":"\u0437","Zdot":"\u017B","zdot":"\u017C","zeetrf":"\u2128","ZeroWidthSpace":"\u200B","Zeta":"\u0396","zeta":"\u03B6","zfr":"\uD835\uDD37","Zfr":"\u2128","ZHcy":"\u0416","zhcy":"\u0436","zigrarr":"\u21DD","zopf":"\uD835\uDD6B","Zopf":"\u2124","Zscr":"\uD835\uDCB5","zscr":"\uD835\uDCCF","zwj":"\u200D","zwnj":"\u200C"}
},{}],34:[function(require,module,exports){
module.exports={"Aacute":"\u00C1","aacute":"\u00E1","Acirc":"\u00C2","acirc":"\u00E2","acute":"\u00B4","AElig":"\u00C6","aelig":"\u00E6","Agrave":"\u00C0","agrave":"\u00E0","amp":"&","AMP":"&","Aring":"\u00C5","aring":"\u00E5","Atilde":"\u00C3","atilde":"\u00E3","Auml":"\u00C4","auml":"\u00E4","brvbar":"\u00A6","Ccedil":"\u00C7","ccedil":"\u00E7","cedil":"\u00B8","cent":"\u00A2","copy":"\u00A9","COPY":"\u00A9","curren":"\u00A4","deg":"\u00B0","divide":"\u00F7","Eacute":"\u00C9","eacute":"\u00E9","Ecirc":"\u00CA","ecirc":"\u00EA","Egrave":"\u00C8","egrave":"\u00E8","ETH":"\u00D0","eth":"\u00F0","Euml":"\u00CB","euml":"\u00EB","frac12":"\u00BD","frac14":"\u00BC","frac34":"\u00BE","gt":">","GT":">","Iacute":"\u00CD","iacute":"\u00ED","Icirc":"\u00CE","icirc":"\u00EE","iexcl":"\u00A1","Igrave":"\u00CC","igrave":"\u00EC","iquest":"\u00BF","Iuml":"\u00CF","iuml":"\u00EF","laquo":"\u00AB","lt":"<","LT":"<","macr":"\u00AF","micro":"\u00B5","middot":"\u00B7","nbsp":"\u00A0","not":"\u00AC","Ntilde":"\u00D1","ntilde":"\u00F1","Oacute":"\u00D3","oacute":"\u00F3","Ocirc":"\u00D4","ocirc":"\u00F4","Ograve":"\u00D2","ograve":"\u00F2","ordf":"\u00AA","ordm":"\u00BA","Oslash":"\u00D8","oslash":"\u00F8","Otilde":"\u00D5","otilde":"\u00F5","Ouml":"\u00D6","ouml":"\u00F6","para":"\u00B6","plusmn":"\u00B1","pound":"\u00A3","quot":"\"","QUOT":"\"","raquo":"\u00BB","reg":"\u00AE","REG":"\u00AE","sect":"\u00A7","shy":"\u00AD","sup1":"\u00B9","sup2":"\u00B2","sup3":"\u00B3","szlig":"\u00DF","THORN":"\u00DE","thorn":"\u00FE","times":"\u00D7","Uacute":"\u00DA","uacute":"\u00FA","Ucirc":"\u00DB","ucirc":"\u00FB","Ugrave":"\u00D9","ugrave":"\u00F9","uml":"\u00A8","Uuml":"\u00DC","uuml":"\u00FC","Yacute":"\u00DD","yacute":"\u00FD","yen":"\u00A5","yuml":"\u00FF"}
},{}],35:[function(require,module,exports){
module.exports={"amp":"&","apos":"'","gt":">","lt":"<","quot":"\""}

},{}],36:[function(require,module,exports){
(function (global){
/* global Blob File */

/*
 * Module requirements.
 */

var isArray = require('isarray');

var toString = Object.prototype.toString;
var withNativeBlob = typeof global.Blob === 'function' || toString.call(global.Blob) === '[object BlobConstructor]';
var withNativeFile = typeof global.File === 'function' || toString.call(global.File) === '[object FileConstructor]';

/**
 * Module exports.
 */

module.exports = hasBinary;

/**
 * Checks for binary data.
 *
 * Supports Buffer, ArrayBuffer, Blob and File.
 *
 * @param {Object} anything
 * @api public
 */

function hasBinary (obj) {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  if (isArray(obj)) {
    for (var i = 0, l = obj.length; i < l; i++) {
      if (hasBinary(obj[i])) {
        return true;
      }
    }
    return false;
  }

  if ((typeof global.Buffer === 'function' && global.Buffer.isBuffer && global.Buffer.isBuffer(obj)) ||
     (typeof global.ArrayBuffer === 'function' && obj instanceof ArrayBuffer) ||
     (withNativeBlob && obj instanceof Blob) ||
     (withNativeFile && obj instanceof File)
    ) {
    return true;
  }

  // see: https://github.com/Automattic/has-binary/pull/4
  if (obj.toJSON && typeof obj.toJSON === 'function' && arguments.length === 1) {
    return hasBinary(obj.toJSON(), true);
  }

  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && hasBinary(obj[key])) {
      return true;
    }
  }

  return false;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"isarray":37}],37:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],38:[function(require,module,exports){

/**
 * Module exports.
 *
 * Logic borrowed from Modernizr:
 *
 *   - https://github.com/Modernizr/Modernizr/blob/master/feature-detects/cors.js
 */

try {
  module.exports = typeof XMLHttpRequest !== 'undefined' &&
    'withCredentials' in new XMLHttpRequest();
} catch (err) {
  // if XMLHttp support is disabled in IE then it will throw
  // when trying to create
  module.exports = false;
}

},{}],39:[function(require,module,exports){

var indexOf = [].indexOf;

module.exports = function(arr, obj){
  if (indexOf) return arr.indexOf(obj);
  for (var i = 0; i < arr.length; ++i) {
    if (arr[i] === obj) return i;
  }
  return -1;
};
},{}],40:[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} [options]
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options) {
  options = options || {};
  var type = typeof val;
  if (type === 'string' && val.length > 0) {
    return parse(val);
  } else if (type === 'number' && isNaN(val) === false) {
    return options.long ? fmtLong(val) : fmtShort(val);
  }
  throw new Error(
    'val is not a non-empty string or a valid number. val=' +
      JSON.stringify(val)
  );
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = String(str);
  if (str.length > 100) {
    return;
  }
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(
    str
  );
  if (!match) {
    return;
  }
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
    default:
      return undefined;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtShort(ms) {
  if (ms >= d) {
    return Math.round(ms / d) + 'd';
  }
  if (ms >= h) {
    return Math.round(ms / h) + 'h';
  }
  if (ms >= m) {
    return Math.round(ms / m) + 'm';
  }
  if (ms >= s) {
    return Math.round(ms / s) + 's';
  }
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtLong(ms) {
  return plural(ms, d, 'day') ||
    plural(ms, h, 'hour') ||
    plural(ms, m, 'minute') ||
    plural(ms, s, 'second') ||
    ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) {
    return;
  }
  if (ms < n * 1.5) {
    return Math.floor(ms / n) + ' ' + name;
  }
  return Math.ceil(ms / n) + ' ' + name + 's';
}

},{}],41:[function(require,module,exports){
(function (global){
/**
 * JSON parse.
 *
 * @see Based on jQuery#parseJSON (MIT) and JSON2
 * @api private
 */

var rvalidchars = /^[\],:{}\s]*$/;
var rvalidescape = /\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g;
var rvalidtokens = /"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g;
var rvalidbraces = /(?:^|:|,)(?:\s*\[)+/g;
var rtrimLeft = /^\s+/;
var rtrimRight = /\s+$/;

module.exports = function parsejson(data) {
  if ('string' != typeof data || !data) {
    return null;
  }

  data = data.replace(rtrimLeft, '').replace(rtrimRight, '');

  // Attempt to parse using the native JSON parser first
  if (global.JSON && JSON.parse) {
    return JSON.parse(data);
  }

  if (rvalidchars.test(data.replace(rvalidescape, '@')
      .replace(rvalidtokens, ']')
      .replace(rvalidbraces, ''))) {
    return (new Function('return ' + data))();
  }
};
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],42:[function(require,module,exports){
/**
 * Compiles a querystring
 * Returns string representation of the object
 *
 * @param {Object}
 * @api private
 */

exports.encode = function (obj) {
  var str = '';

  for (var i in obj) {
    if (obj.hasOwnProperty(i)) {
      if (str.length) str += '&';
      str += encodeURIComponent(i) + '=' + encodeURIComponent(obj[i]);
    }
  }

  return str;
};

/**
 * Parses a simple querystring into an object
 *
 * @param {String} qs
 * @api private
 */

exports.decode = function(qs){
  var qry = {};
  var pairs = qs.split('&');
  for (var i = 0, l = pairs.length; i < l; i++) {
    var pair = pairs[i].split('=');
    qry[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
  }
  return qry;
};

},{}],43:[function(require,module,exports){
/**
 * Parses an URI
 *
 * @author Steven Levithan <stevenlevithan.com> (MIT license)
 * @api private
 */

var re = /^(?:(?![^:@]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;

var parts = [
    'source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host', 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'
];

module.exports = function parseuri(str) {
    var src = str,
        b = str.indexOf('['),
        e = str.indexOf(']');

    if (b != -1 && e != -1) {
        str = str.substring(0, b) + str.substring(b, e).replace(/:/g, ';') + str.substring(e, str.length);
    }

    var m = re.exec(str || ''),
        uri = {},
        i = 14;

    while (i--) {
        uri[parts[i]] = m[i] || '';
    }

    if (b != -1 && e != -1) {
        uri.source = src;
        uri.host = uri.host.substring(1, uri.host.length - 1).replace(/;/g, ':');
        uri.authority = uri.authority.replace('[', '').replace(']', '').replace(/;/g, ':');
        uri.ipv6uri = true;
    }

    return uri;
};

},{}],44:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],45:[function(require,module,exports){

/**
 * Module dependencies.
 */

var url = require('./url');
var parser = require('socket.io-parser');
var Manager = require('./manager');
var debug = require('debug')('socket.io-client');

/**
 * Module exports.
 */

module.exports = exports = lookup;

/**
 * Managers cache.
 */

var cache = exports.managers = {};

/**
 * Looks up an existing `Manager` for multiplexing.
 * If the user summons:
 *
 *   `io('http://localhost/a');`
 *   `io('http://localhost/b');`
 *
 * We reuse the existing instance based on same scheme/port/host,
 * and we initialize sockets for each namespace.
 *
 * @api public
 */

function lookup (uri, opts) {
  if (typeof uri === 'object') {
    opts = uri;
    uri = undefined;
  }

  opts = opts || {};

  var parsed = url(uri);
  var source = parsed.source;
  var id = parsed.id;
  var path = parsed.path;
  var sameNamespace = cache[id] && path in cache[id].nsps;
  var newConnection = opts.forceNew || opts['force new connection'] ||
                      false === opts.multiplex || sameNamespace;

  var io;

  if (newConnection) {
    debug('ignoring socket cache for %s', source);
    io = Manager(source, opts);
  } else {
    if (!cache[id]) {
      debug('new io instance for %s', source);
      cache[id] = Manager(source, opts);
    }
    io = cache[id];
  }
  if (parsed.query && !opts.query) {
    opts.query = parsed.query;
  }
  return io.socket(parsed.path, opts);
}

/**
 * Protocol version.
 *
 * @api public
 */

exports.protocol = parser.protocol;

/**
 * `connect`.
 *
 * @param {String} uri
 * @api public
 */

exports.connect = lookup;

/**
 * Expose constructors for standalone build.
 *
 * @api public
 */

exports.Manager = require('./manager');
exports.Socket = require('./socket');

},{"./manager":46,"./socket":48,"./url":49,"debug":12,"socket.io-parser":53}],46:[function(require,module,exports){

/**
 * Module dependencies.
 */

var eio = require('engine.io-client');
var Socket = require('./socket');
var Emitter = require('component-emitter');
var parser = require('socket.io-parser');
var on = require('./on');
var bind = require('component-bind');
var debug = require('debug')('socket.io-client:manager');
var indexOf = require('indexof');
var Backoff = require('backo2');

/**
 * IE6+ hasOwnProperty
 */

var has = Object.prototype.hasOwnProperty;

/**
 * Module exports
 */

module.exports = Manager;

/**
 * `Manager` constructor.
 *
 * @param {String} engine instance or engine uri/opts
 * @param {Object} options
 * @api public
 */

function Manager (uri, opts) {
  if (!(this instanceof Manager)) return new Manager(uri, opts);
  if (uri && ('object' === typeof uri)) {
    opts = uri;
    uri = undefined;
  }
  opts = opts || {};

  opts.path = opts.path || '/socket.io';
  this.nsps = {};
  this.subs = [];
  this.opts = opts;
  this.reconnection(opts.reconnection !== false);
  this.reconnectionAttempts(opts.reconnectionAttempts || Infinity);
  this.reconnectionDelay(opts.reconnectionDelay || 1000);
  this.reconnectionDelayMax(opts.reconnectionDelayMax || 5000);
  this.randomizationFactor(opts.randomizationFactor || 0.5);
  this.backoff = new Backoff({
    min: this.reconnectionDelay(),
    max: this.reconnectionDelayMax(),
    jitter: this.randomizationFactor()
  });
  this.timeout(null == opts.timeout ? 20000 : opts.timeout);
  this.readyState = 'closed';
  this.uri = uri;
  this.connecting = [];
  this.lastPing = null;
  this.encoding = false;
  this.packetBuffer = [];
  var _parser = opts.parser || parser;
  this.encoder = new _parser.Encoder();
  this.decoder = new _parser.Decoder();
  this.autoConnect = opts.autoConnect !== false;
  if (this.autoConnect) this.open();
}

/**
 * Propagate given event to sockets and emit on `this`
 *
 * @api private
 */

Manager.prototype.emitAll = function () {
  this.emit.apply(this, arguments);
  for (var nsp in this.nsps) {
    if (has.call(this.nsps, nsp)) {
      this.nsps[nsp].emit.apply(this.nsps[nsp], arguments);
    }
  }
};

/**
 * Update `socket.id` of all sockets
 *
 * @api private
 */

Manager.prototype.updateSocketIds = function () {
  for (var nsp in this.nsps) {
    if (has.call(this.nsps, nsp)) {
      this.nsps[nsp].id = this.generateId(nsp);
    }
  }
};

/**
 * generate `socket.id` for the given `nsp`
 *
 * @param {String} nsp
 * @return {String}
 * @api private
 */

Manager.prototype.generateId = function (nsp) {
  return (nsp === '/' ? '' : (nsp + '#')) + this.engine.id;
};

/**
 * Mix in `Emitter`.
 */

Emitter(Manager.prototype);

/**
 * Sets the `reconnection` config.
 *
 * @param {Boolean} true/false if it should automatically reconnect
 * @return {Manager} self or value
 * @api public
 */

Manager.prototype.reconnection = function (v) {
  if (!arguments.length) return this._reconnection;
  this._reconnection = !!v;
  return this;
};

/**
 * Sets the reconnection attempts config.
 *
 * @param {Number} max reconnection attempts before giving up
 * @return {Manager} self or value
 * @api public
 */

Manager.prototype.reconnectionAttempts = function (v) {
  if (!arguments.length) return this._reconnectionAttempts;
  this._reconnectionAttempts = v;
  return this;
};

/**
 * Sets the delay between reconnections.
 *
 * @param {Number} delay
 * @return {Manager} self or value
 * @api public
 */

Manager.prototype.reconnectionDelay = function (v) {
  if (!arguments.length) return this._reconnectionDelay;
  this._reconnectionDelay = v;
  this.backoff && this.backoff.setMin(v);
  return this;
};

Manager.prototype.randomizationFactor = function (v) {
  if (!arguments.length) return this._randomizationFactor;
  this._randomizationFactor = v;
  this.backoff && this.backoff.setJitter(v);
  return this;
};

/**
 * Sets the maximum delay between reconnections.
 *
 * @param {Number} delay
 * @return {Manager} self or value
 * @api public
 */

Manager.prototype.reconnectionDelayMax = function (v) {
  if (!arguments.length) return this._reconnectionDelayMax;
  this._reconnectionDelayMax = v;
  this.backoff && this.backoff.setMax(v);
  return this;
};

/**
 * Sets the connection timeout. `false` to disable
 *
 * @return {Manager} self or value
 * @api public
 */

Manager.prototype.timeout = function (v) {
  if (!arguments.length) return this._timeout;
  this._timeout = v;
  return this;
};

/**
 * Starts trying to reconnect if reconnection is enabled and we have not
 * started reconnecting yet
 *
 * @api private
 */

Manager.prototype.maybeReconnectOnOpen = function () {
  // Only try to reconnect if it's the first time we're connecting
  if (!this.reconnecting && this._reconnection && this.backoff.attempts === 0) {
    // keeps reconnection from firing twice for the same reconnection loop
    this.reconnect();
  }
};

/**
 * Sets the current transport `socket`.
 *
 * @param {Function} optional, callback
 * @return {Manager} self
 * @api public
 */

Manager.prototype.open =
Manager.prototype.connect = function (fn, opts) {
  debug('readyState %s', this.readyState);
  if (~this.readyState.indexOf('open')) return this;

  debug('opening %s', this.uri);
  this.engine = eio(this.uri, this.opts);
  var socket = this.engine;
  var self = this;
  this.readyState = 'opening';
  this.skipReconnect = false;

  // emit `open`
  var openSub = on(socket, 'open', function () {
    self.onopen();
    fn && fn();
  });

  // emit `connect_error`
  var errorSub = on(socket, 'error', function (data) {
    debug('connect_error');
    self.cleanup();
    self.readyState = 'closed';
    self.emitAll('connect_error', data);
    if (fn) {
      var err = new Error('Connection error');
      err.data = data;
      fn(err);
    } else {
      // Only do this if there is no fn to handle the error
      self.maybeReconnectOnOpen();
    }
  });

  // emit `connect_timeout`
  if (false !== this._timeout) {
    var timeout = this._timeout;
    debug('connect attempt will timeout after %d', timeout);

    // set timer
    var timer = setTimeout(function () {
      debug('connect attempt timed out after %d', timeout);
      openSub.destroy();
      socket.close();
      socket.emit('error', 'timeout');
      self.emitAll('connect_timeout', timeout);
    }, timeout);

    this.subs.push({
      destroy: function () {
        clearTimeout(timer);
      }
    });
  }

  this.subs.push(openSub);
  this.subs.push(errorSub);

  return this;
};

/**
 * Called upon transport open.
 *
 * @api private
 */

Manager.prototype.onopen = function () {
  debug('open');

  // clear old subs
  this.cleanup();

  // mark as open
  this.readyState = 'open';
  this.emit('open');

  // add new subs
  var socket = this.engine;
  this.subs.push(on(socket, 'data', bind(this, 'ondata')));
  this.subs.push(on(socket, 'ping', bind(this, 'onping')));
  this.subs.push(on(socket, 'pong', bind(this, 'onpong')));
  this.subs.push(on(socket, 'error', bind(this, 'onerror')));
  this.subs.push(on(socket, 'close', bind(this, 'onclose')));
  this.subs.push(on(this.decoder, 'decoded', bind(this, 'ondecoded')));
};

/**
 * Called upon a ping.
 *
 * @api private
 */

Manager.prototype.onping = function () {
  this.lastPing = new Date();
  this.emitAll('ping');
};

/**
 * Called upon a packet.
 *
 * @api private
 */

Manager.prototype.onpong = function () {
  this.emitAll('pong', new Date() - this.lastPing);
};

/**
 * Called with data.
 *
 * @api private
 */

Manager.prototype.ondata = function (data) {
  this.decoder.add(data);
};

/**
 * Called when parser fully decodes a packet.
 *
 * @api private
 */

Manager.prototype.ondecoded = function (packet) {
  this.emit('packet', packet);
};

/**
 * Called upon socket error.
 *
 * @api private
 */

Manager.prototype.onerror = function (err) {
  debug('error', err);
  this.emitAll('error', err);
};

/**
 * Creates a new socket for the given `nsp`.
 *
 * @return {Socket}
 * @api public
 */

Manager.prototype.socket = function (nsp, opts) {
  var socket = this.nsps[nsp];
  if (!socket) {
    socket = new Socket(this, nsp, opts);
    this.nsps[nsp] = socket;
    var self = this;
    socket.on('connecting', onConnecting);
    socket.on('connect', function () {
      socket.id = self.generateId(nsp);
    });

    if (this.autoConnect) {
      // manually call here since connecting event is fired before listening
      onConnecting();
    }
  }

  function onConnecting () {
    if (!~indexOf(self.connecting, socket)) {
      self.connecting.push(socket);
    }
  }

  return socket;
};

/**
 * Called upon a socket close.
 *
 * @param {Socket} socket
 */

Manager.prototype.destroy = function (socket) {
  var index = indexOf(this.connecting, socket);
  if (~index) this.connecting.splice(index, 1);
  if (this.connecting.length) return;

  this.close();
};

/**
 * Writes a packet.
 *
 * @param {Object} packet
 * @api private
 */

Manager.prototype.packet = function (packet) {
  debug('writing packet %j', packet);
  var self = this;
  if (packet.query && packet.type === 0) packet.nsp += '?' + packet.query;

  if (!self.encoding) {
    // encode, then write to engine with result
    self.encoding = true;
    this.encoder.encode(packet, function (encodedPackets) {
      for (var i = 0; i < encodedPackets.length; i++) {
        self.engine.write(encodedPackets[i], packet.options);
      }
      self.encoding = false;
      self.processPacketQueue();
    });
  } else { // add packet to the queue
    self.packetBuffer.push(packet);
  }
};

/**
 * If packet buffer is non-empty, begins encoding the
 * next packet in line.
 *
 * @api private
 */

Manager.prototype.processPacketQueue = function () {
  if (this.packetBuffer.length > 0 && !this.encoding) {
    var pack = this.packetBuffer.shift();
    this.packet(pack);
  }
};

/**
 * Clean up transport subscriptions and packet buffer.
 *
 * @api private
 */

Manager.prototype.cleanup = function () {
  debug('cleanup');

  var subsLength = this.subs.length;
  for (var i = 0; i < subsLength; i++) {
    var sub = this.subs.shift();
    sub.destroy();
  }

  this.packetBuffer = [];
  this.encoding = false;
  this.lastPing = null;

  this.decoder.destroy();
};

/**
 * Close the current socket.
 *
 * @api private
 */

Manager.prototype.close =
Manager.prototype.disconnect = function () {
  debug('disconnect');
  this.skipReconnect = true;
  this.reconnecting = false;
  if ('opening' === this.readyState) {
    // `onclose` will not fire because
    // an open event never happened
    this.cleanup();
  }
  this.backoff.reset();
  this.readyState = 'closed';
  if (this.engine) this.engine.close();
};

/**
 * Called upon engine close.
 *
 * @api private
 */

Manager.prototype.onclose = function (reason) {
  debug('onclose');

  this.cleanup();
  this.backoff.reset();
  this.readyState = 'closed';
  this.emit('close', reason);

  if (this._reconnection && !this.skipReconnect) {
    this.reconnect();
  }
};

/**
 * Attempt a reconnection.
 *
 * @api private
 */

Manager.prototype.reconnect = function () {
  if (this.reconnecting || this.skipReconnect) return this;

  var self = this;

  if (this.backoff.attempts >= this._reconnectionAttempts) {
    debug('reconnect failed');
    this.backoff.reset();
    this.emitAll('reconnect_failed');
    this.reconnecting = false;
  } else {
    var delay = this.backoff.duration();
    debug('will wait %dms before reconnect attempt', delay);

    this.reconnecting = true;
    var timer = setTimeout(function () {
      if (self.skipReconnect) return;

      debug('attempting reconnect');
      self.emitAll('reconnect_attempt', self.backoff.attempts);
      self.emitAll('reconnecting', self.backoff.attempts);

      // check again for the case socket closed in above events
      if (self.skipReconnect) return;

      self.open(function (err) {
        if (err) {
          debug('reconnect attempt error');
          self.reconnecting = false;
          self.reconnect();
          self.emitAll('reconnect_error', err.data);
        } else {
          debug('reconnect success');
          self.onreconnect();
        }
      });
    }, delay);

    this.subs.push({
      destroy: function () {
        clearTimeout(timer);
      }
    });
  }
};

/**
 * Called upon successful reconnect.
 *
 * @api private
 */

Manager.prototype.onreconnect = function () {
  var attempt = this.backoff.attempts;
  this.reconnecting = false;
  this.backoff.reset();
  this.updateSocketIds();
  this.emitAll('reconnect', attempt);
};

},{"./on":47,"./socket":48,"backo2":6,"component-bind":10,"component-emitter":50,"debug":12,"engine.io-client":14,"indexof":39,"socket.io-parser":53}],47:[function(require,module,exports){

/**
 * Module exports.
 */

module.exports = on;

/**
 * Helper for subscriptions.
 *
 * @param {Object|EventEmitter} obj with `Emitter` mixin or `EventEmitter`
 * @param {String} event name
 * @param {Function} callback
 * @api public
 */

function on (obj, ev, fn) {
  obj.on(ev, fn);
  return {
    destroy: function () {
      obj.removeListener(ev, fn);
    }
  };
}

},{}],48:[function(require,module,exports){

/**
 * Module dependencies.
 */

var parser = require('socket.io-parser');
var Emitter = require('component-emitter');
var toArray = require('to-array');
var on = require('./on');
var bind = require('component-bind');
var debug = require('debug')('socket.io-client:socket');
var parseqs = require('parseqs');

/**
 * Module exports.
 */

module.exports = exports = Socket;

/**
 * Internal events (blacklisted).
 * These events can't be emitted by the user.
 *
 * @api private
 */

var events = {
  connect: 1,
  connect_error: 1,
  connect_timeout: 1,
  connecting: 1,
  disconnect: 1,
  error: 1,
  reconnect: 1,
  reconnect_attempt: 1,
  reconnect_failed: 1,
  reconnect_error: 1,
  reconnecting: 1,
  ping: 1,
  pong: 1
};

/**
 * Shortcut to `Emitter#emit`.
 */

var emit = Emitter.prototype.emit;

/**
 * `Socket` constructor.
 *
 * @api public
 */

function Socket (io, nsp, opts) {
  this.io = io;
  this.nsp = nsp;
  this.json = this; // compat
  this.ids = 0;
  this.acks = {};
  this.receiveBuffer = [];
  this.sendBuffer = [];
  this.connected = false;
  this.disconnected = true;
  if (opts && opts.query) {
    this.query = opts.query;
  }
  if (this.io.autoConnect) this.open();
}

/**
 * Mix in `Emitter`.
 */

Emitter(Socket.prototype);

/**
 * Subscribe to open, close and packet events
 *
 * @api private
 */

Socket.prototype.subEvents = function () {
  if (this.subs) return;

  var io = this.io;
  this.subs = [
    on(io, 'open', bind(this, 'onopen')),
    on(io, 'packet', bind(this, 'onpacket')),
    on(io, 'close', bind(this, 'onclose'))
  ];
};

/**
 * "Opens" the socket.
 *
 * @api public
 */

Socket.prototype.open =
Socket.prototype.connect = function () {
  if (this.connected) return this;

  this.subEvents();
  this.io.open(); // ensure open
  if ('open' === this.io.readyState) this.onopen();
  this.emit('connecting');
  return this;
};

/**
 * Sends a `message` event.
 *
 * @return {Socket} self
 * @api public
 */

Socket.prototype.send = function () {
  var args = toArray(arguments);
  args.unshift('message');
  this.emit.apply(this, args);
  return this;
};

/**
 * Override `emit`.
 * If the event is in `events`, it's emitted normally.
 *
 * @param {String} event name
 * @return {Socket} self
 * @api public
 */

Socket.prototype.emit = function (ev) {
  if (events.hasOwnProperty(ev)) {
    emit.apply(this, arguments);
    return this;
  }

  var args = toArray(arguments);
  var packet = { type: parser.EVENT, data: args };

  packet.options = {};
  packet.options.compress = !this.flags || false !== this.flags.compress;

  // event ack callback
  if ('function' === typeof args[args.length - 1]) {
    debug('emitting packet with ack id %d', this.ids);
    this.acks[this.ids] = args.pop();
    packet.id = this.ids++;
  }

  if (this.connected) {
    this.packet(packet);
  } else {
    this.sendBuffer.push(packet);
  }

  delete this.flags;

  return this;
};

/**
 * Sends a packet.
 *
 * @param {Object} packet
 * @api private
 */

Socket.prototype.packet = function (packet) {
  packet.nsp = this.nsp;
  this.io.packet(packet);
};

/**
 * Called upon engine `open`.
 *
 * @api private
 */

Socket.prototype.onopen = function () {
  debug('transport is open - connecting');

  // write connect packet if necessary
  if ('/' !== this.nsp) {
    if (this.query) {
      var query = typeof this.query === 'object' ? parseqs.encode(this.query) : this.query;
      debug('sending connect packet with query %s', query);
      this.packet({type: parser.CONNECT, query: query});
    } else {
      this.packet({type: parser.CONNECT});
    }
  }
};

/**
 * Called upon engine `close`.
 *
 * @param {String} reason
 * @api private
 */

Socket.prototype.onclose = function (reason) {
  debug('close (%s)', reason);
  this.connected = false;
  this.disconnected = true;
  delete this.id;
  this.emit('disconnect', reason);
};

/**
 * Called with socket packet.
 *
 * @param {Object} packet
 * @api private
 */

Socket.prototype.onpacket = function (packet) {
  if (packet.nsp !== this.nsp) return;

  switch (packet.type) {
    case parser.CONNECT:
      this.onconnect();
      break;

    case parser.EVENT:
      this.onevent(packet);
      break;

    case parser.BINARY_EVENT:
      this.onevent(packet);
      break;

    case parser.ACK:
      this.onack(packet);
      break;

    case parser.BINARY_ACK:
      this.onack(packet);
      break;

    case parser.DISCONNECT:
      this.ondisconnect();
      break;

    case parser.ERROR:
      this.emit('error', packet.data);
      break;
  }
};

/**
 * Called upon a server event.
 *
 * @param {Object} packet
 * @api private
 */

Socket.prototype.onevent = function (packet) {
  var args = packet.data || [];
  debug('emitting event %j', args);

  if (null != packet.id) {
    debug('attaching ack callback to event');
    args.push(this.ack(packet.id));
  }

  if (this.connected) {
    emit.apply(this, args);
  } else {
    this.receiveBuffer.push(args);
  }
};

/**
 * Produces an ack callback to emit with an event.
 *
 * @api private
 */

Socket.prototype.ack = function (id) {
  var self = this;
  var sent = false;
  return function () {
    // prevent double callbacks
    if (sent) return;
    sent = true;
    var args = toArray(arguments);
    debug('sending ack %j', args);

    self.packet({
      type: parser.ACK,
      id: id,
      data: args
    });
  };
};

/**
 * Called upon a server acknowlegement.
 *
 * @param {Object} packet
 * @api private
 */

Socket.prototype.onack = function (packet) {
  var ack = this.acks[packet.id];
  if ('function' === typeof ack) {
    debug('calling ack %s with %j', packet.id, packet.data);
    ack.apply(this, packet.data);
    delete this.acks[packet.id];
  } else {
    debug('bad ack %s', packet.id);
  }
};

/**
 * Called upon server connect.
 *
 * @api private
 */

Socket.prototype.onconnect = function () {
  this.connected = true;
  this.disconnected = false;
  this.emit('connect');
  this.emitBuffered();
};

/**
 * Emit buffered events (received and emitted).
 *
 * @api private
 */

Socket.prototype.emitBuffered = function () {
  var i;
  for (i = 0; i < this.receiveBuffer.length; i++) {
    emit.apply(this, this.receiveBuffer[i]);
  }
  this.receiveBuffer = [];

  for (i = 0; i < this.sendBuffer.length; i++) {
    this.packet(this.sendBuffer[i]);
  }
  this.sendBuffer = [];
};

/**
 * Called upon server disconnect.
 *
 * @api private
 */

Socket.prototype.ondisconnect = function () {
  debug('server disconnect (%s)', this.nsp);
  this.destroy();
  this.onclose('io server disconnect');
};

/**
 * Called upon forced client/server side disconnections,
 * this method ensures the manager stops tracking us and
 * that reconnections don't get triggered for this.
 *
 * @api private.
 */

Socket.prototype.destroy = function () {
  if (this.subs) {
    // clean subscriptions to avoid reconnections
    for (var i = 0; i < this.subs.length; i++) {
      this.subs[i].destroy();
    }
    this.subs = null;
  }

  this.io.destroy(this);
};

/**
 * Disconnects the socket manually.
 *
 * @return {Socket} self
 * @api public
 */

Socket.prototype.close =
Socket.prototype.disconnect = function () {
  if (this.connected) {
    debug('performing disconnect (%s)', this.nsp);
    this.packet({ type: parser.DISCONNECT });
  }

  // remove socket from pool
  this.destroy();

  if (this.connected) {
    // fire events
    this.onclose('io client disconnect');
  }
  return this;
};

/**
 * Sets the compress flag.
 *
 * @param {Boolean} if `true`, compresses the sending data
 * @return {Socket} self
 * @api public
 */

Socket.prototype.compress = function (compress) {
  this.flags = this.flags || {};
  this.flags.compress = compress;
  return this;
};

},{"./on":47,"component-bind":10,"component-emitter":50,"debug":12,"parseqs":42,"socket.io-parser":53,"to-array":55}],49:[function(require,module,exports){
(function (global){

/**
 * Module dependencies.
 */

var parseuri = require('parseuri');
var debug = require('debug')('socket.io-client:url');

/**
 * Module exports.
 */

module.exports = url;

/**
 * URL parser.
 *
 * @param {String} url
 * @param {Object} An object meant to mimic window.location.
 *                 Defaults to window.location.
 * @api public
 */

function url (uri, loc) {
  var obj = uri;

  // default to window.location
  loc = loc || global.location;
  if (null == uri) uri = loc.protocol + '//' + loc.host;

  // relative path support
  if ('string' === typeof uri) {
    if ('/' === uri.charAt(0)) {
      if ('/' === uri.charAt(1)) {
        uri = loc.protocol + uri;
      } else {
        uri = loc.host + uri;
      }
    }

    if (!/^(https?|wss?):\/\//.test(uri)) {
      debug('protocol-less url %s', uri);
      if ('undefined' !== typeof loc) {
        uri = loc.protocol + '//' + uri;
      } else {
        uri = 'https://' + uri;
      }
    }

    // parse
    debug('parse %s', uri);
    obj = parseuri(uri);
  }

  // make sure we treat `localhost:80` and `localhost` equally
  if (!obj.port) {
    if (/^(http|ws)$/.test(obj.protocol)) {
      obj.port = '80';
    } else if (/^(http|ws)s$/.test(obj.protocol)) {
      obj.port = '443';
    }
  }

  obj.path = obj.path || '/';

  var ipv6 = obj.host.indexOf(':') !== -1;
  var host = ipv6 ? '[' + obj.host + ']' : obj.host;

  // define unique id
  obj.id = obj.protocol + '://' + host + ':' + obj.port;
  // define href
  obj.href = obj.protocol + '://' + host + (loc && loc.port === obj.port ? '' : (':' + obj.port));

  return obj;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"debug":12,"parseuri":43}],50:[function(require,module,exports){
arguments[4][24][0].apply(exports,arguments)
},{"dup":24}],51:[function(require,module,exports){
arguments[4][37][0].apply(exports,arguments)
},{"dup":37}],52:[function(require,module,exports){
(function (global){
/*global Blob,File*/

/**
 * Module requirements
 */

var isArray = require('isarray');
var isBuf = require('./is-buffer');
var toString = Object.prototype.toString;
var withNativeBlob = typeof global.Blob === 'function' || toString.call(global.Blob) === '[object BlobConstructor]';
var withNativeFile = typeof global.File === 'function' || toString.call(global.File) === '[object FileConstructor]';

/**
 * Replaces every Buffer | ArrayBuffer in packet with a numbered placeholder.
 * Anything with blobs or files should be fed through removeBlobs before coming
 * here.
 *
 * @param {Object} packet - socket.io event packet
 * @return {Object} with deconstructed packet and list of buffers
 * @api public
 */

exports.deconstructPacket = function(packet) {
  var buffers = [];
  var packetData = packet.data;
  var pack = packet;
  pack.data = _deconstructPacket(packetData, buffers);
  pack.attachments = buffers.length; // number of binary 'attachments'
  return {packet: pack, buffers: buffers};
};

function _deconstructPacket(data, buffers) {
  if (!data) return data;

  if (isBuf(data)) {
    var placeholder = { _placeholder: true, num: buffers.length };
    buffers.push(data);
    return placeholder;
  } else if (isArray(data)) {
    var newData = new Array(data.length);
    for (var i = 0; i < data.length; i++) {
      newData[i] = _deconstructPacket(data[i], buffers);
    }
    return newData;
  } else if (typeof data === 'object' && !(data instanceof Date)) {
    var newData = {};
    for (var key in data) {
      newData[key] = _deconstructPacket(data[key], buffers);
    }
    return newData;
  }
  return data;
}

/**
 * Reconstructs a binary packet from its placeholder packet and buffers
 *
 * @param {Object} packet - event packet with placeholders
 * @param {Array} buffers - binary buffers to put in placeholder positions
 * @return {Object} reconstructed packet
 * @api public
 */

exports.reconstructPacket = function(packet, buffers) {
  packet.data = _reconstructPacket(packet.data, buffers);
  packet.attachments = undefined; // no longer useful
  return packet;
};

function _reconstructPacket(data, buffers) {
  if (!data) return data;

  if (data && data._placeholder) {
    return buffers[data.num]; // appropriate buffer (should be natural order anyway)
  } else if (isArray(data)) {
    for (var i = 0; i < data.length; i++) {
      data[i] = _reconstructPacket(data[i], buffers);
    }
  } else if (typeof data === 'object') {
    for (var key in data) {
      data[key] = _reconstructPacket(data[key], buffers);
    }
  }

  return data;
}

/**
 * Asynchronously removes Blobs or Files from data via
 * FileReader's readAsArrayBuffer method. Used before encoding
 * data as msgpack. Calls callback with the blobless data.
 *
 * @param {Object} data
 * @param {Function} callback
 * @api private
 */

exports.removeBlobs = function(data, callback) {
  function _removeBlobs(obj, curKey, containingObject) {
    if (!obj) return obj;

    // convert any blob
    if ((withNativeBlob && obj instanceof Blob) ||
        (withNativeFile && obj instanceof File)) {
      pendingBlobs++;

      // async filereader
      var fileReader = new FileReader();
      fileReader.onload = function() { // this.result == arraybuffer
        if (containingObject) {
          containingObject[curKey] = this.result;
        }
        else {
          bloblessData = this.result;
        }

        // if nothing pending its callback time
        if(! --pendingBlobs) {
          callback(bloblessData);
        }
      };

      fileReader.readAsArrayBuffer(obj); // blob -> arraybuffer
    } else if (isArray(obj)) { // handle array
      for (var i = 0; i < obj.length; i++) {
        _removeBlobs(obj[i], i, obj);
      }
    } else if (typeof obj === 'object' && !isBuf(obj)) { // and object
      for (var key in obj) {
        _removeBlobs(obj[key], key, obj);
      }
    }
  }

  var pendingBlobs = 0;
  var bloblessData = data;
  _removeBlobs(bloblessData);
  if (!pendingBlobs) {
    callback(bloblessData);
  }
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./is-buffer":54,"isarray":51}],53:[function(require,module,exports){

/**
 * Module dependencies.
 */

var debug = require('debug')('socket.io-parser');
var Emitter = require('component-emitter');
var hasBin = require('has-binary2');
var binary = require('./binary');
var isBuf = require('./is-buffer');

/**
 * Protocol version.
 *
 * @api public
 */

exports.protocol = 4;

/**
 * Packet types.
 *
 * @api public
 */

exports.types = [
  'CONNECT',
  'DISCONNECT',
  'EVENT',
  'ACK',
  'ERROR',
  'BINARY_EVENT',
  'BINARY_ACK'
];

/**
 * Packet type `connect`.
 *
 * @api public
 */

exports.CONNECT = 0;

/**
 * Packet type `disconnect`.
 *
 * @api public
 */

exports.DISCONNECT = 1;

/**
 * Packet type `event`.
 *
 * @api public
 */

exports.EVENT = 2;

/**
 * Packet type `ack`.
 *
 * @api public
 */

exports.ACK = 3;

/**
 * Packet type `error`.
 *
 * @api public
 */

exports.ERROR = 4;

/**
 * Packet type 'binary event'
 *
 * @api public
 */

exports.BINARY_EVENT = 5;

/**
 * Packet type `binary ack`. For acks with binary arguments.
 *
 * @api public
 */

exports.BINARY_ACK = 6;

/**
 * Encoder constructor.
 *
 * @api public
 */

exports.Encoder = Encoder;

/**
 * Decoder constructor.
 *
 * @api public
 */

exports.Decoder = Decoder;

/**
 * A socket.io Encoder instance
 *
 * @api public
 */

function Encoder() {}

/**
 * Encode a packet as a single string if non-binary, or as a
 * buffer sequence, depending on packet type.
 *
 * @param {Object} obj - packet object
 * @param {Function} callback - function to handle encodings (likely engine.write)
 * @return Calls callback with Array of encodings
 * @api public
 */

Encoder.prototype.encode = function(obj, callback){
  if ((obj.type === exports.EVENT || obj.type === exports.ACK) && hasBin(obj.data)) {
    obj.type = obj.type === exports.EVENT ? exports.BINARY_EVENT : exports.BINARY_ACK;
  }

  debug('encoding packet %j', obj);

  if (exports.BINARY_EVENT === obj.type || exports.BINARY_ACK === obj.type) {
    encodeAsBinary(obj, callback);
  }
  else {
    var encoding = encodeAsString(obj);
    callback([encoding]);
  }
};

/**
 * Encode packet as string.
 *
 * @param {Object} packet
 * @return {String} encoded
 * @api private
 */

function encodeAsString(obj) {

  // first is type
  var str = '' + obj.type;

  // attachments if we have them
  if (exports.BINARY_EVENT === obj.type || exports.BINARY_ACK === obj.type) {
    str += obj.attachments + '-';
  }

  // if we have a namespace other than `/`
  // we append it followed by a comma `,`
  if (obj.nsp && '/' !== obj.nsp) {
    str += obj.nsp + ',';
  }

  // immediately followed by the id
  if (null != obj.id) {
    str += obj.id;
  }

  // json data
  if (null != obj.data) {
    str += JSON.stringify(obj.data);
  }

  debug('encoded %j as %s', obj, str);
  return str;
}

/**
 * Encode packet as 'buffer sequence' by removing blobs, and
 * deconstructing packet into object with placeholders and
 * a list of buffers.
 *
 * @param {Object} packet
 * @return {Buffer} encoded
 * @api private
 */

function encodeAsBinary(obj, callback) {

  function writeEncoding(bloblessData) {
    var deconstruction = binary.deconstructPacket(bloblessData);
    var pack = encodeAsString(deconstruction.packet);
    var buffers = deconstruction.buffers;

    buffers.unshift(pack); // add packet info to beginning of data list
    callback(buffers); // write all the buffers
  }

  binary.removeBlobs(obj, writeEncoding);
}

/**
 * A socket.io Decoder instance
 *
 * @return {Object} decoder
 * @api public
 */

function Decoder() {
  this.reconstructor = null;
}

/**
 * Mix in `Emitter` with Decoder.
 */

Emitter(Decoder.prototype);

/**
 * Decodes an ecoded packet string into packet JSON.
 *
 * @param {String} obj - encoded packet
 * @return {Object} packet
 * @api public
 */

Decoder.prototype.add = function(obj) {
  var packet;
  if (typeof obj === 'string') {
    packet = decodeString(obj);
    if (exports.BINARY_EVENT === packet.type || exports.BINARY_ACK === packet.type) { // binary packet's json
      this.reconstructor = new BinaryReconstructor(packet);

      // no attachments, labeled binary but no binary data to follow
      if (this.reconstructor.reconPack.attachments === 0) {
        this.emit('decoded', packet);
      }
    } else { // non-binary full packet
      this.emit('decoded', packet);
    }
  }
  else if (isBuf(obj) || obj.base64) { // raw binary data
    if (!this.reconstructor) {
      throw new Error('got binary data when not reconstructing a packet');
    } else {
      packet = this.reconstructor.takeBinaryData(obj);
      if (packet) { // received final buffer
        this.reconstructor = null;
        this.emit('decoded', packet);
      }
    }
  }
  else {
    throw new Error('Unknown type: ' + obj);
  }
};

/**
 * Decode a packet String (JSON data)
 *
 * @param {String} str
 * @return {Object} packet
 * @api private
 */

function decodeString(str) {
  var i = 0;
  // look up type
  var p = {
    type: Number(str.charAt(0))
  };

  if (null == exports.types[p.type]) return error();

  // look up attachments if type binary
  if (exports.BINARY_EVENT === p.type || exports.BINARY_ACK === p.type) {
    var buf = '';
    while (str.charAt(++i) !== '-') {
      buf += str.charAt(i);
      if (i == str.length) break;
    }
    if (buf != Number(buf) || str.charAt(i) !== '-') {
      throw new Error('Illegal attachments');
    }
    p.attachments = Number(buf);
  }

  // look up namespace (if any)
  if ('/' === str.charAt(i + 1)) {
    p.nsp = '';
    while (++i) {
      var c = str.charAt(i);
      if (',' === c) break;
      p.nsp += c;
      if (i === str.length) break;
    }
  } else {
    p.nsp = '/';
  }

  // look up id
  var next = str.charAt(i + 1);
  if ('' !== next && Number(next) == next) {
    p.id = '';
    while (++i) {
      var c = str.charAt(i);
      if (null == c || Number(c) != c) {
        --i;
        break;
      }
      p.id += str.charAt(i);
      if (i === str.length) break;
    }
    p.id = Number(p.id);
  }

  // look up json data
  if (str.charAt(++i)) {
    p = tryParse(p, str.substr(i));
  }

  debug('decoded %s as %j', str, p);
  return p;
}

function tryParse(p, str) {
  try {
    p.data = JSON.parse(str);
  } catch(e){
    return error();
  }
  return p; 
}

/**
 * Deallocates a parser's resources
 *
 * @api public
 */

Decoder.prototype.destroy = function() {
  if (this.reconstructor) {
    this.reconstructor.finishedReconstruction();
  }
};

/**
 * A manager of a binary event's 'buffer sequence'. Should
 * be constructed whenever a packet of type BINARY_EVENT is
 * decoded.
 *
 * @param {Object} packet
 * @return {BinaryReconstructor} initialized reconstructor
 * @api private
 */

function BinaryReconstructor(packet) {
  this.reconPack = packet;
  this.buffers = [];
}

/**
 * Method to be called when binary data received from connection
 * after a BINARY_EVENT packet.
 *
 * @param {Buffer | ArrayBuffer} binData - the raw binary data received
 * @return {null | Object} returns null if more binary data is expected or
 *   a reconstructed packet object if all buffers have been received.
 * @api private
 */

BinaryReconstructor.prototype.takeBinaryData = function(binData) {
  this.buffers.push(binData);
  if (this.buffers.length === this.reconPack.attachments) { // done with buffer list
    var packet = binary.reconstructPacket(this.reconPack, this.buffers);
    this.finishedReconstruction();
    return packet;
  }
  return null;
};

/**
 * Cleans up binary packet reconstruction variables.
 *
 * @api private
 */

BinaryReconstructor.prototype.finishedReconstruction = function() {
  this.reconPack = null;
  this.buffers = [];
};

function error() {
  return {
    type: exports.ERROR,
    data: 'parser error'
  };
}

},{"./binary":52,"./is-buffer":54,"component-emitter":50,"debug":12,"has-binary2":36}],54:[function(require,module,exports){
(function (global){

module.exports = isBuf;

/**
 * Returns true if obj is a buffer or an arraybuffer.
 *
 * @api private
 */

function isBuf(obj) {
  return (global.Buffer && global.Buffer.isBuffer(obj)) ||
         (global.ArrayBuffer && obj instanceof ArrayBuffer);
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],55:[function(require,module,exports){
module.exports = toArray

function toArray(list, index) {
    var array = []

    index = index || 0

    for (var i = index || 0; i < list.length; i++) {
        array[i - index] = list[i]
    }

    return array
}

},{}],56:[function(require,module,exports){
'use strict';

var alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'.split('')
  , length = 64
  , map = {}
  , seed = 0
  , i = 0
  , prev;

/**
 * Return a string representing the specified number.
 *
 * @param {Number} num The number to convert.
 * @returns {String} The string representation of the number.
 * @api public
 */
function encode(num) {
  var encoded = '';

  do {
    encoded = alphabet[num % length] + encoded;
    num = Math.floor(num / length);
  } while (num > 0);

  return encoded;
}

/**
 * Return the integer value specified by the given string.
 *
 * @param {String} str The string to convert.
 * @returns {Number} The integer value represented by the string.
 * @api public
 */
function decode(str) {
  var decoded = 0;

  for (i = 0; i < str.length; i++) {
    decoded = decoded * length + map[str.charAt(i)];
  }

  return decoded;
}

/**
 * Yeast: A tiny growing id generator.
 *
 * @returns {String} A unique id.
 * @api public
 */
function yeast() {
  var now = encode(+new Date());

  if (now !== prev) return seed = 0, prev = now;
  return now +'.'+ encode(seed++);
}

//
// Map each character to its index.
//
for (; i < length; i++) map[alphabet[i]] = i;

//
// Expose the `yeast`, `encode` and `decode` functions.
//
yeast.encode = encode;
yeast.decode = decode;
module.exports = yeast;

},{}],57:[function(require,module,exports){
(function (process,global){
"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

!function (e) {
  if ("object" == (typeof exports === "undefined" ? "undefined" : _typeof(exports)) && "undefined" != typeof module) module.exports = e();else if ("function" == typeof define && define.amd) define([], e);else {
    var t;t = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : this, t.wooster = e();
  }
}(function () {
  return function e(t, r, n) {
    function i(a, s) {
      if (!r[a]) {
        if (!t[a]) {
          var c = "function" == typeof require && require;if (!s && c) return c(a, !0);if (o) return o(a, !0);var l = new Error("Cannot find module '" + a + "'");throw l.code = "MODULE_NOT_FOUND", l;
        }var f = r[a] = { exports: {} };t[a][0].call(f.exports, function (e) {
          var r = t[a][1][e];return i(r || e);
        }, f, f.exports, e, t, r, n);
      }return r[a].exports;
    }for (var o = "function" == typeof require && require, a = 0; a < n.length; a++) {
      i(n[a]);
    }return i;
  }({ 1: [function (e, t, r) {
      "use strict";
      t.exports = function () {
        return (/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-PRZcf-nqry=><]/g
        );
      };
    }, {}], 2: [function (e, t, r) {
      "use strict";
      var n = e("es5-ext/object/valid-object"),
          i = e("es5-ext/object/validate-stringifiable-value"),
          o = e("es6-iterator/for-of");t.exports = function (e, t) {
        var r = "";return e = i(e), n(t), o(e, function (e) {
          r += t[e] || e;
        }), r;
      };
    }, { "es5-ext/object/valid-object": 67, "es5-ext/object/validate-stringifiable-value": 69, "es6-iterator/for-of": 79 }], 3: [function (e, t, r) {
      "use strict";
      var n,
          i,
          o = e("d"),
          a = e("es5-ext/object/assign"),
          s = e("es5-ext/object/for-each"),
          c = e("es5-ext/object/map"),
          l = e("es5-ext/object/primitive-set"),
          f = e("es5-ext/object/set-prototype-of"),
          u = e("memoizee"),
          p = e("memoizee/methods"),
          d = e("./lib/sgr"),
          h = d.mods,
          b = Array.prototype.join,
          m = Object.defineProperty,
          v = Math.max,
          g = Math.min,
          x = l("_fg", "_bg"),
          y = u(function (e, t) {
        return m(i(), "_cliColorData", o(a({}, e._cliColorData, t)));
      }),
          _ = Object.create(Function.prototype, a(c(h, function (e) {
        return o.gs(function () {
          return y(this, e);
        });
      }), p({ xterm: o(function (e) {
          return e = isNaN(e) ? 255 : g(v(e, 0), 255), m(i(), "_cliColorData", o(a({}, this._cliColorData, { _fg: [n ? n[e] : "38;5;" + e, 39] })));
        }), bgXterm: o(function (e) {
          return e = isNaN(e) ? 255 : g(v(e, 0), 255), m(i(), "_cliColorData", o(a({}, this._cliColorData, { _bg: [n ? n[e] + 10 : "48;5;" + e, 49] })));
        }) }))),
          j = u(function (e) {
        return new RegExp("\\[" + e + "m", "g");
      }, { primitive: !0 });"win32" === process.platform && (n = e("./lib/xterm-match")), i = function i() {
        return f(function e() {
          var t = "",
              r = "",
              n = b.call(arguments, " "),
              i = e._cliColorData,
              o = d.hasCSI(n);return s(i, function (e, i) {
            r = d(e[1]) + r, t += d(e[0]), o && (n = n.replace(j(e[1]), x[i] ? d(e[0]) : ""));
          }, null, !0), t + n + r;
        }, _);
      }, t.exports = Object.defineProperties(i(), { xtermSupported: o(!n), _cliColorData: o("", {}) });
    }, { "./lib/sgr": 9, "./lib/xterm-match": 11, d: 19, "es5-ext/object/assign": 46, "es5-ext/object/for-each": 52, "es5-ext/object/map": 59, "es5-ext/object/primitive-set": 62, "es5-ext/object/set-prototype-of": 63, memoizee: 99, "memoizee/methods": 106 }], 4: [function (e, t, r) {
      "use strict";
      t.exports = "";
    }, {}], 5: [function (e, t, r) {
      "use strict";
      var n = e("es5-ext/array/from"),
          i = e("es5-ext/iterable/validate-object"),
          o = e("es5-ext/object/validate-stringifiable"),
          a = e("es5-ext/string/#/repeat"),
          s = e("./get-stripped-length");t.exports = function (e) {
        var t = Object(arguments[1]),
            r = [],
            c = t.columns || [];return n(i(e), function (e, t) {
          return n(i(e), function (e, t) {
            var n,
                i = r[t];return i || (i = r[t] = { width: 0 }), e = o(e), n = s(e), n > i.width && (i.width = n), { str: e, length: n };
          });
        }).map(function (e) {
          return e.map(function (e, t) {
            var n,
                i = "left",
                o = c && c[t];return i = o && "right" === o.align ? "right" : "left", n = a.call(" ", r[t].width - e.length), "left" === i ? e.str + n : n + e.str;
          }).join(null == t.sep ? " | " : t.sep);
        }).join("\n") + "\n";
      };
    }, { "./get-stripped-length": 7, "es5-ext/array/from": 25, "es5-ext/iterable/validate-object": 36, "es5-ext/object/validate-stringifiable": 70, "es5-ext/string/#/repeat": 74 }], 6: [function (e, t, r) {
      "use strict";
      t.exports = { screen: "[2J", screenLeft: "[1J", screenRight: "[J", line: "[2K", lineLeft: "[1K", lineRight: "[K" };
    }, {}], 7: [function (e, t, r) {
      "use strict";
      var n = e("./strip");t.exports = function (e) {
        return n(e).length;
      };
    }, { "./strip": 15 }], 8: [function (e, t, r) {
      "use strict";
      var n = e("d");t.exports = Object.defineProperties(e("./bare"), { windowSize: n(e("./window-size")), erase: n(e("./erase")), move: n(e("./move")), beep: n(e("./beep")), columns: n(e("./columns")), strip: n(e("./strip")), getStrippedLength: n(e("./get-stripped-length")), slice: n(e("./slice")), throbber: n(e("./throbber")), reset: n(e("./reset")), art: n(e("./art")) });
    }, { "./art": 2, "./bare": 3, "./beep": 4, "./columns": 5, "./erase": 6, "./get-stripped-length": 7, "./move": 12, "./reset": 13, "./slice": 14, "./strip": 15, "./throbber": 16, "./window-size": 17, d: 19 }], 9: [function (e, t, r) {
      "use strict";
      var n = e("es5-ext/object/assign"),
          i = e("es5-ext/string/#/contains"),
          o = e("es5-ext/object/for-each"),
          a = e("es5-ext/object/first-key"),
          s = e("es5-ext/array/#/for-each-right"),
          c = e("es5-ext/array/#/uniq.js"),
          l = function l(e) {
        return "[" + e + "m";
      };l.CSI = "[";var f = n({ bold: { _bold: [1, 22] }, italic: { _italic: [3, 23] }, underline: { _underline: [4, 24] }, blink: { _blink: [5, 25] }, inverse: { _inverse: [7, 27] }, strike: { _strike: [9, 29] } }, ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"].reduce(function (e, t, r) {
        return e[t] = { _fg: [30 + r, 39] }, e[t + "Bright"] = { _fg: [90 + r, 39] }, e["bg" + t[0].toUpperCase() + t.slice(1)] = { _bg: [40 + r, 49] }, e["bg" + t[0].toUpperCase() + t.slice(1) + "Bright"] = { _bg: [100 + r, 49] }, e;
      }, {}));l.mods = f, l.openers = {}, l.closers = {}, o(f, function (e) {
        var t = e[a(e)];l.openers[t[0]] = t, l.closers[t[1]] = t;
      }), l.openStyle = function (e, t) {
        e.push(l.openers[t]);
      }, l.closeStyle = function (e, t) {
        s.call(e, function (r, n) {
          r[1] === t && e.splice(n, 1);
        });
      }, l.prepend = function (e) {
        return e.map(function (e, t) {
          return l(e[0]);
        });
      }, l.complete = function (e, t) {
        return t.forEach(function (t) {
          l.closeStyle(e, t);
        }), e = e.reverse(), e = e.map(function (e, t) {
          return e[1];
        }), e = c.call(e), e.map(l);
      }, l.hasCSI = function (e) {
        return i.call(e, "[");
      }, l.extractCode = function (e) {
        var t = e.slice(2, -1);return t = Number(t);
      }, t.exports = l;
    }, { "es5-ext/array/#/for-each-right": 23, "es5-ext/array/#/uniq.js": 24, "es5-ext/object/assign": 46, "es5-ext/object/first-key": 51, "es5-ext/object/for-each": 52, "es5-ext/string/#/contains": 71 }], 10: [function (e, t, r) {
      "use strict";
      t.exports = ["000000", "800000", "008000", "808000", "000080", "800080", "008080", "c0c0c0", "808080", "ff0000", "00ff00", "ffff00", "0000ff", "ff00ff", "00ffff", "ffffff", "000000", "00005f", "000087", "0000af", "0000d7", "0000ff", "005f00", "005f5f", "005f87", "005faf", "005fd7", "005fff", "008700", "00875f", "008787", "0087af", "0087d7", "0087ff", "00af00", "00af5f", "00af87", "00afaf", "00afd7", "00afff", "00d700", "00d75f", "00d787", "00d7af", "00d7d7", "00d7ff", "00ff00", "00ff5f", "00ff87", "00ffaf", "00ffd7", "00ffff", "5f0000", "5f005f", "5f0087", "5f00af", "5f00d7", "5f00ff", "5f5f00", "5f5f5f", "5f5f87", "5f5faf", "5f5fd7", "5f5fff", "5f8700", "5f875f", "5f8787", "5f87af", "5f87d7", "5f87ff", "5faf00", "5faf5f", "5faf87", "5fafaf", "5fafd7", "5fafff", "5fd700", "5fd75f", "5fd787", "5fd7af", "5fd7d7", "5fd7ff", "5fff00", "5fff5f", "5fff87", "5fffaf", "5fffd7", "5fffff", "870000", "87005f", "870087", "8700af", "8700d7", "8700ff", "875f00", "875f5f", "875f87", "875faf", "875fd7", "875fff", "878700", "87875f", "878787", "8787af", "8787d7", "8787ff", "87af00", "87af5f", "87af87", "87afaf", "87afd7", "87afff", "87d700", "87d75f", "87d787", "87d7af", "87d7d7", "87d7ff", "87ff00", "87ff5f", "87ff87", "87ffaf", "87ffd7", "87ffff", "af0000", "af005f", "af0087", "af00af", "af00d7", "af00ff", "af5f00", "af5f5f", "af5f87", "af5faf", "af5fd7", "af5fff", "af8700", "af875f", "af8787", "af87af", "af87d7", "af87ff", "afaf00", "afaf5f", "afaf87", "afafaf", "afafd7", "afafff", "afd700", "afd75f", "afd787", "afd7af", "afd7d7", "afd7ff", "afff00", "afff5f", "afff87", "afffaf", "afffd7", "afffff", "d70000", "d7005f", "d70087", "d700af", "d700d7", "d700ff", "d75f00", "d75f5f", "d75f87", "d75faf", "d75fd7", "d75fff", "d78700", "d7875f", "d78787", "d787af", "d787d7", "d787ff", "d7af00", "d7af5f", "d7af87", "d7afaf", "d7afd7", "d7afff", "d7d700", "d7d75f", "d7d787", "d7d7af", "d7d7d7", "d7d7ff", "d7ff00", "d7ff5f", "d7ff87", "d7ffaf", "d7ffd7", "d7ffff", "ff0000", "ff005f", "ff0087", "ff00af", "ff00d7", "ff00ff", "ff5f00", "ff5f5f", "ff5f87", "ff5faf", "ff5fd7", "ff5fff", "ff8700", "ff875f", "ff8787", "ff87af", "ff87d7", "ff87ff", "ffaf00", "ffaf5f", "ffaf87", "ffafaf", "ffafd7", "ffafff", "ffd700", "ffd75f", "ffd787", "ffd7af", "ffd7d7", "ffd7ff", "ffff00", "ffff5f", "ffff87", "ffffaf", "ffffd7", "ffffff", "080808", "121212", "1c1c1c", "262626", "303030", "3a3a3a", "444444", "4e4e4e", "585858", "626262", "6c6c6c", "767676", "808080", "8a8a8a", "949494", "9e9e9e", "a8a8a8", "b2b2b2", "bcbcbc", "c6c6c6", "d0d0d0", "dadada", "e4e4e4", "eeeeee"];
    }, {}], 11: [function (e, t, r) {
      "use strict";
      var n,
          i,
          o,
          a,
          s = Array.prototype.push,
          c = Array.prototype.reduce,
          l = Math.abs;for (n = e("./xterm-colors").map(function (e) {
        return { r: parseInt(e.slice(0, 2), 16), g: parseInt(e.slice(2, 4), 16), b: parseInt(e.slice(4), 16) };
      }), i = n.slice(0, 16), t.exports = o = [], a = 0; a < 8;) {
        o.push(30 + a++);
      }for (a = 0; a < 8;) {
        o.push(90 + a++);
      }s.apply(o, n.slice(16).map(function (e) {
        var t,
            r = 1 / 0;return i.every(function (n, i) {
          var o = c.call("rgb", function (t, r) {
            return t += l(n[r] - e[r]);
          }, 0);return o < r && (t = i, r = o), o;
        }), o[t];
      }));
    }, { "./xterm-colors": 10 }], 12: [function (e, t, r) {
      "use strict";
      var n,
          i,
          o,
          a,
          s = e("d"),
          c = e("es5-ext/math/trunc"),
          l = Math.abs,
          f = Math.floor,
          u = Math.max,
          p = function p(e) {
        return function (t) {
          return t = isNaN(t) ? 0 : u(f(t), 0), t ? "[" + t + e : "";
        };
      };t.exports = Object.defineProperties(function (e, t) {
        return e = isNaN(e) ? 0 : f(e), t = isNaN(t) ? 0 : f(t), (e > 0 ? o(e) : a(-e)) + (t > 0 ? i(t) : n(-t));
      }, { up: s(n = p("A")), down: s(i = p("B")), right: s(o = p("C")), left: s(a = p("D")), to: s(function (e, t) {
          return e = isNaN(e) ? 1 : u(f(e), 0) + 1, "[" + (t = isNaN(t) ? 1 : u(f(t), 0) + 1) + ";" + e + "H";
        }), lines: s(function (e) {
          var t;return e = c(e) || 0, t = e >= 0 ? "E" : "F", "[" + (e = f(l(e))) + t;
        }) });
    }, { d: 19, "es5-ext/math/trunc": 40 }], 13: [function (e, t, r) {
      "use strict";
      t.exports = "[2J[0;0H";
    }, {}], 14: [function (e, t, r) {
      "use strict";
      var n = e("ansi-regex"),
          i = e("es5-ext/object/validate-stringifiable-value"),
          o = e("./get-stripped-length"),
          a = e("./lib/sgr"),
          s = Math.max,
          c = function c(e) {
        this.token = e;
      },
          l = function l(e) {
        var t = n().exec(e);if (!t) return [e];var r,
            i,
            o,
            a = t.index;return 0 === a ? (r = t[0], o = e.slice(r.length), [new c(r)].concat(l(o))) : (i = e.slice(0, a), r = t[0], o = e.slice(a + r.length), [i, new c(r)].concat(l(o)));
      },
          f = function f(e, t, r, n) {
        return !(r > e.length + t || n < t);
      },
          u = function u(e, t, r) {
        var n = e.reduce(function (e, n) {
          var i = e.index;if (n instanceof c) {
            var o = a.extractCode(n.token);i <= t ? (o in a.openers && a.openStyle(e.preOpeners, o), o in a.closers && a.closeStyle(e.preOpeners, o)) : i < r && (o in a.openers ? (a.openStyle(e.inOpeners, o), e.seq.push(n)) : o in a.closers && (e.inClosers.push(o), e.seq.push(n)));
          } else {
            var s = "";if (f(n, i, t, r)) {
              var l = Math.max(t - i, 0),
                  u = Math.min(r - i, n.length);s = n.slice(l, u);
            }e.seq.push(s), e.index = i + n.length;
          }return e;
        }, { index: 0, seq: [], preOpeners: [], inOpeners: [], inClosers: [] });return n.seq = [].concat(a.prepend(n.preOpeners), n.seq, a.complete([].concat(n.preOpeners, n.inOpeners), n.inClosers)), n.seq;
      };t.exports = function (e) {
        var t,
            r,
            n = Number(arguments[1]),
            a = Number(arguments[2]);return e = i(e), r = o(e), isNaN(n) && (n = 0), isNaN(a) && (a = r), n < 0 && (n = s(r + n, 0)), a < 0 && (a = s(r + a, 0)), t = l(e), t = u(t, n, a), t.map(function (e) {
          return e instanceof c ? e.token : e;
        }).join("");
      };
    }, { "./get-stripped-length": 7, "./lib/sgr": 9, "ansi-regex": 1, "es5-ext/object/validate-stringifiable-value": 69 }], 15: [function (e, t, r) {
      "use strict";
      var n = e("es5-ext/object/validate-stringifiable"),
          i = e("ansi-regex")();t.exports = function (e) {
        return n(e).replace(i, "");
      };
    }, { "ansi-regex": 1, "es5-ext/object/validate-stringifiable": 70 }], 16: [function (e, t, r) {
      "use strict";
      var n,
          i = e("es5-ext/function/#/compose"),
          o = e("es5-ext/object/valid-callable"),
          a = e("d"),
          s = e("timers-ext/valid-timeout"),
          c = "-\\|/".length;n = function n() {}, Object.defineProperties(n.prototype, { index: a(-1), running: a(!1), next: a(function () {
          var e = this.running ? "\b" : "";return this.running || (this.running = !0), e + "-\\|/"[this.index = (this.index + 1) % c];
        }), reset: a(function () {
          return this.running ? (this.index = -1, this.running = !1, "\b") : "";
        }) }), t.exports = r = function r(e, t) {
        var r,
            a = arguments[2],
            c = new n();return o(e), t = s(t), void 0 !== a && (e = i.call(e, o(a))), { start: function start() {
            r || (r = setInterval(function () {
              e(c.next());
            }, t));
          }, restart: function restart() {
            this.stop(), this.start();
          }, stop: function stop() {
            r && (clearInterval(r), r = null, e(c.reset()));
          } };
      }, Object.defineProperty(r, "Iterator", a(n));
    }, { d: 19, "es5-ext/function/#/compose": 30, "es5-ext/object/valid-callable": 66, "timers-ext/valid-timeout": 115 }], 17: [function (e, t, r) {
      "use strict";
      var n = e("d");Object.defineProperties(r, { width: n.gs("ce", function () {
          return process.stdout.columns || 0;
        }), height: n.gs("ce", function () {
          return process.stdout.rows || 0;
        }) });
    }, { d: 19 }], 18: [function (e, t, r) {
      "use strict";
      var n,
          i = e("es5-ext/object/copy"),
          o = e("es5-ext/object/normalize-options"),
          a = e("es5-ext/object/valid-callable"),
          s = e("es5-ext/object/map"),
          c = e("es5-ext/object/valid-callable"),
          l = e("es5-ext/object/valid-value"),
          f = Function.prototype.bind,
          u = Object.defineProperty,
          p = Object.prototype.hasOwnProperty;n = function n(e, t, r) {
        var n,
            o = l(t) && c(t.value);return n = i(t), delete n.writable, delete n.value, n.get = function () {
          return !r.overwriteDefinition && p.call(this, e) ? o : (t.value = f.call(o, r.resolveContext ? r.resolveContext(this) : this), u(this, e, t), this[e]);
        }, n;
      }, t.exports = function (e) {
        var t = o(arguments[1]);return null != t.resolveContext && a(t.resolveContext), s(e, function (e, r) {
          return n(r, e, t);
        });
      };
    }, { "es5-ext/object/copy": 49, "es5-ext/object/map": 59, "es5-ext/object/normalize-options": 61, "es5-ext/object/valid-callable": 66, "es5-ext/object/valid-value": 68 }], 19: [function (e, t, r) {
      "use strict";
      var n,
          i = e("es5-ext/object/assign"),
          o = e("es5-ext/object/normalize-options"),
          a = e("es5-ext/object/is-callable"),
          s = e("es5-ext/string/#/contains");n = t.exports = function (e, t) {
        var r, n, a, c, l;return arguments.length < 2 || "string" != typeof e ? (c = t, t = e, e = null) : c = arguments[2], null == e ? (r = a = !0, n = !1) : (r = s.call(e, "c"), n = s.call(e, "e"), a = s.call(e, "w")), l = { value: t, configurable: r, enumerable: n, writable: a }, c ? i(o(c), l) : l;
      }, n.gs = function (e, t, r) {
        var n, c, l, f;return "string" != typeof e ? (l = r, r = t, t = e, e = null) : l = arguments[3], null == t ? t = void 0 : a(t) ? null == r ? r = void 0 : a(r) || (l = r, r = void 0) : (l = t, t = r = void 0), null == e ? (n = !0, c = !1) : (n = s.call(e, "c"), c = s.call(e, "e")), f = { get: t, set: r, configurable: n, enumerable: c }, l ? i(o(l), f) : f;
      };
    }, { "es5-ext/object/assign": 46, "es5-ext/object/is-callable": 54, "es5-ext/object/normalize-options": 61, "es5-ext/string/#/contains": 71 }], 20: [function (e, t, r) {
      "use strict";
      var n,
          i = e("es5-ext/object/map"),
          o = e("es5-ext/object/is-callable"),
          a = e("es5-ext/object/valid-value"),
          s = e("es5-ext/string/#/contains"),
          c = Function.prototype.call,
          l = Object.defineProperty,
          f = Object.getOwnPropertyDescriptor,
          u = Object.getPrototypeOf,
          p = Object.prototype.hasOwnProperty,
          d = { configurable: !1, enumerable: !1, writable: !1, value: null };n = function n(e, t) {
        var r,
            n,
            i,
            h,
            b,
            m,
            v = !1;return t = Object(a(t)), i = t.cacheName, m = t.flat, null == i && (i = e), delete t.cacheName, r = t.value, b = o(r), delete t.value, n = { configurable: Boolean(t.configurable), enumerable: Boolean(t.enumerable) }, n.get = e !== i ? function () {
          return p.call(this, i) ? this[i] : (d.value = b ? c.call(r, this, t) : r, d.writable = v, l(this, i, d), d.value = null, h && l(this, e, h), this[i]);
        } : m ? function n() {
          var i,
              o = this;if (p.call(this, e)) {
            if (i = f(this, e), i.hasOwnProperty("value")) return i.value;if ("function" == typeof i.get && i.get !== n) return i.get.call(this);
          }for (; !p.call(o, e);) {
            o = u(o);
          }return h.value = b ? c.call(r, o, t) : r, l(o, e, h), h.value = null, o[e];
        } : function n() {
          var i;return p.call(this, e) && (i = f(this, e)) ? i.hasOwnProperty("value") ? i.value : "function" == typeof i.get && i.get !== n ? i.get.call(this) : r : (h.value = b ? c.call(r, this, t) : r, l(this, e, h), h.value = null, this[e]);
        }, n.set = function (t) {
          if (p.call(this, e)) throw new TypeError("Cannot assign to lazy defined '" + e + "' property of " + this);n.get.call(this), this[i] = t;
        }, t.desc ? (h = { configurable: s.call(t.desc, "c"), enumerable: s.call(t.desc, "e") }, i === e ? (h.writable = s.call(t.desc, "w"), h.value = null) : (v = s.call(t.desc, "w"), h.get = n.get, h.set = n.set), delete t.desc) : i === e && (h = { configurable: Boolean(t.configurable), enumerable: Boolean(t.enumerable), writable: Boolean(t.writable), value: null }), delete t.configurable, delete t.enumerable, delete t.writable, n;
      }, t.exports = function (e) {
        return i(e, function (e, t) {
          return n(t, e);
        });
      };
    }, { "es5-ext/object/is-callable": 54, "es5-ext/object/map": 59, "es5-ext/object/valid-value": 68, "es5-ext/string/#/contains": 71 }], 21: [function (e, t, r) {
      "use strict";
      var n = e("../../object/valid-value");t.exports = function () {
        return n(this).length = 0, this;
      };
    }, { "../../object/valid-value": 68 }], 22: [function (e, t, r) {
      "use strict";
      var n = e("../../number/to-pos-integer"),
          i = e("../../object/valid-value"),
          o = Array.prototype.indexOf,
          a = Object.prototype.hasOwnProperty,
          s = Math.abs,
          c = Math.floor;t.exports = function (e) {
        var t, r, l, f;if (e === e) return o.apply(this, arguments);for (r = n(i(this).length), l = arguments[1], l = isNaN(l) ? 0 : l >= 0 ? c(l) : n(this.length) - c(s(l)), t = l; t < r; ++t) {
          if (a.call(this, t) && (f = this[t]) !== f) return t;
        }return -1;
      };
    }, { "../../number/to-pos-integer": 44, "../../object/valid-value": 68 }], 23: [function (e, t, r) {
      "use strict";
      var n = e("../../number/to-pos-integer"),
          i = e("../../object/valid-callable"),
          o = e("../../object/valid-value"),
          a = Object.prototype.hasOwnProperty,
          s = Function.prototype.call;t.exports = function (e) {
        var t, r, c;for (r = Object(o(this)), i(e), c = arguments[1], t = n(r.length) - 1; t >= 0; --t) {
          a.call(r, t) && s.call(e, c, r[t], t, r);
        }
      };
    }, { "../../number/to-pos-integer": 44, "../../object/valid-callable": 66, "../../object/valid-value": 68 }], 24: [function (e, t, r) {
      "use strict";
      var n,
          i = e("./e-index-of"),
          o = Array.prototype.filter;n = function n(e, t) {
        return i.call(this, e) === t;
      }, t.exports = function () {
        return o.call(this, n, this);
      };
    }, { "./e-index-of": 22 }], 25: [function (e, t, r) {
      "use strict";
      t.exports = e("./is-implemented")() ? Array.from : e("./shim");
    }, { "./is-implemented": 26, "./shim": 27 }], 26: [function (e, t, r) {
      "use strict";
      t.exports = function () {
        var e,
            t,
            r = Array.from;return "function" == typeof r && (e = ["raz", "dwa"], t = r(e), Boolean(t && t !== e && "dwa" === t[1]));
      };
    }, {}], 27: [function (e, t, r) {
      "use strict";
      var n = e("es6-symbol").iterator,
          i = e("../../function/is-arguments"),
          o = e("../../function/is-function"),
          a = e("../../number/to-pos-integer"),
          s = e("../../object/valid-callable"),
          c = e("../../object/valid-value"),
          l = e("../../string/is-string"),
          f = Array.isArray,
          u = Function.prototype.call,
          p = { configurable: !0, enumerable: !0, writable: !0, value: null },
          d = Object.defineProperty;t.exports = function (e) {
        var t,
            r,
            h,
            b,
            m,
            v,
            g,
            x,
            y,
            _,
            j = arguments[1],
            w = arguments[2];if (e = Object(c(e)), null != j && s(j), this && this !== Array && o(this)) t = this;else {
          if (!j) {
            if (i(e)) return 1 !== (m = e.length) ? Array.apply(null, e) : (b = new Array(1), b[0] = e[0], b);if (f(e)) {
              for (b = new Array(m = e.length), r = 0; r < m; ++r) {
                b[r] = e[r];
              }return b;
            }
          }b = [];
        }if (!f(e)) if (void 0 !== (y = e[n])) {
          for (g = s(y).call(e), t && (b = new t()), x = g.next(), r = 0; !x.done;) {
            _ = j ? u.call(j, w, x.value, r) : x.value, t ? (p.value = _, d(b, r, p)) : b[r] = _, x = g.next(), ++r;
          }m = r;
        } else if (l(e)) {
          for (m = e.length, t && (b = new t()), r = 0, h = 0; r < m; ++r) {
            _ = e[r], r + 1 < m && (v = _.charCodeAt(0)) >= 55296 && v <= 56319 && (_ += e[++r]), _ = j ? u.call(j, w, _, h) : _, t ? (p.value = _, d(b, h, p)) : b[h] = _, ++h;
          }m = h;
        }if (void 0 === m) for (m = a(e.length), t && (b = new t(m)), r = 0; r < m; ++r) {
          _ = j ? u.call(j, w, e[r], r) : e[r], t ? (p.value = _, d(b, r, p)) : b[r] = _;
        }return t && (p.value = null, b.length = m), b;
      };
    }, { "../../function/is-arguments": 32, "../../function/is-function": 33, "../../number/to-pos-integer": 44, "../../object/valid-callable": 66, "../../object/valid-value": 68, "../../string/is-string": 77, "es6-symbol": 85 }], 28: [function (e, t, r) {
      "use strict";
      var n = e("./from"),
          i = Array.isArray;t.exports = function (e) {
        return i(e) ? e : n(e);
      };
    }, { "./from": 25 }], 29: [function (e, t, r) {
      "use strict";
      var n = e("../object/assign"),
          i = e("../object/is-object"),
          o = Error.captureStackTrace;r = t.exports = function (e) {
        var t = new Error(e),
            a = arguments[1],
            s = arguments[2];return null == s && i(a) && (s = a, a = null), null != s && n(t, s), null != a && (t.code = a), o && o(t, r), t;
      };
    }, { "../object/assign": 46, "../object/is-object": 55 }], 30: [function (e, t, r) {
      "use strict";
      var n = e("../../object/valid-callable"),
          i = e("../../array/from"),
          o = Function.prototype.apply,
          a = Function.prototype.call,
          s = function s(e, t) {
        return a.call(t, this, e);
      };t.exports = function (e) {
        var t, r;return e || n(e), t = [this].concat(i(arguments)), t.forEach(n), t = t.reverse(), r = t[0], t = t.slice(1), function (e) {
          return t.reduce(s, o.call(r, this, arguments));
        };
      };
    }, { "../../array/from": 25, "../../object/valid-callable": 66 }], 31: [function (e, t, r) {
      "use strict";
      var n,
          i,
          o,
          a,
          s = e("../number/to-pos-integer"),
          c = function c(e, t) {};try {
        Object.defineProperty(c, "length", { configurable: !0, writable: !1, enumerable: !1, value: 1 });
      } catch (e) {}1 === c.length ? (n = { configurable: !0, writable: !1, enumerable: !1 }, i = Object.defineProperty, t.exports = function (e, t) {
        return t = s(t), e.length === t ? e : (n.value = t, i(e, "length", n));
      }) : (a = e("../object/mixin"), o = function () {
        var e = [];return function (t) {
          var r,
              n = 0;if (e[t]) return e[t];for (r = []; t--;) {
            r.push("a" + (++n).toString(36));
          }return new Function("fn", "return function (" + r.join(", ") + ") { return fn.apply(this, arguments); };");
        };
      }(), t.exports = function (e, t) {
        var r;if (t = s(t), e.length === t) return e;r = o(t)(e);try {
          a(r, e);
        } catch (e) {}return r;
      });
    }, { "../number/to-pos-integer": 44, "../object/mixin": 60 }], 32: [function (e, t, r) {
      "use strict";
      var n = Object.prototype.toString,
          i = n.call(function () {
        return arguments;
      }());t.exports = function (e) {
        return n.call(e) === i;
      };
    }, {}], 33: [function (e, t, r) {
      "use strict";
      var n = Object.prototype.toString,
          i = n.call(e("./noop"));t.exports = function (e) {
        return "function" == typeof e && n.call(e) === i;
      };
    }, { "./noop": 34 }], 34: [function (e, t, r) {
      "use strict";
      t.exports = function () {};
    }, {}], 35: [function (e, t, r) {
      "use strict";
      var n = e("es6-symbol").iterator,
          i = e("../object/is-array-like");t.exports = function (e) {
        return null != e && ("function" == typeof e[n] || i(e));
      };
    }, { "../object/is-array-like": 53, "es6-symbol": 85 }], 36: [function (e, t, r) {
      "use strict";
      var n = e("../object/is-object"),
          i = e("./is");t.exports = function (e) {
        if (i(e) && n(e)) return e;throw new TypeError(e + " is not an iterable or array-like object");
      };
    }, { "../object/is-object": 55, "./is": 35 }], 37: [function (e, t, r) {
      "use strict";
      t.exports = e("./is-implemented")() ? Math.sign : e("./shim");
    }, { "./is-implemented": 38, "./shim": 39 }], 38: [function (e, t, r) {
      "use strict";
      t.exports = function () {
        var e = Math.sign;return "function" == typeof e && 1 === e(10) && -1 === e(-20);
      };
    }, {}], 39: [function (e, t, r) {
      "use strict";
      t.exports = function (e) {
        return e = Number(e), isNaN(e) || 0 === e ? e : e > 0 ? 1 : -1;
      };
    }, {}], 40: [function (e, t, r) {
      "use strict";
      t.exports = e("./is-implemented")() ? Math.trunc : e("./shim");
    }, { "./is-implemented": 41, "./shim": 42 }], 41: [function (e, t, r) {
      "use strict";
      t.exports = function () {
        var e = Math.trunc;return "function" == typeof e && 13 === e(13.67) && -13 === e(-13.67);
      };
    }, {}], 42: [function (e, t, r) {
      "use strict";
      var n = Math.floor;t.exports = function (e) {
        return isNaN(e) ? NaN : (e = Number(e), 0 === e ? e : e === 1 / 0 ? 1 / 0 : e === -1 / 0 ? -1 / 0 : e > 0 ? n(e) : -n(-e));
      };
    }, {}], 43: [function (e, t, r) {
      "use strict";
      var n = e("../math/sign"),
          i = Math.abs,
          o = Math.floor;t.exports = function (e) {
        return isNaN(e) ? 0 : (e = Number(e), 0 !== e && isFinite(e) ? n(e) * o(i(e)) : e);
      };
    }, { "../math/sign": 37 }], 44: [function (e, t, r) {
      "use strict";
      var n = e("./to-integer"),
          i = Math.max;t.exports = function (e) {
        return i(0, n(e));
      };
    }, { "./to-integer": 43 }], 45: [function (e, t, r) {
      "use strict";
      var n = e("./valid-callable"),
          i = e("./valid-value"),
          o = Function.prototype.bind,
          a = Function.prototype.call,
          s = Object.keys,
          c = Object.prototype.propertyIsEnumerable;t.exports = function (e, t) {
        return function (r, l) {
          var f,
              u = arguments[2],
              p = arguments[3];return r = Object(i(r)), n(l), f = s(r), p && f.sort("function" == typeof p ? o.call(p, r) : void 0), "function" != typeof e && (e = f[e]), a.call(e, f, function (e, n) {
            return c.call(r, e) ? a.call(l, u, r[e], e, r, n) : t;
          });
        };
      };
    }, { "./valid-callable": 66, "./valid-value": 68 }], 46: [function (e, t, r) {
      "use strict";
      t.exports = e("./is-implemented")() ? Object.assign : e("./shim");
    }, { "./is-implemented": 47, "./shim": 48 }], 47: [function (e, t, r) {
      "use strict";
      t.exports = function () {
        var e,
            t = Object.assign;return "function" == typeof t && (e = { foo: "raz" }, t(e, { bar: "dwa" }, { trzy: "trzy" }), e.foo + e.bar + e.trzy === "razdwatrzy");
      };
    }, {}], 48: [function (e, t, r) {
      "use strict";
      var n = e("../keys"),
          i = e("../valid-value"),
          o = Math.max;t.exports = function (e, t) {
        var r,
            a,
            s,
            c = o(arguments.length, 2);for (e = Object(i(e)), s = function s(n) {
          try {
            e[n] = t[n];
          } catch (e) {
            r || (r = e);
          }
        }, a = 1; a < c; ++a) {
          t = arguments[a], n(t).forEach(s);
        }if (void 0 !== r) throw r;return e;
      };
    }, { "../keys": 56, "../valid-value": 68 }], 49: [function (e, t, r) {
      "use strict";
      var n = e("../array/from"),
          i = e("./assign"),
          o = e("./valid-value");t.exports = function (e) {
        var t = Object(o(e)),
            r = arguments[1],
            a = Object(arguments[2]);if (t !== e && !r) return t;var s = {};return r ? n(r, function (t) {
          (a.ensure || t in e) && (s[t] = e[t]);
        }) : i(s, e), s;
      };
    }, { "../array/from": 25, "./assign": 46, "./valid-value": 68 }], 50: [function (e, t, r) {
      "use strict";
      var n,
          i = Object.create;e("./set-prototype-of/is-implemented")() || (n = e("./set-prototype-of/shim")), t.exports = function () {
        var e, t, r;return n ? 1 !== n.level ? i : (e = {}, t = {}, r = { configurable: !1, enumerable: !1, writable: !0, value: void 0 }, Object.getOwnPropertyNames(Object.prototype).forEach(function (e) {
          if ("__proto__" === e) return void (t[e] = { configurable: !0, enumerable: !1, writable: !0, value: void 0 });t[e] = r;
        }), Object.defineProperties(e, t), Object.defineProperty(n, "nullPolyfill", { configurable: !1, enumerable: !1, writable: !1, value: e }), function (t, r) {
          return i(null === t ? e : t, r);
        }) : i;
      }();
    }, { "./set-prototype-of/is-implemented": 64, "./set-prototype-of/shim": 65 }], 51: [function (e, t, r) {
      "use strict";
      var n = e("./valid-value"),
          i = Object.prototype.propertyIsEnumerable;t.exports = function (e) {
        var t;n(e);for (t in e) {
          if (i.call(e, t)) return t;
        }return null;
      };
    }, { "./valid-value": 68 }], 52: [function (e, t, r) {
      "use strict";
      t.exports = e("./_iterate")("forEach");
    }, { "./_iterate": 45 }], 53: [function (e, t, r) {
      "use strict";
      var n = e("../function/is-function"),
          i = e("./is-object");t.exports = function (e) {
        return null != e && "number" == typeof e.length && (i(e) && !n(e) || "string" == typeof e) || !1;
      };
    }, { "../function/is-function": 33, "./is-object": 55 }], 54: [function (e, t, r) {
      "use strict";
      t.exports = function (e) {
        return "function" == typeof e;
      };
    }, {}], 55: [function (e, t, r) {
      "use strict";
      var n = { function: !0, object: !0 };t.exports = function (e) {
        return null != e && n[typeof e === "undefined" ? "undefined" : _typeof(e)] || !1;
      };
    }, {}], 56: [function (e, t, r) {
      "use strict";
      t.exports = e("./is-implemented")() ? Object.keys : e("./shim");
    }, { "./is-implemented": 57, "./shim": 58 }], 57: [function (e, t, r) {
      "use strict";
      t.exports = function () {
        try {
          return Object.keys("primitive"), !0;
        } catch (e) {
          return !1;
        }
      };
    }, {}], 58: [function (e, t, r) {
      "use strict";
      var n = Object.keys;t.exports = function (e) {
        return n(null == e ? e : Object(e));
      };
    }, {}], 59: [function (e, t, r) {
      "use strict";
      var n = e("./valid-callable"),
          i = e("./for-each"),
          o = Function.prototype.call;t.exports = function (e, t) {
        var r = {},
            a = arguments[2];return n(t), i(e, function (e, n, i, s) {
          r[n] = o.call(t, a, e, n, i, s);
        }), r;
      };
    }, { "./for-each": 52, "./valid-callable": 66 }], 60: [function (e, t, r) {
      "use strict";
      var n = e("./valid-value"),
          i = Object.defineProperty,
          o = Object.getOwnPropertyDescriptor,
          a = Object.getOwnPropertyNames,
          s = Object.getOwnPropertySymbols;t.exports = function (e, t) {
        var r,
            c = Object(n(t));if (e = Object(n(e)), a(c).forEach(function (n) {
          try {
            i(e, n, o(t, n));
          } catch (e) {
            r = e;
          }
        }), "function" == typeof s && s(c).forEach(function (n) {
          try {
            i(e, n, o(t, n));
          } catch (e) {
            r = e;
          }
        }), void 0 !== r) throw r;return e;
      };
    }, { "./valid-value": 68 }], 61: [function (e, t, r) {
      "use strict";
      var n = Array.prototype.forEach,
          i = Object.create,
          o = function o(e, t) {
        var r;for (r in e) {
          t[r] = e[r];
        }
      };t.exports = function (e) {
        var t = i(null);return n.call(arguments, function (e) {
          null != e && o(Object(e), t);
        }), t;
      };
    }, {}], 62: [function (e, t, r) {
      "use strict";
      var n = Array.prototype.forEach,
          i = Object.create;t.exports = function (e) {
        var t = i(null);return n.call(arguments, function (e) {
          t[e] = !0;
        }), t;
      };
    }, {}], 63: [function (e, t, r) {
      "use strict";
      t.exports = e("./is-implemented")() ? Object.setPrototypeOf : e("./shim");
    }, { "./is-implemented": 64, "./shim": 65 }], 64: [function (e, t, r) {
      "use strict";
      var n = Object.create,
          i = Object.getPrototypeOf,
          o = {};t.exports = function () {
        var e = Object.setPrototypeOf,
            t = arguments[0] || n;return "function" == typeof e && i(e(t(null), o)) === o;
      };
    }, {}], 65: [function (e, t, r) {
      "use strict";
      var n,
          i = e("../is-object"),
          o = e("../valid-value"),
          a = Object.prototype.isPrototypeOf,
          s = Object.defineProperty,
          c = { configurable: !0, enumerable: !1, writable: !0, value: void 0 };n = function n(e, t) {
        if (o(e), null === t || i(t)) return e;throw new TypeError("Prototype must be null or an object");
      }, t.exports = function (e) {
        var t, r;return e ? (2 === e.level ? e.set ? (r = e.set, t = function t(e, _t) {
          return r.call(n(e, _t), _t), e;
        }) : t = function t(e, _t2) {
          return n(e, _t2).__proto__ = _t2, e;
        } : t = function e(t, r) {
          var i;return n(t, r), i = a.call(e.nullPolyfill, t), i && delete e.nullPolyfill.__proto__, null === r && (r = e.nullPolyfill), t.__proto__ = r, i && s(e.nullPolyfill, "__proto__", c), t;
        }, Object.defineProperty(t, "level", { configurable: !1, enumerable: !1, writable: !1, value: e.level })) : null;
      }(function () {
        var e,
            t = Object.create(null),
            r = {},
            n = Object.getOwnPropertyDescriptor(Object.prototype, "__proto__");if (n) {
          try {
            e = n.set, e.call(t, r);
          } catch (e) {}if (Object.getPrototypeOf(t) === r) return { set: e, level: 2 };
        }return t.__proto__ = r, Object.getPrototypeOf(t) === r ? { level: 2 } : (t = {}, t.__proto__ = r, Object.getPrototypeOf(t) === r && { level: 1 });
      }()), e("../create");
    }, { "../create": 50, "../is-object": 55, "../valid-value": 68 }], 66: [function (e, t, r) {
      "use strict";
      t.exports = function (e) {
        if ("function" != typeof e) throw new TypeError(e + " is not a function");return e;
      };
    }, {}], 67: [function (e, t, r) {
      "use strict";
      var n = e("./is-object");t.exports = function (e) {
        if (!n(e)) throw new TypeError(e + " is not an Object");return e;
      };
    }, { "./is-object": 55 }], 68: [function (e, t, r) {
      "use strict";
      t.exports = function (e) {
        if (null == e) throw new TypeError("Cannot use null or undefined");return e;
      };
    }, {}], 69: [function (e, t, r) {
      "use strict";
      var n = e("./valid-value"),
          i = e("./validate-stringifiable");t.exports = function (e) {
        return i(n(e));
      };
    }, { "./valid-value": 68, "./validate-stringifiable": 70 }], 70: [function (e, t, r) {
      "use strict";
      var n = e("./is-callable");t.exports = function (e) {
        try {
          return e && n(e.toString) ? e.toString() : String(e);
        } catch (e) {
          throw new TypeError("Passed argument cannot be stringifed");
        }
      };
    }, { "./is-callable": 54 }], 71: [function (e, t, r) {
      "use strict";
      t.exports = e("./is-implemented")() ? String.prototype.contains : e("./shim");
    }, { "./is-implemented": 72, "./shim": 73 }], 72: [function (e, t, r) {
      "use strict";
      var n = "razdwatrzy";t.exports = function () {
        return "function" == typeof n.contains && !0 === n.contains("dwa") && !1 === n.contains("foo");
      };
    }, {}], 73: [function (e, t, r) {
      "use strict";
      var n = String.prototype.indexOf;t.exports = function (e) {
        return n.call(this, e, arguments[1]) > -1;
      };
    }, {}], 74: [function (e, t, r) {
      "use strict";
      t.exports = e("./is-implemented")() ? String.prototype.repeat : e("./shim");
    }, { "./is-implemented": 75, "./shim": 76 }], 75: [function (e, t, r) {
      "use strict";
      var n = "foo";t.exports = function () {
        return "function" == typeof n.repeat && "foofoo" === n.repeat(2);
      };
    }, {}], 76: [function (e, t, r) {
      "use strict";
      var n = e("../../../object/valid-value"),
          i = e("../../../number/to-integer");t.exports = function (e) {
        var t,
            r = String(n(this));if ((e = i(e)) < 0) throw new RangeError("Count must be >= 0");if (!isFinite(e)) throw new RangeError("Count must be < ∞");if (t = "", !e) return t;for (;;) {
          if (1 & e && (t += r), (e >>>= 1) <= 0) break;r += r;
        }return t;
      };
    }, { "../../../number/to-integer": 43, "../../../object/valid-value": 68 }], 77: [function (e, t, r) {
      "use strict";
      var n = Object.prototype.toString,
          i = n.call("");t.exports = function (e) {
        return "string" == typeof e || e && "object" == (typeof e === "undefined" ? "undefined" : _typeof(e)) && (e instanceof String || n.call(e) === i) || !1;
      };
    }, {}], 78: [function (e, t, r) {
      "use strict";
      var n,
          i = e("es5-ext/object/set-prototype-of"),
          o = e("es5-ext/string/#/contains"),
          a = e("d"),
          s = e("./"),
          c = Object.defineProperty;n = t.exports = function (e, t) {
        if (!(this instanceof n)) return new n(e, t);s.call(this, e), t = t ? o.call(t, "key+value") ? "key+value" : o.call(t, "key") ? "key" : "value" : "value", c(this, "__kind__", a("", t));
      }, i && i(n, s), n.prototype = Object.create(s.prototype, { constructor: a(n), _resolve: a(function (e) {
          return "value" === this.__kind__ ? this.__list__[e] : "key+value" === this.__kind__ ? [e, this.__list__[e]] : e;
        }), toString: a(function () {
          return "[object Array Iterator]";
        }) });
    }, { "./": 81, d: 19, "es5-ext/object/set-prototype-of": 63, "es5-ext/string/#/contains": 71 }], 79: [function (e, t, r) {
      "use strict";
      var n = e("es5-ext/function/is-arguments"),
          i = e("es5-ext/object/valid-callable"),
          o = e("es5-ext/string/is-string"),
          a = e("./get"),
          s = Array.isArray,
          c = Function.prototype.call,
          l = Array.prototype.some;t.exports = function (e, t) {
        var r,
            f,
            u,
            p,
            d,
            h,
            b,
            m,
            v = arguments[2];if (s(e) || n(e) ? r = "array" : o(e) ? r = "string" : e = a(e), i(t), u = function u() {
          p = !0;
        }, "array" === r) return void l.call(e, function (e) {
          if (c.call(t, v, e, u), p) return !0;
        });if ("string" !== r) for (f = e.next(); !f.done;) {
          if (c.call(t, v, f.value, u), p) return;f = e.next();
        } else for (h = e.length, d = 0; d < h && (b = e[d], d + 1 < h && (m = b.charCodeAt(0)) >= 55296 && m <= 56319 && (b += e[++d]), c.call(t, v, b, u), !p); ++d) {}
      };
    }, { "./get": 80, "es5-ext/function/is-arguments": 32, "es5-ext/object/valid-callable": 66, "es5-ext/string/is-string": 77 }], 80: [function (e, t, r) {
      "use strict";
      var n = e("es5-ext/function/is-arguments"),
          i = e("es5-ext/string/is-string"),
          o = e("./array"),
          a = e("./string"),
          s = e("./valid-iterable"),
          c = e("es6-symbol").iterator;t.exports = function (e) {
        return "function" == typeof s(e)[c] ? e[c]() : n(e) ? new o(e) : i(e) ? new a(e) : new o(e);
      };
    }, { "./array": 78, "./string": 83, "./valid-iterable": 84,
      "es5-ext/function/is-arguments": 32, "es5-ext/string/is-string": 77, "es6-symbol": 85 }], 81: [function (e, t, r) {
      "use strict";
      var _n,
          i = e("es5-ext/array/#/clear"),
          o = e("es5-ext/object/assign"),
          a = e("es5-ext/object/valid-callable"),
          s = e("es5-ext/object/valid-value"),
          c = e("d"),
          l = e("d/auto-bind"),
          f = e("es6-symbol"),
          u = Object.defineProperty,
          p = Object.defineProperties;t.exports = _n = function n(e, t) {
        if (!(this instanceof _n)) return new _n(e, t);p(this, { __list__: c("w", s(e)), __context__: c("w", t), __nextIndex__: c("w", 0) }), t && (a(t.on), t.on("_add", this._onAdd), t.on("_delete", this._onDelete), t.on("_clear", this._onClear));
      }, p(_n.prototype, o({ constructor: c(_n), _next: c(function () {
          var e;if (this.__list__) return this.__redo__ && void 0 !== (e = this.__redo__.shift()) ? e : this.__nextIndex__ < this.__list__.length ? this.__nextIndex__++ : void this._unBind();
        }), next: c(function () {
          return this._createResult(this._next());
        }), _createResult: c(function (e) {
          return void 0 === e ? { done: !0, value: void 0 } : { done: !1, value: this._resolve(e) };
        }), _resolve: c(function (e) {
          return this.__list__[e];
        }), _unBind: c(function () {
          this.__list__ = null, delete this.__redo__, this.__context__ && (this.__context__.off("_add", this._onAdd), this.__context__.off("_delete", this._onDelete), this.__context__.off("_clear", this._onClear), this.__context__ = null);
        }), toString: c(function () {
          return "[object Iterator]";
        }) }, l({ _onAdd: c(function (e) {
          if (!(e >= this.__nextIndex__)) {
            if (++this.__nextIndex__, !this.__redo__) return void u(this, "__redo__", c("c", [e]));this.__redo__.forEach(function (t, r) {
              t >= e && (this.__redo__[r] = ++t);
            }, this), this.__redo__.push(e);
          }
        }), _onDelete: c(function (e) {
          var t;e >= this.__nextIndex__ || (--this.__nextIndex__, this.__redo__ && (t = this.__redo__.indexOf(e), -1 !== t && this.__redo__.splice(t, 1), this.__redo__.forEach(function (t, r) {
            t > e && (this.__redo__[r] = --t);
          }, this)));
        }), _onClear: c(function () {
          this.__redo__ && i.call(this.__redo__), this.__nextIndex__ = 0;
        }) }))), u(_n.prototype, f.iterator, c(function () {
        return this;
      })), u(_n.prototype, f.toStringTag, c("", "Iterator"));
    }, { d: 19, "d/auto-bind": 18, "es5-ext/array/#/clear": 21, "es5-ext/object/assign": 46, "es5-ext/object/valid-callable": 66, "es5-ext/object/valid-value": 68, "es6-symbol": 85 }], 82: [function (e, t, r) {
      "use strict";
      var n = e("es5-ext/function/is-arguments"),
          i = e("es5-ext/string/is-string"),
          o = e("es6-symbol").iterator,
          a = Array.isArray;t.exports = function (e) {
        return null != e && (!!a(e) || !!i(e) || !!n(e) || "function" == typeof e[o]);
      };
    }, { "es5-ext/function/is-arguments": 32, "es5-ext/string/is-string": 77, "es6-symbol": 85 }], 83: [function (e, t, r) {
      "use strict";
      var n,
          i = e("es5-ext/object/set-prototype-of"),
          o = e("d"),
          a = e("./"),
          s = Object.defineProperty;n = t.exports = function (e) {
        if (!(this instanceof n)) return new n(e);e = String(e), a.call(this, e), s(this, "__length__", o("", e.length));
      }, i && i(n, a), n.prototype = Object.create(a.prototype, { constructor: o(n), _next: o(function () {
          if (this.__list__) return this.__nextIndex__ < this.__length__ ? this.__nextIndex__++ : void this._unBind();
        }), _resolve: o(function (e) {
          var t,
              r = this.__list__[e];return this.__nextIndex__ === this.__length__ ? r : (t = r.charCodeAt(0), t >= 55296 && t <= 56319 ? r + this.__list__[this.__nextIndex__++] : r);
        }), toString: o(function () {
          return "[object String Iterator]";
        }) });
    }, { "./": 81, d: 19, "es5-ext/object/set-prototype-of": 63 }], 84: [function (e, t, r) {
      "use strict";
      var n = e("./is-iterable");t.exports = function (e) {
        if (!n(e)) throw new TypeError(e + " is not iterable");return e;
      };
    }, { "./is-iterable": 82 }], 85: [function (e, t, r) {
      "use strict";
      t.exports = e("./is-implemented")() ? Symbol : e("./polyfill");
    }, { "./is-implemented": 86, "./polyfill": 88 }], 86: [function (e, t, r) {
      "use strict";
      var n = { object: !0, symbol: !0 };t.exports = function () {
        var e;if ("function" != typeof Symbol) return !1;e = Symbol("test symbol");try {
          String(e);
        } catch (e) {
          return !1;
        }return !!n[_typeof(Symbol.iterator)] && !!n[_typeof(Symbol.toPrimitive)] && !!n[_typeof(Symbol.toStringTag)];
      };
    }, {}], 87: [function (e, t, r) {
      "use strict";
      t.exports = function (e) {
        return !!e && ("symbol" == (typeof e === "undefined" ? "undefined" : _typeof(e)) || !!e.constructor && "Symbol" === e.constructor.name && "Symbol" === e[e.constructor.toStringTag]);
      };
    }, {}], 88: [function (e, t, r) {
      "use strict";
      var n,
          i,
          _o,
          a,
          s = e("d"),
          c = e("./validate-symbol"),
          l = Object.create,
          f = Object.defineProperties,
          u = Object.defineProperty,
          p = Object.prototype,
          d = l(null);if ("function" == typeof Symbol) {
        n = Symbol;try {
          String(n()), a = !0;
        } catch (e) {}
      }var h = function () {
        var e = l(null);return function (t) {
          for (var r, n, i = 0; e[t + (i || "")];) {
            ++i;
          }return t += i || "", e[t] = !0, r = "@@" + t, u(p, r, s.gs(null, function (e) {
            n || (n = !0, u(this, r, s(e)), n = !1);
          })), r;
        };
      }();_o = function o(e) {
        if (this instanceof _o) throw new TypeError("Symbol is not a constructor");return i(e);
      }, t.exports = i = function e(t) {
        var r;if (this instanceof e) throw new TypeError("Symbol is not a constructor");return a ? n(t) : (r = l(_o.prototype), t = void 0 === t ? "" : String(t), f(r, { __description__: s("", t), __name__: s("", h(t)) }));
      }, f(i, { for: s(function (e) {
          return d[e] ? d[e] : d[e] = i(String(e));
        }), keyFor: s(function (e) {
          var t;c(e);for (t in d) {
            if (d[t] === e) return t;
          }
        }), hasInstance: s("", n && n.hasInstance || i("hasInstance")), isConcatSpreadable: s("", n && n.isConcatSpreadable || i("isConcatSpreadable")), iterator: s("", n && n.iterator || i("iterator")), match: s("", n && n.match || i("match")), replace: s("", n && n.replace || i("replace")), search: s("", n && n.search || i("search")), species: s("", n && n.species || i("species")), split: s("", n && n.split || i("split")), toPrimitive: s("", n && n.toPrimitive || i("toPrimitive")), toStringTag: s("", n && n.toStringTag || i("toStringTag")), unscopables: s("", n && n.unscopables || i("unscopables")) }), f(_o.prototype, { constructor: s(i), toString: s("", function () {
          return this.__name__;
        }) }), f(i.prototype, { toString: s(function () {
          return "Symbol (" + c(this).__description__ + ")";
        }), valueOf: s(function () {
          return c(this);
        }) }), u(i.prototype, i.toPrimitive, s("", function () {
        var e = c(this);return "symbol" == (typeof e === "undefined" ? "undefined" : _typeof(e)) ? e : e.toString();
      })), u(i.prototype, i.toStringTag, s("c", "Symbol")), u(_o.prototype, i.toStringTag, s("c", i.prototype[i.toStringTag])), u(_o.prototype, i.toPrimitive, s("c", i.prototype[i.toPrimitive]));
    }, { "./validate-symbol": 89, d: 19 }], 89: [function (e, t, r) {
      "use strict";
      var n = e("./is-symbol");t.exports = function (e) {
        if (!n(e)) throw new TypeError(e + " is not a symbol");return e;
      };
    }, { "./is-symbol": 87 }], 90: [function (e, t, r) {
      "use strict";
      var n,
          i,
          o,
          a,
          s,
          c,
          l,
          f = e("d"),
          u = e("es5-ext/object/valid-callable"),
          p = Function.prototype.apply,
          d = Function.prototype.call,
          h = Object.create,
          b = Object.defineProperty,
          m = Object.defineProperties,
          v = Object.prototype.hasOwnProperty,
          g = { configurable: !0, enumerable: !1, writable: !0 };n = function n(e, t) {
        var r;return u(t), v.call(this, "__ee__") ? r = this.__ee__ : (r = g.value = h(null), b(this, "__ee__", g), g.value = null), r[e] ? "object" == _typeof(r[e]) ? r[e].push(t) : r[e] = [r[e], t] : r[e] = t, this;
      }, i = function i(e, t) {
        var _r, i;return u(t), i = this, n.call(this, e, _r = function r() {
          o.call(i, e, _r), p.call(t, this, arguments);
        }), _r.__eeOnceListener__ = t, this;
      }, o = function o(e, t) {
        var r, n, i, o;if (u(t), !v.call(this, "__ee__")) return this;if (r = this.__ee__, !r[e]) return this;if ("object" == _typeof(n = r[e])) for (o = 0; i = n[o]; ++o) {
          i !== t && i.__eeOnceListener__ !== t || (2 === n.length ? r[e] = n[o ? 0 : 1] : n.splice(o, 1));
        } else n !== t && n.__eeOnceListener__ !== t || delete r[e];return this;
      }, a = function a(e) {
        var t, r, n, i, o;if (v.call(this, "__ee__") && (i = this.__ee__[e])) if ("object" == (typeof i === "undefined" ? "undefined" : _typeof(i))) {
          for (r = arguments.length, o = new Array(r - 1), t = 1; t < r; ++t) {
            o[t - 1] = arguments[t];
          }for (i = i.slice(), t = 0; n = i[t]; ++t) {
            p.call(n, this, o);
          }
        } else switch (arguments.length) {case 1:
            d.call(i, this);break;case 2:
            d.call(i, this, arguments[1]);break;case 3:
            d.call(i, this, arguments[1], arguments[2]);break;default:
            for (r = arguments.length, o = new Array(r - 1), t = 1; t < r; ++t) {
              o[t - 1] = arguments[t];
            }p.call(i, this, o);}
      }, s = { on: n, once: i, off: o, emit: a }, c = { on: f(n), once: f(i), off: f(o), emit: f(a) }, l = m({}, c), t.exports = r = function r(e) {
        return null == e ? h(l) : m(Object(e), c);
      }, r.methods = s;
    }, { d: 19, "es5-ext/object/valid-callable": 66 }], 91: [function (e, t, r) {
      function n(e) {
        return !!e && ("object" == (typeof e === "undefined" ? "undefined" : _typeof(e)) || "function" == typeof e) && "function" == typeof e.then;
      }t.exports = n;
    }, {}], 92: [function (e, t, r) {
      "use strict";
      var n = e("es5-ext/number/to-pos-integer"),
          i = Object.create,
          o = Object.prototype.hasOwnProperty;t.exports = function (e) {
        var t,
            r = 0,
            a = 1,
            s = i(null),
            c = i(null),
            l = 0;return e = n(e), { hit: function hit(n) {
            var i = c[n],
                f = ++l;if (s[f] = n, c[n] = f, !i) {
              if (++r <= e) return;return n = s[a], t(n), n;
            }if (delete s[i], a === i) for (; !o.call(s, ++a);) {
              continue;
            }
          }, delete: t = function t(e) {
            var t = c[e];if (t && (delete s[t], delete c[e], --r, a === t)) {
              if (!r) return l = 0, void (a = 1);for (; !o.call(s, ++a);) {
                continue;
              }
            }
          }, clear: function clear() {
            r = 0, a = 1, s = i(null), c = i(null), l = 0;
          } };
      };
    }, { "es5-ext/number/to-pos-integer": 44 }], 93: [function (e, t, r) {
      "use strict";
      var n = e("es5-ext/array/from"),
          i = e("es5-ext/object/map"),
          o = e("es5-ext/object/mixin"),
          a = e("es5-ext/function/_define-length"),
          s = e("next-tick"),
          c = Array.prototype.slice,
          l = Function.prototype.apply,
          f = Object.create,
          u = Object.prototype.hasOwnProperty;e("../lib/registered-extensions").async = function (e, t) {
        var r,
            p,
            d,
            h = f(null),
            b = f(null),
            m = t.memoized,
            v = t.original;t.memoized = a(function (e) {
          var t = arguments,
              n = t[t.length - 1];return "function" == typeof n && (r = n, t = c.call(t, 0, -1)), m.apply(p = this, d = t);
        }, m);try {
          o(t.memoized, m);
        } catch (e) {}t.on("get", function (e) {
          var n, i, o;if (r) {
            if (h[e]) return "function" == typeof h[e] ? h[e] = [h[e], r] : h[e].push(r), void (r = null);n = r, i = p, o = d, r = p = d = null, s(function () {
              var a;u.call(b, e) ? (a = b[e], t.emit("getasync", e, o, i), l.call(n, a.context, a.args)) : (r = n, p = i, d = o, m.apply(i, o));
            });
          }
        }), t.original = function () {
          var e, i, o, a;return r ? (e = n(arguments), i = function e(r) {
            var i,
                o,
                c = e.id;return null == c ? void s(l.bind(e, this, arguments)) : (delete e.id, i = h[c], delete h[c], i ? (o = n(arguments), t.has(c) && (r ? t.delete(c) : (b[c] = { context: this, args: o }, t.emit("setasync", c, "function" == typeof i ? 1 : i.length))), "function" == typeof i ? a = l.call(i, this, o) : i.forEach(function (e) {
              a = l.call(e, this, o);
            }, this), a) : void 0);
          }, o = r, r = p = d = null, e.push(i), a = l.call(v, this, e), i.cb = o, r = i, a) : l.call(v, this, arguments);
        }, t.on("set", function (e) {
          if (!r) return void t.delete(e);h[e] ? "function" == typeof h[e] ? h[e] = [h[e], r.cb] : h[e].push(r.cb) : h[e] = r.cb, delete r.cb, r.id = e, r = null;
        }), t.on("delete", function (e) {
          var r;u.call(h, e) || b[e] && (r = b[e], delete b[e], t.emit("deleteasync", e, c.call(r.args, 1)));
        }), t.on("clear", function () {
          var e = b;b = f(null), t.emit("clearasync", i(e, function (e) {
            return c.call(e.args, 1);
          }));
        });
      };
    }, { "../lib/registered-extensions": 102, "es5-ext/array/from": 25, "es5-ext/function/_define-length": 31, "es5-ext/object/map": 59, "es5-ext/object/mixin": 60, "next-tick": 113 }], 94: [function (e, t, r) {
      "use strict";
      var n = e("es5-ext/object/valid-callable"),
          i = e("es5-ext/object/for-each"),
          o = e("../lib/registered-extensions"),
          a = Function.prototype.apply;o.dispose = function (e, t, r) {
        var s;if (n(e), r.async && o.async || r.promise && o.promise) return t.on("deleteasync", s = function s(t, r) {
          a.call(e, null, r);
        }), void t.on("clearasync", function (e) {
          i(e, function (e, t) {
            s(t, e);
          });
        });t.on("delete", s = function s(t, r) {
          e(r);
        }), t.on("clear", function (e) {
          i(e, function (e, t) {
            s(t, e);
          });
        });
      };
    }, { "../lib/registered-extensions": 102, "es5-ext/object/for-each": 52, "es5-ext/object/valid-callable": 66 }], 95: [function (e, t, r) {
      "use strict";
      var n = e("es5-ext/array/from"),
          i = e("es5-ext/object/for-each"),
          o = e("next-tick"),
          a = e("is-promise"),
          s = e("timers-ext/valid-timeout"),
          c = e("../lib/registered-extensions"),
          l = Function.prototype,
          f = Math.max,
          u = Math.min,
          p = Object.create;c.maxAge = function (e, t, r) {
        var d, h, b, m;(e = s(e)) && (d = p(null), h = r.async && c.async || r.promise && c.promise ? "async" : "", t.on("set" + h, function (r) {
          d[r] = setTimeout(function () {
            t.delete(r);
          }, e), m && (m[r] && "nextTick" !== m[r] && clearTimeout(m[r]), m[r] = setTimeout(function () {
            delete m[r];
          }, b));
        }), t.on("delete" + h, function (e) {
          clearTimeout(d[e]), delete d[e], m && ("nextTick" !== m[e] && clearTimeout(m[e]), delete m[e]);
        }), r.preFetch && (b = !0 === r.preFetch || isNaN(r.preFetch) ? .333 : f(u(Number(r.preFetch), 1), 0)) && (m = {}, b = (1 - b) * e, t.on("get" + h, function (e, i, s) {
          m[e] || (m[e] = "nextTick", o(function () {
            var o;"nextTick" === m[e] && (delete m[e], t.delete(e), r.async && (i = n(i), i.push(l)), o = t.memoized.apply(s, i), r.promise && a(o) && ("function" == typeof o.done ? o.done(l, l) : o.then(l, l)));
          }));
        })), t.on("clear" + h, function () {
          i(d, function (e) {
            clearTimeout(e);
          }), d = {}, m && (i(m, function (e) {
            "nextTick" !== e && clearTimeout(e);
          }), m = {});
        }));
      };
    }, { "../lib/registered-extensions": 102, "es5-ext/array/from": 25, "es5-ext/object/for-each": 52, "is-promise": 91, "next-tick": 113, "timers-ext/valid-timeout": 115 }], 96: [function (e, t, r) {
      "use strict";
      var n = e("es5-ext/number/to-pos-integer"),
          i = e("lru-queue"),
          o = e("../lib/registered-extensions");o.max = function (e, t, r) {
        var a, s, c;(e = n(e)) && (s = i(e), a = r.async && o.async || r.promise && o.promise ? "async" : "", t.on("set" + a, c = function c(e) {
          void 0 !== (e = s.hit(e)) && t.delete(e);
        }), t.on("get" + a, c), t.on("delete" + a, s.delete), t.on("clear" + a, s.clear));
      };
    }, { "../lib/registered-extensions": 102, "es5-ext/number/to-pos-integer": 44, "lru-queue": 92 }], 97: [function (e, t, r) {
      "use strict";
      var n = e("es5-ext/object/map"),
          i = e("is-promise"),
          o = e("next-tick"),
          a = Object.create,
          s = Object.prototype.hasOwnProperty;e("../lib/registered-extensions").promise = function (e, t) {
        var r = a(null),
            c = a(null),
            l = a(null);t.on("set", function (n, a, s) {
          var f = !1;if (!i(s)) return c[n] = s, void t.emit("setasync", n, 1);r[n] = 1, l[n] = s;var u = function u(e) {
            var i = r[n];if (f) throw new Error("Memoizee error: Promise resolved with both failure and success, this can be result of unordered done & finally resolution.\nInstead of `promise: true` consider configuring memoization via `promise: 'then'` or `promise: 'done'");i && (delete r[n], c[n] = e, t.emit("setasync", n, i));
          },
              p = function p() {
            f = !0, r[n] && (delete r[n], delete l[n], t.delete(n));
          };"then" !== e && "function" == typeof s.done ? "done" !== e && "function" == typeof s.finally ? (s.done(u), s.finally(p)) : s.done(u, p) : s.then(function (e) {
            o(u.bind(this, e));
          }, function () {
            o(p);
          });
        }), t.on("get", function (e, n, a) {
          var s;if (r[e]) return void ++r[e];s = l[e];var c = function c() {
            t.emit("getasync", e, n, a);
          };i(s) ? "function" == typeof s.done ? s.done(c) : s.then(function () {
            o(c);
          }) : c();
        }), t.on("delete", function (e) {
          if (delete l[e], r[e]) return void delete r[e];if (s.call(c, e)) {
            var n = c[e];delete c[e], t.emit("deleteasync", e, [n]);
          }
        }), t.on("clear", function () {
          var e = c;c = a(null), r = a(null), l = a(null), t.emit("clearasync", n(e, function (e) {
            return [e];
          }));
        });
      };
    }, { "../lib/registered-extensions": 102, "es5-ext/object/map": 59, "is-promise": 91, "next-tick": 113 }], 98: [function (e, t, r) {
      "use strict";
      var n = e("d"),
          i = e("../lib/registered-extensions"),
          o = Object.create,
          a = Object.defineProperties;i.refCounter = function (e, t, r) {
        var s, c;s = o(null), c = r.async && i.async || r.promise && i.promise ? "async" : "", t.on("set" + c, function (e, t) {
          s[e] = t || 1;
        }), t.on("get" + c, function (e) {
          ++s[e];
        }), t.on("delete" + c, function (e) {
          delete s[e];
        }), t.on("clear" + c, function () {
          s = {};
        }), a(t.memoized, { deleteRef: n(function () {
            var e = t.get(arguments);return null === e ? null : s[e] ? ! --s[e] && (t.delete(e), !0) : null;
          }), getRefCount: n(function () {
            var e = t.get(arguments);return null === e ? 0 : s[e] ? s[e] : 0;
          }) });
      };
    }, { "../lib/registered-extensions": 102, d: 19 }], 99: [function (e, t, r) {
      "use strict";
      var n = e("es5-ext/object/normalize-options"),
          i = e("./lib/resolve-length"),
          o = e("./plain");t.exports = function (t) {
        var r,
            a = n(arguments[1]);return a.normalizer || 0 !== (r = a.length = i(a.length, t.length, a.async)) && (a.primitive ? !1 === r ? a.normalizer = e("./normalizers/primitive") : r > 1 && (a.normalizer = e("./normalizers/get-primitive-fixed")(r)) : a.normalizer = !1 === r ? e("./normalizers/get")() : 1 === r ? e("./normalizers/get-1")() : e("./normalizers/get-fixed")(r)), a.async && e("./ext/async"), a.promise && e("./ext/promise"), a.dispose && e("./ext/dispose"), a.maxAge && e("./ext/max-age"), a.max && e("./ext/max"), a.refCounter && e("./ext/ref-counter"), o(t, a);
      };
    }, { "./ext/async": 93, "./ext/dispose": 94, "./ext/max": 96, "./ext/max-age": 95, "./ext/promise": 97, "./ext/ref-counter": 98, "./lib/resolve-length": 103, "./normalizers/get": 110, "./normalizers/get-1": 107, "./normalizers/get-fixed": 108, "./normalizers/get-primitive-fixed": 109, "./normalizers/primitive": 111, "./plain": 112, "es5-ext/object/normalize-options": 61 }], 100: [function (e, t, r) {
      "use strict";
      var n = e("es5-ext/error/custom"),
          i = e("es5-ext/function/_define-length"),
          o = e("d"),
          a = e("event-emitter").methods,
          s = e("./resolve-resolve"),
          c = e("./resolve-normalize"),
          l = Function.prototype.apply,
          f = Function.prototype.call,
          u = Object.create,
          p = Object.prototype.hasOwnProperty,
          d = Object.defineProperties,
          h = a.on,
          b = a.emit;t.exports = function (e, t, r) {
        var a,
            m,
            v,
            g,
            x,
            y,
            _,
            j,
            w,
            O,
            k,
            S,
            C,
            P,
            N,
            z = u(null);return m = !1 !== t ? t : isNaN(e.length) ? 1 : e.length, r.normalizer && (O = c(r.normalizer), v = O.get, g = O.set, x = O.delete, y = O.clear), null != r.resolvers && (N = s(r.resolvers)), P = v ? i(function (t) {
          var r,
              i,
              o = arguments;if (N && (o = N(o)), null !== (r = v(o)) && p.call(z, r)) return k && a.emit("get", r, o, this), z[r];if (i = 1 === o.length ? f.call(e, this, o[0]) : l.call(e, this, o), null === r) {
            if (null !== (r = v(o))) throw n("Circular invocation", "CIRCULAR_INVOCATION");r = g(o);
          } else if (p.call(z, r)) throw n("Circular invocation", "CIRCULAR_INVOCATION");return z[r] = i, S && a.emit("set", r, null, i), i;
        }, m) : 0 === t ? function () {
          var t;if (p.call(z, "data")) return k && a.emit("get", "data", arguments, this), z.data;if (t = arguments.length ? l.call(e, this, arguments) : f.call(e, this), p.call(z, "data")) throw n("Circular invocation", "CIRCULAR_INVOCATION");return z.data = t, S && a.emit("set", "data", null, t), t;
        } : function (t) {
          var r,
              i,
              o = arguments;if (N && (o = N(arguments)), i = String(o[0]), p.call(z, i)) return k && a.emit("get", i, o, this), z[i];if (r = 1 === o.length ? f.call(e, this, o[0]) : l.call(e, this, o), p.call(z, i)) throw n("Circular invocation", "CIRCULAR_INVOCATION");return z[i] = r, S && a.emit("set", i, null, r), r;
        }, a = { original: e, memoized: P, get: function get(e) {
            return N && (e = N(e)), v ? v(e) : String(e[0]);
          }, has: function has(e) {
            return p.call(z, e);
          }, delete: function _delete(e) {
            var t;p.call(z, e) && (x && x(e), t = z[e], delete z[e], C && a.emit("delete", e, t));
          }, clear: function clear() {
            var e = z;y && y(), z = u(null), a.emit("clear", e);
          }, on: function on(e, t) {
            return "get" === e ? k = !0 : "set" === e ? S = !0 : "delete" === e && (C = !0), h.call(this, e, t);
          }, emit: b, updateEnv: function updateEnv() {
            e = a.original;
          } }, _ = v ? i(function (e) {
          var t,
              r = arguments;N && (r = N(r)), null !== (t = v(r)) && a.delete(t);
        }, m) : 0 === t ? function () {
          return a.delete("data");
        } : function (e) {
          return N && (e = N(arguments)[0]), a.delete(e);
        }, j = i(function () {
          var e,
              t = arguments;return N && (t = N(t)), e = v(t), z[e];
        }), w = i(function () {
          var e,
              t = arguments;return N && (t = N(t)), null !== (e = v(t)) && a.has(e);
        }), d(P, { __memoized__: o(!0), delete: o(_), clear: o(a.clear), _get: o(j), _has: o(w) }), a;
      };
    }, { "./resolve-normalize": 104, "./resolve-resolve": 105, d: 19, "es5-ext/error/custom": 29, "es5-ext/function/_define-length": 31, "event-emitter": 90 }], 101: [function (e, t, r) {
      "use strict";
      var n = e("es5-ext/object/for-each"),
          i = e("es5-ext/object/normalize-options"),
          o = e("es5-ext/object/valid-callable"),
          a = e("d/lazy"),
          s = e("./resolve-length"),
          c = e("./registered-extensions");t.exports = function (e) {
        return function (t) {
          return n(t, function (t, r) {
            var n,
                a = o(t.value);t.value = function (t) {
              return t.getNormalizer && (t = i(t), void 0 === n && (n = s(t.length, a.length, t.async && c.async)), t.normalizer = t.getNormalizer(n), delete t.getNormalizer), e(a.bind(this), t);
            };
          }), a(t);
        };
      };
    }, { "./registered-extensions": 102, "./resolve-length": 103, "d/lazy": 20, "es5-ext/object/for-each": 52, "es5-ext/object/normalize-options": 61, "es5-ext/object/valid-callable": 66 }], 102: [function (e, t, r) {
      "use strict";
    }, {}], 103: [function (e, t, r) {
      "use strict";
      var n = e("es5-ext/number/to-pos-integer");t.exports = function (e, t, r) {
        var i;return isNaN(e) ? (i = t, i >= 0 ? r && i ? i - 1 : i : 1) : !1 !== e && n(e);
      };
    }, { "es5-ext/number/to-pos-integer": 44 }], 104: [function (e, t, r) {
      "use strict";
      var n = e("es5-ext/object/valid-callable");t.exports = function (e) {
        var t;return "function" == typeof e ? { set: e, get: e } : (t = { get: n(e.get) }, void 0 !== e.set ? (t.set = n(e.set), e.delete && (t.delete = n(e.delete)), e.clear && (t.clear = n(e.clear)), t) : (t.set = t.get, t));
      };
    }, { "es5-ext/object/valid-callable": 66 }], 105: [function (e, t, r) {
      "use strict";
      var n,
          i = e("es5-ext/array/to-array"),
          o = e("es5-ext/object/valid-callable"),
          a = Array.prototype.slice;n = function n(e) {
        return this.map(function (t, r) {
          return t ? t(e[r]) : e[r];
        }).concat(a.call(e, this.length));
      }, t.exports = function (e) {
        return e = i(e), e.forEach(function (e) {
          null != e && o(e);
        }), n.bind(e);
      };
    }, { "es5-ext/array/to-array": 28, "es5-ext/object/valid-callable": 66 }], 106: [function (e, t, r) {
      "use strict";
      t.exports = e("./lib/methods")(e("./"));
    }, { "./": 99, "./lib/methods": 101 }], 107: [function (e, t, r) {
      "use strict";
      var n = e("es5-ext/array/#/e-index-of");t.exports = function () {
        var e = 0,
            t = [],
            r = [];return { get: function get(e) {
            var i = n.call(t, e[0]);return -1 === i ? null : r[i];
          }, set: function set(n) {
            return t.push(n[0]), r.push(++e), e;
          }, delete: function _delete(e) {
            var i = n.call(r, e);-1 !== i && (t.splice(i, 1), r.splice(i, 1));
          }, clear: function clear() {
            t = [], r = [];
          } };
      };
    }, { "es5-ext/array/#/e-index-of": 22 }], 108: [function (e, t, r) {
      "use strict";
      var n = e("es5-ext/array/#/e-index-of"),
          i = Object.create;t.exports = function (e) {
        var t = 0,
            r = [[], []],
            o = i(null);return { get: function get(t) {
            for (var i, o = 0, a = r; o < e - 1;) {
              if (-1 === (i = n.call(a[0], t[o]))) return null;a = a[1][i], ++o;
            }return i = n.call(a[0], t[o]), -1 === i ? null : a[1][i] || null;
          }, set: function set(i) {
            for (var a, s = 0, c = r; s < e - 1;) {
              a = n.call(c[0], i[s]), -1 === a && (a = c[0].push(i[s]) - 1, c[1].push([[], []])), c = c[1][a], ++s;
            }return a = n.call(c[0], i[s]), -1 === a && (a = c[0].push(i[s]) - 1), c[1][a] = ++t, o[t] = i, t;
          }, delete: function _delete(t) {
            for (var i, a = 0, s = r, c = [], l = o[t]; a < e - 1;) {
              if (-1 === (i = n.call(s[0], l[a]))) return;c.push(s, i), s = s[1][i], ++a;
            }if (-1 !== (i = n.call(s[0], l[a]))) {
              for (t = s[1][i], s[0].splice(i, 1), s[1].splice(i, 1); !s[0].length && c.length;) {
                i = c.pop(), s = c.pop(), s[0].splice(i, 1), s[1].splice(i, 1);
              }delete o[t];
            }
          }, clear: function clear() {
            r = [[], []], o = i(null);
          } };
      };
    }, { "es5-ext/array/#/e-index-of": 22 }], 109: [function (e, t, r) {
      "use strict";
      t.exports = function (e) {
        return e ? function (t) {
          for (var r = String(t[0]), n = 0, i = e; --i;) {
            r += "" + t[++n];
          }return r;
        } : function () {
          return "";
        };
      };
    }, {}], 110: [function (e, t, r) {
      "use strict";
      var n = e("es5-ext/array/#/e-index-of"),
          i = Object.create;t.exports = function () {
        var e = 0,
            t = [],
            r = i(null);return { get: function get(e) {
            var r,
                i = 0,
                o = t,
                a = e.length;if (0 === a) return o[a] || null;if (o = o[a]) {
              for (; i < a - 1;) {
                if (-1 === (r = n.call(o[0], e[i]))) return null;o = o[1][r], ++i;
              }return r = n.call(o[0], e[i]), -1 === r ? null : o[1][r] || null;
            }return null;
          }, set: function set(i) {
            var o,
                a = 0,
                s = t,
                c = i.length;if (0 === c) s[c] = ++e;else {
              for (s[c] || (s[c] = [[], []]), s = s[c]; a < c - 1;) {
                o = n.call(s[0], i[a]), -1 === o && (o = s[0].push(i[a]) - 1, s[1].push([[], []])), s = s[1][o], ++a;
              }o = n.call(s[0], i[a]), -1 === o && (o = s[0].push(i[a]) - 1), s[1][o] = ++e;
            }return r[e] = i, e;
          }, delete: function _delete(e) {
            var i,
                o = 0,
                a = t,
                s = r[e],
                c = s.length,
                l = [];if (0 === c) delete a[c];else if (a = a[c]) {
              for (; o < c - 1;) {
                if (-1 === (i = n.call(a[0], s[o]))) return;l.push(a, i), a = a[1][i], ++o;
              }if (-1 === (i = n.call(a[0], s[o]))) return;for (e = a[1][i], a[0].splice(i, 1), a[1].splice(i, 1); !a[0].length && l.length;) {
                i = l.pop(), a = l.pop(), a[0].splice(i, 1), a[1].splice(i, 1);
              }
            }delete r[e];
          }, clear: function clear() {
            t = [], r = i(null);
          } };
      };
    }, { "es5-ext/array/#/e-index-of": 22 }], 111: [function (e, t, r) {
      "use strict";
      t.exports = function (e) {
        var t,
            r,
            n = e.length;if (!n) return "";for (t = String(e[r = 0]); --n;) {
          t += "" + e[++r];
        }return t;
      };
    }, {}], 112: [function (e, t, r) {
      "use strict";
      var n = e("es5-ext/object/valid-callable"),
          i = e("es5-ext/object/for-each"),
          o = e("./lib/registered-extensions"),
          a = e("./lib/configure-map"),
          s = e("./lib/resolve-length"),
          c = Object.prototype.hasOwnProperty;t.exports = function e(t) {
        var r, l, f;if (n(t), r = Object(arguments[1]), r.async && r.promise) throw new Error("Options 'async' and 'promise' cannot be used together");return c.call(t, "__memoized__") && !r.force ? t : (l = s(r.length, t.length, r.async && o.async), f = a(t, l, r), i(o, function (e, t) {
          r[t] && e(r[t], f, r);
        }), e.__profiler__ && e.__profiler__(f), f.updateEnv(), f.memoized);
      };
    }, { "./lib/configure-map": 100, "./lib/registered-extensions": 102, "./lib/resolve-length": 103, "es5-ext/object/for-each": 52, "es5-ext/object/valid-callable": 66 }], 113: [function (e, t, r) {
      "use strict";
      var n, i;n = function n(e) {
        if ("function" != typeof e) throw new TypeError(e + " is not a function");return e;
      }, i = function i(e) {
        var t,
            r,
            i = document.createTextNode(""),
            o = 0;return new e(function () {
          var e;if (t) r && (t = r.concat(t));else {
            if (!r) return;t = r;
          }if (r = t, t = null, "function" == typeof r) return e = r, r = null, void e();for (i.data = o = ++o % 2; r;) {
            e = r.shift(), r.length || (r = null), e();
          }
        }).observe(i, { characterData: !0 }), function (e) {
          if (n(e), t) return void ("function" == typeof t ? t = [t, e] : t.push(e));t = e, i.data = o = ++o % 2;
        };
      }, t.exports = function () {
        if ("object" == (typeof process === "undefined" ? "undefined" : _typeof(process)) && process && "function" == typeof process.nextTick) return process.nextTick;if ("object" == (typeof document === "undefined" ? "undefined" : _typeof(document)) && document) {
          if ("function" == typeof MutationObserver) return i(MutationObserver);if ("function" == typeof WebKitMutationObserver) return i(WebKitMutationObserver);
        }return "function" == typeof setImmediate ? function (e) {
          setImmediate(n(e));
        } : "function" == typeof setTimeout || "object" == (typeof setTimeout === "undefined" ? "undefined" : _typeof(setTimeout)) ? function (e) {
          setTimeout(n(e), 0);
        } : null;
      }();
    }, {}], 114: [function (e, t, r) {
      "use strict";
      t.exports = 2147483647;
    }, {}], 115: [function (e, t, r) {
      "use strict";
      var n = e("es5-ext/number/to-pos-integer"),
          i = e("./max-timeout");t.exports = function (e) {
        if ((e = n(e)) > i) throw new TypeError(e + " exceeds maximum possible timeout");return e;
      };
    }, { "./max-timeout": 114, "es5-ext/number/to-pos-integer": 44 }], 116: [function (e, t, r) {
      "use strict";
      function n(e, t) {
        return i && t ? i[t](e) : e;
      }var i = e("cli-color");t.exports = n;
    }, { "cli-color": 8 }], 117: [function (e, t, r) {
      "use strict";
      function n(e) {}function i(e) {
        var t = e.split(/\D+/).filter(function (e) {
          return e;
        });return n("  parsed positioning string: " + t.toString()), { lineno: /\d+/.exec(t[0])[0], colno: /\d+/.exec(t[1])[0] };
      }function o(e) {
        e = l(e);var t = e.split("\n");n(" === cwd directories === ");var r = [];process && process.version && a && (r = a.readdirSync(process.cwd()).filter(function (e) {
          return a.lstatSync(e).isDirectory();
        })), n(r), n(" === "), n(" === urls === ");for (var o, c = [], f = e, u = /[\S]*\.[a-zA-Z]+/g, p = /[(]?\s{0,5}\d+\s{0,5}?\D{1,20}\s{0,5}?\d+\s{0,5}[)]?/g; o = u.exec(e);) {
          var d = 0,
              h = e.length - f.length + f.indexOf(o[0]),
              b = e.substring(0, h).split("\n").length - 1,
              m = t[b];f = e.substring(h + o[0].length), -1 !== m.toLowerCase().indexOf("node_modules") && (d -= 1.5), -1 !== m.toLowerCase().indexOf("npm") && (d -= .1), -1 !== m.toLowerCase().indexOf("Npm") && (d -= .25), -1 !== m.toLowerCase().indexOf("NPM") && (d -= .75), -1 !== m.toLowerCase().indexOf("error") && (d += 1), -1 !== m.toLowerCase().indexOf("fail") && (d += .49), -1 !== m.indexOf("Error") && (d += .5), p.test(m.toLowerCase()) && (d += .5);var v = t[b - 1];"string" == typeof v && (-1 !== v.toLowerCase().indexOf("error") && (d += .5), p.test(v.toLowerCase()) && (d += .05));var g = t[b + 1];"string" == typeof g && (-1 !== g.toLowerCase().indexOf("error") && (d += .25), p.test(g.toLowerCase()) && (d += .35)), n(" url found: " + o[0] + ", weight: " + d), n("  line: " + m), c.push({ weight: d, line: m, lineNumber: b, match: o[0] }), c.push({ weight: d - .1, line: m, lineNumber: b, match: "../" + o[0] }), c.push({ weight: d - .15, line: m, lineNumber: b, match: "../../" + o[0] }), r.forEach(function (e) {
            c.push({ weight: d - .2, line: m, lineNumber: b, match: e + "/" + o[0] });
          });
        }n("sorting urls by weight"), c = c.sort(function (e, t) {
          return t.weight - e.weight;
        });for (var x, y, _ = 0; _ < c.length; _++) {
          var j = c[_],
              w = s.resolve(j.match);if (a.existsSync(w)) {
            y = w, x = j, n(" >> deciding line: " + j.line);break;
          }
        }if (!x) return n("no url matches"), !1;if (x.weight <= 0) return n(" >>>>> url match weight at or below 0 -- consider as no error found"), !1;n("   > most likely source URL: " + x.match), n(" === positions === ");var O = [],
            p = /[(]?\s{0,5}\d+\s{0,5}?\D{1,20}\s{0,5}?\d+\s{0,5}[)]?/g;for (f = e; o = p.exec(e);) {
          var d = 0,
              h = e.length - f.length + f.indexOf(o[0]),
              b = e.substring(0, h).split("\n").length - 1,
              m = t[b],
              k = m.split(/\s+/),
              S = k.filter(function (e) {
            return -1 !== e.indexOf(o[0]);
          })[0];f = e.substring(h + o[0].length), n(" position word boundary: " + S + ", match: " + o[0]), S && -1 !== S.indexOf("/") && (d -= 1), -1 !== m.toLowerCase().indexOf("node_modules") && (d -= 1), -1 !== m.toLowerCase().indexOf("npm") && (d -= .5), -1 !== m.toLowerCase().indexOf("error") && (d += 1), -1 !== m.toLowerCase().indexOf("fail") && (d += 1), -1 !== m.indexOf("Error") && (d += 1), m.toLowerCase().match(/[a-z]/) && (d -= .1);var v = t[b - 1];"string" == typeof v && -1 !== v.toLowerCase().indexOf("error") && (d += .5);var g = t[b + 1];"string" == typeof g && -1 !== g.toLowerCase().indexOf("error") && (d += .25), -1 !== m.indexOf(x.match) && d++, n(" position found: " + o[0] + ", weight: " + d), n("  line: " + m), O.push({ line: m, weight: d, lineNumber: b, match: o[0] });
        }if (O.length < 1 && (n("no positional matches, trying special cases"), x)) try {
          var m = t.slice(x.lineNumber - 1).filter(function (e) {
            return e.indexOf("^") >= 0;
          })[0],
              b = x.line.split(":")[1].replace(/\D/g, ""),
              C = m.indexOf("^");O.push({ line: m, weight: 999, lineNumber: b, match: "(" + b + ":" + C + ")" }), n("special case positioning found: " + O[0].match);
        } catch (e) {
          n("no special case positioning found.");
        }if (O.length < 1) return n("still no positional matches, even after checking special cases"), !1;n("sorting positions");var P = O.sort(function (e, t) {
          return t.weight - e.weight;
        });if (P[0].weight <= 0) return n(" >>>>> pos match weight at or below 0 -- consider as no error found"), !1;var N = P[0].match;n("pos bestMatch: " + N);var z;t.forEach(function (e) {
          e.indexOf("Error") >= 0 && (z = e);
        }), z || t.forEach(function (e) {
          e.toLowerCase().indexOf("unexpected") >= 0 && (z = e), e.toLowerCase().indexOf("failed") >= 0 && (z = e);
        }), z || (z = "[ Unknown Error ]"), n("   > most likely error description: " + z);var E = i(N);return { message: z, url: x, path: y, lineno: E.lineno, colno: E.colno };
      }var a, s;try {
        var c = e;a = c("fs"), s = c("path"), !0;
      } catch (e) {
        !1;
      }var l = e("./remove-context-from-text.js");t.exports = o;
    }, { "./remove-context-from-text.js": 120 }], 118: [function (e, t, r) {
      "use strict";
      function n(e) {
        var t = e.text,
            r = t.split("\n"),
            n = r,
            a = e.lineno,
            s = e.colno,
            c = Math.max(0, a - 6),
            l = Math.min(n.length - 1, c + 4 + 2 + 2);if (e.prettify) {
          var f = Math.max(0, c - 3),
              u = Math.min(n.length, l + 1),
              p = n.slice(f, u),
              d = p.join("\n"),
              h = e.url || e.path || e.filename || e.filepath;i(d, h).split("\n").forEach(function (e, t) {
            n[f + t] = e;
          });
        }for (var b = String(l).trim().length, m = []; c < l; c++) {
          for (var v = String(c + 1).trim(), g = n[c], x = c === a - 1; v.length < b;) {
            v = " " + v;
          }x ? (e.prettify && (v = o(v, "whiteBright")), v = e.prettify ? o("> ", "redBright") + v : "> " + v) : (e.prettify && (v = o(v, "blackBright")), v = "  " + v);var y = v + " | " + g;if (m.push(y), x) {
            for (var _ = "", j = 0; j < s; j++) {
              _ += " ";
            }var w = String(l).trim().split(/./).join(" ") + "   | ";e.prettify ? m.push(w + _ + o("^", "redBright")) : m.push(w + _ + "^");
          }
        }return m;
      }var i = e("./prettify-text.js"),
          o = e("./colorify.js");t.exports = n;
    }, { "./colorify.js": 116, "./prettify-text.js": 119 }], 119: [function (e, t, r) {
      "use strict";
      function n(e) {
        return e.replace(l, "");
      }function i(e, t) {
        var r = o,
            i = t.split(".");s(i[i.length - 1], ["less/i", "styl/i", "sass/i", "scss/i", "css/i"]) && (r = a), e = n(e);var l = "whiteBright",
            f = "normal",
            u = [],
            p = e.split("\n");if (p.forEach(function (e) {
          var t,
              n,
              i = "",
              o = "";for (t = 0; t < e.length; t++) {
            switch (n = e[t], f) {case "normal":
                switch (n) {case "'":case '"':
                    i += r(o, l), o = "", f = "quotes", l = "green", o += n;break;case "{":case "}":case "<":case ">":case "+":case "-":case "*":case "%":case "=":case ";":case ":":case ".":case ",":case "?":case "!":
                    i += r(o, l), o = "", i += r(n, "yellow");break;case "/":
                    if (t + 1 < e.length) {
                      var a = e[t + 1];switch (a) {case "/":
                          i += r(o, l), o = "", i += c(e.slice(t), "blackBright"), t = e.length;break;case "*":
                          i += r(o, l), o = "", f = "commentstar", l = "blackBright", o += n;break;default:
                          i += r(o, l), o = "", i += r(n, "yellow");}
                    } else i += r(o, l), o = "", i += r(n, "yellow");break;case "(":case ")":
                    i += r(o, l), o = "", i += r(n, "white");break;case " ":
                    o += n, i += r(o, l), o = "";break;default:
                    o += n;}break;case "quotes":
                switch (n) {case "'":case '"':
                    o += n, i += r(o, l), o = "", f = "normal", l = "whiteBright";break;default:
                    o += n;}break;case "commentstar":
                switch (n) {case "*":
                    if (t + 1 < e.length) {
                      var a = e[t + 1];if ("/" === a) {
                        o += n, o += a, t += 1, i += r(o, "blackBright"), o = "", f = "normal", l = "whiteBright";break;
                      }
                    }default:
                    o += n;}break;default:
                throw new Error("prettify-text.js error");}
          }i += r(o, l), o = "", u.push(i);
        }), u.length !== p.length) throw new Error("prettyfying resulted in different number of output lines");return u.join("\n");
      }function o(e, t) {
        return s(e, ["function", "atob", "btoa", "decodeURI", "decodeURIComponent", "encodeURI", "encodeURIComponent", "document"], "ts") ? c(e, "cyan") : s(e, ["return", "var", "new", "do", "void", "if", "else", "break", "catch", "instanceof", "with", "throw", "case", "default", "try", "this", "switch", "continue", "typeof", "delete", "let", "yield", "const", "export", "super", "debugger", "as", "async", "await", "static", "import", "from", "arguments", "window"], "ts") ? c(e, "redBright") : s(e, ["true", "false", "null", "undefined"], "ts") ? c(e, "magentaBright") : s(e, ["Date", "Object", "Function", "Number", "Math", "String", "RegExp", "Array", "Boolean"], "ts") ? c(e, "yellow") : c(e, t);
      }function a(e, t) {
        return s(e, ["align-content", "align-items", "align-self", "all", "animation", "animation-delay", "animation-direction", "animation-duration", "animation-fill-mode", "animation-iteration-count", "animation-name", "animation-play-state", "animation-timing-function", "backface-visibility", "background", "background-attachment", "background-blend-mode", "background-clip", "background-color", "background-image", "background-origin", "background-position", "background-repeat", "background-size", "border", "border-bottom", "border-bottom-color", "border-bottom-left-radius", "border-bottom-right-radius", "border-bottom-style", "border-bottom-width", "border-collapse", "border-color", "border-image", "border-image-outset", "border-image-repeat", "border-image-slice", "border-image-source", "border-image-width", "border-left", "border-left-color", "border-left-style", "border-left-width", "border-radius", "border-right", "border-right-color", "border-right-style", "border-right-width", "border-spacing", "border-style", "border-top", "border-top-color", "border-top-left-radius", "border-top-right-radius", "border-top-style", "border-top-width", "border-width", "bottom", "box-shadow", "box-sizing", "caption-side", "clear", "clip", "color", "column-count", "column-fill", "column-gap", "column-rule", "column-rule-color", "column-rule-style", "column-rule-width", "column-span", "column-width", "columns", "content", "counter-increment", "counter-reset", "cursor", "direction", "display", "empty-cells", "filter", "flex", "flex-basis", "flex-direction", "flex-flow", "flex-grow", "flex-shrink", "flex-wrap", "float", "font", "@font-face", "font-family", "font-size", "font-size-adjust", "font-stretch", "font-style", "font-variant", "font-weight", "hanging-punctuation", "height", "justify-content", "@keyframes", "left", "letter-spacing", "line-height", "list-style", "list-style-image", "list-style-position", "list-style-type", "margin", "margin-bottom", "margin-left", "margin-right", "margin-top", "max-height", "max-width", "@media", "min-height", "min-width", "nav-down", "nav-index", "nav-left", "nav-right", "nav-up", "opacity", "order", "outline", "outline-color", "outline-offset", "outline-style", "outline-width", "overflow", "overflow-x", "overflow-y", "padding", "padding-bottom", "padding-left", "padding-right", "padding-top", "page-break-after", "page-break-before", "page-break-inside", "perspective", "perspective-origin", "position", "quotes", "resize", "right", "tab-size", "table-layout", "text-align", "text-align-last", "text-decoration", "text-decoration-color", "text-decoration-line", "text-decoration-style", "text-indent", "text-justify", "text-overflow", "text-shadow", "text-transform", "top", "transform", "transform-origin", "transform-style", "transition", "transition-delay", "transition-duration", "transition-property", "transition-timing-function", "unicode-bidi", "user-select", "vertical-align", "visibility", "white-space", "width", "word-break", "word-spacing", "word-wrap", "z-index"]) ? c(e, "cyan") : s(e, ["html", "head", "meta", "link", "title", "base", "body", "style", "nav", "header", "footer", "main", "aside", "article", "section", "h1", "h2", "h3", "h4", "h5", "h6", "hgroup", "div", "p", "pre", "blockquote", "hr", "ul", "ol", "li", "dl", "dt", "dd", "span", "a", "em", "strong", "b", "i", "u", "s", "mark", "small", "del", "ins", "sup", "sub", "dfn", "code", "var", "samp", "kbd", "q", "cite", "ruby", "rt", "rp", "br", "wbr", "bdo", "bdi", "table", "caption", "tr", "td", "th", "thead", "tfoot", "tbody", "colgroup", "col", "img", "figure", "figcaption", "map", "area", "video", "audio", "source", "track", "script", "noscript", "object", "param", "embed", "iframe", "canvas", "abbr", "address", "meter", "progress", "time", "form", "button", "input", "textarea", "select", "option", "optgroup", "label", "fieldset", "legend", "keygen", "command", "datalist", "menu", "output", "details", "summary"], "ts") ? c(e, "redBright") : s(e, ["sans-serif", "monospace", "Times", "serif", "Arial", "Helvetica", "Impact", "Charcoal", "Tahoma", "Geneva", "Trebuchet", "Verdana", "table-caption", "table-column", "table-column-group", "line-through", "bidi-override", "inline-block", "inline", "open-quote", "close-quote", "normal", "smaller", "super", "sub", "separate", "table-row-group", "table-footer-group", "table-header-group", "table-cell", "table-row", "middle", "inherit", "block", "default", "inset", "disc", "decimal", "absolute", "none", "hidden", "bold", "italic", "underline", "auto", "center", "pre", "0"], "s") ? c(e, "magentaBright") : "." === e.trim()[0] ? c(e, "greenBright") : "#" === e.trim()[0] ? c(e, "yellowBright") : c(e, t);
      }function s(e, t, r) {
        "string" == typeof t && (t = [t]);var n, i, o, a, s, c, l;e: for (n = 0; n < t.length; n++) {
          for (i = t[n], c = e, a = i.split("/"), o = a[0], s = a[1] || "", r && (s += r), l = 0; l < s.length; l++) {
            var f = s[l];switch (f) {case "i":
                o = o.toLowerCase(), c = c.toLowerCase();break;case "t":
                o = o.trim(), c = c.trim();break;case "s":
                if (c.length !== o.length) continue e;}
          }if (c.indexOf(o) >= 0) return !0;
        }return !1;
      }var c = e("./colorify.js"),
          l = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-PRZcf-nqry=><]/g;t.exports = i;
    }, { "./colorify.js": 116 }], 120: [function (e, t, r) {
      "use strict";
      function n(e) {
        var t = e.split("\n").map(function (e) {
          return { text: e };
        });t.forEach(function (e) {
          var t,
              r = e.text,
              n = r.substring(0, 10),
              i = /\s{0,5}\d+\s{1,2}[|:]?\s{0,5}/,
              t = i.exec(n);t && t[0] && (e.possibleSnippet = !0);
        });for (var r = 0; r < t.length; r++) {
          var n = t[r - 1] || void 0,
              i = t[r],
              o = t[r + 1] || void 0;i.possibleSnippet && (n && n.possibleSnippet && (t[r].detectedSnippet = !0), o && o.possibleSnippet && (t[r].detectedSnippet = !0));
        }return t.filter(function (e) {
          return !e.detectedSnippet;
        }).map(function (e) {
          return e.text;
        }).join("\n");
      }t.exports = n;
    }, {}], 121: [function (e, t, r) {
      "use strict";
      function n(e, t) {
        t = t || 3;var r = e.split(/\s+/);return r = r.map(function (e) {
          if (e.indexOf(".") >= 0 || e.indexOf("/") >= 0) {
            var r = e.split("/"),
                n = r.pop(),
                i = "";return r.forEach(function (e) {
              if (e) {
                var r,
                    n = t;for (t > e.length && (n = e.length), r = 0; r < n; r++) {
                  i += e[r];
                }i += "/";
              }
            }), i += n;
          }return e;
        }), r.join(" ");
      }t.exports = n;
    }, {}], 122: [function (e, t, r) {
      "use strict";
      function n(e) {}function i(e, t) {
        if (s) {
          t || (t = function t(e) {
            return e;
          });for (var r, i = [], c = /[\S]*\.[a-zA-Z]+/g; r = c.exec(e);) {
            i.push({ match: r[0], absolutePath: a.resolve(r[0]) });
          }return i = i.filter(function (e) {
            try {
              return o.existsSync(e.absolutePath);
            } catch (e) {
              return !1;
            }
          }), i.forEach(function (r) {
            n("trans match: " + r.match);var i = "./" + a.relative(process.cwd(), r.absolutePath);n("trans relpath: " + i), e = e.split(r.match).join(t(" " + i));
          }), e.split(/\s+/).join(" ");
        }throw new Error(" NOT IN NODE JS ================== ");
      }var o,
          a,
          s = !1;try {
        var c = e;o = c("fs"), a = c("path"), s = !0;
      } catch (e) {
        s = !1;
      }e("./colorify.js");t.exports = i;
    }, { "./colorify.js": 116 }], 123: [function (e, t, r) {
      "use strict";
      function n(e) {}function i(e) {
        return e.replace(f, "");
      }function o(e, t) {
        if (!c) throw new Error("This function cannot be run in the Browser.");var r = { prettify: !0, relative: !0, shorten: !0 },
            o = e,
            l = o;e = i(e), n(" === text === "), n(e), n(" === ==== === ");var f = p(e);if (f) {
          n("match: " + f.url.match), n("resolved match: " + s.resolve(f.url.match)), n("path: " + f.path), n("pos: " + f.lineno + ":" + f.colno);var b = f.path || s.resolve(f.url.match),
              v = m({ filename: b, prettify: r.prettify, text: a.readFileSync(b, { encoding: "utf8" }), lineno: f.lineno, colno: f.colno }),
              g = v.join("\n"),
              x = f.message || "[ Unknown Error ]";if (r.prettify) {
            var y = 0,
                _ = " ";x.split(/\s+/).forEach(function (e) {
              var t = e,
                  n = t.toLowerCase();-1 !== n.indexOf("error") && (e = u(t, "red")), -1 === n.indexOf("/") && -1 === n.indexOf(".") || (r.relative && (e = d(t, function (e) {
                return r.prettify ? u(e, "magentaBright") : e;
              })), r.shorten && (e = h(e))), _ += e.trim(), y += t.length, y > 70 && (y = 0, _ += "\n "), _ += " ";
            }), x = " " + _.trim();
          }if (r.prettify) var _ = [u(">> wooster output <<", "blackBright"), x, "", " @ " + d(b, function (e) {
            return u(e, "magentaBright");
          }) + " " + u(f.lineno, "redBright") + ":" + u(f.colno, "redBright")].join("\n");_ += "\n" + g, n(_), l = _;
        } else l = o;return "function" == typeof t && t(l), l;
      }var a,
          s,
          c = !1;try {
        var l = e;a = l("fs"), s = l("path"), c = !0;
      } catch (e) {
        c = !1;
      }var f = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-PRZcf-nqry=><]/g,
          u = e("./colorify.js"),
          p = e("./find-error.js"),
          d = e("./transform-to-relative-paths.js"),
          h = e("./shorten-urls.js"),
          b = e("./prettify-text.js"),
          m = e("./parse-context.js");o.prettifyText = b, o.parseContext = m, o.shortenUrls = h, o.colorify = u, t.exports = o;
    }, { "./colorify.js": 116, "./find-error.js": 117, "./parse-context.js": 118, "./prettify-text.js": 119, "./shorten-urls.js": 121, "./transform-to-relative-paths.js": 122 }] }, {}, [123])(123);
});

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"_process":44}]},{},[2]);
