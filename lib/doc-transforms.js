'use strict';

/**
 * Each transform takes an Elastic doc and options ({prefix, elasticPrefix,
 * handlers}) and streams a partial doc to be merged into the original doc.
 */

const util = require('./util'),
  clayUtils = require('clayutils'),
  errors = require('./errors'),
  h = require('highland'),
  _ = require('lodash'),
  urlUtil = require('url');

/**
 * Fills "url" and "published" fields of doc
 * @param  {Object} doc
 * @param {string} opts.prefix
 * @return {Stream} doc partial
 */
function addPublishData(doc, {prefix} = {}) {
  const publishedPageUrl = util.getPageUrl(doc.uri, prefix, 'published');

  return util.streamFetchJson(publishedPageUrl)
    .map(publishedPageData => ({published: true, url: publishedPageData.url}))
    .errors((err, push) => {
      // if 404, assume page is not published
      if (err instanceof errors.request404) {
        return push(null, {published: false});
      }
      return push(err);
    });
}

/**
 * Fills "scheduled" and "scheduledTime" fields of doc
 * @param {Object} doc
 * @param {string} opts.prefix
 * @return {Stream} doc partial
 */
function addScheduleTime(doc, {prefix} = {}) {
  const scheduleEndpoint = `${prefix}/schedule`,
    pageUrl = util.getPageUrl(doc.uri, prefix);

  return util.streamFetchJson(scheduleEndpoint)
    .map(schedule => {
      const url = urlUtil.parse(pageUrl),
        {hostname, port} = url,
        // urls in the schedule itself always have a colon for port
        fixed = pageUrl.replace(hostname, hostname + ':' + (port || '')),
        matching = schedule.find(entry => entry.publish === fixed);

      return matching ?
        {scheduled: true, scheduledTime: matching.at} :
        {scheduled: false};
    });
}

/**
 * Check if doc.url is still a valid page url by checking it against the
 * /uris endpoint. If it does not exist, sets doc.url to null.
 * @param  {Object} doc
 * @param  {string} opts.prefix
 * @return {Stream} doc partial
 */
function validatePublishUrl(doc, {prefix} = {}) {
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
 * Fills "siteSlug".
 * @param {Object} doc
 * @param {string} opts.elasticPrefix
 * @returns {Stream}
 */
function addSiteSlug(doc, {elasticPrefix} = {}) {
  return getDocSite(doc, elasticPrefix)
    .pluck('slug')
    .map(slug => ({siteSlug: slug}));
}

/**
 * Apply all the handlers to the specified doc.
 * @param  {Object} doc
 * @param  {string} opts.prefix
 * @param  {Object} opts.handlers
 * @return {Stream} doc partial
 */
function applyHandlers(doc, {prefix, handlers, elasticPrefix} = {}) {
  const composedUrl = util.getPageUrl(doc.uri, prefix) + '.json';
  let site;

  return getDocSite(doc, elasticPrefix)
    .flatMap(result => {
      site = result;
      return util.streamFetchJson(composedUrl);
    })
    .flatMap(util.streamComponents)
    .flatMap(cmpt => applyCmptHandler(cmpt, handlers, site))
    .reduce({}, (acc, curr) => Object.assign(acc, curr));
}

/**
 * Stream the site object of the specified document.
 * @param  {Object} doc
 * @param  {string} elasticPrefix
 * @return {Stream}
 */
function getDocSite(doc, elasticPrefix) {
  const prefix = 'http://' + doc.uri.split('/pages/')[0];

  return util.getSite(prefix, elasticPrefix);
}

/**
 * Lookup the handler for the specified cmpt and apply it.
 * @param  {Object} cmpt Cmpt data (with _ref)
 * @param  {Object} handlers
 * @param  {Object} site
 * @return {Stream} of doc partials merged into doc
 */
function applyCmptHandler(cmpt, handlers, site) {
  const componentName = clayUtils.getComponentName(cmpt._ref),
    handler = handlers[componentName];
  let result;

  if (!handler) return h.of({});
  result = handler(cmpt._ref, _.omit(cmpt, '_ref'), site);
  return h.isStream(result) && result ||
    result.then && h(result) ||
    result && h.of(result) ||
    h.of({});
}

module.exports.applyHandlers = applyHandlers;
module.exports.addPublishData = addPublishData;
module.exports.addScheduleTime = addScheduleTime;
module.exports.validatePublishUrl = validatePublishUrl;
module.exports.addSiteSlug = addSiteSlug;
