'use strict';

const util = require('./util'),
  clayUtils = require('clayutils'),
  errors = require('./errors'),
  h = require('highland'),
  _ = require('lodash'),
  urlUtil = require('url'),
  docTransforms = require('./doc-transforms'),
  getSiteMemoized = util.memoizeStream(util.getSite, (...args) => args.join()),
  {AMPHORA_HOST} = require('./constants');

function getFetchOpts(uri) {
  return {headers: {'x-forwarded-host': util.parseUri(uri).host}};
}

/**
 * Adds URI to the elastic doc.
 * @param {string} uri
 * @param {Object} doc
 */
function addUri(uri) {
  return {uri, _id: uri};
}

/**
 * Fills "url" and "published" fields of doc
 * @param  {Object} doc
 * @return {Stream} doc partial
 */
function addPublishData(uri) {
  const publishedPageUrl = util.getPageUrl(uri, 'published'),
    fetchOpts = getFetchOpts(uri);

  return util.streamFetchJson(publishedPageUrl, fetchOpts)
    .map(({url, lastModified, customUrl}) => ({
      published: true,
      url: customUrl || url,
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
 * @return {Stream} doc partial
 */
function addScheduleTime(uri) {
  const {path} = util.parseUri(uri),
    scheduleUrl = `${AMPHORA_HOST}${path === '/' ? '' : path}/schedule`,
    fetchOpts = getFetchOpts(uri);

  return util.streamFetchJson(scheduleUrl, fetchOpts)
    .flatMap(schedule => {
      const matching = schedule.find(entry => {
        const {host, path} = urlUtil.parse(entry.publish);

        return `${host}${path}` === uri;
      });

      return matching ?
        h.of({scheduled: true, scheduledTime: matching.at}) :
        h.of({scheduled: false});
    });
}

/**
 * Check if doc.url is still a valid page url by checking it against the
 * /uris endpoint. If it does not exist, sets doc.url to null.
 * @param  {Object} doc
 * @return {Stream} doc partial
 */
function validatePublishUrl(uri, doc) {
  const fetchOpts = getFetchOpts(uri);
  let encoded, uriUrl, noProtocol;

  if (!doc.url) return h.of({});
  noProtocol = doc.url.replace('http://','').replace('https://','');
  encoded = Buffer.from(noProtocol).toString('base64'),
  uriUrl = `${AMPHORA_HOST}/uris/${encoded}`;

  return util.streamFetchText(uriUrl, fetchOpts)
    .map(text => {
      if (text === uri) return {};
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
 * @returns {Stream}
 */
function addSiteSlug(uri) {
  const {hostname, path} = util.parseUri(uri);

  return getSiteMemoized(hostname, path)
    .pluck('slug')
    .map(siteSlug => ({siteSlug}));
}

/**
 * Apply all the handlers to the specified doc.
 * @param  {Object} doc
 * @return {Stream} doc partial
 */
function applyHandlers(uri, doc, handlers = {}) {
  const pageUrl = util.getPageUrl(uri),
    composedUrl = `${pageUrl}.json`,
    fetchOpts = getFetchOpts(uri);

  return util.streamFetchJson(composedUrl, fetchOpts)
    .flatMap(util.streamComponents)
    .flatMap(cmpt => applyCmptHandler(cmpt, handlers))
    .reduce({}, (acc, curr) => Object.assign(acc, curr));
}

/**
 * Lookup the handler for the specified cmpt and apply it.
 * @param  {Object} cmpt Cmpt data (with _ref)
 * @return {Stream} of doc partials merged into doc
 */
function applyCmptHandler(cmpt, handlers) {
  const componentName = clayUtils.getComponentName(cmpt._ref),
    handler = handlers[componentName];
  let result;

  if (!handler) return h.of({});
  result = handler(cmpt._ref, _.omit(cmpt, '_ref'));

  if (result) return makeStream(result);
  return h.of({});
}

function pageTransform(uri, doc, handlers, customTransforms) {
  const fncs = [
    addUri,
    addSiteSlug,
    addPublishData,
    validatePublishUrl,
    addScheduleTime,
    customTransforms &&
      docTransforms.applyTransforms.bind(null, uri, doc, customTransforms),
    _.partialRight(applyHandlers, handlers)
  ].filter(i => i);

  return h(fncs)
    .flatMap(fnc => util.makeStream(fnc(uri,doc)))
    .reduce({}, Object.assign);
}

function generatePageTransform(handlers, customTransforms) {
  return _.partialRight(pageTransform, [handlers, customTransforms]);
}

module.exports.generatePageTransform = generatePageTransform;
module.exports.addUri = addUri;
module.exports.addPublishData = addPublishData;
module.exports.addScheduleTime = addScheduleTime;
module.exports.addSiteSlug = addSiteSlug;
module.exports.validatePublishUrl = validatePublishUrl;
module.exports.applyHandlers = applyHandlers;
module.exports.applyCmptHandler = applyCmptHandler;
