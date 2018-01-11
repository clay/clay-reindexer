const util = require('./util'),
  clayUtils = require('clayutils'),
  errors = require('./errors'),
  h = require('highland'),
  _ = require('lodash'),
  urlUtil = require('url');

/**
 * Fills "url"
 * @param  {Object} doc
 * @param {string} prefix
 * @return {Stream}
 */
function addPublishData(doc, prefix) {
  const publishedPageUrl = util.getPageUrl(doc.uri, prefix, 'published');

  return util.streamFetchJson(publishedPageUrl)
    .map(publishedPageData => {
      doc.published = true;
      doc.url = publishedPageData.url;
      return doc;
    })
    .errors((err, push) => {
      doc.published = false;
      if (err === errors.request404) return push(null, doc);
      return push(err);
    });
}

/** 
 * Fills "scheduled" and "scheduledTime"
 * @param {Object} doc
 * @param {string} prefix
 */
function addScheduleTime(doc, prefix) {
  const scheduleEndpoint = `${prefix}/schedule`,
    pageUrl = util.getPageUrl(doc.uri, prefix);

  return util.streamFetchJson(scheduleEndpoint)
    .map(schedule => {
      const url = urlUtil.parse(pageUrl),
        {hostname, port} = url,
        // urls in the schedule itself always have a colon for port
        fixed = pageUrl.replace(hostname, hostname + ':' + (port || '')),
        matching = schedule.find(entry => entry.publish === fixed);

      if (matching) {
        doc.scheduled = true;
        doc.scheduledTime = matching.at;
      } else {
        doc.scheduled = false;
      }
      return doc;
    });
}

/**
 * Check if doc.url is still a valid page url by checking it against the
 * /uris endpoint. If it does not exist, sets doc.url to null.
 * @param  {Object} doc
 * @param  {string} prefix
 * @return {Stream}
 */
function validatePublishUrl(doc, prefix) {
  let encoded, uriUrl;
  
  if (!doc.url) return h.of(doc);
  encoded = Buffer.from(doc.url).toString('base64'),
  uriUrl = `${prefix}/uris/${encoded}`;
  return util.streamFetch(uriUrl)
    .map(res => {
      if (res.status === 404) throw errors.request404;
      return res.text();
    })
    .map(text => {
      if (text === doc.pageUri) return doc;
      doc.url = null;
      return doc;
    })
    .errors((err, push) => {c
      if (err === errors.request404) {
        doc.url = null;
        return push(null, doc);
      }
      push(err);
    });
}

/** 
 * Fills "siteSlug"
 * @param {Object} doc
 * @param {Stream}
 */
function addSiteSlug(doc, prefix) {
  return util.getSite(prefix)
    .map(site => {
      doc.siteSlug = site.slug;
      return doc;
    });
}

/**
 * Apply all the handlers to the specified doc.
 * @param  {Object} doc
 * @param  {string} prefix
 * @return {Stream} modified doc
 */
function applyHandlers(doc, prefix, handlers) {
  const composedUrl = util.getPageUrl(doc.uri, prefix) + '.json';

  return util.streamFetchJson(composedUrl)
    .errors((err, push) => {
      if (err === errors.request404) {
        return push(new Error(`Could not fetch composed JSON at ${composedUrl}`));
      }
      push(err);
    })
    .flatMap(util.streamComponents)
    .flatMap(cmpt => applyHandlersOnCmpt(cmpt, prefix, handlers))
    .tap(subDoc => _.assign(doc, subDoc))
    .collect()
    .map(() => doc);
}

/**
 * Apply all handlers
 * @param  {Object} cmpt cmpt data with _ref
 * @return {Stream} of subdocs, partial docs to be merged into doc
 */
function applyHandlersOnCmpt(cmpt, prefix, handlers) {
  const componentName = clayUtils.getComponentName(cmpt._ref),
    handler = handlers[componentName];

  if (!handler) return h.of({});
  return util.getSite(prefix)
    .flatMap(site => {
      const result = handler(cmpt._ref, _.omit(cmpt, '_ref'), site);

      return h.isStream(result) ? result : h.of(result);
    })
}

module.exports.applyHandlers = applyHandlers;
module.exports.addPublishData = addPublishData;
module.exports.addScheduleTime = addScheduleTime;
module.exports.validatePublishUrl = validatePublishUrl;
module.exports.addSiteSlug = addSiteSlug;
