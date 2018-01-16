'use strict';

const util = require('./lib/util'),
  reindexUtil = require('./lib/reindex-util'),
  args = require('yargs').argv,
  fs = require('fs'),
  _ = require('lodash'),
  path = require('path'),
  client = require('./lib/es-client'),
  runningAsScript = !module.parent;

function validateArgs(args) {
  if (!args.site) throw new Error('You must specify "site"');
  if (!args.elasticIndex) throw new Error('You must specify "elasticIndex"');
  if (!args.elasticHost) throw new Error('You must specify "elasticHost"');
}

/**
 * Re-indexes the specified site.
 * @param  {string} options.site
 * @param  {Object} options.client
 * @param  {string} options.elasticIndex
 * @param  {Object} [options.handlers]
 * @return {Stream}
 */
function reindexSite({site, elasticIndex, handlers}) {
  return util.streamPageUris(site)
    .flatMap(pageUri => reindexUtil.pageToDoc(pageUri, site, handlers))
    .through(reindexUtil.putDocs(elasticIndex));
}

/**
 * Retrieve all handlers.
 * @param  {string} dir directory relative to cwd where handlers are stored
 * @return {Object} mapping cmpt name to handler fnc
 */
function getHandlers(dir) {
  if (!dir) return {};
  dir = path.resolve(dir);
  return fs.readdirSync(dir)
    .filter(file => _.endsWith(file, '.js'))
    .reduce((acc, file) => {
      acc[file.slice(0, -3)] = require(path.join(dir, file));
      return acc;
    }, {});
}

function init() {
  const {site, elasticIndex} = args,
    handlers = getHandlers(args.handlers);

  reindexSite({site, client, elasticIndex, handlers})
    .errors((error, push) => {
      const resultObj = {error, status: 'error'};

      if (error.pageUri) resultObj.pageUri = error.pageUri;
      push(null, resultObj);
    })
    .tap(util.logResult())
    .done(() => process.exit());
}

validateArgs(args);

if (runningAsScript) {
  validateArgs(args);
  init();
}

// for testing
module.exports.getHandlers = getHandlers;
module.exports.reindexSite = reindexSite;
