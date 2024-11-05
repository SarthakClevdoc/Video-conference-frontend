const webpack = require('webpack');

module.exports = {
  webpack: {
    configure: {
      resolve: {
        fallback: {
          process: require.resolve("process/browser"),
          buffer: require.resolve("buffer/"),
          events: require.resolve("events/"),
          stream: require.resolve("stream-browserify"),
          util: require.resolve("util/"),
        },
      },
    },
    plugins: {
      add: [
        new webpack.ProvidePlugin({
          process: 'process/browser',
          Buffer: ['buffer', 'Buffer'],
        }),
      ],
    },
  },
};