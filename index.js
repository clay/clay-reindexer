'use strict';

const util = require('./lib/util'),
  reindexUtil = require('./lib/reindex-util'),
  args = require('yargs').argv,
  client = require('./lib/es-client'),
  requireDirectory = require('require-directory'),
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

function init() {
  const {site, elasticIndex} = args,
    handlers = requireDirectory(module, args.handlers, {recurse: false});

  console.log('handlers');

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
module.exports.reindexSite = reindexSite;
