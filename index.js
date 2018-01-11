const {logResult, streamFetchJson, streamSearch, streamComponents, streamFetch} = require('./lib/util'),
  {getPageInstance} = require('clayutils'),
  urlUtil = require('url'),
  h = require('highland'),
  args = require('yargs').argv,
  fs = require('fs'),
  _ = require('lodash'),
  path = require('path'),
  elasticsearch = require('elasticsearch'),
  getSite = getSiteMemoized();
  client = new elasticsearch.Client({host: args.elasticHost}),
  clayUtils = require('clayutils'),
  errors = require('./lib/errors'),
  searchElastic = streamSearch.bind(this, client),
  handlers = getHandlers();

function validateArgs() {
  if (!args.site) throw new Error('You must specify "prefix"');
  if (!args.elasticIndex) throw new Error('You must specify "elasticIndex"');
  if (!args.elasticHost) throw new Error('You must specify "elasticHost"');
}

function processSite(prefix) {
  return streamDocs(prefix)
    .through(putDocs)
    .errors((error, push) => {
      const resultObj = {error, status: 'error'};

      if (error.pageUri) resultObj.pageUri = error.pageUri;
      push(null, resultObj);
    })
    .tap(logResult());
}

/**
 * Given a stream of Elastic documents, put those docs into the specified
 * Elastic index.
 * @param  {Stream} stream of docs (objects)
 * @return {Stream} of indexing results of the form {id, status}, where id is
 *                  Elastic doc ID and status is Elastic status code (e.g.
 *                  "200")
 */
function putDocs(stream) {
  const elasticIndex = args.elasticIndex;

  return stream
    .batch(1000)
    .flatMap(docs => {
      const body = docs.reduce((acc, doc, index) => {
        acc.push({index: { _index: elasticIndex, _type: 'general', _id: doc.uri }});
        acc.push(doc);
        return acc;
      }, [])

      return h(client.bulk({body}))
        .flatMap(results => h(results.items))
        .map(resultItem => ({
          id: resultItem.index._id,
          status: resultItem.index.status === 200 ? 'success' : 'error'
        }));
    })
}

/**
 * Stream the page URIs of the specified site.
 * @param  {prefix} prefix e.g. 'http://localhost.thecut.com:3001'
 * @return {Stream} of page URIs (strings)
 */
function streamDocs(prefix) {
  return streamFetchJson(`${prefix}/pages`)
    .flatten()
    .filter(pageUri => pageUri === 'localhost.thecut.com/pages/author')
    .flatMap(pageUri => processPage(pageUri, prefix));
}

/** 
 * Generate an Elastic document from the specified pageUri.
 * @param  {string} prefix
 * @param  {string} pageUri
 * @return {Stream} Elastic document (object)
 */
function processPage(pageUri, prefix) {
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

  return h.of(elasticDoc)
    .flatMap(doc => addSiteSlug(doc, prefix))
    .flatMap(doc => addPublishData(doc, prefix))
    .flatMap(doc => validatePublishUrl(doc, prefix))
    .flatMap(doc => addScheduleTime(doc, prefix))
    .flatMap(doc => applyHandlersOnDoc(doc, prefix))
    .errors((err, push) => {
      err.pageUri = pageUri;
      push(err);
    });
}

/**
 * Apply all the handlers to the specified doc.
 * @param  {Object} doc
 * @param  {string} prefix
 * @return {Stream} modified doc
 */
function applyHandlersOnDoc(doc, prefix) {
  const composedUrl = getPageUrl(doc, prefix) + '.json';

  return streamFetchJson(composedUrl)
    .errors((err, push) => {
      if (err === errors.request404) {
        return push(new Error(`Could not fetch composed JSON at ${composedUrl}`));
      }
      push(err);
    })
    .flatMap(streamComponents)
    .flatMap(cmpt => applyHandlersOnCmpt(cmpt, prefix))
    .tap(subDoc => _.assign(doc, subDoc))
    .collect()
    .map(() => doc);
}

/**
 * Apply all handlers
 * @param  {Object} cmpt cmpt data with _ref
 * @return {Stream} of subdocs, partial docs to be merged into doc
 */
function applyHandlersOnCmpt(cmpt, prefix) {
  const componentName = clayUtils.getComponentName(cmpt._ref),
    handler = handlers[componentName];

  if (!handler) return h.of({});
  return getSite(prefix)
    .flatMap(site => {
      const result = handler(cmpt._ref, _.omit(cmpt, '_ref'), site);

      return h.isStream(result) ? result : h.of(result);
    })
}

/**
 * Retrieve all handlers.
 * @return {Object} mapping of component name to handler fnc
 */
function getHandlers() {
  let dir = args.handlers;

  if (!dir) return {};
  dir = path.resolve(dir);
  return fs.readdirSync(dir)
    .filter(file => _.endsWith(file, '.js'))
    .reduce((acc, file) => {
      acc[file.slice(0, -3)] = require(path.join(dir, file));
      return acc;
    }, {});
}

/**
 * Return the page URL corresponding to a doc with a "uri" property.
 * @param  {Object} doc Partial pages index doc with a "uri" property
 * @param  {string} prefix Page instance name is affixed to this prefix.
 * @param  {string} [version] e.g. "published"
 * @return {string}
 * @example
 * getPageUrl({uri: 'foo.com/pages/bar'}, 'http://zar.com') // http://zar.com/pages/bar
 */
function getPageUrl(doc, prefix, version) {
  let url = `${prefix}/pages/${clayUtils.getPageInstance(doc.uri)}`;

  if (version) url = clayUtils.replaceVersion(url, version);
  return url;
}

/**
 * Fills "url"
 * @param  {Object} doc
 * @param {string} prefix
 * @return {Stream}
 */
function addPublishData(doc, prefix) {
  const publishedPageUrl = getPageUrl(doc, prefix, 'published');

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
 * Return a memoized function that retrieves site slug from a prefix by
 * querying the _sites endpoint.
 * @return {function}
 */
function getSiteMemoized() {
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
      cache[prefix] = result;
      return result;
    })
  }
}


function init() {
  processSite(args.site).done(() => process.exit());
}

init();
