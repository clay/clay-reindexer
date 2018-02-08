const args = require('./args');

module.exports.ELASTIC_HOST = args.elasticHost || process.env.ELASTIC_HOST;
module.exports.ELASTIC_PREFIX = args.elasticPrefix || process.env.ELASTIC_PREFIX;
module.exports.AMPHORA_HOST = args.amphoraHost || process.env.AMPHORA_HOST;
module.exports.VERBOSE = args.verbose || process.env.VERBOSE;

if (!module.exports.ELASTIC_HOST) throw new Error('You must specify an elastic host');
if (!module.exports.AMPHORA_HOST) throw new Error('You must specify an Amphora host');
