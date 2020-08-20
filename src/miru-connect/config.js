export function getHostname () {
  return window.location.hostname
}

export function getHost () {
  return ( 'http:' + '//' + getHostname() )
}

export function getPort () {
  return window.__miru.port
}

export function getUri() {
  return ( getHost() + ':' + getPort() )
}
