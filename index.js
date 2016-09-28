var chokidar = require('chokidar')
var express = require('express')
var cp = require('child_process')

var parseArgs = require('minimist')

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

var split = args[0].split(':')

var config = {
  target: split[0],
  cmd: split[1]
}

console.log(config)
