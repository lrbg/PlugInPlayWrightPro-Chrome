const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => ({
  mode: argv.mode || 'development',
  devtool: argv.mode === 'production' ? false : 'inline-source-map',
  entry: {
    'popup/index': './src/popup/index.tsx',
    'background/service-worker': './src/background/service-worker.ts',
    'content/recorder': './src/content/recorder.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'public/popup.html', to: 'popup.html' },
        { from: 'manifest.json', to: 'manifest.json' },
        {
          from: 'public/icons',
          to: 'icons',
          noErrorOnMissing: true,
        },
      ],
    }),
  ],
  optimization: {
    splitChunks: false,
  },
});
