const {logResult, streamPageUris} = require('./lib/util'),
  docTransforms = require('./lib/doc-transforms'),
  h = require('highland'),
  args = require('yargs').argv,
  fs = require('fs'),
  _ = require('lodash'),
  path = require('path'),
  clayUtils = require('clayutils'),
  client = require('./lib/es-client');

function validateArgs(args) {
  if (!args.site) throw new Error('You must specify "site"');
  if (!args.elasticIndex) throw new Error('You must specify "elasticIndex"');
  if (!args.elasticHost) throw new Error('You must specify "elasticHost"');
}

/** 
 * Re-indexes the specified site.
 * @param  {string} options.site
 * @param  {Object} options.client
 * @param  {string} options.elasticIndex
 * @param  {Object} [options.handlers]
 * @return {Stream}
 */
function reindexSite({site, client, elasticIndex, handlers}) {
  return streamPageUris(site)
    .flatMap(pageUri => convertToDoc(pageUri, site))
    .through(putDocs(client, elasticIndex));
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

/**
 * Stream the page URIs of the specified site.
 * @param  {prefix} prefix e.g. 'http://localhost.thecut.com:3001'
 * @return {Stream} of page URIs (strings)
 */
function convertToDoc(pageUri, prefix) {
  return h.of(pageUri)
    .filter(pageUri => pageUri === 'localhost.thecut.com/pages/author')
    .flatMap(pageUri => pageToDoc(pageUri, prefix, handlers));
}

/** 
 * Generate an Elastic document from the specified pageUri.
 * @param  {string} prefix
 * @param  {string} pageUri
 * @return {Stream} Elastic document (object)
 */
function pageToDoc(pageUri, prefix, handlers) {
  const elasticDoc = {
    createdAt: null,
    title: null,
    titleTruncated: null,
    authors: null,
    users: null,
    published: null,
    archived: null,
    scheduled: null,
    scheduledTime: null,
    publishTime: null,
    updateTime: null,
    url: null,
    uri: pageUri,
    siteSlug: null
  };

  return h.of(elasticDoc)
    .flatMap(doc => docTransforms.addSiteSlug(doc, prefix))
    .flatMap(doc => docTransforms.addPublishData(doc, prefix))
    .flatMap(doc => docTransforms.validatePublishUrl(doc, prefix))
    .flatMap(doc => docTransforms.addScheduleTime(doc, prefix))
    .flatMap(doc => docTransforms.applyHandlers(doc, prefix))
    .errors((err, push) => {
      err.pageUri = pageUri;
      push(err);
    });
}


/**
 * Retrieve all handlers.
 * @return {Object} mapping of component name to handler fnc
 */
function getHandlers(dir) {
  if (!dir) return {};
  dir = path.resolve(dir);
  return fs.readdirSync(dir)
    .filter(file => _.endsWith(file, '.js'))
    .reduce((acc, file) => {
      acc[file.slice(0, -3)] = require(path.join(dir, file));
      return acc;
    }, {});
}

function init() {
  const {site, elasticIndex} = args;
    handlers = getHandlers(args.handlers);

  reindexSite({site, client, elasticIndex, handlers})
    .errors((error, push) => {
      const resultObj = {error, status: 'error'};

      if (error.pageUri) resultObj.pageUri = error.pageUri;
      push(null, resultObj);
    })
    .tap(logResult())
    .done(() => process.exit());
}

validateArgs(args);
init();
