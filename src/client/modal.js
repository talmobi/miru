/* global window */

import { el, list, mount } from 'redom'
import * as pesticide from './pesticide.js'

import ansiToHtml from './ansi-to-html.js'
import stripAnsi from './strip-ansi.js'

const MODAL_ID = '__miru-error-modal-id'

let _isVisible = false

const modal = Modal()

mount( document.body, modal )

export default modal

function Message () {
  let _el = el(
    '.__miru-error-modal__text',
    {
      style: {
        'line-height': '1.5em',
        'opacity': 1,
        'white-space': 'pre',
        'color': '#fbf1c7',
        'background': '#1d2021',
        'padding': '4px 8px',
        'margin-bottom': '8px',
        'overflow-x': 'auto'
      }
    }
  )

  function update ( message ) {
    var text = ( message.text || message )

    // mouse hover for stripped message
    _el.title = stripAnsi( text )

    let html = stripAnsi( ansiToHtml( text ) )
    _el.innerHTML = html
  }

  return {
    el: _el,
    update: update
  }
}

function Modal () {
  let _name, _text, _help, _list

  let _el = el(
    '.__miru-error-modal',
    {
      id: MODAL_ID,
      style: {
        'margin': 0,
        'padding': 0,

        'transition': 0,
        'opacity': 0,
        'display': 'none',

        'position': 'fixed',
        'top': 0,
        'left': 0,

        'width': '100%',
        'height': '100%',

        'background-color': '#b6442f',
        'color': '#eee',

        'opacity': 0.9725,
        'white-space': 'pre-wrap',
        'z-index': 2147483646 - 2,

        'font-family': "'Monaco', 'Space Mono', 'Anonymous Pro', monospace",
        'font-size': '16px',
        'line-height': '1.25em'
      }
    },
    _help = el(
      'a.__miru-error-modal__help',
      {
        href: 'https://github.com/talmobi/miru',
        style: {
          'margin': 0,
          'padding': '2px',

          'position': 'fixed',
          'top': 0,
          'right': 0,

          'font-size': '10px',
          'line-height': '10px',

          'color': '#fbf1c7',
          'background': '#1d2021'

          // 'background': '#fbf1c7'
          // 'color': '#fbf1c7',
          // 'background': '#1d2021'
        }
      }, 'https://github.com/talmobi/miru'
    ),
    _name = el(
      '.__miru-error-modal__name',
      {
        style: {
          'white-space': 'pre',
          'padding': '0.675em',
          'border': '0px solid back !important',
          'border-bottom': '1px solid #bb4444'
        }
      }, '[miru] error modal' ),
    _list = list(
      '.__miru-error-modal__list',
      Message
    )
  )

  _list.el.style[ 'margin' ] = '0'
  _list.el.style[ 'padding' ] = '0'

  function update ( opts ) {
    window.__miru.debug( '[miru] modal update called' )
    _isVisible = true

    if ( opts ) {
      let title = ( opts.name || opts.title )
      let messages = ( opts.messages || opts.message || opts.text || opts )

      if ( !( messages instanceof Array ) ) {
        messages = [ messages ]
      }

      title = '[miru] ' + ( title || '[ unknown title ]' )
      _name.innerHTML = title

      // console.log( 'messages.length: ' + messages.length )
      _list.update( messages )

      // disable pesticide when showing error
      // this fixes bug in IE11 ( IE11 does not support css unset attribute )
      pesticide.disablePesticide()
    } else {
      _isVisible = false

      // will show pesticide again if it is enabled
      pesticide.update()
    }

    _el.style[ 'display' ] = ( _isVisible === false ? 'none' : 'block' )

    window.__miru.modalVisible = !!_isVisible
  }

  return {
    el: _el,
    update
  }
}

export function showModal () {
  _isVisible = true
  modal.update()
}

export function hideModal () {
  _isVisible = false
  modal.update()
}
