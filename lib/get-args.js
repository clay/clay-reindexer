'use strict';
const yargs = require('yargs'),
  _ = require('lodash'),
  requireDirectory = require('require-directory');

/**
 * Confirm command-line args include all mandatory args.
 * @param  {Object} args
 * @return {Object} args
 */
function validateArgs(args) {
  if (!args.site) throw new Error('You must specify "site"');
  if (!args.elasticIndex) throw new Error('You must specify "elasticIndex"');
  if (!args.elasticHost) throw new Error('You must specify "elasticHost"');
  return args;
}

/**
 * Convert command-line args into programmatic options.
 * @param  {Object} args
 * @return {Object}
 */
function parseArgs(args) {
  const out = _.pickBy({
    prefix: formatUrl(args.site),
    elasticIndex: args.elasticIndex,
    elasticPrefix: args.elasticPrefix,
    elasticHost: formatUrl(args.elasticHost),
    handlers: args.handlers &&
      requireDirectory(module, args.handlers, {recurse: false})
  });

  return out;
}

function formatUrl(url) {
  return url.slice(-1) === '/' ? url.slice(0, url.length - 1) : url;
}

function getArgs(args = yargs.argv) {
  validateArgs(args);
  return parseArgs(args);
}

module.exports = getArgs;
