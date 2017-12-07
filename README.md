#  見る miru - Simple dev server for command-line watchers

## Simple to use
```bash
npm install -g miru
# miru -w [ <watch command>, <target bundle filepath> ]
miru --path public -w [ webpack -w src/app.js -o public/bundle.js, public/bundle.js ]
```

![](https://i.imgur.com/HmLQzqV.gif)

[![npm](https://img.shields.io/npm/v/miru.svg?maxAge=3600)](https://www.npmjs.com/package/miru)
[![npm](https://img.shields.io/npm/dm/miru.svg?maxAge=3600)](https://www.npmjs.com/package/miru)
[![npm](https://img.shields.io/npm/l/miru.svg?maxAge=3600)](https://www.npmjs.com/package/miru)

> TIP! make an npm script of each step!

```js
// package.json
"scripts": {
  "watch:js": "webpack -w src/app.js -o public/bundle.js",
  "watch:css": "stylus -w src/app.css -o public/bundle.css",
  "watch": "miru -p public -w [ npm run watch:js, public/bundle.js ] -w [ npm run watch:css, public/bundle.css ]"
}
```

add `miru-connect.js` script to your index.html ( created by miru at start inside the `--path` directory or current working directory by default )
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title></title>
  <link href="bundle.css" rel="stylesheet">
</head>
<body>
  <script src="miru-connect.js"></script>
  <script src="bundle.js"></script>
</body>
</html>
```

# About (Who watches the watchers?)
A simple web server ( express and socket.io ) intended for running command-line watchers (daemon processes that watch and bundle source files and never exits).

# Why
Most bundlers are great at what they do and come with their own `--watch` modes ([rollup](https://github.com/rollup/rollup), [webpack](https://github.com/webpack/webpack), [stylus](https://github.com/stylus/stylus/) etc), they have great error parsing and do their specific thing very well. Miru embraces this, simply mirroring what they print to the terminal into the browser along with live reloading and some honey on top.

# ...but why though?
Because it reduces the contexts you're switching between by at least 1 (usually from 3 to 2).

Without miru you'll have your eyes between your source code, your terminal running your watcher and the browser running your code.

With miru your browser stays in sync with your terminal output, no longer do you have to double check the terminal to make sure your bundle was generated successfully or that an error occured during bundle generation. Live reloading is a nice plus.

No need for browser extensions, allows for a nice dev experience across multiple devices, develop simultaneously against tablets, mobiles and desktop monitors.

Miru simply spits the terminal output to the browser ( with some prettyfying and honey ) as well as cleaning up your command-line watchers into a concice, clear workflow. Keeping them nicely separate but also together.

# For who?
Probably people who prefer npm scripts over monolithic boilerplates and convoluted configs (not that there's anything wrong with boilerplates or configs, as long as they're well maintained, straightforward and clear!)

# How
miru simply runs commands, preferably npm scripts, as child_process.spawn's and attaches listeners to their std.out and std.err streams to figure out when various interesting events occur, such as successful builds, errors and crashes, additionally providing useful things like auto-recovery, live reloads and errors in the browser.

miru creates a `miru-connect.js` file on startup in the `--path` directory (current working directory by default) that you link to in your index.html page. This script (miru-connect.js) simply connects to the miru express (w/ socket.io) server on port 4040 to listen for interesting events.

miru serves the `-p, --path` directory but you'll probably want to run your own http server to serve your content and simply have the miru dev server (running on port 4040) available for the `miru-connect.js` script to connect to.

# Sample index.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Moon moon</title>
  <link href="bundle.css" rel="stylesheet">
</head>
<body>
  <div id="root"></div>
  <!-- miru-connect.js connects to http:// + window.location.hostname + :4040 -->
  <script src="miru-connect.js" type="text/javascript"></script>
  <script src="bundle.js" type="text/javascript"></script>
</body>
</html>

```

# Arguments
```bash
$ miru --help
  
  Usage: miru [options]

  Options:

  -p, --path <dir>                      Specify path (current directory by default)
                                        Usually path to public directory.

                                        This is also the path where miru creates "miru-connect.js"
                                        which you should <script src="miru-connect.js"> on your html
                                        page to enable live reloads and error reporting directly
                                        within the page/browser.

  -w, --watch [ <command>, <file> ]     Specify watch command and target file bundle.

                                        miru-connect.js refreshes corresponding <link href="file.css">
                                        or reloads <script src="file.js"> tags on the html page where
                                        <script src="miru-connect.js"> is loaded.

                                        "miru-connect.js" is created inside the --path directory
                                        when miru starts

  -t, --targets <file>                  Add arbitrary target files not linked to a watch process.
                                        When these files change, they will be assumed as if they have been
                                        successfully built and will be emitted to miru-connect.js.

                                        styles ( *.css ) are attempted to refresh if the basename
                                        is found on a link tag inside the DOM.

                                        scripts ( *.js ) and all other files trigger a page reload.

                                        miru-connect.js will listen for DOM Errors -- and if the
                                        basename of the source file of the error matches a
                                        file in --targets then it will pass the error
                                        back to the miru.js sever for parsing. The parsing is
                                        done by wooster and the result is sent back to the client.
                                        The parsed error output is then rendered on the screen
                                        for easier debugging.

                                        Inline source maps are supported:
                                          If the target file includes inline source maps then
                                          the parsed output includes the source map as well.

  -r, --reload                          Always force a reload when a change event is emitted.
                                        This disables css link.href quick refreshing.

  -f, --files <file>                    Watch arbitray files for changes and execute commands.

  -e, --execute <command>               Execute commands when --files have changed.

                                        '$evt' and '$file' strings in the <command> parameter
                                        are substituted accordingly.

                                        eg:
                                            miru -f package.json -e 'echo $evt: $file'

  -v, --verbose                         Enable verbose mode

  -V, --version                         Display miru version
  -h, --help                            Display help information (this text)

  Terminal Commands:        miru.js listens for lined stdio input

  devices                   prints a numbered list of connected client/device information
  logs <number>             list console.log output of <number> client ( or all clients if undefined )
  recovery                  prints recovery watcher ( if watcher exits ( should not happen, fix your watcher script ) )
  previous                  prints out previous error
  lan, ip, address          prints out LAN address ( use this address to connect from other devices )
  watchers                  prints watcher commands and targets
  targets                   prints watch targets ( set by --targets and --watch )
  files                     prints watch files ( set by --files )
  executions                prints executions ( set by --execute )
  error                     prints active watcher errors ( or empty if nothing is active )
  pesticide <bool>          enable or disable pesticide ( css debugger ) on all connected clients
```

# Installation
```bash
npm install --save-dev miru # locally (for use with npm scripts)
```
or
```bash
npm install -g miru # globally
```

# Usages

## With bundling tools like `browserify`, `webpack`, `rollup` or `stylus`

miru works best with bundling tools like `browserify`, `webpack`, `rollup` or `stylus` etc that are equipped with a `--watch` mode.

eg:

  `miru --path public --watch [ watchify -v src/app.js -o public/bundle.js, public/bundle.js ]`
  `miru -p public -w [ webpack -w -e src/app.js -o public/bundle.js, public/bundle.js ]`

combine watchers ( usually 1 for css and 1 for js )
  `miru -p public -w [ rollup -w src/app.js -o public/bundle.js, public/bundle.js ] --watch [ stylus -w -r src/app.styl -o public/bundle.css, public/bundle.js ]`


miru can also work with bundlers without a `--watch` mode relying on the built-in recovery watcher. But this isn't ideal.

by default the recovery watcher watches for changes on **/*.js or **/*.(css|less|sass|scss|styl) files
depending on the target file suffix -- you can override this recovery glob by passing in a third
argument to the --watch subarg

eg:

  `miru -w [ npm run build, public/bundle.js, src/**/*.js ]`

It gets its name because it's mainly used to recover when your build watcher exits/crashes for some reason.. ( *hits rollup with a large trout* )

You can list the `--watch` commands and their targets with the stdin command `watch`:

```bash
$ miru --watch [ echo 'giraffe', test/stage/bundle.js ]
server listening at *:4040 ( IPv4 0.0.0.0 )
LAN addresses: 192.168.0.101
giraffe

watcher exited [ echo giraffe ], target: test/stage/bundle.js
launching recovery watcher for [ echo giraffe ], target: test/stage/bundle.js
client connected: Windows 10 Chrome 62.0.3202.94
recovery watcher watching 50 files - type 'recovery' to see list
wat
  watchers:
  echo giraffe    test/stage/bundle.js
```

## static files

miru can also work without a bundler and treat files as --targets without any watch processes attached.

Every time a --target file is changed it will trigger a build success event which will either:
  1. Rreload the page ( if anything other than a *.css file ) or
  2. Refresh the targeted *.css files on the page ( without reloading the page )

Use the `--reload` flag to force all changes to reload the page and disable css refreshing.

You can list the `--targets` with the stdin command `targets`.
This also includes any targets bound to watch processes with
the `-w, --watch [ <command>, <file> ]` command:

```bash
$ miru --targets test/stage/bundle.js
server listening at *:4040 ( IPv4 0.0.0.0 )
LAN addresses: 192.168.0.101
client connected: Windows 10 Chrome 62.0.3202.94
targ
  targets:
/Users/mollie/code/miru/test/stage/bundle.js
sending target build success: test/stage/bundle.js
sending target build success: test/stage/bundle.js
```

## execute terminal commands on file changes

miru can also watch an arbitrary number of `--files` and `--execute` terminal commands on them.

`--execute` commands `$evt` and `$file` strings will be replaced  if they are found
with the suspected informations:
  1. `$evt`      will either be `add` or `change` i.e. the file will exist
  2. `$file`     will be replaced with the filepath in question relative to the current working directory.

eg:
  `miru --files src/**/*.js --execute 'echo evt: $evt, file: $file'`
  `miru --files src/**/*.js --execute 'sshpass -p "giraffe" scp $file user@10.0.0.6:/home/user/app/$file'`

or you could use `rsync` with diffing or whatever you like..

NOTE: you shouldn't pass in the password to sshpass directly in plain text unless you want it to show up
in your bash history -- you can read it from a file instead using the `sshpass -f` arg.

You can list the `--files` and `--execute`ions with the stdin commands `files` and `executions`:

```bash
$ miru --files test/stage/app.js -e 'echo file: $file'
number of --files watched: 1
server listening at *:4040 ( IPv4 0.0.0.0 )
LAN addresses: 192.168.0.101
client connected: Windows 10 Chrome 62.0.3202.94
files
watched files: 1
[ '/Users/mollie/code/miru/test/stage/app.js' ]
exec
executions: 1
[ 'echo file: $file' ]
```

# Sample setups with webpack, browserify, rollup and stylus ( css bundler )

Browserify ( using [watchify](https://github.com/substack/watchify) since browserify doesn't come with a --watch mode )
```bash
git clone https://github.com/talmobi/miru
cd miru
npm install
cd demos/browserify
npm install
npm start
open localhost:4040
```

Webpack ( --watch )
```bash
git clone https://github.com/talmobi/miru
cd miru
npm install
cd demos/webpack
npm install
npm start
open localhost:4040
```

Rollup ( --watch )
```bash
git clone https://github.com/talmobi/miru
cd miru
npm install
cd demos/rollup
npm install
npm start
open localhost:4040
```
