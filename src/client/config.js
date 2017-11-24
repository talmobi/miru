export const HOSTNAME = (
  window.location.hostname
)

export const HOST = (
  'http:' + '//' + HOSTNAME
)

export const PORT = (
  process.env.PORT || 4040
)

export const URI = (
  HOST + ':' + PORT
)
