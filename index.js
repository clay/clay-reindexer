const {logResult, streamFetchJson, streamSearch} = require('./lib/util'),
  {getPageInstance} = require('clayutils'),
  urlUtil = require('url'),
  h = require('highland'),
  args = require('yargs').argv,
  _ = require('lodash'),
  elasticsearch = require('elasticsearch'),
  getSiteSlug = getSiteSlugMemoized();
  client = new elasticsearch.Client({host: args.elasticHost}),
  clayUtils = require('clayutils'),
  errors = require('./lib/errors'),
  searchElastic = streamSearch.bind(this, client);

function validateArgs() {
  if (!args.site) throw new Error('You must specify a prefix');
  if (!args.elasticHost) throw new Error('You must specify an elasticHost');
}

function processSite(prefix) {
  console.log('processing', prefix);
  return streamFetchJson(`${prefix}/pages`)
    .flatten()
    .flatMap(pageUri => processPage(prefix, pageUri))
    .tap(h.log)
    .errors((err, push) => {
      console.log('error!');
      console.log(err);
    })
    .doto(logResult);
}

function processPage(prefix, pageUri) {
  const elasticDoc = {
    createdAt: null,
    title: null,
    titleTruncated: null,
    authors: null,
    users: null,
    published: null,
    archived: null,
    scheduled: null,
    scheduledTime: null,
    publishTime: null,
    updateTime: null,
    url: null,
    uri: pageUri,
    siteSlug: null
  };

  return h([elasticDoc])
    .flatMap(doc => addSiteSlug(doc, prefix))
    .flatMap(doc => addPublishData(doc, prefix))
    .flatMap(doc => validatePublishUrl(doc, prefix))
    .flatMap(doc => addScheduleTime(doc, prefix))
}

/**
 * Fills "url"
 * @param  {Object} doc
 * @param {string} prefix
 * @return {Stream}
 */
function addPublishData(doc, prefix) {
  const pageUrl = `${prefix}/pages/${clayUtils.getPageInstance(doc.uri)}`,
    publishedPageUrl = clayUtils.replaceVersion(pageUrl, 'published');

  console.log('----', publishedPageUrl);
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
  
  if (!doc.url) return h([doc]);
  encoded = Buffer.from(doc.url).toString('base64'),
  uriUrl = `${prefix}/uris/${encoded}`;
  return streamFetch(uriUrl)
    .map(res => {
      if (result.status === 404) throw errors.request404;
      return res.text();
    })
    .map(text => {
      if (text === doc.pageUri) return doc;
      doc.url = null;
      return doc;
    })
    .errors((err, push) => {
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
  return getSiteSlug(prefix)
    .map(slug => {
      doc.siteSlug = slug;
      return doc;
    });
}

/** 
 * Return a memoized function that retrieves site slug from a prefix by
 * querying the _sites endpoint.
 * @return {function}
 */
function getSiteSlugMemoized() {
  const cache = {};

  /**
   * Stream a site slug from a site prefix.
   * @param  {prefix} prefix
   * @return {Stream}
   */
  return function (prefix) {
    let searchEndpoint, url, host, path;
    if (cache[prefix] !== undefined) return h.of(cache[prefix]);

    searchEndpoint = `${prefix}/_search`,
    url = urlUtil.parse(prefix);
    host = url.hostname;
    path = url.path === '/' ? '' : url.path;

    return searchElastic({
      index: 'local_sites_v1',
      type: 'general',
      body: {
        query: {
          bool: {
            filter: [
              {term: {host}},
              {term: {path}}
            ]
          }
        }
      }
    })
    .map((result) => {
      cache[prefix] = result.slug;
      return result;
    })
  }
}


function init() {
  processSite(args.site).done(() => process.exit());
}

init();
