'use strict';
const yargs = require('yargs'),
  _ = require('lodash'),
  path = require('path'),
  requireDirectory = require('require-directory');

/**
 * Convert command-line args into programmatic options.
 * @param  {Object} args
 * @return {Object}
 */
function parseArgs(args) {
  const out = _.pickBy({
    prefix: formatUrl(args.prefix),
    elasticIndex: args.elasticIndex,
    elasticPrefix: args.elasticPrefix,
    elasticHost: formatUrl(args.elasticHost),
    handlers: args.handlers &&
      requireDirectory(module, path.join(process.cwd(), args.handlers), {
        recurse: false
      }),
    batch: args.batch
  });

  return out;
}

/**
 * Remove trailing slash from url.
 * @param  {string} url
 * @return {string}
 */
function formatUrl(url) {
  return url.slice(-1) === '/' ? url.slice(0, url.length - 1) : url;
}

/**
 * Return command-line arguments as programmatic options.
 * @param {Object} [args]
 * @return {Object}
 */
function getArgs() {
  const args = yargs
    .demandOption(['prefix','elasticIndex', 'elasticHost'])
    .argv;

  // validateArgs(args);
  return parseArgs(args);
}

module.exports = getArgs;
