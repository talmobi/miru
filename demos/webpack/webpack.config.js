const path = require( 'path' )

module.exports = {
  entry: './scripts/app.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve( __dirname, 'public' )
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      }
    ]
  }
}
