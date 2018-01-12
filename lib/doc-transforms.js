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
 * @return {Stream} doc partial
 */
function addPublishData(doc, prefix) {
  const publishedPageUrl = util.getPageUrl(doc.uri, prefix, 'published');

  return util.streamFetchJson(publishedPageUrl)
    .map(publishedPageData => ({published: true, url: publishedPageData.url}))
    .errors((err, push) => {
      doc.published = false;
      if (err instanceof errors.request404) return push(null, {published: false});
      return push(err);
    });
}

/** 
 * Fills "scheduled" and "scheduledTime"
 * @param {Object} doc
 * @param {string} prefix
 * @return {Stream} doc partial
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
        return {scheduled: true, scheduledTime: matching.at};
      } else {
        return {scheduled: false};
      }
      return doc;
    });
}

/**
 * Check if doc.url is still a valid page url by checking it against the
 * /uris endpoint. If it does not exist, sets doc.url to null.
 * @param  {Object} doc
 * @param  {string} prefix
 * @return {Stream} doc partial
 */
function validatePublishUrl(doc, prefix) {
  let encoded, uriUrl, noProtocol;
  
  if (!doc.url) return h.of(doc);
  noProtocol = doc.url.replace('http://','').replace('https://','');
  encoded = Buffer.from(noProtocol).toString('base64'),
  uriUrl = `${prefix}/uris/${encoded}`;

  return util.streamFetchText(uriUrl)
    .map(text => {
      if (text === doc.uri) return {};
      return {url: null};
    })
    .errors((err, push) => {
      if (err instanceof errors.request404) {
        return push(null, {url: null});
      }
      push(err);
    });
}

/** 
 * Fills "siteSlug"
 * @param {Object} doc
 * @param {Stream} doc partial
 */
function addSiteSlug(doc, prefix) {
  return util.getSite(prefix)
    .map(site => ({siteSlug: site.slug}));
}

/**
 * Apply all the handlers to the specified doc.
 * @param  {Object} doc
 * @param  {string} prefix
 * @return {Stream} doc partial
 */
function applyHandlers(doc, prefix, handlers) {
  const composedUrl = util.getPageUrl(doc.uri, prefix) + '.json';

  return util.streamFetchJson(composedUrl)
    .errors((err, push) => {
      if (err === errors.request404) {
        return push(
          new Error(`Could not fetch composed JSON at ${composedUrl}`)
        );
      }
      push(err);
    })
    .flatMap(util.streamComponents)
    .flatMap(cmpt => applyHandlersOnCmpt(cmpt, prefix, handlers))
    .reduce({}, (out, curr) => Object.assign(out, curr));
}

/**
 * Apply all handlers
 * @param  {Object} cmpt cmpt data with _ref
 * @return {Stream} of doc partials merged into doc
 */
function applyHandlersOnCmpt(cmpt, prefix, handlers) {
  const componentName = clayUtils.getComponentName(cmpt._ref),
    handler = handlers[componentName];

  if (!handler) return h.of({});
  return util.getSite(prefix)
    .flatMap(site => {
      const result = handler(cmpt._ref, _.omit(cmpt, '_ref'), site);

      if (h.isStream(result)) return result;
      if (result.then) return h(result);
      return h.of(result);
    })
}

module.exports.applyHandlers = applyHandlers;
module.exports.addPublishData = addPublishData;
module.exports.addScheduleTime = addScheduleTime;
module.exports.validatePublishUrl = validatePublishUrl;
module.exports.addSiteSlug = addSiteSlug;
