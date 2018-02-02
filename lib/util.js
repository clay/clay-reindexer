'use strict';

const h = require('highland'),
  nodeFetch = require('node-fetch'),
  errors = require('./errors'),
  traverse = require('traverse'),
  clayUtils = require('clayutils'),
  client = require('./es-client'),
  {helpers: {indexWithPrefix}} = require('amphora-search');

function streamFetch() {
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
 * @param  {string} prefix
 * @param  {Object} fetchOpts
 * @return {Stream} of page uris (strings)
 */
function streamPageUris(prefix, fetchOpts) {
  return streamFetchJson(`${prefix}/pages`, fetchOpts)
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
function streamSearch(opts) {
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
 * Retrieve all sites in the sites index.
 * @param  {string} elasticPrefix
 * @return {Stream} of sites index documents
 */
function getSites(elasticPrefix) {
  return streamSearch({
    index: indexWithPrefix('sites', elasticPrefix),
    type: 'general',
    size: 99
  });
}

module.exports.getPageUrl = getPageUrl;
module.exports.logResult = logResult;
module.exports.streamComponents = streamComponents;
module.exports.streamFetch = streamFetch;
module.exports.streamFetchJson = streamFetchJson;
module.exports.streamFetchText = streamFetchText;
module.exports.streamPageUris = streamPageUris;
module.exports.streamSearch = streamSearch;
module.exports.getSites = getSites;
