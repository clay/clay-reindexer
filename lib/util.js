const h = require('highland'),
  nodeFetch = require('node-fetch'),
  errors = require('./errors'),
  traverse = require('traverse'),
  clayUtils = require('clayutils'),
  client = require('./es-client'),
  urlUtil = require('url');

function streamFetch(url, opts = {}) {
  return h(nodeFetch(url, Object.assign({}, opts)));
}

function streamFetchJson(url, opts = {}) {
  return streamFetch(url, opts)
    .tap(res => {
      if (res.status === 404) throw new errors.request404();
    })
    .flatMap(res => h(res.json()));
}

function streamFetchText(url, opts = {}) {
  return streamFetch(url, opts)
    .tap(res => {
      if (res.status === 404) throw new errors.request404();
    })
    .flatMap(res => h(res.text()));
}

function queryElastic(url, reqBody) {
  return streamFetch(url, {
    method: 'POST',
    body: JSON.stringify(reqBody),
    headers: {
      'Content-Type': 'application/json'
    }
  })
    .flatMap(res => h(res.json()));
}

/**
 * Streams the page URIs for the specified site via a GET request to
 * its pages endpoint.
 * @param  {string} prefix
 * @return {Stream} of page uris (strings)
 */
function streamPageUris(prefix) {
  return streamFetchJson(`${prefix}/pages`)
    .flatten();
}

/**
* Returns a function that adds an index number to each result and logs it.
* @return {function}
*/
function logResult() {
  let i = 0;

  return (result) => {
    result.index = i++;
    if (result.error) {
      result.error = result.error.stack;
    }
    console.log(JSON.stringify(result));
  };
}

/** 
 * Searches Elastic.
 * @param  {Object} opts e.g. {index: 'foo', type: 'general', body: {query: {match: {foo: bar}}}}
 * @return {[type]}      [description]
 */
function streamSearch(client, opts) {
  return h(client.search(opts))
    .map(resp => resp.hits.hits)
    .flatten()
    .map(hit => hit._source);
}

/**
 * Given composed page data, stream components within.
 * @param  {Object} composedPageObj
 * @return {Stream}
 */
function streamComponents(composedPageObj) {
  const cmpts = traverse(composedPageObj).reduce(function (acc, x) {
    if (typeof x === 'object' && x && x._ref) acc.push(x);
    return acc;
  }, []);

  return h(cmpts);
}

/**
 * Return the page URL corresponding to a doc with a "uri" property.
 * @param  {string} uri
 * @param  {string} prefix Page instance name is affixed to this prefix.
 * @param  {string} [version] e.g. "published"
 * @return {string}
 * @example
 * getPageUrl('foo.com/pages/bar', 'http://zar.com') // http://zar.com/pages/bar
 */
function getPageUrl(uri, prefix, version) {
  let url = `${prefix}/pages/${clayUtils.getPageInstance(uri)}`;

  if (version) url = clayUtils.replaceVersion(url, version);
  return url;
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

    return streamSearch(client, {
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

module.exports.streamSearch = streamSearch;
module.exports.streamFetch = streamFetch;
module.exports.streamFetchJson = streamFetchJson;
module.exports.streamFetchText = streamFetchText;
module.exports.queryElastic = queryElastic;
module.exports.logResult = logResult;
module.exports.streamComponents = streamComponents;
module.exports.streamPageUris = streamPageUris;
module.exports.getPageUrl = getPageUrl;
module.exports.getSite = getSiteMemoized();
