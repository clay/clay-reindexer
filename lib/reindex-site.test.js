'use strict';
/* eslint max-nested-callbacks:[2,5] */

const _ = require('lodash'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  fn = require('./' + filename),
  sinon = require('sinon'),
  h = require('highland'),
  reindexUtil = require('./reindex-util'),
  util = require('./util');

describe(_.startCase(filename), function () {
  describe(filename, function () {
    let sandbox;

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      sandbox.stub(reindexUtil, 'pageToDoc');
      sandbox.stub(reindexUtil, 'putDocs');
      sandbox.stub(util, 'streamPageUris');
    });
    afterEach(function () {
      sandbox.restore();
    });

    it ('converts pages to docs and puts docs to Elastic', function () {
      const mockPrefix = 'http://foo.com',
        mockElasticPrefix = 'local',
        mockElasticIndex = 'test',
        mockPageUri1 = 'foo.com/pages/1',
        mockPageUri2 = 'foo.com/pages/2',
        mockDoc1 = {uri: mockPageUri1, foo: 'bar'},
        mockDoc2 = {uri: mockPageUri2, foo: 'bar'},
        mockResult1 = {id: mockPageUri1, status: 200},
        mockResult2 = {id: mockPageUri2, status: 200},
        mockOpts = {
          prefix: mockPrefix,
          elasticPrefix: mockElasticPrefix,
          elasticIndex: mockElasticIndex
        };

      util.streamPageUris
        .withArgs(mockPrefix)
        .returns(h([mockPageUri1, mockPageUri2]));
      reindexUtil.pageToDoc
        .withArgs('foo.com/pages/1', mockOpts)
        .returns(h.of(mockDoc1));
      reindexUtil.pageToDoc
        .withArgs('foo.com/pages/2', mockOpts)
        .returns(h.of(mockDoc2));
      reindexUtil.putDocs
        .withArgs(mockOpts.elasticIndex, mockOpts.elasticPrefix)
        .returns(stream => {
          return stream
            .collect()
            .flatMap(() => h([mockResult1, mockResult2]));
        });
      return fn(mockOpts)
        .collect()
        .toPromise(Promise)
        .then((results) => {
          expect(results).to.eql([mockResult1, mockResult2]);
        });
    });
  });
});
