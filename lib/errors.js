'use strict';

class request404 extends Error {
  constructor(message) {
    super(message);
    this.name = 'requestError';
  }
}
class failedBulkAction extends Error {
  constructor(message) {
    super(message);
    this.name = 'failedBulkAction';
  }
}
module.exports.request404 = request404;
module.exports.failedBulkAction = failedBulkAction;
