const path = require('path')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

module.exports = {
  entry: './src/app.js',
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
                  'useBuiltIns': 'usage'
                }
              ]
            ]
          }
        }
      },
      {
        test: /\.(css)$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader'
        ]
      },
      {
        test: /\.woff($|\?)|\.woff2($|\?)|\.ttf($|\?)|\.eot($|\?)|\.svg($|\?)/,
        use: {loader: 'file-loader',
          options: {
            name: '[path][name].[ext]'
          }
        }
      }
    ]
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: './SbbWeatherApp.css'
    })
  ]
}
