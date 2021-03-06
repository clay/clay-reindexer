'use strict';
/* eslint max-nested-callbacks:[2,5] */

const _ = require('lodash'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  mockYargs = {argv: {}},
  mock = require('mock-require');
let fn;

mock('yargs', mockYargs);
fn = mock.reRequire('./' + filename);


describe(_.startCase(filename), function () {
  describe(filename, function () {
    beforeEach(function () {
      mockYargs.argv = {};
      mockYargs.demandOption = function () {
        return this;
      };
    });

    it ('throws error if "site" is missing', function () {
      mockYargs.argv = {
        elasticIndex: 'foo',
        elasticHost: 'bar'
      };
      expect(() => fn()).to.throw(Error);
    });

    it ('throws error if "elasticIndex" is missing', function () {
      mockYargs.argv = {
        prefix: 'foo',
        elasticHost: 'bar'
      };

      expect(fn()).to.eql(mockYargs.argv);
    });

    it ('throws error if "elasticHost" is missing', function () {
      mockYargs.argv = {
        elasticIndex: 'foo',
        prefix: 'bar'
      };
      expect(() => fn()).to.throw(Error);
    });

    it ('returns object with args if valid', function () {
      mockYargs.argv = {
        prefix: 'foo',
        elasticHost: 'bar',
        elasticIndex: 'baz',
        elasticPrefix: 'zar'
      };
      expect(fn())
        .to.eql({
          prefix: 'foo',
          elasticHost: 'bar',
          elasticIndex: 'baz',
          elasticPrefix: 'zar'
        });
    });

    it ('strips trailing slash from site and elasticHost', function () {
      mockYargs.argv = {
        prefix: 'foo/',
        elasticHost: 'bar/',
        elasticIndex: 'baz',
        elasticPrefix: 'zar'
      };
      expect(fn())
        .to.eql({
          prefix: 'foo',
          elasticHost: 'bar',
          elasticIndex: 'baz',
          elasticPrefix: 'zar'
        });
    });

    it ('includes handlers as object', function () {
      mockYargs.argv = {
        prefix: 'foo',
        elasticHost: 'bar',
        elasticIndex: 'baz',
        handlers: './test/handlers'
      };
      expect(fn()).to.eql({
        prefix: 'foo',
        elasticHost: 'bar',
        elasticIndex: 'baz',
        handlers: {
          a: require('../test/handlers/a'),
          b: require('../test/handlers/b')
        }
      });
    });

    it ('includes transforms as object', function () {
      mockYargs.argv = {
        prefix: 'foo',
        elasticHost: 'bar',
        elasticIndex: 'baz',
        handlers: './test/transforms'
      };
      expect(fn()).to.eql({
        prefix: 'foo',
        elasticHost: 'bar',
        elasticIndex: 'baz',
        handlers: {
          a: require('../test/transforms/a'),
          b: require('../test/transforms/b')
        }
      });
    });

  });
});
