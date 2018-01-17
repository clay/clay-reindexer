'use strict';

const util = require('./lib/util'),
  reindexUtil = require('./lib/reindex-util'),
  getArgs = require('./lib/get-args'),
  runningAsScript = !module.parent;

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

function init() {
  const opts = getArgs();

  reindexSite(opts)
    .errors((error, push) => {
      const resultObj = {error, status: 'error'};

      if (error.pageUri) resultObj.pageUri = error.pageUri;
      push(null, resultObj);
    })
    .tap(util.logResult())
    .done(process.exit);
}

if (runningAsScript) init();
module.exports.reindexSite = reindexSite;
