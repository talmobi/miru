var bodyParser = require( 'body-parser' )
var getUID = require( './uid.js' )

var clients = {}

function emit ( evt, data ) {
  var ids = Object.keys( clients )
  keys.forEach( function ( id ) {
    var client = clients[ id ]
    client.buffer.push( {
      evt: evt,
      data: data
    } )

    flush( client )
  } )
}

// check if there are messages to the user and send them
function flush ( client ) {
  if ( client.buffer.length > 0 ) {

    if ( client.res ) { // able to send
      var messages = client.buffer.slice()
      client.buffer = []

      if ( client.res )
      console.log( 'flushing messages: ' + messages.length + ', for client.id: ' + client.id )
      client.res.status( 200 ).json( {
        evt: 'flush',
        messages: messages
      } ).end()
    } else {
      console.log( 'wanted to flush but no longpoll available' )
    }
  }
}

var MS_IN_TWO_DAYS = ( 1000 * 60 * 60 * 24 * 2 )
var MS_IN_FIVE_MIN = ( 1000 * 60 * 5 )

function updateDCTimeout ( client ) {
  clearTimeout( client.DCTimeout )
  client.DCTimeout = setTimeout( function () {
    if ( client.res ) {
      // new longpoll received even after old is still active
      // -> delete and abort the old one
      res.send( 200 ).json( { evt: 'disconnect' } ).end()
    }

    delete clients[ client.id ]
  }, MS_IN_FIVE_MIN )
}

module.exports = function ( app ) {
  app.post( '/__miru/kiite.io', bodyParser.json(), function ( req, res ) {
    var data = req.body

    var id = data.id

    if ( typeof id === 'string' && id.length > 5 ) {
      var client = id && clients[ data.id ]

      if ( client ) {
        // existing client
        console.log( 'old client, evt: ' + dat.evt )
        client.last_message_time = Date.now()

        updateDCTimeout()

        if ( client.res ) {
          // new longpoll received even after old is still active
          // -> delete and abort the old one
          res.send( 200 ).json( { evt: 'stop' } ).end()
        }

        clearTimeout( client.resTimeout )
        client.res = res
        client.resTimeout = setTimeout( function () {
          // longpoll timed out, tell the user to issue another longpoll
          res.send( 200 ).json( { evt: 'timeout' } ).end()
          delete client.res
        }, 8 * 1000 )

        flush( client )
      } else {
        // new client
        if ( data.evt === 'connecting' ) {
          console.log( 'new client' )
          // wants to connect
          id = getUID()
          client = {
            ua: req.get( 'user-agent' ),
            last_message_time: Date.now(),
            id: id,
            buffer: []
          }
          clients[ id ] = client

          res.status( 201 ).json( {
            evt: 'connected',
            id: id,
            message: 'connected successfully!'
          } ).end()
        } else {
          // unknown intentions -- unknown suer
          console.log( '404 unkown user' )
          res.status( 404 ).json( {
            status: 404,
            message: 'user not recognized, senda  "connect" event first.'
          } ).end()
        }
      }
    } else {
      // not recognized -- each req should have an id
      console.log( '400 not recognized bad request' )
      res.status( 400 ).end() // bad request
    }
  } )
}

