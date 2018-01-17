'use strict';
/* eslint max-nested-callbacks:[2,5] */

const _ = require('lodash'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  fn = require('./' + filename),
  sinon = require('sinon'),
  reindexUtil = require('./lib/reindex-util');

describe(_.startCase(filename), function () {
  describe(filename, function () {
    let sandbox;

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      sandbox.stub(reindexUtil, 'pageToDoc');
      sandbox.stub(reindexUtil, 'putDocs');
    });
    afterEach(function () {
      sandbox.restore();
    });
  });
});
