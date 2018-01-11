const client = require('./es-client'),
  {streamSearch} = require('./util'),
  urlUtil = require('url'),
  h = require('highland');

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

module.exports = getSiteMemoized();
