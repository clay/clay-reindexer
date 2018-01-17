'use strict';

const util = require('./lib/util'),
  reindexUtil = require('./lib/reindex-util'),
  args = require('yargs').argv,
  requireDirectory = require('require-directory'),
  runningAsScript = !module.parent;

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
 * Re-indexes the specified site.
 * @param  {Object} opts
 * @param  {string} opts.site
 * @param  {string} opts.elasticIndex
 * @param  {string} opts.elasticPrefix
 * @param  {Object} [opts.handlers]
 * @return {Stream}
 */
function reindexSite(opts) {
  return util.streamPageUris(opts.prefix)
    .flatMap(pageUri => reindexUtil.pageToDoc(pageUri, opts))
    .through(reindexUtil.putDocs(opts.elasticIndex, opts.elasticPrefix));
}

/**
 * Convert command-line args into programmatic options.
 * @param  {Object} args
 * @return {Object}
 */
function parseArgs(args) {
  return {
    prefix: args.site,
    elasticIndex: args.elasticIndex,
    elasticPrefix: args.elasticPrefix,
    handlers: args.handlers &&
      requireDirectory(module, args.handlers, {recurse: false})
  };
}

function init() {
  reindexSite(parseArgs(args))
    .errors((error, push) => {
      const resultObj = {error, status: 'error'};

      if (error.pageUri) resultObj.pageUri = error.pageUri;
      push(null, resultObj);
    })
    .tap(util.logResult())
    .done(process.exit);
}

if (runningAsScript) {
  validateArgs(args);
  init();
}

// for testing
module.exports.reindexSite = reindexSite;
