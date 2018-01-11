const {streamFetchJson, streamFetch, streamComponents, getPageUrl} = require('./util'),
  getSite = require('./get-site'),
  clayUtils = require('clayutils'),
  errors = require('./errors'),
  h = require('highland');

/**
 * Fills "url"
 * @param  {Object} doc
 * @param {string} prefix
 * @return {Stream}
 */
function addPublishData(doc, prefix) {
  const publishedPageUrl = getPageUrl(doc.uri, prefix, 'published');

  return streamFetchJson(publishedPageUrl)
    .map(publishedPageData => {
      doc.published = true;
      doc.url = publishedPageData.url;
      return doc;
    })
    .errors((err, push) => {
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
  const scheduleEndpoint = `${prefix}/schedule`;

  if (!doc.url) return h.of(doc);
  return streamFetchJson(scheduleEndpoint)
    .map(schedule => {
      const url = urlUtil.parse(doc.url),
        {hostname, port} = url,
        fixed = url.replace(hostname, hostname + ':' + port);

      const matching = schedule.find(entry => entry.publish === fixed);

      if (!matching) return doc;
      if (matching) {
        doc.scheduled = true;
        doc.scheduledTime = matching.at;
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
  return streamFetch(uriUrl)
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
  return getSite(prefix)
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
  const composedUrl = getPageUrl(doc.uri, prefix) + '.json';

  return streamFetchJson(composedUrl)
    .errors((err, push) => {
      if (err === errors.request404) {
        return push(new Error(`Could not fetch composed JSON at ${composedUrl}`));
      }
      push(err);
    })
    .flatMap(streamComponents)
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
  return getSite(prefix)
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
