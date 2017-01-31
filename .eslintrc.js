module.exports = {
  root: true,

  parser: 'babel-eslint',

  'extends': 'standard',
  'plugins': [
    'standard',
    'promise'
  ],

  env: {
    browser: true,
    commonjs: true,
    es6: true,
    node: true
  },

  settings: {
    'import/ignore': [
      'node_modules',
      '\\.(json|css|jpg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm)$',
    ],
    'import/extensions': ['.js'],
    'import/resolver': {
      node: {
        extensions: ['.js', '.json']
      }
    }
  },
};
