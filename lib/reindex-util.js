'use strict';

const h = require('highland'),
  client = require('./es-client'),
  errors = require('./errors'),
  _ = require('lodash'),
  {ELASTIC_PREFIX} = require('./constants'),
  {helpers: {indexWithPrefix}} = require('amphora-search');

/**
 * Given a stream of Elastic documents, put those docs into the specified
 * Elastic index.
 * @param  {string} elasticIndex
 * @param  {string} [elasticPrefix]
 * @param  {number} [batch=100] batch size
 * @return {Stream} of indexing results of the form {id, status}, where id is
 *                  Elastic doc ID and status is Elastic status code (e.g.
 *                  "200")
 */
function putDocs(elasticIndex, batch = 100) {
  const fullIndexName = indexWithPrefix(elasticIndex, ELASTIC_PREFIX);

  return (stream) => stream
    .batch(batch)
    .flatMap(docs => h.of(docsToBatchActions(docs, fullIndexName)))
    .flatMap(batchActions => h(client.bulk({body: batchActions})))
    .flatMap(results => h(results.items))
    .map(resultItem => {
      const id = resultItem.update._id,
        status = resultItem.update.status;

      if (status >= 200 && status < 300) {
        return {id, status: 'success'};
      } else {
        throw new errors.failedBulkAction(`Elastic batch action failed on ${id}`);
      }
    });
}

function docsToBatchActions(docs, elasticIndex) {
  return docs.reduce((acc, doc) => {
    acc.push({update: { _index: elasticIndex, _type: 'general', _id: doc._id }});
    acc.push({doc: _.omit(doc, ['_id']), doc_as_upsert: true});
    return acc;
  }, []);
}

module.exports.putDocs = putDocs;
