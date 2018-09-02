// successful build
var text = require( './module.js' )
// redom
console.log( text )

var el = document.createElement( 'div' )
el.innerHTML = 'hello world'
document.body.appendChild( el )

// function foo ( interval ) {
//   const interval = 'foo'
// }
