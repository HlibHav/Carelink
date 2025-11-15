const path = require('node:path');
const baseConfig = require('../.eslintrc.cjs');

module.exports = {
  ...baseConfig,
  parserOptions: {
    ...baseConfig.parserOptions,
    project: path.join(__dirname, 'tsconfig.json'),
    tsconfigRootDir: __dirname,
  },
};
