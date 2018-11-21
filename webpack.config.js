const path = require('path');

module.exports = {
  entry: './src/SbbWeatherApp.js',
  output: {
    library: 'SbbWeatherApp',
    path: path.resolve(__dirname, 'dist'),
    filename: 'SbbWeatherApp.js'
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              [
                '@babel/preset-env',
                {
                  "useBuiltIns": "usage",
                  "debug": true
                }
              ]
            ]
          }
        }
      }
    ]
  }
};