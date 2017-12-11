#!/usr/bin/env node

var fs = require( 'fs' )
var path = require( 'path' )

var assets = {}

assets.packageJson = fs.readFileSync(
  path.join( __dirname, 'package.json' ), 'utf8'
)

assets.usage = fs.readFileSync(
  path.join( __dirname, 'dist/usage.txt' ), 'utf8'
)

assets.miruConnectSource = path.join( __dirname, 'dist/miru-connect.js' )

assets.favicon = path.join( __dirname, 'dist/favicon.png' )

assets.pesticide = path.join( __dirname, 'dist/pesticide.css' )

assets.indexHTML = path.join( __dirname, 'dist/index.html' )

require( path.join( __dirname, 'src/server/miru.js' ) )( assets )

