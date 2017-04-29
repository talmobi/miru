var path = require('path')

module.exports = {
  entry: './scripts/app.js',
  output: {
    filename: 'bundle.js',
    path: path.join(__dirname, 'public')
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        query: {
          presets: ['es2015']
        }
      }
    ]
  }
}

// module.exports = {
//   entry: './scripts/app.js',
//   output: {
//     filename: 'bundle.js',
//     path: path.join(__dirname, 'public')
//   },
//   module: {
//     loaders: [
//       {
//         test: /\.js$/,
//         exclude: /node_modules/,
//         loaders: 'buble-loader',
//         query: {
//           objectAssign: 'Object.assign'
//         }
//       }
//     ]
//   }
// }
