// Test harness: builds a real DOM from each skeleton HTML mock (happy-dom)
// and verifies buildList() / collectBookEntries() / buildFilename() output.
//
// Only the baseline mock (series.html) is actively asserted. The other four
// mocks are describe.skip()'d here — they are fixtures for the bug-hunt
// session (see TODO.md "Pending — bug hunt"). Un-skip them one at a time
// once each has been hand-verified against the real Goodreads page.
//
// Run: bun test   (or `bun run test:watch`)

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { Window } from 'happy-dom';
import { test, describe, expect, beforeAll } from 'bun:test';

// Import the userscript via createRequire so its CommonJS `module.exports`
// handshake works under bun's ESM test entry point.
const requireUser = createRequire(import.meta.url);
const script = requireUser(
  path.resolve(import.meta.dirname, '..', 'goodreads-extract-series.user.js')
);

const MOCK_DIR = import.meta.dirname;
const EXPECTED_DIR = path.join(MOCK_DIR, 'expected');

function docFromHtml(html) {
  const win = new Window();
  win.document.write(html);
  return win.document;
}

function loadMockDoc(file) {
  const html = fs.readFileSync(path.join(MOCK_DIR, file), 'utf8');
  return docFromHtml(html);
}

function loadGolden(file) {
  const name = file.replace(/\.html$/, '.txt');
  return fs.readFileSync(path.join(EXPECTED_DIR, name), 'utf8').replace(/\n$/, '');
}

function parseSeriesNumbers(list) {
  return list.split('\n').map((line) => {
    const m = line.match(/ - \S+ ([\d.]+) - /);
    return m ? parseFloat(m[1]) : null;
  });
}

// Minimal mock document built from a string of HTML — used by buildFilename
// unit tests so they don't depend on the committed skeletons.
function docFromHtmlString(html) {
  return docFromHtml(html);
}

const mockFiles = fs
  .readdirSync(MOCK_DIR)
  .filter((f) => /^series.*\.html$/.test(f) && f !== 'series.html')
  .sort();

describe('series.html (baseline)', () => {
  const file = 'series.html';
  let doc;
  beforeAll(() => { doc = loadMockDoc(file); });

  test('collectBookEntries returns 6 numbered entries', () => {
    expect(script.collectBookEntries(doc)).toHaveLength(6);
  });

  test('buildList is non-null', () => {
    expect(script.buildList(doc)).not.toBeNull();
  });

  test('lines are sorted ascending by series number', () => {
    const list = script.buildList(doc);
    const numbers = parseSeriesNumbers(list);
    const sorted = [...numbers].sort((a, b) => a - b);
    expect(numbers).toEqual(sorted);
  });

  test('buildList matches test/expected/series.txt', () => {
    expect(script.buildList(doc)).toBe(loadGolden(file));
  });

  test('buildFilename is "Walter Mosley - Leonid McGill.txt"', () => {
    expect(script.buildFilename(doc)).toBe('Walter Mosley - Leonid McGill.txt');
  });
});

// --- Bug-hunt follow-up (see TODO.md "Pending — bug hunt") -------------------
// Each mock below is skipped until it's been hand-verified against the real
// Goodreads page. Flow per mock: un-skip, hand-verify buildList output, fix
// the script if needed, `bun run golden:update <file>` to regenerate the
// golden, then promote from describe.skip to describe with assertions.
for (const file of mockFiles) {
  describe.skip(file, () => {
    test('buildList matches golden (placeholder)', () => {
      const doc = loadMockDoc(file);
      expect(script.buildList(doc)).toBe(loadGolden(file));
    });
  });
}

describe('pure functions', () => {
  describe('padSeriesNumber', () => {
    test.each([
      ['0.5', '00.5'],
      ['0.1', '00.1'],
      ['1', '01'],
      ['2', '02'],
      ['10', '10'],
      ['15', '15'],
      ['1.5', '01.5'],
    ])('%s -> %s', (input, expected) => {
      expect(script.padSeriesNumber(input)).toBe(expected);
    });
  });

  describe('stripSeriesSuffix', () => {
    test('strips trailing " Series"', () => {
      expect(script.stripSeriesSuffix('Walt Longmire Series')).toBe('Walt Longmire');
    });
    test('no suffix = unchanged', () => {
      expect(script.stripSeriesSuffix('Walt Longmire')).toBe('Walt Longmire');
    });
  });

  describe('sanitize', () => {
    test('no illegal chars = unchanged', () => {
      expect(script.sanitize('normal name')).toBe('normal name');
    });
    test('dots and spaces preserved', () => {
      expect(script.sanitize('Series 01.5')).toBe('Series 01.5');
    });
    test('all illegal chars -> underscore', () => {
      expect(script.sanitize('A/B\\C:D*E?F"G<H>I|J')).toBe('A_B_C_D_E_F_G_H_I_J');
    });
    test('control char -> underscore', () => {
      expect(script.sanitize('a\x01b')).toBe('a_b');
    });
    test('empty string unchanged', () => {
      expect(script.sanitize('')).toBe('');
    });
  });

  describe('buildFilename', () => {
    function multiAuthorDoc() {
      const props = JSON.stringify({
        series: [
          { book: { bookId: 'a1', author: { name: 'Author One' }, title: 'Book One (#1)', bookTitleBare: 'Book One' } },
          { book: { bookId: 'b2', author: { name: 'Author Two' }, title: 'Book Two (#2)', bookTitleBare: 'Book Two' } },
        ],
      });
      const headerProps = JSON.stringify({ title: 'Shared Saga' });
      const html =
        '<div class="responsiveSeriesHeader__title"><h1>Shared Saga</h1></div>' +
        '<div data-react-class="ReactComponents.SeriesHeader" data-react-props="' + headerProps.replace(/"/g, '&quot;') + '"></div>' +
        '<div data-react-class="ReactComponents.SeriesList" data-react-props="' + props.replace(/"/g, '&quot;') + '"></div>';
      return docFromHtmlString(html);
    }

    function illegalCharsDoc() {
      const listProps = JSON.stringify({
        series: [
          { book: { bookId: 'x', author: { name: 'Solo' }, title: 'T (#1)', bookTitleBare: 'T' } },
        ],
      });
      const headerProps = JSON.stringify({ title: 'A/B Series' });
      const html =
        '<div class="responsiveSeriesHeader__title"><h1>A/B Series</h1></div>' +
        '<div data-react-class="ReactComponents.SeriesHeader" data-react-props="' + headerProps.replace(/"/g, '&quot;') + '"></div>' +
        '<div data-react-class="ReactComponents.SeriesList" data-react-props="' + listProps.replace(/"/g, '&quot;') + '"></div>';
      return docFromHtmlString(html);
    }

    test('multi-author -> "Various Authors"', () => {
      expect(script.buildFilename(multiAuthorDoc())).toBe('Various Authors - Shared Saga.txt');
    });
    test('illegal slash sanitized in filename', () => {
      expect(script.buildFilename(illegalCharsDoc())).toBe('Solo - A_B.txt');
    });
  });
});
