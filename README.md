# Clay Re-indexer

Populate a specified Elastic index with your page data.

## Example usage

The following command populates the local `zar` index with the pages inside the `http://foo.bar` site, applying the handlers in the folder `myhandlers`.

```
node index.js --prefix http://foo.bar --elasticHost http://localhost:9200 --elasticIndex zar --handlers myhandlers --transforms mytransforms
```

## Installation

Cli installation:

```
git clone https://github.com/nymag/page-reindexer
cd page-reindexer
npm install -g
```

The `clayReindex` command will now be available.

## Options

* **batch**: Max number of documents to PUT into Elastic in one request.
* **elasticHost**: String. Required. URL to Elastic Host root, e.g. `http://localhost:9200`.
* **elasticIndex**: String. Required. Name of index to store new page docs.
* **elasticPrefix**: String. Optional. Name of the prefix of your Elastic indices.
* **handlers**: String. Optional. Path to directory containing handlers. See "Handlers" below.
* **limit**: Number. Optional. Limit the number of pages processed per site.
* **prefix**: String. Required. Clay IP or domain of any of its sites.
* **transforms**: String. Optional. Path to directory containing transforms. See "Transforms" below.

## Context object

The context object is passed to each transform and handler. It includes data about the current site reindexing. It is similar to the options argument, except:

* **handlers** is an object mapping cmpt name to handler fnc, not a string
* **fetchOpts** is an object describing node-fetch opts sent with every Amphora request. It is derived from the `x-forwarded-host` option.


## Transforms

Transforms allow you to describe your own logic for populating the fields of a page's Elastic document.

Each file in the transforms folder should export a function that returns, streams, or resolves an object.

Each transform function has this signature:

* `doc`: Object. The Elastic doc generated _so_ far. All custom transforms occur after all built-in transforms. See "Built-in Transforms", below.
* `context`: Object. See "Context Object."

Note: The order of transform processing is not guaranteed.

### Example

```
// mytransforms/example.js
// Sets `foo` to `bar` on every document processed.
module.exports = doc => ({foo: 'bar'});
```

## Handlers

Handlers allow you to populate fields of a page's Elastic doc based on components within the page.

Each file in the handlers folder:

* Should have a name matching a component name, e.g. `clay-paragraph.js`.
* Should export a function that returns, streams, or resolves an object. This object will be merged into the Elastic document.

Each handler function has this signature:

* `ref`: String. Uri of component instance
* `data`: Object. Component instance data (does not have `_ref`)
* `context`: Object. See "Context Object."

Handlers are applied after custom transforms. The order of handler processing is not guaranteed.

### Example

The following handler will set the `title` property of any page with an `article` component to the `headline` of its article:

```
// myhandlers/article.js
module.exports = (ref, data) => ({title: data.headline});
```

## Built-in Transforms

Built-in transforms populate these fields automatically:

* published: true if published version of page exists
* publishTime: inferred from `lastModified` of published page
* url: inferred from `url` of published page
* scheduled: inferred from presence of page in site schedule
* scheduledTime: inferred from site schedule
* siteSlug: inferred from sit 
