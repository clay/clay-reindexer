#!/usr/bin/env node
'use strict';

const reindexSites = require('./lib/reindex-sites'),
  util = require('./lib/util'),
  getArgs = require('./lib/get-args'),
  runningAsScript = !module.parent;

function init() {
  const opts = getArgs();

  reindexSites(opts)
    .errors((error, push) => {
      const resultObj = {error, status: 'error'};

      if (error.pageUri) resultObj.pageUri = error.pageUri;
      push(null, resultObj);
    })
    .tap(util.logResult())
    .done(process.exit);
}

if (runningAsScript) init();
module.exports = reindexSites;
