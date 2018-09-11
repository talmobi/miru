module.exports = function onExit ( callback ) {
  let called = false
  function once () {
    if ( !called ) {
      called = true
      callback && callback()
    }
  }

  process.on( 'SIGINT', once )
  process.on( 'exit', once )
}
