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
    transforms: args.transforms &&
      requireDirectory(module, path.join(process.cwd(), args.transforms), {
        recurse: false
      }),
    batch: args.batch,
    limit: args.limit,
    parallel: args.parallel,
    fetchOpts: getFetchOpts(args),
    'x-forwarded-host': args['x-forwared-host']
  });

  return out;
}

function getFetchOpts(args) {
  const fetchOpts = {};

  if (args['x-forwarded-host']) {
    fetchOpts.headers = {
      'x-forwarded-host': args['x-forwarded-host']
    };
  }
  return fetchOpts;
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
    .demandOption([ // Requires these args
      'prefix',
      'elasticIndex',
      'elasticHost'
    ])
    .argv;

  return parseArgs(args);
}

module.exports = getArgs;
