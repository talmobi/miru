(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var _module = require('./mods/module.js');

console.log('app: ' + (0, _module.greet)('giraffe'));

var root = document.getElementById('root');
root.innerHTML = new Date().toLocaleString();

var colors = ['salmon', 'tomato', 'magenta', 'goldenrod', 'burlywood', 'blanchedalmond', 'cornflowerblue', 'darkolivegreen', 'darkseagreen', 'indianred', 'hotpink', 'honeydew', 'lightblue', 'olive', 'orchid', 'peru', 'plum', 'oldlace', 'rosybrown', 'sienna', 'sandybrown', 'snow', 'thistle'];

// colors = ['yellow']

function tick() {
  root.innerHTML = new Date().toLocaleString();
  setTimeout(tick, 100);
}

function flash() {
  root.style['background-color'] = colors[Math.random() * colors.length | 0];
  setTimeout(flash, 500);
}

tick();
flash();

},{"./mods/module.js":2}],2:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.greet = greet;
function greet(name) {
  return 'hello, ' + name;
}

},{}]},{},[1]);
