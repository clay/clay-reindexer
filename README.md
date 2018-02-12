# clay-reindex

Build or update Elastic indices from Amphora or arbitrary data.

## Installation

Cli installation:

```
git clone https://github.com/nymag/clay-reindexer
cd clay-reindexer
npm install -g
```

The `clayReindex` command will now be available.

## Overview

Clay-reindex is a command line and programmatic utility for building or updating Elastic documents in bulk. It:

1. Reads data from a source, e.g. a list of page URIs
2. Transforms each datum into an Elastic doc using built-in or user-defined transform functions
3. Inserts each resulting document into a specified Elastic index

## Example uses

Pass every line in `my-uris.txt` into each `transform` function and PUT the merged results into elastic index `foo` at elastic host `http://localhost:9200`:

```
clayReindex --elasticHost http://localhost:9200 --elasticIndex foo --transforms mytransforms < my-uris.txt
```

Populates the local `foo` index with all pages in all sites, using built-in logic to infer some page document properties from Amphora data:

```
clayReindex pages --amphoraHost http://localhost:3001 --elasticHost http://localhost:9200 --elasticIndex foo --handlers myhandlers --transforms mytransforms
```

Do the same thing but only process the URIs inside `my-uris.txt`:

```
clayReindex pages --amphoraHost http://localhost:3001 --elasticHost http://localhost:9200 --elasticIndex zar --handlers myhandlers --transforms mytransforms < my-uris.txt
```

## General use (no subcommands)

When no subcommand is specified, clayReindex simply processes data from `stdin`, transforms it, and upserts it into the specified index.

### Options

* **batch**: Max number of documents to PUT into Elastic in one request.
* **elasticHost**: String. Required. URL to Elastic Host root, e.g. `http://localhost:9200`.
* **elasticIndex**: String. Required. Name of index to store new page docs.
* **elasticPrefix**: String. Optional. Name of the prefix of your Elastic indices.
* **limit**: Number. Optional. Limit the number of pages processed per site.
* **prefix**: String. Required. Clay IP or domain of any of its sites.
* **transforms**: String. Optional. Path to directory containing transforms. See "Transforms" below.
* **verbose**: Boolean. Optional. Log all HTTP requests.

## Pages subcommand

The pages subcommand makes it easier to re-index the built-in `pages` index provided by amphora-search. Using the subcommand specifies `clayReindex` in two ways:

* It automatically process all page URIs, unless it detects data in `stdin`.
* It automatically generates partial documents using built-in logic that applies before user-specified transforms. This logic generates the following page document properties:
    * `published`: `true` if published version of page exists
    * `publishTime`: inferred from `lastModified` of published page
    * `url`: inferred from `url` of published page
    * `scheduled`: inferred from presence of page in site schedule
    * `scheduledTime`: inferred from site schedule
    * `siteSlug`: inferred from site slug as it apperas in the `sites` index

### Options

In addition to the generic options described above, the `pages` subcommand provides these options:

* `amphoraHost`: String. Required. URL from which to retrieve Amphora data. The command automatically appends site paths and `x-forwarded-host` headers, so this could be the IP of your Clay server or simply the domain of any of your Clay sites.
* `handlers` String. Optional. Path to directory with handler functions. See "Handlers" section below.
* `limit` Number. Optional. Limit number of URIs in input that are processed.

### Handlers

Handlers allow you to populate fields of a page's Elastic doc based on components within the page.

Each file in the handlers folder:

* Should have a name matching a component name, e.g. `clay-paragraph.js`.
* Should export a function that returns, streams, or resolves an object. This object will be merged into the Elastic document.

Each handler function has this signature:

* `ref`: String. Uri of component instance
* `data`: Object. Component instance data (does not have `_ref`)
* `context`: Object. See "Context Object."

Handlers are applied _after_ custom transforms. The order of handler processing is not guaranteed.

## Transforms

Transforms allow you to describe your own logic for populating the fields of a page's Elastic document.

Each file in the transforms folder should export a function that returns, streams, or resolves an object.

Each transform function has this signature:

* `uri`: This is the input of the reindexing process.
* `doc`: Object. The Elastic doc generated _so_ far.

Note: The order of transform processing is not guaranteed.
