const elasticsearch = require('elasticsearch'),
  args = require('yargs').argv;

module.exports = new elasticsearch.Client({host: args.elasticHost});
