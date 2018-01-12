'use strict';
/* eslint max-nested-callbacks:[2,5] */

const sinon = require('sinon'),
  _ = require('lodash'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  h = require('highland'),
  errors = require('./errors'),
  util = require('./util'),
  docTransforms = require('./doc-transforms');

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    sandbox.stub(docTransforms, 'addPublishData');
    sandbox.stub(docTransforms, 'addScheduleTime');
    sandbox.stub(docTransforms, 'addSiteSlug');
    sandbox.stub(docTransforms, 'applyHandlers');
    sandbox.stub(docTransforms, 'validatePublishUrl');
  });
  afterEach(function () {
    sandbox.restore();
  });

  describe(filename, function () {
    describe('pageToDoc', function () {
      const fn = lib[this.title],
        mockPageUri = 'foo.com/pages/1',
          mockPrefix = 'http://foo.com',
          mockHandlers = {};

      docTransforms.addSite

      it ('runs all doc transforms', function () {


        return fn(mockPageUri, mockPrefix, mockHandlers)
          .toPromise(Promise)
          .then((result) => {

          })

      });

      it ('errors with pageUri if a doc transform errors', function () {

      });



    });
    describe('putDocs', function () {

    });
  });
});
