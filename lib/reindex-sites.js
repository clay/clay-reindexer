'use strict';

const util = require('./util'),
  reindexUtil = require('./reindex-util'),
  h = require('highland'),
  _ = require('lodash');

/**
 * Re-indexes the specified site.
 * @param  {Object} opts
 * @param  {string} opts.elasticIndex
 * @param  {string} opts.elasticPrefix
 * @param  {Object} [opts.handlers]
 * @return {Stream}
 */
function reindexSite(opts) {
  let context = Object.assign({}, opts);

  return addScheduleToContext(context)
    .flatMap(util.streamPageUris.bind(null, opts.prefix, opts.fetchOpts))
    // .filter(i => i === 'nymag.com/scienceofus/pages/cj0dzsyii00ascuye1inobx5k')
    .slice(0, opts.limit || Infinity)
    .map(pageUri => reindexUtil.pageToDoc(pageUri, context))
    .parallel(opts.parallel || 5)
    .through(reindexUtil.putDocs(
      opts.elasticIndex,
      opts.elasticPrefix,
      opts.batch
    ));
}

/**
 * Reindexes all sites.
 * @param  {Object} opts
 * @return {Stream}
 */
function reindexSites(opts) {
  return util.getSites(opts.elasticPrefix)
    .flatMap(site => {
      const siteOpts = _.cloneDeep(opts);

      siteOpts.fetchOpts = {headers: {'x-forwarded-host': site.host}};
      siteOpts.site = site;
      siteOpts.prefix += site.path;
      return reindexSite(siteOpts);
    });
}

function addScheduleToContext(context) {
  const scheduleUrl = `${context.prefix}/schedule`;

  if (context.schedule) return h.of(pageUri);
  return util.streamFetchJson(scheduleUrl, context.fetchOpts)
    .map(schedule => context.schedule = schedule);
}


module.exports = reindexSites;
