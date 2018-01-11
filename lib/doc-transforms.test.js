'use strict';
/* eslint max-nested-callbacks:[2,5] */

const sinon = require('sinon'),
  _ = require('lodash'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  h = require('highland'),
  util = require('./util');

describe(_.startCase(filename), function () {
  describe(filename, function () {
    let sandbox;

    beforeEach(function() {
      sandbox = sinon.sandbox.create();
      sandbox.stub(util, 'streamFetchJson');
      sandbox.stub(util, 'streamFetch');
      sandbox.stub(util, 'getSite');
    });
    afterEach(function () {
      sandbox.restore();
    });

    describe('applyHandlers', function () {
      const fn = lib[this.title],
        mockDoc = {
          uri: 'a.com/pages/b'
        },
        mockPage = {
          content: [{
            _ref: 'a.com/components/cmpt1/instances/1',
            test: 'bar'
          }]
        },
        mockSite = {},
        mockHandlers = {
          cmpt1: (ref, data, site) => ({foo: data.test})
        },
        expectedDoc = {uri: 'a.com/pages/b', foo: 'bar'};

      it ('applies handlers if there is a matching component', function () {
        util.streamFetchJson.withArgs('http://a.com/pages/b.json')
          .returns(h.of(mockPage));
        util.getSite.withArgs('http://a.com')
          .returns(h.of(mockSite));
        return fn(mockDoc, 'http://a.com', mockHandlers)
          .toPromise(Promise)
          .then((result) => {
            expect(result).to.eql(expectedDoc);
          });
      });

      it ('detects deep components', function () {
        const mockPage = {
          content: [{
            _ref: 'a.com/components/cmpt2/instances/1',
            someMoreContent: [{
              _ref: 'a.com/components/cmpt1/instances/1',
              test: 'bar'
            }]
          }]
        };

        util.streamFetchJson.withArgs('http://a.com/pages/b.json')
          .returns(h.of(mockPage));
        util.getSite.withArgs('http://a.com')
          .returns(h.of(mockSite));
        return fn(mockDoc, 'http://a.com', mockHandlers)
          .toPromise(Promise)
          .then((result) => {
            expect(result).to.eql(expectedDoc);
          });
      });

      it ('recognizes promise-returning handlers', function () {
        const mockHandlers = {
          cmpt1: (ref, data, site) => Promise.resolve({foo: data.test})
        };

        util.streamFetchJson.withArgs('http://a.com/pages/b.json')
          .returns(h.of(mockPage));
        util.getSite.withArgs('http://a.com')
          .returns(h.of(mockSite));
        return fn(mockDoc, 'http://a.com', mockHandlers)
          .toPromise(Promise)
          .then((result) => {
            expect(result).to.eql(expectedDoc);
          });
      });

      it ('recognizes stream-returning handlers', function () {
        const mockHandlers = {
          cmpt1: (ref, data, site) => h.of({foo: data.test})
        };

        util.streamFetchJson.withArgs('http://a.com/pages/b.json')
          .returns(h.of(mockPage));
        util.getSite.withArgs('http://a.com')
          .returns(h.of(mockSite));
        return fn(mockDoc, 'http://a.com', mockHandlers)
          .toPromise(Promise)
          .then((result) => {
            expect(result).to.eql(expectedDoc);
          });
      });
    });
    describe('addPublishData', function () {

    });
    describe('addScheduleTime', function () {

    });
    describe('validatePublishUrl', function () {

    });
    describe('addSiteSlug', function () {

    });
  });
});
