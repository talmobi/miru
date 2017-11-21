export const HOST = (
  window.location.protocol + '//' +
  window.location.hostname
)

export const PORT = (
  process.env.PORT || 4040
)

export const URI = (
  HOST + ':' + PORT
)
