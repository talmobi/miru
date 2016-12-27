#  見る miru - Simple dev server for watchers


[![npm](https://img.shields.io/npm/v/wrollup.svg?maxAge=2592000)](https://www.npmjs.com/package/wrollup)
[![npm](https://img.shields.io/npm/dm/wrollup.svg?maxAge=2592000)](https://www.npmjs.com/package/wrollup)
[![npm](https://img.shields.io/npm/l/wrollup.svg?maxAge=2592000)](https://www.npmjs.com/package/wrollup)


## Simple to use
```bash
npm install -g miru
miru -t js/bundle.js -t css/bundle.css -s 'webpack -w --config webpack.config.js' -s 'stylus -w styles/app.styl -o public/bundle.css',
```

# About -- Who watches the watchers?
A simple web server (express and socket.io) that runs watchers (processes that watch and bundle)

# Why
Most bundles are superb and come with their own --watch modes (rollup, webpack, stylus etc), they have great error parsing and do their specific thing very well. Miru lets them do their thing and simply listens to their std.out and std.err streams to enable live reloading of javascript, live injection of css and error printing straight into the browser across devices (no need for browser extensions)

# How
Miru simply runs processes (preferably npm scripts) and attaches listeners to their std.out and std.err streams to figure out when a successful build has occured or an error has popped up and sends these events to all listening sockets. Miru creates a 'miru.init.js' file on startup that you link in your index.html page. this init script (miru.init.js) simply connects to the miru dev server on port 4040 to listen for events for live reloads, css injections and errors

# Arguments TODO
```bash
$ miru --help

  Usage: miru [options]'
  
  Examples:'
  
    wrollup -c rollup.config.js'
    wrollup --verbose --error-glob "scripts/**/*.(ts|tsx|js)"'
    wrollup --help'
  
  Options:'
  
    -c, --config                   Specify path to rollup.config.js'
    --error-glob, --files          Specify glob of files to watch on rollup error/crash'
                                   for auto-recovery (defaults to \'**/*.js*\')'
    --verbose                      Wrollup will console.log some extra info of'
                                   what is going on'
    --disable-cache, --nocache     Disable bundle caching'
    --cache-before-disk            Generate cache before bundle written to disk'
    -h, --help                     Display help information'
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
