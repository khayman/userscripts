# Goodreads Extract Series

A small, dependency-free userscript that adds `Copy titles` and `Download titles` buttons to Goodreads series pages. I use it for renaming audiobooks from my collection, since manually copy/pasting from Goodreads is for chumps.

Made mostly as an exercise to learn more about [Bun](https://github.com/oven-sh/bun) and [`happy-dom`](https://github.com/capricorn86/happy-dom).

While I was doing this, I discovered that [Hardcover](https://hardcover.app) exists, which is likely a better choice than GoodReads. In fact, this project allowed me to take a good, long look at GoodReads' frontend code, and I can confidently tell you it's **definitely** a better choice. Mongo is appalled.

Maybe I'll create a version for Hardcover too one day, it should be easier.

## What it spits out

Each numbered book gets a line like this:

```text
Robert Crais - Elvis Cole and Joe Pike 01 - The Monkey's Raincoat
Robert Crais - Elvis Cole and Joe Pike 02 - Stalking the Angel
Robert Crais - Elvis Cole and Joe Pike 03 - Lullaby Town
```

The script sorts the books by number and pads whole numbers to two digits. Fractional positions stay put, so `0.5` becomes `00.5`.

Downloaded files use the name `<author> - <series>.txt`. If the series has more than one author, it uses `Various Authors` instead. Characters that Windows does not allow in filenames become underscores.

## Install it

You need [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/). These are called Userscript managers.

### By a Userscript manager
Visit [raw userscript](https://raw.githubusercontent.com/khayman/userscripts/main/goodreads-extract-series/goodreads-extract-series.user.js). It should theoretically auto-open it in Tampermonkey/Violentmonkey, where you can click Install.

### By hand

1. Create a new userscript in your manager.
2. Replace its contents with [`goodreads-extract-series.user.js`](./goodreads-extract-series.user.js) and save it.
3. Open a page under `https://www.goodreads.com/series/*`.

There is no build step. The file in this repo is the one the browser runs.

## Use it

Open a Goodreads series page. Two buttons should appear to the right of the series heading:

- `Copy titles` puts the list on the clipboard.
- `Download titles` saves the same thing as a text file.

After you click one, it briefly reports how many titles it found. If the page has no usable numbered books, it shows a warning instead.

## What counts as a book

Goodreads puts a `Book N` label beside each entry. The script trusts that label, not numbers buried in the title, because those title numbers sometimes belong to a completely different series, which is how a book listed at slot 7 ends up calling itself book 1. Many such cases.

If the label is missing or malformed, the script skips the book instead of guessing. Goodreads also likes to repeat a slot when it throws an omnibus or collection into the list, so the first valid book at each number wins. The related-series teasers do not count.

I tried my best to support various kinds of series pages, from single authors, to co-written series and anthologies. Chances are you might still encounter certain uniquely shaped lists of series where the script can get tripped up.

Feel free to [open an issue](https://github.com/khayman/userscripts/issues/new) when that happens (don't forget to include the GoodReads link), and I'll look into fixing it.

## Limitations

- The script only runs on `https://www.goodreads.com/series/*` pages.
- It reads Goodreads' embedded React data and header markup, so a redesign may break it.
- Unnumbered books and labels that do not exactly match `Book N` or `Book N.M` get skipped.
- Titles otherwise stay as Goodreads wrote them, including foreign-series text in parentheses.
- Apostrophes, curly quotes, and colons are not normalized. Filesystem-illegal characters become `_`.

## Development

These notes are mainly for myself so I don't forget things.

I use Bun for the tests and fixture scripts:

```text
bun install
bun test
bun test --watch
```

The userscript itself is plain JS with no runtime dependencies and nothing needing transpiling.

### Test fixtures

Full Goodreads pages copied from the browser live in the gitignored `test/fixtures/verbatim/` directory. They are handy for debugging, but far too large and noisy to commit.

`bun run trim:mocks` cuts each verbatim page down to the DOM nodes the userscript reads and writes the result to `test/fixtures/skeletons/*.html`. The golden output lives under `test/fixtures/expected/`. The script keeps the parsed `data-react-props` JSON and discards the rest of the rendered page.

To add and investigate a page shape:

1. Save it as `test/fixtures/verbatim/${seriesName}.html`.
2. Run `bun run trim:mocks` to regenerate the skeletons.
3. Compare extraction with the real page using `node test/test-extract.js ${seriesName}.html`.
4. Hand-check the list against Goodreads.
5. Run `bun run golden:update ${seriesName}.html` and promote its test only after the output is correct.

`bun run golden:update -- --all` regenerates every golden. Run it without a filename and it only updates the default Leonid McGill fixture.

Don't trust a newly generated golden until it has been checked against the page.
