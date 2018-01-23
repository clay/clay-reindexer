'use strict';

const h = require('highland'),
  docTransforms = require('./doc-transforms'),
  client = require('./es-client'),
  errors = require('./errors'),
  _ = require('lodash'),
  {helpers: {indexWithPrefix}} = require('amphora-search');

/**
 * Generate an Elastic document from the specified pageUri.
 * @param  {string} pageUri
 * @param  {Object} context
 * @return {Stream} Elastic document (object)
 */
function pageToDoc(pageUri, context) {
  const elasticDoc = {uri: pageUri};
  let transforms = [
    docTransforms.addSiteSlug,
    docTransforms.addPublishData,
    docTransforms.validatePublishUrl,
    docTransforms.addScheduleTime,
    docTransforms.applyCustomTransforms,
    docTransforms.applyHandlers
  ];

  return h(transforms)
    .flatMap(transform => transform(_.cloneDeep(elasticDoc), context))
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
 * @param  {string} [elasticPrefix]
 * @param  {number} [batch=100] batch size
 * @return {Stream} of indexing results of the form {id, status}, where id is
 *                  Elastic doc ID and status is Elastic status code (e.g.
 *                  "200")
 */
function putDocs(elasticIndex, elasticPrefix, batch = 100) {
  const fullIndexName = indexWithPrefix(elasticIndex, elasticPrefix);

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
    acc.push({update: { _index: elasticIndex, _type: 'general', _id: doc.uri }});
    acc.push({doc, doc_as_upsert: true});
    return acc;
  }, []);
}

module.exports.pageToDoc = pageToDoc;
module.exports.putDocs = putDocs;
