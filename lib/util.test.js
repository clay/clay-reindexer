'use strict';
/* eslint max-nested-callbacks:[2,5] */

const sinon = require('sinon'),
  _ = require('lodash'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  h = require('highland'),
  mock = require('mock-require'),
  nodeFetchStub = sinon.stub(),
  mockEsClient = {search: () => {}},
  test1 = () => {},
  test2 = () => {};

let lib;

// mock the node-fetch require call
mock('node-fetch', nodeFetchStub);
mock('./es-client', mockEsClient);
mock('./test1', () => test1);
mock('./test2', () => test2);
lib = mock.reRequire('./' + filename);

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create(),
    sandbox.stub(mockEsClient, 'search');
  });
  afterEach(function () {
    sandbox.restore();
  });

  describe('streamFetch', function () {
    const fn = lib[this.title],
      mockUrl = 'http://foo.com',
      mockOpts = {method: 'POST'};

    it ('calls node-fetch with specified args and returns a stream', function () {
      nodeFetchStub.resolves('a');
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
      nodeFetchStub.resolves({json: () => Promise.resolve({foo: 'bar'})});

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
      nodeFetchStub.resolves({text: () => Promise.resolve('foo')});

      return fn(mockUrl, mockOpts)
        .toPromise(Promise)
        .then((result) => {
          expect(result).to.equal('foo');
          expect(nodeFetchStub.getCall(0).args[0]).to.equal(mockUrl);
          expect(nodeFetchStub.getCall(0).args[1]).to.eql(mockOpts);
        });
    });
  });

  describe('streamPageUris', function () {
    const fn = lib[this.title],
      mockPrefix = 'http://foo.com',
      mockUris = ['foo.com/pages/1', 'foo.com/pages/2'];

    it ('sends correct request and streams each uri', function () {
      nodeFetchStub.withArgs('http://foo.com/pages')
        .resolves({json: () => Promise.resolve(mockUris)});

      return fn(mockPrefix)
        .collect()
        .toPromise(Promise)
        .then(uris => expect(uris).to.eql(mockUris));
    });

    it ('throws error if request to pages endpoint errors', function (done) {
      nodeFetchStub.withArgs('http://foo.com/pages').rejects();

      fn(mockPrefix)
        .toPromise(Promise)
        .then(result =>
          done('expected error but got ', + JSON.stringify(result)))
        .catch(() => done());
    });
  });

  describe('logResult', function () {
    const fn = lib[this.title];

    beforeEach(function () {
      sandbox.stub(console, 'log');
    });

    it ('logs results, adding index to each', function (done) {
      const mockResults = [
        {foo: 'bar'},
        {baz: 'car'}
      ];

      h(mockResults)
        .tap(fn())
        .done(() => {
          const result1 = JSON.parse(console.log.getCall(0).args[0]),
            result2 = JSON.parse(console.log.getCall(1).args[0]);

          sandbox.restore();
          expect(result1).to.eql({foo: 'bar', index: 0});
          expect(result2).to.eql({baz: 'car', index: 1});
          done();
        });
    });
  });

  describe('streamSearch', function () {
    const fn = lib[this.title];

    it ('streams hits', function () {
      const mockOpts = {foo: 'bar'};

      mockEsClient.search.withArgs(mockOpts).resolves({
        hits: {
          hits: [
            {_source: {a: 'b'}},
            {_source: {c: 'd'}}
          ]
        }
      });

      return fn(mockOpts)
        .collect()
        .toPromise(Promise)
        .then((results) => {
          expect(results).to.eql([{a: 'b'}, {c: 'd'}]);
        });
    });
  });

  describe('streamComponents', function () {
    const fn = lib[this.title];

    it ('streams deep components', function () {
      const mockPage = {
        content: [
          {_ref: '/components/a/instances/1', a: 'b', c: {d: {}}},
          {_ref: '/components/a/instances/2'},
          {_ref: '/components/a/instances/3', foo: [
            {_ref: '/components/a/instances/4', bar: {
              _ref: '/components/a/instances/5'
            }}
          ]}
        ]
      };

      return fn(mockPage)
        .collect()
        .toPromise(Promise)
        .then((results) => {
          expect(results).to.eql([
            {_ref: '/components/a/instances/1', a: 'b', c: {d: {}}},
            {_ref: '/components/a/instances/2'},
            {_ref: '/components/a/instances/3', foo: [
              {_ref: '/components/a/instances/4', bar: {
                _ref: '/components/a/instances/5'
              }}
            ]},
            {_ref: '/components/a/instances/4', bar: {
              _ref: '/components/a/instances/5'
            }},
            {_ref: '/components/a/instances/5'}
          ]);
        });
    });
  });

  describe ('getPageUrl', function () {
    const fn = lib[this.title];

    it ('returns page url at the specified prefix', function () {
      expect(fn('bar.com/pages/1', 'http://foo.com'))
        .to.equal('http://foo.com/pages/1');
    });

    it ('appends version if specified', function () {
      expect(fn('bar.com/pages/1', 'http://foo.com', 'published'))
        .to.equal('http://foo.com/pages/1@published');
    });
  });

  describe('getSite', function () {
    const fn = lib[this.title],
      mockPrefix1 = 'http://foo.com/1',
      mockPrefix2 = 'http://foo.com/2',
      mockPrefix3 = 'http://foo.com/3',
      mockPrefix4 = 'http://foo.com/4';

    it ('sends the correct request and returns the site document directly', function () {
      mockEsClient.search.resolves({hits: {hits: [{_source: {foo: 'bar'}}]}});

      return fn(mockPrefix1)
        .toPromise(Promise)
        .then((result) => {
          const esOpts = mockEsClient.search.getCall(0).args[0];

          expect(esOpts.index).to.equal('sites');
          expect(esOpts.type).to.equal('general');
          expect(esOpts.body.query.bool).to.eql(
            {filter: [{term: {host: 'foo.com'}}, {term: {path: '/1'}}]}
          );
          expect(result).to.eql({foo: 'bar'});
        });
    });

    it ('prefixes site index with second arg', function () {
      mockEsClient.search.resolves({hits: {hits: [{_source: {foo: 'bar'}}]}});

      return fn(mockPrefix2, 'foo')
        .toPromise(Promise)
        .then(() => {
          const esOpts = mockEsClient.search.getCall(0).args[0];

          expect(esOpts.index).to.equal('foo_sites');
        });
    });

    it ('errors if Elastic request fails', function (done) {
      mockEsClient.search.rejects();

      fn(mockPrefix3)
        .toPromise(Promise)
        .then(result => {
          done(new Error('expected error but got ' + JSON.stringify(result)));
        })
        .catch(() => done());
    });

    it ('caches previous results', async function () {
      let result2;

      mockEsClient.search.resolves({hits: {hits: [{_source: {foo: 'bar'}}]}});
      await fn(mockPrefix4).toPromise(Promise);
      mockEsClient.search.resolves({hits: {hits: [{_source: {car: 'zar'}}]}});
      result2 = await fn(mockPrefix4).toPromise(Promise);
      expect(result2).to.eql({foo: 'bar'});
      expect(mockEsClient.search.calledOnce).to.be.true;
    });
  });
});
