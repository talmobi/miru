'use strict'

var fs = require( 'fs' )
var path = require( 'path' )
var childProcess = require( 'child_process' )
var spawns = [] // keep track of all spawns

var faviconBase64 = Buffer.from( require( './favicon.json' ).base64, 'base64' )

// var useragent = require( 'useragent' )
var useragent = {
  parse: require( 'ua-parser-js' )
}

// var pino = require( 'pino' )()

/*
 * miteru is a simplified basic file watcher with an API similar to chokidar.
 *
 * miteru uses a hot and cold file polling system optimized to fit
 * development workflow for super fast and consistent file watch events.
 *
 * Intended for fast and consistent file events.
 */
var miteru = require( 'miteru' )
// miteru = require( '../../../miteru/src/index.js' )

/*
 *  wooster tries to find the source file of the error,
 *  get its context and prettify the information into
 *  a consice, easy to understand text output.
 *
 *  If it fails the output text is left unchanged from the
 *  original input text.
 */
var wooster = require( 'wooster' )
// wooster = require( '../../../wooster/src/version2.js' )

// watch arbitrary files and execute commands when they change
var executions = []
var fileWatcher = miteru.watch( function ( evt, filepath ) {
  if ( evt === 'add' || evt === 'change' ) {
    // handle executions
    executions.forEach( function ( command ) {
      console.log( 'command: ' + command )

      // pass in watch event info to the command string if applicable
      command = (
        command
        .split( '$evt' ).join( evt )
        .split( '$file' ).join( filepath )
      )

      console.log( 'executing: ' + command )

      childProcess.exec( command, function ( error, stdout, stderr ) {
        if ( error ) {
          console.error( 'exec error: ' + error )
        } else {
          stdout && console.log( stdout )
          stderr && console.log( stderr )
        }
      } )
    } )
  }
} )

// watch target bundle files ( -w [ <command>, <file> ] )
var targetWatcher = miteru.watch( handleTargetWatchEvent )

// Get the visual width of a string - the number of columns required to display it
var stringWidth = require( 'string-width' )

var assert = require( 'assert' )

var http = require( 'http' )
var express = require( 'express' )

var cors = require( 'cors' )

var app = express()
var server = http.createServer( app )
var io = require( 'socket.io' )( server ) // livereload

var os = require( 'os' ) // for getNetworkIpAddresses

// cli-color is a great terminal text color library, better than chalk
var clc = require( 'cli-color' ) // for colored output

// load the projects package.json
var packageJson = require( path.resolve( __dirname, '../../package.json' ) )

var _recoveryFiles = []
var _lastPrintOutput = ''
var _lastPesticide = false

// parse the command line arguments ( with subarg/minimist )
var argv = require( 'subarg' )( process.argv.slice( 2 ), {
  alias: {
    // watch process
    'watch': [ 'w', 'watcher', 'watched' ],

    // arbitrary files
    'file': [ 'f', 'files' ],

    // execute command on --files changes
    'execute': [ 'e', 'ex', 'exe', 'exec' ],

    // watch arbitrary files as build targets -- will trigger a live reload or refresh
    'targets': [ 't', 'targets' ],

    // always force a reload instead of attempting to refresh css files
    'reload': [ 'r' ],

    'debounce': [],
    'throttle': [],

    // public/static path ( also where miru-connect.js is saved to )
    'public-path': [ 'public', 'p', 'path' ],

    'no-wooster': [],
    'no-miru-connect': [],
    'no-clear': [],

    'development': [ 'D' ],

    'verbose': [ 'v' ],

    'version': [ 'V' ],

    'help': [ 'h' ]
  },
  boolean: [
    'noflicker', // disable style reload flicker ( not recommended )
    'nolimit', // nolimit on col size terminal output
    'version',
    'verbose',
    'help',
    'no-wooster',
    'no-miru-connect',
    'no-clear', // disable terminal clearing
    'development'
  ],
  unknown: function ( arg ) {
    console.log( 'uknown argument: ' + arg )
    // process.exit( 1 )
  }
} )

// console.dir( argv )
// console.dir( argv.watch )

// console.dir( argv.watch[ 0 ]._.join( '' ) )

var verbose = !!argv[ 'verbose' ]

// watch arbitrary files as build targets without an associated watch process
if ( argv[ 'targets' ] ) {
  var files = argv[ 'targets' ]

  if ( typeof files === 'string' ) {
    files = [ files ]
  }

  if ( !( files instanceof Array ) ) {
    console.error( '-t, --targets <string>    parse error - missing file names?' )
    process.exit( 1 )
  }

  files.forEach( function ( file ) {
    log( 'adding watch target: ' + file )
    targetWatcher.add( file )
  } )

  log( 'target files watched :' )
  log( targetWatcher.getWatched() )
}

function log () {
  if ( verbose ) console.log.apply( this, arguments )
}

log( 'verbose: ' + verbose )

/*
 * set publicPath
 *
 * publicPath is the destination where miru-connect.js is saved in and
 * where default contents will be statically served.
 */
var publicPath = ( argv[ 'public-path' ] )
if ( !publicPath ) {
  publicPath = process.cwd()
  log( '-p, --public-path, --path, --public was unset, defaulting to process.cwd()' )
}
publicPath = path.resolve( publicPath )
log( 'publicPath is: ' + publicPath )

var DEBOUNCE = 33
var THROTTLE = 0

var errors = {
  DEBOUNCE: 33,
  THROTTLE: 1000,
  history: []
}

// target bundles
var targets = {}

// client hosts
var clients = {}

var PORT = ( argv[ 'port' ] || 4040 )
var ADDRESS = ( argv[ 'address' ] || '0.0.0.0' )

/*
 * Parse args
 */
if ( argv[ 'version' ] ) {
  console.log( 'miru version: ' + ( packageJson[ 'version' ] ) )
  process.exit( 0 ) // exit success
}

if ( argv[ 'help' ] ) {
  var usage = fs.readFileSync(
    path.join( __dirname, 'usage.txt' ),
    'utf8'
  )

  console.log( usage )

  process.exit( 0 ) // exit success
}

if ( argv[ 'file' ] ) {
  var files = argv[ 'file' ]

  if ( typeof files === 'string' ) {
    files = [ files ]
  }

  if ( !( files instanceof Array ) ) {
    console.error( '-f, --file, --files <string>    parse error - missing file names?' )
    process.exit( 1 )
  }

  files.forEach( function ( file ) {
    log( 'adding watch file: ' + file )
    fileWatcher.add( file )
  } )

  // TODO
  log( 'watched files:' )
  log( fileWatcher.getWatched() )
}

/*
 * Execute arbitrary commands on certain events TODO
 *
 * The commands/processes are expected to exit quickly.
 */
if ( argv[ 'execute' ] ) {
  var execs = argv[ 'execute' ]

  if ( typeof execs === 'string' ) {
    execs = [ execs ]
  }

  if ( !( execs instanceof Array ) ) {
    console.error( '-e, --execute <string>    parse error - missing commands?' )
    process.exit( 1 )
  }

  executions = execs
}

log( 'executions: ' )
log( executions )

/*
 * Watch a daemon process ( bundler ) and listen for its
 * stdio and stderr for interesting stuff ( mainly errors ).
 *
 * The commands/processes are expected to keep running indefinitely/forever.
 */
var watchers = []
if ( argv[ 'watch' ] ) {
  watchers = argv[ 'watch' ]

  if ( !( watchers instanceof Array ) ) {
    watchers = [ watchers ]
  }

  log( watchers )

  var list = []
  watchers.forEach( function ( w ) {
    var split = w._.join( ' ' ).split( ',' )
    if ( split.length !== 2 ) {
      console.error( '-w, --watch [ <command>, <file> ]    parse error - invalid format?' )
      console.error( 'samples:' )
      console.error( '  miru -w [ npm run watch:js, dist/bundle.js ]' )
      console.error( '  miru -w [ webpack --watch src/main.js -o dist/bundle.js, dist/bundle.js ]' )
      process.exit( 1 )
    }

    var w = {
      command: split[ 0 ].trim(),
      target: split[ 1 ].trim()
    }

    log( 'command: ' + w.command )
    log( 'target file: ' + w.target )

    list.push( w )

    var targetPath = path.resolve( w.target )
    log( 'initializing target: ' + w.target )
    targets[ targetPath ] = {}

    targetWatcher.add( targetPath )

    try {
      fs.statSync( path.resolve( w.target ) )
    } catch ( err ) {
      if ( err.code === 'ENOENT' ) {
        console.error( 'warning: watcher target file does not exist: ' + w.target )
      } else {
        console.error( 'warning: could not access watcher target file: ' + w.target )
      }
    }
  } )

  watchers = list
}

log( 'watchers: ' )
log( watchers )

/*
 * Save miru-connect.js inside public-path for the user to then
 * link to from his/her html page/pages
 */
var miruConnectSource = path.join( __dirname, '../../dist/miru-connect.js' )
var miruConnectDestination = path.join( publicPath, 'miru-connect.js' )
try {
  if ( !argv[ 'no-miru-connect' ] ) {
    writeMiruConnect()
  }

  fs.readFileSync(
    miruConnectDestination
  ).equals(
    injectMiruConnect()
  )

  log( 'up to date miru-connect.js found at: ' + miruConnectDestination )

  if ( argv[ 'development' ] ) {
    var w = miteru.watch(
      miruConnectSource,
      function ( evt, filepath ) {
        switch ( evt ) {
          case 'add':
          case 'change':
            writeMiruConnect()
            console.log( 'emitting reload on miru-connect.js change' )
            emit( 'reload' )
            break;
        }
      }
    )

    console.log( 'watching miru-connect.js' )
  }
} catch ( err ) {
  log( 'failed to load or save miru-connect.js to users project' )
  throw err
}

function writeMiruConnect () {
  fs.writeFileSync(
    // save the miru-connect.js in --public-path
    // ( current working directory by default )
    miruConnectDestination,

    // load the bundled miru-connect.js from the dist directory
    injectMiruConnect()
  )

  log( 'miru-connect.js saved to: ' + miruConnectDestination )
}

function injectMiruConnect () {
  // load the bundled miru-connect.js from the dist directory
  var text = fs.readFileSync(
    miruConnectSource,
    'utf8'
  )

  // inject it with options and variables
  text = ( `
    ;(function () {
      window.__miru = {
        verbose: true,
        forceReload: ${ !!argv[ 'reload' ] },
        styleFlicker: ${ !argv[ 'noflicker' ] },
        targets: ${ JSON.stringify( Object.keys( targets ) ) }
      }
    })();
    ${ text }
  ` )

  return Buffer.from( text )
}

/*
 * setup and start express server
 */
log( '[express]: cors' )
app.use( cors() ) // allow cors

app.use( '/favicon*', function ( req, res ) {
  res.sendFile( path.join( __dirname, '../../dist/favicon.png' ) )
} )

app.use( '/__miru/pesticide.css', function ( req, res, next ) {
  res.sendFile( path.join( __dirname, '../../dist/pesticide.css' ) )
} )

// serve static contents from --public-path for easy quick access
log( '[express]: static directory: ' + publicPath )
app.use( express.static( publicPath ) )

app.use( '/', function ( req, res, next ) {
  res.sendFile( path.join( __dirname, '../../dist/index.html' ) )
} )

/*
 * setup socket.io
 */
var acks = {}
io.on( 'connect', function ( socket ) {
  // TODO
  var clientID = parseClientID( socket.request.headers[ 'user-agent' ])
  var client = {
    id: clientID
  }
  clients[ clientID ] = client
  socket.miru = {
    client: client
  }
  console.log( 'client connected: ' +  clientID )

  // turn on pesticide if it's set
  if ( _lastPesticide ) {
    socket.emit( 'pesticide', _lastPesticide )
  }

  // if there's an uncleared error, send it to the new client
  Object.keys( targets ).forEach( function ( target ) {
    var t = targets[ target ]
    if ( t.output && t.error ) {
      log( 'emitting unresolved error to new connection' )
      socket.emit( 'terminal-error', {
        timestamp: Date.now(),
        output: t.output,
        error: t.error
      } )
    }
  } )

  // listen for ack's
  socket.on( 'ack', function ( id ) {
    acks[ id ] = true
    setTimeout( function () {
      delete acks[ id ]
    }, 1000 * 30 )
  } )

  /*
   * client wants to woosterify something ( usually DOM error )
   */
  socket.on( 'woosterify', function ( id, opts, callback ) {
    // console.log( 'pre-woosterify' )

    if ( !acks[ id ] ) {
      // var wp = wooster.parse( text )

      // console.log( opts )
      acks[ id ] = true

      var ctx = wooster.parseContext( {
        prettify: true,
        text: opts.text,
        filename: opts.filename,
        lineno: opts.lineno,
        colno: opts.colno
      } )

      var clientID = socket.miru.client.id

      var message = wooster.createMessage( {
        postintro: ( ' ' + clc.bgWhite( 'DOM Error' ) + ' [' + clientID + ']' ),
        message: opts.message,
        filename: ctx.filename,
        ctx: ctx
      } )

      var origin = undefined
      if ( ctx.usedSourceMap ) {
        var originCtx = wooster.parseContext( {
          prettify: true,
          disableSourceMaps: true,
          text: opts.text,
          filename: opts.filename,
          lineno: opts.lineno,
          colno: opts.colno
        } )

        origin = wooster.createMessage( {
          message: opts.message,
          filename: originCtx.filename,
          ctx: originCtx
        } )
      }

      clearConsole()

      print( message )
      // console.log( 'sending woosterify response length: ' + parsedMessage.length )

      callback( {
        target: 'DOM',
        name: 'Error',
        message: message,
        origin: origin
      } )
    }
  } )

  /*
   * gather logs form clients
   */
  socket.on( 'console', function ( data ) {
    var host = data.host
    var clientID = socket.miru.client.id
    var client = clients[ clientID ]

    var logs = data.logs

    // console.log( 'logs from: ' + clientID + ', size: ' + logs.join( '' ).length )
    logs.forEach( function ( log ) {
      // TODO add to clients TODO create unique ID based on browser ( navigator.userAgent )
      // console.log.apply( this, [ log.type + ':' ].concat( log.args ) )
    } )

    client.logs = logs
  } )

  // handle disconnect
  socket.on( 'disconnect', function () {
    var clientID = socket.miru.client.id
    // console.log( 'disconnected: ' +  clientID )
  } )
} )

function parseClientID ( userAgent ) {
  var agent = useragent.parse( userAgent )

  var id = ''


  // id += agent.os.toString()
  id += agent.os.name
  id += ' ' + agent.os.version

  // id += ' ' + agent.toAgent()
  id += ' ' + agent.browser.name
  id += ' ' + agent.browser.version

  // if ( agent.device.family.toLowerCase() !== 'other' ) {
  //   id += ' ' + agent.device.toString()
  // }

  id += ' ' + agent.device.vendor
  id += ' ' + agent.device.model
  id += ' ' + agent.device.type

  // id += ' ' + agent.engine.name

  id = id
    .split( /\s+/ )
    .filter( function ( word ) {
      var w = word.toLowerCase().trim()
      return (
        ( w !== 'other' ) &&
        ( w !== '0.0.0' ) &&
        ( w !== 'undefined' ) &&
        w
      )
    } )
    .join( ' ' ).trim()

  return id
}

// start server
log( '[express]: starting server at ' + ADDRESS + ':' + PORT )
server.listen(
  PORT,
  ADDRESS,
  function () {
    var addr = server.address()
    console.log(
      'server listening at *:' + addr.port +
      ' ( ' + addr.family + ' ' + addr.address + ' )'
    )
    printNetworkIpAddresses()
  }
)

function printNetworkIpAddresses () {
  console.log( 'LAN addresses: ' + getNetworkIpAddresses().join( ',' ) )
}

/*
 * Run watchers
 */
watchers.forEach( function ( w ) {
  watchCommandAndTarget( w )
} )

function watchCommandAndTarget ( w ) {
  // clear recovery watcher if it exists
  if ( w.rw ) {
    log( 'closing recovery watcher, files watched: ' + w.rw.getWatched().length )
    w.rw.clear()
    w.rw.close()
    if ( w.rw.getWatched().length === 0 ) {
      log( 'recovery watcher closed' )
    }
    _recoveryFiles = []
    delete w.rw
  }

  var commands = w.command
  var target = path.resolve( w.target )

  if ( typeof commands === 'string' ) commands = commands.split( /\s+/ )

  var cmd = commands[ 0 ] // first item
  var args = commands.slice( 1 ) // all except first item

  log( 'spawning: ' + cmd + ' ' + args.join( ' ' ) )
  var spawn = childProcess.spawn( cmd, args )

  var timeout
  var buffer = ''

  // TODO
  var handler = function ( chunk ) {
    var str = chunk.toString( 'utf8' )
    buffer += str

    // console.log( str )
    clearTimeout( timeout ) // debounce
    timeout = setTimeout( function () {
      var hasErrors = false
      var lines = buffer.split( '\n' )
      buffer = ''

      lines.forEach( function ( line ) {
        if ( line.toLowerCase().indexOf( 'error' ) !== -1 ) hasErrors = true
      } )

      lines = (
        lines
        .filter( function ( line ) {
          return ( line.indexOf( 'node_modules' ) === -1 )
        } )
      )

      if ( hasErrors ) {
        log( ' == Errors found == ' )
        var text = lines.join( '\n' )
        handleError( target, text )
      } else { // no errors, output as is
        lines.forEach( function ( line ) {
          console.log( line )
        } )

        // warn the user if the target is not recognized
        fs.stat( path.resolve( w.target ), function ( err, stats ) {
          if ( err ) {
            if ( err.code === 'ENOENT' ) {
              console.error( 'warning: watcher target file does not exist: ' + w.target )
            } else {
              console.error( 'warning: could not access watcher target file: ' + w.target )
            }
          }
        } )
      }
    }, DEBOUNCE )
  }

  spawn.stdout.on( 'data', handler )
  spawn.stderr.on( 'data', handler )

  // TODO recovery handlers
  spawn.on( 'exit', function () {
    setTimeout( function () {
      console.log( 'watcher exited [ ' + w.command + ' ], target: ' + w.target )

      launchRecoveryWatcher( w )
    }, 100 )
  } )
}

function launchRecoveryWatcher ( w ) {
  console.log( 'launching recovery watcher for [ ' + w.command + ' ], target: ' + w.target )

  var target = w.target

  var _timeout
  function recover ( evt, filepath ) {
    // log( 'rw ' + evt + ' filepath: ' + filepath )
    if ( evt === 'init' ) printWatched()

    switch ( evt ) {
      case 'add':
      case 'change':
        log( 'recovery watcher change detected: ' + filepath )
        clearTimeout( _timeout )
        _timeout = setTimeout( function () {
          // clear recovery watcher if it exists
          if ( w.rw ) {
            log( 'closing recovery watcher, files watched: ' + w.rw.getWatched().length )
            w.rw.clear()
            w.rw.close()
            if ( w.rw.getWatched().length === 0 ) {
              log( 'recovery watcher closed' )
            }
            _recoveryFiles = []
            delete w.rw
          }

          watchCommandAndTarget( w )
        }, 1500 )
        break

      default:
    }
  }

  if ( // style files
    ( target.indexOf( '.css' ) > 0 ) ||
    ( target.indexOf( '.styl' ) > 0 ) ||
    ( target.indexOf( '.sass' ) > 0 ) ||
    ( target.indexOf( '.scss' ) > 0 ) ||
    ( target.indexOf( '.less' ) > 0 )
  ) {
    log( 'recovering style watcher' )
    w.rw = miteru.watch( recover )

    w.rw.add( '**/*.css' )
    w.rw.add( '**/*.styl' )
    w.rw.add( '**/*.sass' )
    w.rw.add( '**/*.scss' )
    w.rw.add( '**/*.less' )
  } else if ( // javascript files
    ( target.indexOf( '.js' ) > 0 ) ||
    ( target.indexOf( '.jsx' ) > 0 )
  ) {
    log( 'recovering javascript watcher' )
    w.rw = miteru.watch( recover )

    w.rw.add( '**/*.js' )
    w.rw.add( '**/*.jsx' )
  } else {
    log( 'failed to setup recovery watcher, target not recognized: ' + target )
  }

  var _printWatchedTimeout
  function printWatched () {
    if ( w.rw ) {
      clearTimeout( _printWatchedTimeout )
      _printWatchedTimeout = setTimeout( function () {
        _recoveryFiles = w.rw.getWatched().slice()
        log( 'recovery watcher watching ' + _recoveryFiles.length + ' files - type \'recovery\' to see list' )
      }, 300 )
    }
  }
}

// TODO
function handleError ( target, text, ranking ) {
  var now = Date.now()

  var error = {
    time: Date.now(),
    raw: text,
    target: target,
    ranking: ( ranking || 0 )
  }

  // TODO
  if ( argv[ 'no-wooster' ] ) {
    error.text = text
  } else {
    /*
     *  Attempt to parse the error log with wooster.
     *
     *  wooster tries to find the source file of the error,
     *  get its context and prettify the information into
     *  a consice, easy to understand text output.
     *
     *  If it fails the output text is left unchanged from the
     *  original input text.
     */
    var wp = wooster.parse( text )
    if ( wp ) {
      error.text = wp.text
      error.context = wp.context

      var filename = wp.filename
      if ( filename ) {
        error.filename = filename
      }
    } else {
      error.text = text
    }
  }

  // log( ' vvvvvvvvvvvvvvvvvvv ' )
  // log( error.text )
  // log( ' ^^^^^^^^^^^^^^^^^^^ ' )

  var prevError = errors.history[ errors.history.length - 1 ]

  var shouldSkip = false
  if ( prevError ) {
    var delta = ( now - prevError.time )
    if (
      ( delta < errors.THROTTLE ) && (
        ( prevError.raw === error.raw ) ||
        ( prevError.text === error.text ) || (
          ( error.context ) &&
          ( prevError.context === error.context )
        )
      )
    ) {
      if ( error.ranking > prevError.ranking ) {
        // duplicate error has better ranking, this means
        // that the duplicate error probably has a better
        // error message/description, update the text
        // with the better alternative
        prevError.text = error.text
        log( 'duplicate error outranked' )
      }

      /*
       * Ignore the same error if within errors.THROTTLE time.
       * This can sometimes happen e.g. during watchify destination
       * write and watchify stderr output the same error or
       * multiple file change events or quick bundles or delayed stderr output.
       */
      log( clc.blackBright( 'ignoring duplicate error' ) )
      shouldSkip = true
    }
  }

  if ( !shouldSkip ) {
    errors.history.push( error )

    targets[ path.resolve( target ) ] = {
      error: error
    }

    if ( errors.history.length > 20 ) errors.history.shift() // cap history

    log( 'debouncing error' )
    clearTimeout( errors.timeout ) // error debounce
    errors.timeout = setTimeout( function () {
      var output = ''

      // make it easy to distinguish changes/builds
      // that produce the same error or similar errors
      output += ( getIterationErrorBox() + '\n' )

      output += error.text

      clearConsole()

      print( output )

      var timestamp = ( Date.now() )

      io.emit( 'terminal-error', {
        target: target,
        timestamp: timestamp,
        output: output,
        error: error
      } )

      ;[ 33, 100, 300, 500 ].forEach( function ( t ) {
        setTimeout( function () {
          // console.log( 'emitting old error' )
          io.emit( 'terminal-error', {
            timestamp: timestamp,
            output: output,
            error: error
          } )
        }, t )
      } )

      var t = targets[ path.resolve( target )]
      if ( t ) {
        t.output = output
      }
      // TODO attach output to error object
      // TODO send unresolved errors to newly connected clients
    }, errors.DEBOUNCE )
  } else {
    log( 'skipping error' )
  }

  return error
}

/*
 * function getIterationErrorBox ()
 *
 * A visual indicator intended for easy distinguishing between calls.
 *
 * Makes it easy to distinguish changes/builds that produce the same error.
 *
 * In other words, avoids the problem when you are trying to fix an error
 * by making changes/rebuilds but the error output is the same so you are not sure
 * if your change/rebuild took place or not.
 */
var _iterationBoxErrorCounter = -1
var _iterationBoxErrorLimit = 4
function getIterationErrorBox () {
  // increment horizontal position of the box
  _iterationBoxErrorCounter = (
    ( _iterationBoxErrorCounter + 1 ) % _iterationBoxErrorLimit
  )

  var box = ''
  for ( var i = 0; i < _iterationBoxErrorLimit; i++ ) {
    if ( i === _iterationBoxErrorCounter ) {
      // draw a colored box in terminal text
      box += clc.bgMagentaBright( '  ' )
    } else {
      // padding between iterations/positions
      box += '      '
    }
  }

  return box
}

/*
 * Handle file change events.
 *
 * Mainly used to handle file change events on destination bundles that
 * the --watch'ed processes produce
 * ( like watchify, webpack --watch or rollup --watch )
 */
function handleTargetWatchEvent ( evt, filepath ) {
  log( 'evt: ' + evt + ', filepath: ' + filepath )

  switch ( evt ) {
    // handle add/change
    case 'add':
    case 'change':
      /*
       * Check an exception case when a watcher overwrites the
       * build destination with an error log ( e.g. watchify )
       *
       * e.g. watchify might overwrite the destination bundle with this:
       * console.error("SyntaxError: /Users/mollie/code/miru/test/stage/app.js: Unexpected token, expected ; (2:20) while parsing file: /Users/mollie/code/miru/test/stage/app.js");
       *
       * In other words, a change in the build destination
       * doesn't always mean that the build was successful!
       */
      fs.readFile( filepath, 'utf8', function ( err, text ) {
        var hasErrors = false

        // investigate approx first 500 characters
        var slice = text.slice( 0, 500 )
        if (
            ( slice.toLowerCase().indexOf( 'error') !== -1 )
          ) {
          // Could be an error, make sure with wooster.
          var errorText = wooster( slice )

          // wooster outputs the input unchanged if no errors are found.
          if ( errorText !== slice ) {
            // wooster found an error ( input !== output )
            hasErrors = true
          }
        }

        if ( hasErrors === false ) {
          // clear target
          var target = path.resolve( filepath )

          if ( target && targets[ target ] ) {
            targets[ target ].error = undefined
            targets[ target ].output = undefined
          }

          console.log( 'sending target build success: ' + path.relative( process.cwd(), filepath ) )

          io.emit( 'target-build', {
            target: filepath
          } )
        } else {
          log( ' === target error detected === ' )
          var error = handleError( target, slice, -1 )

          // attach error to target if it doesn't have one already
          var target = path.resolve( filepath )
          if ( !targets[ target ].error ) {
            log( 'target error attached' )
            targets[ target ].error = error
          }
        }
      } )
  } // switch ( evt )
} // handleWatchEvent

/*
 * Broadcast events to the listening devices that are
 * connecting with the help of miru-connect.js
 *
 * Mainly page reload, error and style refresh events.
 */
function emit ( action, data ) {
  console.log( 'emitting: ' + action + ', ' + data )
  io.emit( action, data )
}

/*
 * Make sure no zombie spawns are left behind.
 */
process.on( 'exit', function () {
  spawns.forEach( function ( spawn ) {
    try {
      spawn.kill()
    } catch ( err ) {
      /* ignore */
    }
  } )
} )

function print ( output ) {
  _lastPrintOutput = output

  // TODO add argv to limit line length to 80 chars ( ignoring ansi chars )
  var lines = output.split( '\n' )

  var limit = ( process.stdout.columns - 1 )

  if ( argv[ 'nolimit' ] ) {
    limit = 999
  }

  lines.forEach( function ( line ) {
    var sliced = false
    var sw
    while ( ( sw = stringWidth( line ) ) > limit ) {
      sliced = true
      line = line.slice( 0, -1 )
    }

    if ( sliced ) {
      line += clc.bgWhite( '>' )
    }

    if ( line[ line.length - 1 ] !== '\n' ) {
      line += '\n'
    }

    process.stdout.write( line )
  } )
}

function clearConsole () {
  var timestring = ( new Date() ).toTimeString().split( ' ' )[ 0 ]

  // This seems to work best on Windows and other systems.
  // The intention is to clear the output so you can focus on most recent build.
  if ( verbose ||  process.env.MIRU_NOCLEAR ) {
    console.log()
    console.log( ' === CLEAR === ' + timestring )
    console.log()
  } else {
    // send special code to clear terminal/console screen
    process.stdout.write( '\x1bc' )
  }
}

function getNetworkIpAddresses () {
  var interfaces = os.networkInterfaces()
  var addresses = []

  var k, k2
  for ( k in interfaces ) {
    for ( k2 in interfaces[ k ] ) {
      var address = interfaces[ k ][ k2 ]
      if ( address.family === 'IPv4' && !address.internal ) {
        addresses.push( address.address )
      }
    }
  }

  return addresses
}

/*
 * listen for standard input
 * TODO
 */

var commands = {
  'devices': function ( args ) {
    clearConsole()
    Object.keys( clients ).forEach( function ( clientID, index ) {
      var client = clients[ clientID ]
      console.log( '  ' + index + ': ' + client.id )
    } )
  },
  'logs': function ( args ) {
    var _index = args[ 0 ]
    clearConsole()
    Object.keys( clients ).forEach( function ( clientID, index ) {
      if ( _index && index != _index ) return

      var client = clients[ clientID ]
      console.log( '  ' + + index + ': ' + client.id + ' -- logs: ' )
      var logs = ( client.logs || [] )
      logs.forEach( function ( log ) {
        console.log.apply( this, [ log.type + ':' ].concat( log.args ) )
      } )
    } )
  },
  'reload': function () {
    /*
     * force reload on all clients
     */
    io.emit( 'reload' )
  },
  'recovery': function () {
    console.log( 'recovery watcher watching ' + _recoveryFiles.length + ' files' )
    console.log( _recoveryFiles )
  },
  'previous': function () {
    if ( _lastPrintOutput ) {
      clearConsole()
      print( _lastPrintOutput )
    }
  },
  'pesticide': function ( args ) {
    /*
     * Enable or Disable pesticide remotely
     * to all connected clients
     */
    var bool = false
    var arg = String( args[ 0 ] || '' ).trim()
    switch ( arg ) {
      case 'false':
      case 'off':
      case '0':
      case '':
        bool = false // turn off
        break
      default:
        bool = true // turn on

    }
    console.log( 'sending pesticide: ' + bool )
    // set pesticide for newly connected clients
    _lastPesticide = bool
    io.emit( 'pesticide', bool )
  },
  'address': printNetworkIpAddresses,
  'ip': printNetworkIpAddresses,
  'lan': printNetworkIpAddresses,
  'watchers': function ( args ) {
    console.log( '  watchers: ' )

    var maxCommandLength = 0

    watchers.forEach( function ( w ) {
      if ( w.command.length > maxCommandLength ) maxCommandLength = w.command.length
    } )

    watchers.forEach( function ( w ) {
      var shift = ( maxCommandLength - w.command.length + 4 )
      process.stdout.write( '  ' + w.command )
      for ( var i = 0; i < shift; i++ ) process.stdout.write( ' ' )
      process.stdout.write( w.target + '\n' )
    } )
  },
  'targets': function ( args ) {
    console.log( '  targets: ' )
    Object.keys( targets ).forEach( function ( target ) {
      console.log( target )
    } )
  },
  'error': function ( args ) {
    Object.keys( targets ).forEach( function ( target ) {
      var t = targets[ target ]
      if ( t.output && t.error ) {
        io.emit( 'terminal-error', {
          timestamp: Date.now(),
          output: t.output,
          error: t.error
        } )

        print( t.output )
      }
    } )
  },
  'files': function () {
    console.log( 'watched files:' )
    console.log( fileWatcher.getWatched() )
  }
}

var _lastCommand
process.stdin.on( 'data', function ( chunk ) {
  // console.log( 'stdin chunk: ' + chunk )
  var text = chunk.toString( 'utf8' ).toLowerCase().trim()

  var words = text.split( /\s+/ )

  var cmd = words[ 0 ]

  // repeat last command
  if ( !cmd && _lastCommand ) {
    return _lastCommand()
  }

  var args = words.slice( 1 )

  var keys = Object.keys( commands )
    .filter( function ( command ) {
      return ( command.indexOf( cmd ) >= 0 )
    } )
    .sort( function ( a, b ) {
      return ( a.indexOf( cmd ) - b.indexOf( cmd ) )
    } )

  var fn = commands[ keys[ 0 ] ]

  if ( typeof fn === 'function' ) {
    _lastCommand = function () {
      fn( args )
    }
    fn( args )
  } else {
    console.log( 'unknown command: ' + cmd )
  }
} )
