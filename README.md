#  見る miru - Simple dev server for command-line watchers


[![npm](https://img.shields.io/npm/v/wrollup.svg?maxAge=2592000)](https://www.npmjs.com/package/wrollup)
[![npm](https://img.shields.io/npm/dm/wrollup.svg?maxAge=2592000)](https://www.npmjs.com/package/wrollup)
[![npm](https://img.shields.io/npm/l/wrollup.svg?maxAge=2592000)](https://www.npmjs.com/package/wrollup)


## Simple to use
```bash
npm install -g miru
miru --watch js/bundle.js -w css/bundle.css --execute 'webpack -w --config webpack.config.js' -e 'stylus -w styles/app.styl -o public/bundle.css',
```

# About (Who watches the watchers?)
A simple web server (express and socket.io) intended for running command-line watchers (processes that watch and bundle)

# Why
Most bundlers are great at what they do and come with their own --watch modes (rollup, webpack, stylus etc), they have great error parsing and do their specific thing very well. Miru embraces this, simply mirroring what they print into the terminal into the browser along with live reloading and some honey on top.

# ...but why though?
Because it reduces the contexts you're switching between by at least 1 (usually from 3 to 2).

Without miru you'll have your eyes between your source code, your terminal running your watcher and the browser actually running your code.
Miru spits the spits the terminal output to the browser as well as cleaning up your command-line watchers into a concice, clear workflow.

# For who?
Probably minimalists and/or people who prefer npm scripts over monolithic configs (not that there's anything wrong with well written monolithic configs!)

# How
Miru simply runs commands, preferably npm scripts, as child_process.spawn's and attaches listeners to their std.out and std.err streams to figure out when a various interesting events such as successful builds, errors, crashes and provide useful things like auto-recovery, live reloads and errors in the browser (as modals).
Miru creates a 'miru.init.js' file on startup in the --path directory (current working directory by default) that you link to in your index.html page. This init script (miru.init.js) simply connects to the miru express (w/ socket.io) server on port 4040 to listen for interesting events.

# Arguments TODO
```bash
$ miru --help
  
  Usage: miru [options]
  
  Sample package.json:
  
    {
     "scripts": {
       "watch": "miru -p public -w bundle.js -w bundle.css -e \'npm run watch-js\' -e \'npm run watch-css\'"
       "watch-js": "webpack -w --entry ./scripts/app.js --output ./public/bundle.js",
       "watch-css": "stylus -u nib -w ./styles/app.styl -o ./public/bundle.css",
     }
    }
  
  Options:
  
    -p, --path                     Specify path (current directory by default)
  
                                   This is also the path where miru creates "miru.init.js"
                                   which you can <script src=""> on your html page to enable
                                   live reloads and error reporting within the page/browser.
  
                                   ![Required]
    -w, --watch                    Specify path to target output file/bundle to watch
                                   and keep up to date when live reloading.
  
                                   Live reloads refresh corresponding <link href="fileName.css">
                                   or <script src="fileName.js"> tags on the html page where
                                   <script src="miru.init.js"> is loaded.
  
                                   "miru.init.js" is created inside the --path directory
                                   when miru starts
  
                                   Note! Every -w needs a corresponding -e in the same order
  
    -t, --target                   [Deprecated] alias for [-w, --watch]
  
                                   ![Required]
    -e, --execute                  Command (string) to execute with child_process.spawn
                                   usually annpm script like \'npm r watch-js\'
  
                                   Note! Every -w needs a corresponding -e in the same order
  
    -s, --source                   [Deprecated] alias for [-e, --execute]
  
    -v, --version                  Display miru version
    -h, --help                     Display help information
```

# Installation
```bash
npm install --save-dev miru # locally (for use with npm scripts)
```
or
```bash
npm install -g miru # globally (not recommended)
```

# Requirements

Miru would be pretty useless without any bundlers, check the demos/ folder for examples using webpack, rollup and browserify.

# Demos
Webpack (--watch)
```bash
cd demos/
npm install
npm start
open localhost:4040
```

Rollup (Wrollup)
```bash
cd demos/
npm install
npm start
open localhost:4040
```

Browserify (Watchify)
```bash
cd demos/
npm install
npm start
open localhost:4040
```

# Sample package.json from webpack demo
```js
{
  "name": "miru-demo-webpack",
  "version": "0.0.1",
  "description": "small demo using 'miru'",
  "scripts": {
    "start": "node ../../index.js -p public -t bundle.js -t bundle.css -s 'npm run watch-js' -s 'npm run watch-css'",
    "build-js": "webpack --config webpack.config.js",
    "watch-js": "webpack -w --config webpack.config.js",
    "build-css": "stylus -u nib -r styles/app.styl -o public/bundle.css",
    "watch-css": "stylus -u nib -w -r styles/app.styl -o public/bundle.css",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "author": "talmobi <talmo.christian@gmail.com>",
  "license": "MIT",
  "devDependencies": {
    "webpack": "^1.14.0",
    "babel-core": "^6.21.0",
    "babel-loader": "^6.2.10",
    "babel-preset-es2015": "^6.18.0",
    "nib": "^1.1.2",
    "stylus": "^0.54.5"
  },
  "dependencies": {}
}
```

# Sample webpack.config.js from webpack demo
```js
module.exports = {
  entry: './scripts/app.js',
  output: {
    filename: 'bundle.js',
    path: './public'
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        query: {
          presets: ['es2015']
        }
      }
    ]
  }
}
```


Screen cap workflow demo
![](http://i.imgur.com/uKb4lnr.gif)
![](https://gfycat.com/MaleSelfassuredBrahmanbull)
