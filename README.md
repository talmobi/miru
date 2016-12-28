#  見る miru - Simple dev server for command-line watchers

![](https://fat.gfycat.com/MaleSelfassuredBrahmanbull.gif)

[![npm](https://img.shields.io/npm/v/wrollup.svg?maxAge=2592000)](https://www.npmjs.com/package/wrollup)
[![npm](https://img.shields.io/npm/dm/wrollup.svg?maxAge=2592000)](https://www.npmjs.com/package/wrollup)
[![npm](https://img.shields.io/npm/l/wrollup.svg?maxAge=2592000)](https://www.npmjs.com/package/wrollup)


## Simple to use
```bash
npm install -g miru # please install locally with --save-dev, though
miru --path public --watch js/bundle.js -w css/bundle.css --execute 'webpack -w --config webpack.config.js' -e 'stylus -w styles/app.styl -o public/bundle.css',
```

add `miru.init.js` script to your index.html (created by miru on start inside the `--path` directory or current working directory by default)
```html
  <script src="miru.init.js"></script>
```

# About (Who watches the watchers?)
A simple web server (express and socket.io) intended for running command-line watchers (processes that watch and bundle source files)

# Why
Most bundlers are great at what they do and come with their own `--watch` modes ([rollup](https://github.com/rollup/rollup), [webpack](https://github.com/webpack/webpack), [stylus](https://github.com/stylus/stylus/) etc), they have great error parsing and do their specific thing very well. Miru embraces this, simply mirroring what they print to the terminal into the browser along with live reloading and some honey on top.

# ...but why though?
Because it reduces the contexts you're switching between by at least 1 (usually from 3 to 2).

Without miru you'll have your eyes between your source code, your terminal running your watcher and the browser running your code.

With miru your browser stays in sync with your terminal output, no longer do you have to double check the terminal to make sure your bundle was generated successfully or that an error occured during bundle generation. Live reloading is a nice plus.

No need for browser extensions, allows for a nice dev experience across multiple devices, develop simultaneously against tablets, mobiles and desktop monitors.

Miru simply spits the terminal output to the browser (with some prettyfying and honey) as well as cleaning up your command-line watchers into a concice, clear workflow. Keeping them nicely separate but also together.

# For who?
Probably people who prefer npm scripts over monolithic boilerplates and convoluted configs (not that there's anything wrong with boilerplates or configs, as long as they're well maintained, straightforward and clear!)

# How
Miru simply runs commands, preferably npm scripts, as child_process.spawn's and attaches listeners to their std.out and std.err streams to figure out when various interesting events occur, such as successful builds, errors and crashes, additionally providing useful things like auto-recovery, live reloads and errors in the browser.

Miru creates a 'miru.init.js' file on startup in the `--path` directory (current working directory by default) that you link to in your index.html page. This init script (miru.init.js) simply connects to the miru express (w/ socket.io) server on port 4040 to listen for interesting events.

Miru serves the `--path` directory but it is recommended you run your own http server to serve your content and simply have the miru dev server (running on port 4040) available for the `miru.init.js` to connect to.

# Arguments
```bash
$ miru --help
  
  Usage: miru [-w <file>] [-e <string>]
  
  Sample npm scripts:
  
    {
     "scripts": {
       "webpack:dev": "miru -p public -w bundle.js -w bundle.css -e 'npm run webpack:watch-js' -e 'npm run watch-css'",
       "browserify:dev": "miru -p public -w bundle.js -w bundle.css -e 'npm run browserify:watch-js' -e 'npm run watch-css'",
       "rollup:dev": "miru -p public -w bundle.js -w bundle.css -e 'npm run rollup:watch-js' -e 'npm run watch-css'",

       "webpack:build-js": "webpack --config webpack.config.js",
       "webpack:watch-js": "webpack -w --config webpack.config.js",

       "browserify:build-js": "browserify scripts/app.js -t babelify -o public/bundle.js",
       "browserify:watch-js": "watchify scripts/app.js -v -t babelify -o public/bundle.js",

       "rollup:build-js": "rollup -c rollup.config.js",
       "rollup:watch-js": "wrollup -c rollup.config.js",

       "build-css": "stylus -u nib -r styles/app.styl -o public/bundle.css",
       "watch-css": "stylus -u nib -w -r styles/app.styl -o public/bundle.css",
     }
    }
  
  Options:
  
    -p, --path <dir>               Specify path (current directory by default)
                                   Usually path to public directory.
  
                                   This is also the path where miru creates "miru.init.js"
                                   which you should <script src="miru.init.js"> on your html
                                   page to enable live reloads and error reporting directly
                                   within the page/browser.
  
                                   ![Required]
    -w, --watch <file>             Specify path to target output bundle/file to watch
                                   and keep up to date when live reloading.
  
                                   Live reloads refresh corresponding <link href="fileName.css">
                                   or <script src="fileName.js"> tags on the html page where
                                   <script src="miru.init.js"> is loaded.
  
                                   "miru.init.js" is created inside the --path directory
                                   when miru starts
  
                                   Note! Every -w needs a corresponding -e in the same order
  
                                   ![Required]
    -e, --execute <string>         Command (string) to execute with child_process.spawn
                                   usually an npm script like 'npm run watch-js'
  
                                   Note! Every -w needs a corresponding -e in the same order
  
    -t, --target <file>            [Deprecated] alias for [-w, --watch]
    -s, --source <string>          [Deprecated] alias for [-e, --execute]
  
    -v, --version                  Display miru version
    -h, --help                     Display help information

    --sample                       Print out sample npm scripts
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

Miru would be pretty useless without any bundlers, check the `demos/` directory for examples using webpack, rollup and browserify.

# Demos
Webpack (--watch)
```bash
git clone https://github.com/talmobi/miru
cd miru
npm install
cd demos/webpack
npm install
npm start
open localhost:4040
```

Rollup (using [wrollup](https://github.com/talmobi/wrollup) since the "official" --watch plugin is crap)
```bash
git clone https://github.com/talmobi/miru
cd miru
npm install
cd demos/rollup
npm install
npm start
open localhost:4040
```

Browserify (using [watchify](https://github.com/substack/watchify) since browserify doesn't come with a --watch mode)
```bash
git clone https://github.com/talmobi/miru
cd miru
npm install
cd demos/browserify
npm install
npm start
open localhost:4040
```

# Sample package.json usage overview combined from all demos
```js
{
  "scripts": {
    "webpack:dev": "miru -p public -w bundle.js -w bundle.css -e 'npm run webpack:watch-js' -e 'npm run watch-css'",
    "browserify:dev": "miru -p public -w bundle.js -w bundle.css -e 'npm run browserify:watch-js' -e 'npm run watch-css'",
    "rollup:dev": "miru -p public -w bundle.js -w bundle.css -e 'npm run rollup:watch-js' -e 'npm run watch-css'",
    "webpack:build-js": "webpack --config webpack.config.js",
    "webpack:watch-js": "webpack -w --config webpack.config.js",
    "browserify:build-js": "browserify scripts/app.js -t babelify -o public/bundle.js",
    "browserify:watch-js": "watchify scripts/app.js -v -t babelify -o public/bundle.js",
    "rollup:build-js": "rollup -c rollup.config.js",
    "rollup:watch-js": "wrollup -c rollup.config.js",
    "build-css": "stylus -u nib -r styles/app.styl -o public/bundle.css",
    "watch-css": "stylus -u nib -w -r styles/app.styl -o public/bundle.css",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "devDependencies": {
    "miru": "^0.6.0",
    "webpack": "^1.14.0",
    "babel-core": "^6.21.0",
    "babel-loader": "^6.2.10",
    "babel-preset-es2015": "^6.18.0",
    "rollup": "^0.36.1",
    "wrollup": "^0.1.18"
    "babelify": "^7.3.0",
    "browserify": "^13.1.1",
    "watchify": "^3.8.0",
    "nib": "^1.1.2",
    "stylus": "^0.54.5"
  },
  "dependencies": {}
}
```
