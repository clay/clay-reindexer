const h = require('highland'),
  nodeFetch = require('node-fetch'),
  errors = require('./errors'),
  traverse = require('traverse');

function streamFetch(url, opts = {}) {
  return h(nodeFetch(url, Object.assign({}, opts)));
}

function streamFetchJson(url, opts = {}) {
  return streamFetch(url, opts)
    .flatMap(res => {
      if (res.status === 404) throw errors.request404;
      if (res.ok) return h(res.json());
    });
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

module.exports.streamSearch = streamSearch;
module.exports.streamFetch = streamFetch;
module.exports.streamFetchJson = streamFetchJson;
module.exports.queryElastic = queryElastic;
module.exports.logResult = logResult;
module.exports.streamComponents = streamComponents;
