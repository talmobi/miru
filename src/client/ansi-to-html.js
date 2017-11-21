const AnsiToHtmlFilter = require( 'ansi-to-html' )

const colors_gruvbox = {
  0: '#665c54',
  1: '#cc241d',
  2: '#98971a',
  3: '#d79921',
  4: '#458588',
  5: '#b16286',
  6: '#689d6a',
  7: '#a89984',
  8: '#928374',
  9: '#fb4934',
  10: '#b8bb26',
  11: '#fabd2f',
  12: '#83a598',
  13: '#d3869b',
  14: '#8ec97c',
  15: '#ebdbb2'
}

const ansiToHtmlFilter = new AnsiToHtmlFilter({
  fg: '#fbf1c7',
  bg: '#1d2021',
  colors: Object.assign( {}, colors_gruvbox ), // override color palette
  stream: false // do not save style state across invocations of toHtml()
})

export default function ansiToHtml ( text ) {
  return ansiToHtmlFilter.toHtml( text )
}
