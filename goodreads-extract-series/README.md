Tampermonkey userscript to extract lists of titles from Goodreads series pages.

Actual Readme coming soon.

## Test fixtures

Full Goodreads pages copied from the browser live in the gitignored `test/fixtures/verbatim/` directory. They are useful for debugging, but far too large and noisy to commit.

`bun run trim:mocks` turns each verbatim page into a committed `test/fixtures/skeletons/*.html` file containing only the DOM nodes the userscript reads. Golden output lives under `test/fixtures/expected/`. The real `data-react-props` JSON is preserved; the rendered page tree is discarded.

To add and investigate a page shape:

1. Save it as `test/fixtures/verbatim/<series-name>.html`.
2. Run `bun run trim:mocks` to generate the skeleton.
3. Compare `buildList()` with the real Goodreads page using `node test/test-extract.js <file>.html`.
4. Once the output is correct, run `bun run golden:update <file>.html` and add or promote its test.

Don't trust a newly generated golden until the output has been checked against the page. Otherwise we're just preserving the bug with excellent test coverage.
