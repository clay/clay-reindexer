'use strict';
/* eslint max-nested-callbacks:[2,5] */

const _ = require('lodash'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  fn = require('./' + filename);

describe(_.startCase(filename), function () {
  describe(filename, function () {

    it ('throws error if "site" is missing', function () {
      expect(() => fn({
        elasticIndex: 'foo',
        elasticHost: 'bar'
      })).to.throw(Error);
    });

    it ('throws error if "elasticIndex" is missing', function () {
      expect(() => fn({
        site: 'foo',
        elasticHost: 'bar'
      })).to.throw(Error);
    });

    it ('throws error if "elasticHost" is missing', function () {
      expect(() => fn({
        elasticIndex: 'foo',
        site: 'bar'
      })).to.throw(Error);
    });

    it ('returns object with args if valid', function () {
      expect(fn({
        site: 'foo',
        elasticHost: 'bar',
        elasticIndex: 'baz',
        elasticPrefix: 'zar'
      }))
        .to.eql({
          prefix: 'foo',
          elasticHost: 'bar',
          elasticIndex: 'baz',
          elasticPrefix: 'zar'
        });
    });

    it ('strips trailing slash from site and elasticHost', function () {
      expect(fn({
        site: 'foo/',
        elasticHost: 'bar/',
        elasticIndex: 'baz',
        elasticPrefix: 'zar'
      }))
        .to.eql({
          prefix: 'foo',
          elasticHost: 'bar',
          elasticIndex: 'baz',
          elasticPrefix: 'zar'
        });
    });

    it ('includes handlers as object', function () {
      expect(fn({
        site: 'foo',
        elasticHost: 'bar',
        elasticIndex: 'baz',
        handlers: '../test/handlers'
      })).to.eql({
        prefix: 'foo',
        elasticHost: 'bar',
        elasticIndex: 'baz',
        handlers: {
          a: require('../test/handlers/a'),
          b: require('../test/handlers/b')
        }
      });
    });

  });
});
