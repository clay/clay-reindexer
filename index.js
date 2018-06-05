#!/usr/bin/env node
'use strict';

const util = require('./lib/util'),
  api = require('./lib/api'),
  args = require('./lib/args'),
  runningAsScript = !module.parent;

require('dotenv').config();

function initCmd() {
  return getOperationStream()
    .errors(streamErrors)
    .tap(util.logResult())
    .done(process.exit);
}

function streamErrors(error, push) {
  const resultObj = {error, status: 'error'};

  if (error.pageUri) resultObj.pageUri = error.pageUri;
  push(null, resultObj);
}

function getOperationStream() {
  switch (args._[0]) {
    case 'pages':
      return util.readStdin()
        .otherwise(() => util.streamAllPageUris())
        .through(uriStream =>
          api.reindexPages(uriStream, args.elasticIndex, args)
        );
    default:
      return util.readStdin()
        .through(uriStream => api.reindex(uriStream, args.elasticIndex, args));
  }
}

if (runningAsScript) {
  initCmd();
} else {
  module.exports = api;
}
