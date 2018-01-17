'use strict';

const util = require('./util'),
  reindexUtil = require('./reindex-util');

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
    .flatMap(pageUri => {
      return reindexUtil.pageToDoc(pageUri, opts);
    })
    .through(reindexUtil.putDocs(opts.elasticIndex, opts.elasticPrefix));
}

module.exports = reindexSite;
