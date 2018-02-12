'use strict';

const h = require('highland'),
  _ = require('lodash'),
  util = require('./util');

function applyTransforms(uri, doc, transforms) {
  return h.values(transforms)
    .flatMap(transform => {
      const cloned = _.cloneDeep(doc); // prevent overwriting doc directly

      return util.makeStream(transform(uri, cloned));
    })
    .reduce({}, (acc, curr) => Object.assign(acc, curr));
}

module.exports.applyTransforms = applyTransforms;
