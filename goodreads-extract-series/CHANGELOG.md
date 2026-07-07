# Changelog

Stuff I've changed, mostly so I remember what happened when.

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
