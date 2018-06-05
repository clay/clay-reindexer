'use strict';
const yargs = require('yargs'),
  path = require('path'),
  requireDirectory = require('require-directory');

/**
 * Require all JS files in the specified dir, relative to cwd.
 * @param  {string} dir
 * @return {Object}
 */
function requireDir(dir) {
  return requireDirectory(module, path.join(process.cwd(), dir), {
    recurse: false
  });
}


/**
 * Remove trailing slash from url.
 * @param  {string} url
 * @return {string}
 */
function formatUrl(url) {
  return url.slice(-1) === '/' ? url.slice(0, url.length - 1) : url;
}

module.exports = yargs
  .command('pages', 'reindex from pages on all sites', yargs => yargs.coerce('handlers', requireDir))
  .coerce('amphoraHost', formatUrl)
  .coerce('transforms', requireDir)
  .number('batch')
  .number('limit')
  .number('parallel')
  .demandOption(['amphoraHost'])
  .argv;
