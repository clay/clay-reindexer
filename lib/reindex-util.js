'use strict';

const h = require('highland'),
  docTransforms = require('./doc-transforms'),
  client = require('./es-client'),
  errors = require('./errors');

/**
 * Generate an Elastic document from the specified pageUri.
 * @param  {string} pageUri
 * @param  {string} prefix
 * @param  {Object} handlers
 * @return {Stream} Elastic document (object)
 */
function pageToDoc(pageUri, prefix, handlers) {
  const elasticDoc = {uri: pageUri};

  return h([
    docTransforms.addSiteSlug,
    docTransforms.addPublishData,
    docTransforms.validatePublishUrl,
    docTransforms.addScheduleTime,
    docTransforms.applyHandlers
  ])
    .flatMap(transform => transform(elasticDoc, prefix, handlers))
    .tap(partialDoc => Object.assign(elasticDoc, partialDoc))
    .collect()
    .map(() => elasticDoc)
    .errors((err, push) => {
      err.pageUri = pageUri;
      push(err);
    });
}

/**
 * Given a stream of Elastic documents, put those docs into the specified
 * Elastic index.
 * @param  {string} elasticIndex
 * @return {Stream} of indexing results of the form {id, status}, where id is
 *                  Elastic doc ID and status is Elastic status code (e.g.
 *                  "200")
 */
function putDocs(elasticIndex) {
  return (stream) => stream
    .batch(1000)
    .flatMap(docs => h.of(docsToBatchActions(docs, elasticIndex)))
    .flatMap(batchActions => h(client.bulk({body: batchActions})))
    .flatMap(results => h(results.items))
    .map(resultItem => {
      const id = resultItem.update._id;

      if (resultItem.update.status === 200) {
        return {id, status: 'success'};
      } else {
        throw new errors.failedBulkAction(`Elastic batch action failed on ${id}`);
      }
    });
}

function docsToBatchActions(docs, elasticIndex) {
  return docs.reduce((acc, doc) => {
    acc.push({update: { _index: elasticIndex, _type: 'general', _id: doc.uri }});
    acc.push({doc, doc_as_upsert: true});
    return acc;
  }, []);
}

module.exports.pageToDoc = pageToDoc;
module.exports.putDocs = putDocs;
