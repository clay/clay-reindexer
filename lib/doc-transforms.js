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
 * @param {string} context.prefix
 * @return {Stream} doc partial
 */
function addPublishData(doc, {prefix}) {
  const publishedPageUrl = util.getPageUrl(doc.uri, prefix, 'published');

  return util.streamFetchJson(publishedPageUrl)
    .map(({url, lastModified}) => ({
      published: true,
      url,
      publishTime: lastModified && new Date(lastModified) || null
    }))
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
 * @param {string} context.prefix
 * @return {Stream} doc partial
 */
function addScheduleTime(doc, {prefix}) {
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
 * @param  {string} context.prefix
 * @return {Stream} doc partial
 */
function validatePublishUrl(doc, {prefix}) {
  let encoded, uriUrl, noProtocol;

  if (!doc.url) return h.of({});
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
 * @param {Object} context
 * @param {Object} context.site
 * @param {string} context.site.slug
 * @returns {Stream}
 */
function addSiteSlug(doc, {site: {slug}}) {
  return h.of({siteSlug: slug});
}

/**
 * Apply all the handlers to the specified doc.
 * @param  {Object} doc
 * @param  {Object} context
 * @param  {string} context.prefix
 * @param  {Object} context.handlers
 * @return {Stream} doc partial
 */
function applyHandlers(doc, context) {
  const composedUrl = util.getPageUrl(doc.uri, context.prefix) + '.json';

  return util.streamFetchJson(composedUrl)
    .flatMap(util.streamComponents)
    .flatMap(cmpt => applyCmptHandler(cmpt, context))
    .reduce({}, (acc, curr) => Object.assign(acc, curr));
}

/**
 * Lookup the handler for the specified cmpt and apply it.
 * @param  {Object} cmpt Cmpt data (with _ref)
 * @param  {Object} context Handler context, passed to each handler as third argument.
 * @return {Stream} of doc partials merged into doc
 */
function applyCmptHandler(cmpt, context) {
  const componentName = clayUtils.getComponentName(cmpt._ref),
    handler = context.handlers[componentName];
  let result;

  if (!handler) return h.of({});
  result = handler(cmpt._ref, _.omit(cmpt, '_ref'), context);

  if (result) return makeStream(result);
  return h.of({});
}

function applyCustomTransforms(doc, context) {
  if (!context.transforms) return h.of({});
  return h.values(context.transforms)
    .flatMap(transform => {
      const cloned = _.cloneDeep(doc); // prevent overwriting doc directly

      return makeStream(transform(cloned, context));
    })
    .reduce({}, (acc, curr) => Object.assign(acc, curr));
}

function makeStream(i) {
  if (h.isStream(i)) return i;
  if (typeof i === 'object' && i.then) return h(i);
  return h.of(i);
}

module.exports.addPublishData = addPublishData;
module.exports.addScheduleTime = addScheduleTime;
module.exports.addSiteSlug = addSiteSlug;
module.exports.applyCustomTransforms = applyCustomTransforms;
module.exports.applyHandlers = applyHandlers;
module.exports.validatePublishUrl = validatePublishUrl;
