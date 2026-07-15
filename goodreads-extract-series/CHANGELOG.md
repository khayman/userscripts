# Changelog

Stuff I've changed, mostly so I remember what happened when.

## [0.3.1] - 2026-07-15

### Changed
- Replaced the blanket underscore treatment with filename-safe typography. Separators now become spaced en dashes, straight double quotes become contextual curly quotes, curly apostrophes become ASCII apostrophes, and the remaining troublesome punctuation and whitespace get cleaned up without peppering titles with underscores.

### Tests
- Added focused coverage for every sanitization rule and updated the Walt Longmire, Nebula Awards, and Lucas Davenport goldens that contain colons.

## [0.3.0] - 2026-07-14

### Fixed
- Buttons now work with the fallback React series headers, and either missing button is restored without replacing or duplicating the other one.
- A page-defined `module.exports` no longer tricks the userscript into skipping browser startup.

### Tests
- Added browser coverage for fallback header placement, partial button pairs, repeated injection, and page-level CommonJS collisions.

## [0.2.7] - 2026-07-14

### Fixed
- Series numbers now come only from Goodreads' aligned `Book N` headers. Missing or malformed headers are skipped instead of guessing from a title that might name a different series.
- Missing bare-title data no longer strips a legitimate final parenthetical from the book title, and empty series-name candidates now fall through to the next available heading.

### Tests
- Added browser coverage for button injection, clipboard fallback, downloads, feedback timers, and delayed-header polling.

## [0.2.6] - 2026-07-13

### Fixed
- Goodreads can list a collection after the real book with the same series number. The first book in each numeric slot now wins, so the collection no longer creates a duplicate entry. Equivalent numbers such as `1`, `01`, and `1.0` count as the same slot.

### Tests
- Added the Elvis Cole and Joe Pike fixture for the duplicate `Book 8` case and replaced the old sorting checks, which accidentally compared arrays of `null`, with a synthetic out-of-order regression test.

## [0.2.5] - 2026-07-13

### Fixed
- Goodreads sometimes puts inconsistent whitespace in an author's name, which made one author look like several and produced a `Various Authors` filename. Author whitespace is now collapsed before building the list and filename.

## [0.2.4] - 2026-07-13

### Fixed
- Confirmed the same crossover-numbering bug on Lucas Davenport: five later books were being assigned their Virgil Flowers or Letty Davenport numbers, producing duplicate slots and hiding `#31` through `#35`. Added the real page fixture and regression coverage so the header-first fix stays fixed.

### Tests
- Promoted the Easy Rawlins omnibus and Castle Federation spinoff fixtures too. The former proves collection ranges stay out; the latter directly covers the bug fixed in `0.2.3`.

## [0.2.3] - 2026-07-08

### Fixed
- Spinoffs interleaved into a series' reading order were getting numbered by the *foreign* series' `#N` from the title, not the current series' number. So "Admiral's Oath (Dakotan Confederacy #1) (Castle Federation, #7)" came out as `#1` instead of `#7`, and "To Stand Defiant (Dakotan Confederacy, #2)" as `#2` instead of `#8` (duplicate numbers, missing slots.) The parser now treats the positionally-aligned `seriesHeaders[i]` entry ("Book 7") as the primary source for the number, only falling back to the title's `#N)` when the header is missing or doesn't parse. The header always carries the current series' own number; a title's `#N` can't be trusted to.

## [0.2.2] - 2026-07-05

### Fixed
- Omnibus entries like `Book 1-5` were sneaking into the list. The parser now ignores anything without a closing `)` after the `#N` token, which is exactly how Goodreads formats range entries.

## [0.2.1] - 2026-07-04

### Fixed
- SUPER ILLEGAL characters like `/\:*?"<>|` in titles was breaking things when I tried to rename files. Now replaced with underscores, though I honestly thought about using those fancy full-width unicode replacers that `yt-dlp` uses. Decided against it because I'm willing to bet it'd cause unforeseen issues at some point. Plus they nasty, have you seen how weird that question mark looks? (Here it is btw: ？)

## [0.2.0] - 2026-07-04

### Added
- Download button next to the copy one. Dumps a `.txt` file named after the author and series. Falls back to "Various Authors" if there's more than one. Not entirely sure it's the right nomenclature, but eh, it'll do.

## [0.1.0] - 2026-07-03

### Added
- The whole thing:
  - Adds a "Copy titles" button to Goodreads series pages.
  - Grabs the books from the page's React data;
  - Sorts by series number
  - Copies an `Author - Series NN - Title` list to clipboard.
