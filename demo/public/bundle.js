(function () {
'use strict';

var module$1 = 'module'

console.log('app: ' + module$1)

var root = document.getElementById('root')
root.innerHTML = new Date().toLocaleString()


var colors = [
  'salmon', 'tomato', 'magenta',
  'goldenrod', 'burlywood', 'blanchedalmond',
  'cornflowerblue', 'darkolivegreen', 'darkseagreen',
  'indianred', 'hotpink', 'honeydew', 'lightblue',
  'olive', 'orchid', 'peru', 'plum', 'oldlace',
  'rosybrown', 'sienna', 'sandybrown', 'snow', 'thistle'
]

colors = ['yellow']

function tick () {
  root.innerHTML = new Date().toLocaleString()
  setTimeout(tick, 100)
}

function flash () {
  root.style['background-color'] = colors[Math.random() * colors.length | 0]
  setTimeout(flash, 500)
}

setTimeout(tick, 100)
setTimeout(flash, 100)

}());
