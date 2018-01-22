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
  let context;

  return buildContext(opts)
    .tap(result => context = result)
    .flatMap(() => util.streamPageUris(opts.prefix))
    .slice(0, opts.limit || Infinity)
    .flatMap(pageUri => reindexUtil.pageToDoc(pageUri, context))
    .through(reindexUtil.putDocs(
      opts.elasticIndex,
      opts.elasticPrefix,
      opts.batch
    ));
}

/**
 * Generate a context object from the specified opts. It includes data
 * that can be derived from opts and which are used by transforms
 * and (potentially) handlers.
 * @param  {Object} opts
 * @return {Object}
 */
function buildContext(opts) {
  return util.getSite(opts.prefix, opts.elasticPrefix)
    .map(site => Object.assign({}, opts, {site}));
}

module.exports = reindexSite;
