const fs = require('fs-extra');
const path = require('path');

const isNull = (v) => {
  return v === undefined && v === null;
};

class SophicSwWebpackPlugin {
  options;
  swFile;

  constructor(options) {
    this.options = options;

    this.options.expirationHour =
      isNull(options.expirationHour) || isNaN(options.expirationHour)
        ? 72
        : Number(options.expirationHour);

    fs.readFile(path.resolve(__dirname, './sw.js'), 'utf8', (err, data) => {
      this.swFile = data;
    })
  }

  apply(compiler) {
    compiler.hooks.done.tapPromise(this.constructor.name, ({compilation}) => {
      const baseURL = compilation.compiler.options.output.path;
      const fileContent = this.swFile
        .replace(/__expirationHour__/g, `"${this.options.expirationHour}"`)
      return fs.outputFile(baseURL + '/sw.js', fileContent).catch(err => {
        console.error(err)
      })
    })
  }
}

module.exports = SophicSwWebpackPlugin;
