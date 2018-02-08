'use strict';

const reindexUtil = require('./reindex-util'),
  pageTransforms = require('./page-transform'),
  docTransforms = require('./doc-transforms');

/**
 * Return a stream that reindexes.
 * @param  {Stream} uriStream - Stream of URIs
 * @param  {Stream} elasticIndex - Target Elastic index
 * @param  {Object} options
 * @param  {number} [options.parallel]
 * @param  {function[]} [options.transforms] Array of functions to transform Elastic doc
 * @param  {number} [options.batch] Number of documents to include in one elastic.bulk req
 * @return {Stream} Stream of Elastic bulk results
 */
function reindex(uriStream, elasticIndex, {parallel = 1, transforms, batch = 1} = {}) {
  return uriStream
    .map(uri => docTransforms.applyTransforms(uri, {}, transforms))
    .parallel(parallel)
    .through(reindexUtil.putDocs(elasticIndex, batch));
}

/**
 * Reindex all pages from a specified site.
 * @param  {string} elasticIndex Index to upsert docs to
 * @param  {Object} [options]
 * @param  {number} [options.limit] Limit number of pages streamed
 * @param  {number} [options.batch] Number of documents to include in one elastic.bulk req
 * @param  {number} [options.parallel] Number of pages to process in parallel
 * @param  {Object} [options.handlers] Object mapping cmpt name to handler
 * @param  {Array} [options.transforms] Array of additional transforms
 * @return {Stream} of bulk results
 */
function reindexPages(uriStream, elasticIndex, {limit, batch, parallel, handlers, transforms} = {}) {
  return uriStream
    .slice(0, limit || Infinity)
    .through(stream => reindex(stream, elasticIndex, {
      transforms: [pageTransforms.generatePageTransform(handlers, transforms)],
      elasticIndex,
      batch,
      parallel
    }));
}

module.exports.reindex = reindex;
module.exports.reindexPages = reindexPages;
