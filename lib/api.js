'use strict';

const pageTransforms = require('./page-transform'),
  docTransforms = require('./doc-transforms'),
  { formatDoc } = require('./util');

/**
 * Return a stream that reindexes.
 * @param  {Stream} uriStream - Stream of URIs
 * @param  {Object} options
 * @param  {number} [options.parallel]
 * @param  {function[]} [options.transforms] Array of functions to transform Elastic doc
 * @param  {number} [options.batch] Number of documents to include in one elastic.bulk req
 * @return {Stream} Stream of Elastic bulk results
 */
function reindex(uriStream, {parallel = 1, transforms} = {}) {
  return uriStream
    .map(uri => docTransforms.applyTransforms(uri, {}, transforms))
    .parallel(parallel)
    .map(formatDoc);
}

/**
 * Reindex all pages from a specified site.
 * @param  {string} uriStream
 * @param  {Object} [options]
 * @param  {number} [options.limit] Limit number of pages streamed
 * @param  {number} [options.batch] Number of documents to include in one elastic.bulk req
 * @param  {number} [options.parallel] Number of pages to process in parallel
 * @param  {Object} [options.handlers] Object mapping cmpt name to handler
 * @param  {Array} [options.transforms] Array of additional transforms
 * @return {Stream} of bulk results
 */
function reindexPages(uriStream, {limit, parallel, handlers, transforms, batch = 100} = {}) {
  return uriStream
    .slice(0, limit || Infinity)
    .through(stream => reindex(stream, {
      transforms: [pageTransforms.generatePageTransform(handlers, transforms)],
      batch,
      parallel
    }));
}

module.exports.reindex = reindex;
module.exports.reindexPages = reindexPages;
