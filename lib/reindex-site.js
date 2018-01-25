'use strict';

const util = require('./util'),
  reindexUtil = require('./reindex-util'),
  h = require('highland');

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
  let context = Object.assign({}, opts);

  return addScheduleToContext(context)
    .flatMap(util.streamPageUris.bind(null, opts.prefix, opts.fetchOpts))
    .slice(0, opts.limit || Infinity)
    // lookup site using first pageUri as opts.prefix is not necessarily
    // the site base path (e.g. could be an IP)
    .flatMap(addSiteToContext.bind(null, context))
    .map(pageUri => reindexUtil.pageToDoc(pageUri, context))
    .parallel(opts.parallel || 5)
    .through(reindexUtil.putDocs(
      opts.elasticIndex,
      opts.elasticPrefix,
      opts.batch
    ));
}

function addScheduleToContext(context) {
  const scheduleUrl = `${context.prefix}/schedule`;

  if (context.schedule) return h.of(pageUri);
  return util.streamFetchJson(scheduleUrl, context.fetchOpts)
    .map(schedule => context.schedule = schedule);
}

/**
 * Given a pageUri, parse base path, lookup site from "sites" index,
 * add the matching site to the context object, and stream the pageUri.
 * @param {Object} context
 * @param {string} pageUri
 * @return {Stream}
 */
function addSiteToContext(context, pageUri) {
  let basePath;

  if (context.site) return h.of(pageUri);
  basePath = 'http://' + pageUri.split('/pages/')[0];
  return util.getSite(basePath, context.elasticPrefix)
    .tap(site => context.site = site)
    .map(() => pageUri);
}

module.exports = reindexSite;
