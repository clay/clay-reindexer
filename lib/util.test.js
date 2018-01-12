'use strict';
/* eslint max-nested-callbacks:[2,5] */

const sinon = require('sinon'),
  _ = require('lodash'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  h = require('highland'),
  errors = require('./errors'),
  mock = require('mock-require'),
  nodeFetchStub = sinon.stub();
let lib;

mock('node-fetch', nodeFetchStub)
lib = mock.reRequire('./' + filename);

describe(_.startCase(filename), function () {

  describe('streamFetch', function () {
    const fn = lib[this.title],
      mockUrl = 'http://foo.com',
      mockOpts = {method: 'POST'};

    it ('calls node-fetch with specified args and returns a stream', function () {
      nodeFetchStub.returns(Promise.resolve('a'));

      return fn(mockUrl, mockOpts)
        .toPromise(Promise)
        .then((result) => {
          expect(result).to.equal('a');
          expect(nodeFetchStub.getCall(0).args[0]).to.equal(mockUrl);
          expect(nodeFetchStub.getCall(0).args[1]).to.eql(mockOpts);
        });
    });
  });

  describe('streamFetchJson', function () {
    const fn = lib[this.title],
      mockUrl = 'http://foo.com',
      mockOpts = {method: 'POST'};

    it ('automatically parses body for json', function () {
      nodeFetchStub.returns(Promise.resolve({json: () => Promise.resolve({foo: 'bar'})}));

      return fn(mockUrl, mockOpts)
        .toPromise(Promise)
        .then((result) => {
          expect(result).to.eql({foo: 'bar'});
          expect(nodeFetchStub.getCall(0).args[0]).to.equal(mockUrl);
          expect(nodeFetchStub.getCall(0).args[1]).to.eql(mockOpts);
        });
    });
  });

  describe('streamFetchText', function () {
    const fn = lib[this.title],
      mockUrl = 'http://foo.com',
      mockOpts = {method: 'POST'};

    it ('automatically parses body for text', function () {
      nodeFetchStub.returns(Promise.resolve({text: () => Promise.resolve('foo')}));

      return fn(mockUrl, mockOpts)
        .toPromise(Promise)
        .then((result) => {
          expect(result).to.equal('foo');
          expect(nodeFetchStub.getCall(0).args[0]).to.equal(mockUrl);
          expect(nodeFetchStub.getCall(0).args[1]).to.eql(mockOpts);
        });
    });
  });

  describe('queryElastic', function () {

  });


});
