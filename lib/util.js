'use strict';

const h = require('highland'),
  nodeFetch = require('node-fetch'),
  errors = require('./errors'),
  traverse = require('traverse'),
  clayUtils = require('clayutils'),
  client = require('./es-client'),
  urlUtil = require('url'),
  {ELASTIC_PREFIX, AMPHORA_HOST, VERBOSE} = require('./constants'),
  {helpers: {indexWithPrefix}} = require('amphora-search');

function streamFetch() {
  if (VERBOSE) console.log('>> Request: ', arguments);
  return h(nodeFetch.apply(this, arguments));
}

function streamFetchJson() {
  return streamFetch.apply(this, arguments)
    .flatMap(errIfNotOk)
    .flatMap(res => h(res.json()))
    .errors(processError(arguments));
}

function streamFetchText() {
  return streamFetch.apply(this, arguments)
    .flatMap(errIfNotOk)
    .tap(errIfNotOk)
    .flatMap(res => h(res.text()))
    .errors(processError(arguments));
}

function processError(args) {
  return (err, push) => {
    const message = `Request to ${args[0]} failed` +
      (err.status ? `(${err.status})` : '') + `: ${err.message}`;

    if (err.status === 404) {
      return push(new errors.request404(message));
    }
    return push(new Error(message));
  };
}

function errIfNotOk(res) {
  if (res.ok) return h.of(res);
  return h(res.text()) // you must read the response to close the client
    .map(() => {
      const err = new Error();

      err.status = res.status;
      throw err;
    });
}

/**
 * Streams the page URIs for the specified site via a GET request to
 * its pages endpoint.
 * @param  {string} path
 * @param  {Object} fetchOpts
 * @return {Stream} of page uris (strings)
 */
function streamPageUris(path, fetchOpts) {
  const url = `${AMPHORA_HOST}${path === '/' ? '' : path}/_pages`;


  return streamFetchJson(url, fetchOpts)
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
 * @param  {Object} opts e.g. {index: 'foo', type: '_doc', body: {query: {match: {foo: bar}}}}
 * @return {[type]}      [description]
 */
function streamSearch(opts) {
  opts.index = indexWithPrefix(opts.index, ELASTIC_PREFIX);

  return h(client.search(opts))
    .map(resp => resp.hits.hits)
    .flatten()
    .pluck('_source');
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
 * @param  {string} [version] e.g. "published"
 * @return {string}
 * @example
 * getPageUrl('foo.com/_pages/bar', 'http://zar.com') // http://zar.com/_pages/bar
 */
function getPageUrl(uri, version) {
  const {path} = parseUri(uri);
  let url = `${AMPHORA_HOST}${path === '/' ? '' : path}/_pages/${clayUtils.getPageInstance(uri)}`;

  if (version) url = clayUtils.replaceVersion(url, version);
  return url;
}

/**
 * Retrieve all sites in the sites index.
 * @return {Stream} of sites index documents
 */
function getSites() {
  return streamSearch({
    index: 'sites',
    type: '_doc',
    size: 99
  });
}

function getSite(host, path) {
  return streamSearch({
    index: 'sites',
    type: '_doc',
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
  });
}

/**
 * Stream all pages URIs across all sites.
 * @param  {string} baseUrl Base URL for requests, e.g. an IP or domain
 * @return {Stream}
 */
function streamAllPageUris() {
  return getSites()
    .flatMap(site => streamPageUris(site.path, {
      headers: {'x-forwarded-host': site.host}
    }));
}

/**
 * Return i as a stream.
 * @param  {*} i
 * @return {Stream}
 */
function makeStream(i) {
  if (h.isStream(i)) return i;
  if (typeof i === 'object' && i.then) return h(i);
  return h.of(i);
}

/**
 * Memoize a stream-returning function. Cache key is the first arg passed to
 * the fnc unless "resolver" option is set.
 * @param  {function} fnc
 * @param  {function} [resolver] Receives args passed to fnc, returns cache key
 * @return {function}
 */
function memoizeStream(fnc, resolver) {
  const cache = new Map();

  return function () {
    const key = typeof resolver === 'function' ?
      resolver.apply(this, arguments) :
      arguments[0];

    if (cache.has(key)) return h(cache.get(key));
    return fnc.apply(this, arguments)
      .collect()
      .flatMap(result => {
        cache.set(key, result);
        return h(result);
      });
  };
}

function parseUri(uri) {
  const base = uri.split('/_pages/')[0],
    {host, path, hostname} = urlUtil.parse(`http://${base}`);

  return {host, path, hostname};
}

/**
* Read from stdin
* @return {Stream} of stdin lines
**/
function readStdin() {
  if (process.stdin.isTTY) {
    return h([]);
  } else {
    return h(process.stdin)
      .split('\n')
      .filter(i => i)
      .invoke('toString');
  }
}

module.exports.memoizeStream = memoizeStream;
module.exports.getPageUrl = getPageUrl;
module.exports.logResult = logResult;
module.exports.streamComponents = streamComponents;
module.exports.streamFetch = streamFetch;
module.exports.streamFetchJson = streamFetchJson;
module.exports.streamFetchText = streamFetchText;
module.exports.streamPageUris = streamPageUris;
module.exports.streamSearch = streamSearch;
module.exports.getSites = getSites;
module.exports.streamAllPageUris = streamAllPageUris;
module.exports.makeStream = makeStream;
module.exports.readStdin = readStdin;
module.exports.getSite = getSite;
module.exports.parseUri = parseUri;
