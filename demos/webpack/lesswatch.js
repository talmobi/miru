var pw = require('../../../../code/poll-watch/index.js')

var glob = require('glob-fs')({ gitignore: true })

var files = glob.readdirSync('styles/**/*.less')

var snippet = require('./snippet.js')

files.forEach(function (file) {
  // console.log('watching file: ' + file)
  var w = pw.watch(file)
  w.on(function (data) {
    console.log('modified: ' + data.path)
    trigger()
  })
})

var childProcess = require('child_process')

var _timeout
function trigger () {
  clearTimeout(_timeout)
  _timeout = setTimeout(function () {
    // console.log(' -- TRIGGERED -- ')
    childProcess.exec('lessc styles/app.less public/bundle.css', function (err, stdout, stderr) {
      if (err) {
        console.error('exec error: ')
        console.error(String(err))
        snippet(String(err))
        // process.stderr.write(err)
      } else {
        stdout && console.log('exec stdout: ' + stdout)
        stderr && console.log('exec stderr: ' + stderr) || console.log('success')
      }
    })
  }, 33)
}

// trigger initially
trigger()
