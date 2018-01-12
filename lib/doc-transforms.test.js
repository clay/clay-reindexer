'use strict';
/* eslint max-nested-callbacks:[2,5] */

const sinon = require('sinon'),
  _ = require('lodash'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  h = require('highland'),
  errors = require('./errors'),
  util = require('./util');

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    sandbox.stub(util, 'streamFetchJson');
    sandbox.stub(util, 'streamFetch');
    sandbox.stub(util, 'streamFetchText');
    sandbox.stub(util, 'getSite');
  });
  afterEach(function () {
    sandbox.restore();
  });


  describe(filename, function () {
    describe('applyHandlers', function () {
      const fn = lib[this.title],
        mockPage = {
          content: [{
            _ref: 'a.com/components/cmpt1/instances/1',
            test: 'bar'
          }]
        },
        mockSite = {},
        mockHandlers = {
          cmpt1: (ref, data, site) => ({foo: data.test})
        };
      let mockDoc, expectedDoc;

      beforeEach(function () {
        mockDoc = {uri: 'a.com/pages/b'};
        expectedDoc = {uri: 'a.com/pages/b', foo: 'bar'};
      });

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
      const fn = lib[this.title],
        mockUrl = 'http://foo.com/bar',
        mockPublishedPage = 'http://foo.com/pages/1@published',
        mockPrefix = 'http://foo.com';
      let mockDoc;

      beforeEach(function () {
        mockDoc = {uri: 'foo.com/pages/1'};
      })

      it ('sets "published" and "publishedPageData" if published version is retrieved', function () {
        util.streamFetchJson.withArgs(mockPublishedPage)
          .returns(h.of({url: mockUrl}));
        return fn(mockDoc, mockPrefix)
          .toPromise(Promise)
          .then((result => {
            expect(result.url).to.equal(mockUrl);
            expect(result.published).to.be.true;
          }));
      });

      it ('sets published to false and does not set url if published version 404s', function () {
        util.streamFetchJson.withArgs(mockPublishedPage)
          .returns(h(Promise.reject(errors.request404)));
        return fn(mockDoc, mockPrefix)
          .toPromise(Promise)
          .then((result => {
            expect(result.url).to.be.undefined;
            expect(result.published).to.be.false;
          }));
      });

      it ('throws error if fetching published version throws other error', function (done) {
        util.streamFetchJson.withArgs(mockPublishedPage)
          .returns(h(Promise.reject(new Error())));
        fn(mockDoc, mockPrefix)
          .toPromise(Promise)
          .then((result => {
            done('expected error but got ' + JSON.stringify(result));
          }))
          .catch((err) => done());
      });

    });
    describe('addScheduleTime', function () {
      const fn = lib[this.title],
        mockSchedule = [{
          at: 1,
          publish: 'http://foo.com:/pages/1'
        }],
        mockPrefix = 'http://foo.com';
      let mockDoc;

      beforeEach(function () {
        mockDoc = {uri: 'foo.com/pages/1'};
      });

      it ('sets scheduled and scheduledTime if page is scheduled', function () {
        util.streamFetchJson.withArgs('http://foo.com/schedule')
          .returns(h.of(mockSchedule));

        return fn(mockDoc, mockPrefix)
          .toPromise(Promise)
          .then((doc) => {
            expect(doc.scheduled).to.be.true;
            expect(doc.scheduledTime).to.equal(1);
          });
      });

      it ('sets scheduled to false if page is not in schedule', function () {
        const mockSchedule = [];

        util.streamFetchJson.withArgs('http://foo.com/schedule')
          .returns(h.of(mockSchedule));
        return fn(mockDoc, mockPrefix)
          .toPromise(Promise)
          .then((doc) => {
            expect(doc.scheduled).to.be.false;
          });
      });

      it ('throws error if schedule is not retrieved', function (done) {
        util.streamFetchJson.withArgs('http://foo.com/schedule')
          .returns(h(Promise.reject(new Error())));
        fn(mockDoc, mockPrefix)
          .toPromise(Promise)
          .then((doc) => {
            done('expected error but got ' + JSON.stringify(doc));
          })
          .catch(() => done());
      });
    });

    describe('validatePublishUrl', function () {
      const fn = lib[this.title],
        mockPrefix = 'http://foo.com',
        urlEncoded = Buffer.from('foo.com/bar').toString('base64');
      let mockDoc;

      beforeEach(function () {
        mockDoc = {
          uri: 'foo.com/pages/1',
          url: 'http://foo.com/bar'
        }
      });

      it ('keeps url if uri exists and points to correct page uri', function () {
        util.streamFetchText.withArgs(`http://foo.com/uris/${urlEncoded}`)
          .returns(h.of('foo.com/pages/1'));

        return fn(mockDoc, mockPrefix)
          .toPromise(Promise)
          .then((doc) => {
            expect(doc.url).to.equal('http://foo.com/bar');
          });
      });

      it ('removes url if uri exists but does not point to correct page uri', function () {
        util.streamFetchText.withArgs(`http://foo.com/uris/${urlEncoded}`)
          .returns(h.of('foo.com/pages/2'));

        return fn(mockDoc, mockPrefix)
          .toPromise(Promise)
          .then((doc) => {
            expect(doc.url).to.be.null;
          });
      });

      it ('removes url if uri does not exist', function () {
        util.streamFetchText.withArgs(`http://foo.com/uris/${urlEncoded}`)
          .returns(h(Promise.reject(errors.request404)));

        return fn(mockDoc, mockPrefix)
          .toPromise(Promise)
          .then((doc) => {
            expect(doc.url).to.be.null;
          });
      });

      it ('throws error if uri fetch gives a non-404 error', function (done) {
        util.streamFetchText.withArgs(`http://foo.com/uris/${urlEncoded}`)
          .returns(h(Promise.reject(new Error())));

        fn(mockDoc, mockPrefix)
          .toPromise(Promise)
          .then((doc) => done('expect error but got ' + JSON.stringify(doc)))
          .catch(() => done())
      });
    });

    describe('addSiteSlug', function () {
      const fn = lib[this.title], 
        mockPrefix = 'http://foo.com',
        mockSlug = 'bar';
      let mockDoc;

      beforeEach(function () {
        mockDoc = {}
      });

      it ('adds site slug', function () {
        util.getSite.withArgs(mockPrefix)
          .returns(h.of({slug: mockSlug}));

        return fn(mockDoc, mockPrefix)
          .toPromise(Promise)
          .then((doc) => {
            expect(doc.siteSlug).to.equal(mockSlug);
          });
      });

      it ('throws error if site retrieval errors', function (done) {
        util.getSite.withArgs(mockPrefix)
          .returns(h(Promise.reject(new Error())));

        fn(mockDoc, mockPrefix)
          .toPromise(Promise)
          .then((doc) => {
            done('expected error but got ' + JSON.stringify(doc));
          })
          .catch(() => done());
      })
    });
  });
});
