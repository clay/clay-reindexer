/** 
 * Generate an Elastic document from the specified pageUri.
 * @param  {string} prefix
 * @param  {string} pageUri
 * @return {Stream} Elastic document (object)
 */
function pageToDoc(pageUri, prefix, handlers) {
  const elasticDoc = {uri: pageUri};

  return h.of(elasticDoc)
    .flatMap(doc => docTransforms.addSiteSlug(doc, prefix))
    .flatMap(doc => docTransforms.addPublishData(doc, prefix))
    .flatMap(doc => docTransforms.validatePublishUrl(doc, prefix))
    .flatMap(doc => docTransforms.addScheduleTime(doc, prefix))
    .flatMap(doc => docTransforms.applyHandlers(doc, prefix, handlers))
    .errors((err, push) => {
      err.pageUri = pageUri;
      push(err);
    });
}

/**
 * Given a stream of Elastic documents, put those docs into the specified
 * Elastic index.
 * @param  {Stream} stream of docs (objects)
 * @return {Stream} of indexing results of the form {id, status}, where id is
 *                  Elastic doc ID and status is Elastic status code (e.g.
 *                  "200")
 */
function putDocs(client, elasticIndex) {
  return (stream) => stream
    .batch(1000)
    .flatMap(docs => h.of(docsToBatchActions(docs, elasticIndex)))
    .flatMap(batchActions => h(client.bulk({body: batchActions}))
        .flatMap(results => h(results.items))
        .map(resultItem => ({
          id: resultItem.update._id,
          status: resultItem.update.status === 200 ? 'success' : 'error'
        }))
      )
}

function docsToBatchActions(docs, elasticIndex) {
  return docs.reduce((acc, doc, index) => {
    acc.push({update: { _index: elasticIndex, _type: 'general', _id: doc.uri }});
    acc.push({doc, doc_as_upsert: true});
    return acc;
  }, []);
}

module.exports.pageToDoc = pageToDoc;
module.exports.putDocs = putDocs;
