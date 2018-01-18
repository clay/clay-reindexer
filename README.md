# Page Re-indexer

Populate a specified Elastic index with your page data.

## Example usage

The following command populates the local `zar` index with the pages inside the `http://foo.bar` site, applying the handlers in the folder `myhandlers`.

```
node index.js --prefix http://foo.bar --elasticHost http://localhost:9200 --elasticIndex zar --handlers myhandlers
```

## Installation

```
git clone https://github.com/nymag/page-reindexer
cd page-reindexer
npm install
```

## Options

* **prefix**: String. Required. URL prefix of the Clay site you want to reindex, e.g. `http://foo.com`.
* **elasticHost**: String. Required. URL to Elastic Host root, e.g. `http://localhost:9200`.
* **elasticIndex**: String. Required. Name of index to store new page docs.
* **handlers**: String. Optional. Path to directory containing handlers. See "Handlers" section below.
* **elasticPrefix**: String. Optional. Name of the prefix of your Elastic indices.
* **batch**: Max number of documents to PUT into Elastic in one request.

## Handlers

Handlers allow you to populate fields of a page's Elastic doc based on components within the page.

Each file in the handlers folder:

* Should have a name matching a component name, e.g. `clay-paragraph.js`.
* Should export a function that return, streams, or a returns a Promise that resolves with an object. This object will be merged into the Elastic document.

Each handler function has this signature:

* `ref`: String. Uri of component instance
* `data`: Object. Component instance data (does not have `_ref`)
* `opts` Object. Contains all opts passed to the general command. Also includes `site`, which is the site object (`{name, slug, host, path, port, assetDir, assetPath, mediaPath, siteIcon}`).

### Example

The following handler will set the `title` property of any page with an `article` component to the `headline` of its article:

```
// myhandlers/article.js
module.exports = (ref, data) => ({title: data.headline});
```
