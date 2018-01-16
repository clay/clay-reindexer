'use strict';
/* eslint max-nested-callbacks:[2,5] */

const sinon = require('sinon'),
  _ = require('lodash'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  h = require('highland'),
  errors = require('./errors'),
  docTransforms = require('./doc-transforms'),
  esClient = require('./es-client');

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(docTransforms, 'addPublishData');
    sandbox.stub(docTransforms, 'addScheduleTime');
    sandbox.stub(docTransforms, 'addSiteSlug');
    sandbox.stub(docTransforms, 'applyHandlers');
    sandbox.stub(docTransforms, 'validatePublishUrl');
    sandbox.stub(esClient, 'bulk');
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

      it ('runs all doc transforms', function () {
        docTransforms.addPublishData.returns(h.of({a: 1}));
        docTransforms.addScheduleTime.returns(h.of({b: 2}));
        docTransforms.addSiteSlug.returns(h.of({c: 3}));
        docTransforms.applyHandlers.returns(h.of({d: 4}));
        docTransforms.validatePublishUrl.returns(h.of({e: 5}));

        return fn(mockPageUri, mockPrefix, mockHandlers)
          .toPromise(Promise)
          .then((result) => {
            expect(result.uri).to.equal(mockPageUri);
            expect(result.a).to.equal(1);
            expect(result.b).to.equal(2);
            expect(result.c).to.equal(3);
            expect(result.d).to.equal(4);
            expect(result.e).to.equal(5);
          });
      });

      it ('errors with pageUri if a doc transform errors', function (done) {
        docTransforms.addSiteSlug.returns(h(Promise.reject(new Error('a'))));

        fn(mockPageUri, mockPrefix, mockHandlers)
          .toPromise(Promise)
          .then((result) => {
            done('expected erorr but got ' + JSON.stringify(result));
          })
          .catch((err) => {
            expect(err.pageUri).to.equal(mockPageUri);
            expect(err.message).to.equal('a');
            done();
          });
      });

    });
    describe('putDocs', function () {
      const fn = lib[this.title],
        mockIndex = 'testIndex',
        mockStream = () => h([{
          foo: 1,
          uri: 'foo.com/pages/1'
        }, {
          foo: 2,
          uri: 'foo.com/pages/2'
        }]),
        expectedActions = [
          {update: { _index: mockIndex, _type: 'general', _id: 'foo.com/pages/1' }},
          {doc: {foo: 1, uri: 'foo.com/pages/1'}, doc_as_upsert: true},
          {update: { _index: mockIndex, _type: 'general', _id: 'foo.com/pages/2' }},
          {doc: {foo: 2, uri: 'foo.com/pages/2'}, doc_as_upsert: true}
        ],
        mockBulkResults = {
          items: [
            {update: {_id: 'foo.com/pages/1', status: 200}},
            {update: {_id: 'foo.com/pages/2', status: 200}}
          ]
        };

      it ('sends the correct set of actions', function () {
        esClient.bulk.returns(Promise.resolve(mockBulkResults));

        return mockStream()
          .through(fn(mockIndex))
          .collect()
          .toPromise(Promise)
          .then(() => {
            expect(esClient.bulk.getCall(0).args[0].body).to.eql(expectedActions);
          });
      });

      it ('streams {id, status} result objects ', function () {
        esClient.bulk.returns(Promise.resolve(mockBulkResults));

        return mockStream()
          .through(fn(mockIndex))
          .collect()
          .toPromise(Promise)
          .then((results) => {
            expect(results).to.eql([
              {id: 'foo.com/pages/1', status: 'success'},
              {id: 'foo.com/pages/2', status: 'success'}
            ]);
          });
      });

      it ('throws error if action failed', function (done) {
        const mockBulkResults = {
          items: [
            {update: {_id: 'foo.com/pages/1', status: 400}},
            {update: {_id: 'foo.com/pages/2', status: 200}}
          ]
        };

        esClient.bulk.returns(Promise.resolve(mockBulkResults));
        mockStream()
          .through(fn(mockIndex))
          .collect()
          .toPromise(Promise)
          .then((result) => {
            done('expected error but got ', JSON.stringify(result));
          })
          .catch(err => {
            expect(err).to.be.an.instanceof(errors.failedBulkAction);
            done();
          });
      });
    });
  });
});
