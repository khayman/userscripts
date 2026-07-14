// Test harness: builds a real DOM from each skeleton HTML mock (happy-dom)
// and verifies buildList() / collectBookEntries() / buildFilename() output.
//
// Hand-verified fixtures are actively asserted. Other committed skeletons are
// discovered and describe.skip()'d below until each has been checked against
// the real Goodreads page.
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

const FIXTURE_DIR = path.join(import.meta.dirname, 'fixtures');
const MOCK_DIR = path.join(FIXTURE_DIR, 'skeletons');
const EXPECTED_DIR = path.join(FIXTURE_DIR, 'expected');

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

// Minimal mock document built from a string of HTML — used by buildFilename
// unit tests so they don't depend on the committed skeletons.
function docFromHtmlString(html) {
  return docFromHtml(html);
}

function reactElement(className, props, innerHtml = '') {
  return '<div data-react-class="' + className + '" data-react-props="' +
    JSON.stringify(props).replace(/"/g, '&quot;') + '">' + innerHtml + '</div>';
}

function singleBookDoc(seriesHeader, book = {}) {
  return docFromHtmlString(reactElement('ReactComponents.SeriesList', {
    series: [{
      book: {
        bookId: 'book',
        author: { name: 'Author' },
        title: 'A Title (Example Series, #4)',
        bookTitleBare: 'A Title',
        ...book,
      },
    }],
    seriesHeaders: [seriesHeader],
  }));
}

const PROMOTED = new Set([
  'castle-federation.html',
  'easy-rawlins.html',
  'elvis-cole-and-joe-pike.html',
  'leonid-mcgill.html',
  'lucas-davenport.html',
  'nebula-awards-showcases.html',
  'walt-longmire.html',
]);
const mockFiles = fs
  .readdirSync(MOCK_DIR)
  .filter((f) => /\.html$/.test(f) && !PROMOTED.has(f))
  .sort();

describe('leonid-mcgill.html (baseline)', () => {
  const file = 'leonid-mcgill.html';
  let doc;
  beforeAll(() => { doc = loadMockDoc(file); });

  test('collectBookEntries returns 6 numbered entries', () => {
    expect(script.collectBookEntries(doc)).toHaveLength(6);
  });

  test('buildList is non-null', () => {
    expect(script.buildList(doc)).not.toBeNull();
  });

  test('buildList matches golden', () => {
    expect(script.buildList(doc)).toBe(loadGolden(file));
  });

  test('buildFilename is "Walter Mosley - Leonid McGill.txt"', () => {
    expect(script.buildFilename(doc)).toBe('Walter Mosley - Leonid McGill.txt');
  });
});

// --- Promoted mocks (hand-verified against the real page) -------------------
// Each was checked, fixed where needed, given a targeted regression suite and
// golden, then added to PROMOTED so auto-discovery no longer skips it.
//
describe('nebula-awards-showcases.html', () => {
  const file = 'nebula-awards-showcases.html';
  let doc;
  beforeAll(() => { doc = loadMockDoc(file); });

  test('collectBookEntries returns all 55 primary works in sequence', () => {
    const entries = script.collectBookEntries(doc);
    expect(entries).toHaveLength(55);
    expect(entries.map((e) => Number(e.seriesNumber))).toEqual(
      Array.from({ length: 55 }, (_, i) => i + 1)
    );
  });

  test('each volume retains its editor as the author', () => {
    const entries = script.collectBookEntries(doc);
    const authorByNumber = new Map(entries.map((e) => [e.seriesNumber, e.author]));

    expect(authorByNumber.get('1')).toBe('Damon Knight');
    expect(authorByNumber.get('2')).toBe('Brian W. Aldiss');
    expect(authorByNumber.get('55')).toBe('Catherynne M. Valente');
  });

  test('buildList matches golden', () => {
    expect(script.buildList(doc)).toBe(loadGolden(file));
  });

  test('buildFilename uses Various Authors', () => {
    expect(script.buildFilename(doc)).toBe('Various Authors - Nebula Awards Showcases.txt');
  });
});

describe('walt-longmire.html', () => {
  const file = 'walt-longmire.html';
  let doc;
  beforeAll(() => { doc = loadMockDoc(file); });

  test('collectBookEntries returns 29 numbered entries', () => {
    expect(script.collectBookEntries(doc)).toHaveLength(29);
  });

  test('short works retain their fractional series numbers', () => {
    const entries = script.collectBookEntries(doc);
    const numberByTitle = new Map(entries.map((e) => [e.title, e.seriesNumber]));

    expect(numberByTitle.get('Tooth and Claw')).toBe('0.5');
    expect(numberByTitle.get('Divorce Horse')).toBe('7.1');
    expect(numberByTitle.get('Christmas in Absaroka County')).toBe('8.1');
    expect(numberByTitle.get('Messenger')).toBe('8.2');
    expect(numberByTitle.get('Spirit of Steamboat')).toBe('9.1');
    expect(numberByTitle.get('Wait for Signs: Twelve Longmire Stories')).toBe('10.1');
    expect(numberByTitle.get('The Highwayman')).toBe('11.5');
  });

  test('buildList matches golden', () => {
    expect(script.buildList(doc)).toBe(loadGolden(file));
  });

  test('buildFilename is "Craig Johnson - Walt Longmire.txt"', () => {
    expect(script.buildFilename(doc)).toBe('Craig Johnson - Walt Longmire.txt');
  });
});

// Omnibus mock: the omnibus "(Easy Rawlins Mysteries, #1-5)" at the bottom
// must NOT appear as a primary work (must not be misnumbered #1).
describe('easy-rawlins.html', () => {
  const file = 'easy-rawlins.html';
  let doc;
  beforeAll(() => { doc = loadMockDoc(file); });

  test('collectBookEntries returns 17 numbered entries (omnibus excluded)', () => {
    expect(script.collectBookEntries(doc)).toHaveLength(17);
  });

  test('no entry is misnumbered by the omnibus #1-5 range', () => {
    const entries = script.collectBookEntries(doc);
    const numbers = entries.map((e) => e.seriesNumber);
    // Exactly one #1 (Devil in a Blue Dress), no extras from the omnibus.
    expect(numbers.filter((n) => n === '1')).toHaveLength(1);
    // The omnibus bookId 2177745 must be absent.
    expect(entries.some((e) => e.title.includes("Walter Mosley's Easy Rawlins Mysteries"))).toBe(false);
  });

  test('buildList matches golden', () => {
    expect(script.buildList(doc)).toBe(loadGolden(file));
  });

  test('buildFilename is "Walter Mosley - Easy Rawlins.txt"', () => {
    expect(script.buildFilename(doc)).toBe('Walter Mosley - Easy Rawlins.txt');
  });
});

// Spinoffs mock: three Dakotan Confederacy spinoffs are interleaved at
// positions 7/8/9 of the Castle Federation reading order. Their titles
// carry the foreign series' "#N" (e.g. "(Dakotan Confederacy #1)"), which
// used to shadow the current series' number from seriesHeaders. The fix
// prefers the aligned header ("Book 7/8/9") as the source of the number.
describe('castle-federation.html', () => {
  const file = 'castle-federation.html';
  let doc;
  beforeAll(() => { doc = loadMockDoc(file); });

  test('collectBookEntries returns 10 numbered entries', () => {
    expect(script.collectBookEntries(doc)).toHaveLength(10);
  });

  test('spinoffs are numbered by the current series, not the foreign one', () => {
    const entries = script.collectBookEntries(doc);
    const byNum = new Map(entries.map((e) => [e.seriesNumber, e]));
    // Admiral's Oath — title says "Dakotan Confederacy #1", header says "Book 7"
    expect(byNum.get('7').title).toBe("Admiral's Oath (Dakotan Confederacy #1)");
    // To Stand Defiant — title says "Dakotan Confederacy, #2", header says "Book 8"
    expect(byNum.get('8').title).toBe('To Stand Defiant');
    // Unbroken Faith — header "Book 9"
    expect(byNum.get('9').title).toBe('Unbroken Faith');
    // No duplicate #1 / #2 from the foreign series.
    expect(entries.filter((e) => e.seriesNumber === '1')).toHaveLength(1);
    expect(entries.filter((e) => e.seriesNumber === '2')).toHaveLength(1);
  });

  test('skips crossovers rather than using foreign-series title numbers when aligned headers are invalid', () => {
    const mutatedDoc = loadMockDoc(file);
    const crossoverTitles = ["Admiral's Oath (Dakotan Confederacy #1)", 'To Stand Defiant', 'Unbroken Faith'];

    mutatedDoc.querySelectorAll('[data-react-class="ReactComponents.SeriesList"]').forEach((list) => {
      const props = JSON.parse(list.getAttribute('data-react-props'));
      props.series.forEach((_, i) => {
        if (/^Book (?:7|8|9)$/.test(props.seriesHeaders[i])) props.seriesHeaders[i] = 'not a book number';
      });
      list.setAttribute('data-react-props', JSON.stringify(props));
    });

    const entries = script.collectBookEntries(mutatedDoc);
    expect(entries.filter((entry) => crossoverTitles.includes(entry.title))).toEqual([]);
    expect(entries.map((entry) => Number(entry.seriesNumber))).toEqual([1, 2, 3, 4, 5, 6, 6.5]);
  });

  test('buildList matches golden', () => {
    expect(script.buildList(doc)).toBe(loadGolden(file));
  });

  test('buildFilename is "Glynn Stewart - Castle Federation.txt"', () => {
    expect(script.buildFilename(doc)).toBe('Glynn Stewart - Castle Federation.txt');
  });
});

describe('lucas-davenport.html', () => {
  const file = 'lucas-davenport.html';
  let doc;
  beforeAll(() => { doc = loadMockDoc(file); });

  test('collectBookEntries returns 37 numbered entries (collections excluded)', () => {
    expect(script.collectBookEntries(doc)).toHaveLength(37);
  });

  test('crossovers use their Lucas Davenport numbers without duplicates', () => {
    const entries = script.collectBookEntries(doc);
    const numberByTitle = new Map(entries.map((e) => [e.title, e.seriesNumber]));

    expect(numberByTitle.get('Ocean Prey')).toBe('31');
    expect(numberByTitle.get('Righteous Prey')).toBe('32');
    expect(numberByTitle.get('Judgment Prey')).toBe('33');
    expect(numberByTitle.get('Toxic Prey')).toBe('34');
    expect(numberByTitle.get('Lethal Prey')).toBe('35');
    expect(new Set(entries.map((e) => e.seriesNumber)).size).toBe(entries.length);
  });

  test('buildList matches golden', () => {
    expect(script.buildList(doc)).toBe(loadGolden(file));
  });

  test('buildFilename is "Various Authors - Lucas Davenport.txt"', () => {
    expect(script.buildFilename(doc)).toBe('Various Authors - Lucas Davenport.txt');
  });
});

describe('elvis-cole-and-joe-pike.html', () => {
  const file = 'elvis-cole-and-joe-pike.html';
  let doc;
  beforeAll(() => { doc = loadMockDoc(file); });

  test('keeps the novel and excludes the collection from numeric slot 8', () => {
    const entries = script.collectBookEntries(doc);
    const slotEight = entries.filter((entry) => Number(entry.seriesNumber) === 8);

    expect(entries).toHaveLength(20);
    expect(slotEight).toHaveLength(1);
    expect(slotEight[0].title).toBe('L.A. Requiem');
    expect(entries.some((entry) => entry.title.includes('Three Great Novels'))).toBe(false);
  });

  test('buildList matches golden', () => {
    expect(script.buildList(doc)).toBe(loadGolden(file));
  });

  test('buildFilename is "Robert Crais - Elvis Cole and Joe Pike.txt"', () => {
    expect(script.buildFilename(doc)).toBe('Robert Crais - Elvis Cole and Joe Pike.txt');
  });
});

// Any future skeletons are discovered automatically but stay skipped until
// their output has been hand-verified and promoted to an explicit describe.
for (const file of mockFiles) {
  describe.skip(file, () => {
    test('buildList matches golden (placeholder)', () => {
      const doc = loadMockDoc(file);
      expect(script.buildList(doc)).toBe(loadGolden(file));
    });
  });
}

describe('pure functions', () => {
  describe('collectBookEntries', () => {
    test('keeps the first numerically equivalent slot within and across lists', () => {
      function listElement(series, seriesHeaders) {
        const props = JSON.stringify({ series, seriesHeaders });
        return '<div data-react-class="ReactComponents.SeriesList" data-react-props="' + props.replace(/"/g, '&quot;') + '"></div>';
      }

      const doc = docFromHtmlString(
        listElement([
          { book: { bookId: 'first', author: { name: 'Author' }, title: 'First', bookTitleBare: 'First' } },
          { book: { bookId: 'same-list', author: { name: 'Author' }, title: 'Same List', bookTitleBare: 'Same List' } },
        ], ['Book 1', 'Book 01']) +
        listElement([
          { book: { bookId: 'next-list', author: { name: 'Author' }, title: 'Next List', bookTitleBare: 'Next List' } },
          { book: { bookId: 'second', author: { name: 'Author' }, title: 'Second', bookTitleBare: 'Second' } },
        ], ['Book 1.0', 'Book 2'])
      );

      expect(script.collectBookEntries(doc)).toEqual([
        { author: 'Author', title: 'First', seriesNumber: '1' },
        { author: 'Author', title: 'Second', seriesNumber: '2' },
      ]);
    });

    test.each([
      ['Book 1', '1'],
      ['Book 0.5', '0.5'],
      ['book 10.25', '10.25'],
    ])('accepts aligned header %s', (header, expected) => {
      expect(script.collectBookEntries(singleBookDoc(header))).toEqual([
        { author: 'Author', title: 'A Title', seriesNumber: expected },
      ]);
    });

    test.each([
      'Book .',
      'Book .5',
      'Book 1.',
      'Book 1..2',
      'Book 1-5',
      'Book 1, 2',
      'Book 1 extra',
      'prefix Book 1',
      ' Book 1 ',
      undefined,
    ])('rejects malformed or missing aligned header %p', (header) => {
      expect(script.collectBookEntries(singleBookDoc(header))).toEqual([]);
    });

    test('does not infer a number from the title without a valid aligned header', () => {
      expect(script.collectBookEntries(singleBookDoc(undefined))).toEqual([]);
    });

    test('preserves the trimmed raw title when bookTitleBare is missing', () => {
      const doc = singleBookDoc('Book 4', {
        title: '  A Title (Revised Edition)  ',
        bookTitleBare: undefined,
      });

      expect(script.collectBookEntries(doc)).toEqual([
        { author: 'Author', title: 'A Title (Revised Edition)', seriesNumber: '4' },
      ]);
    });

    test('an invalid unnumbered duplicate ID suppresses a later valid copy', () => {
      const doc = docFromHtmlString(
        reactElement('ReactComponents.SeriesList', {
          series: [{ book: { bookId: 'same', author: { name: 'Author' }, title: 'Unnumbered' } }],
          seriesHeaders: ['Book nope'],
        }) +
        reactElement('ReactComponents.SeriesList', {
          series: [{ book: { bookId: 'same', author: { name: 'Author' }, title: 'Numbered', bookTitleBare: 'Numbered' } }],
          seriesHeaders: ['Book 1'],
        })
      );

      expect(script.collectBookEntries(doc)).toEqual([]);
    });

    test('ignores invalid list JSON and continues with later lists', () => {
      const doc = docFromHtmlString(
        '<div data-react-class="ReactComponents.SeriesList" data-react-props="{bad"></div>' +
        reactElement('ReactComponents.SeriesList', {
          series: [{ book: { bookId: 'valid', author: { name: 'Author' }, title: 'Valid', bookTitleBare: 'Valid' } }],
          seriesHeaders: ['Book 1'],
        })
      );

      expect(script.collectBookEntries(doc)).toEqual([
        { author: 'Author', title: 'Valid', seriesNumber: '1' },
      ]);
    });
  });

  describe('getSeriesName', () => {
    test.each(['', '   '])('falls through empty props title %p to the nested heading', (title) => {
      const doc = docFromHtmlString(
        reactElement('ReactComponents.SeriesHeader', { title }, '<h1>Nested Series</h1>')
      );

      expect(script.getSeriesName(doc)).toBe('Nested');
    });

    test('falls through empty React header candidates to the responsive heading', () => {
      const doc = docFromHtmlString(
        '<div data-react-class="ReactComponents.SeriesHeader" data-react-props="{bad"><h1>   </h1></div>' +
        '<div class="responsiveSeriesHeader__title"><h1>Responsive Series</h1></div>'
      );

      expect(script.getSeriesName(doc)).toBe('Responsive');
    });
  });

  describe('buildList', () => {
    test('sorts fractional and multi-digit series numbers numerically', () => {
      const listProps = JSON.stringify({
        series: [
          { book: { bookId: '10', author: { name: 'Test Author' }, title: 'Ten', bookTitleBare: 'Ten' } },
          { book: { bookId: '2', author: { name: 'Test Author' }, title: 'Two', bookTitleBare: 'Two' } },
          { book: { bookId: '1.5', author: { name: 'Test Author' }, title: 'One and a Half', bookTitleBare: 'One and a Half' } },
        ],
        seriesHeaders: ['Book 10', 'Book 2', 'Book 1.5'],
      });
      const headerProps = JSON.stringify({ title: 'Test Series' });
      const doc = docFromHtmlString(
        '<div data-react-class="ReactComponents.SeriesHeader" data-react-props="' + headerProps.replace(/"/g, '&quot;') + '"></div>' +
        '<div data-react-class="ReactComponents.SeriesList" data-react-props="' + listProps.replace(/"/g, '&quot;') + '"></div>'
      );

      expect(script.buildList(doc)).toBe([
        'Test Author - Test 01.5 - One and a Half',
        'Test Author - Test 02 - Two',
        'Test Author - Test 10 - Ten',
      ].join('\n'));
    });
  });

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
        seriesHeaders: ['Book 1', 'Book 2'],
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
        seriesHeaders: ['Book 1'],
      });
      const headerProps = JSON.stringify({ title: 'A/B Series' });
      const html =
        '<div class="responsiveSeriesHeader__title"><h1>A/B Series</h1></div>' +
        '<div data-react-class="ReactComponents.SeriesHeader" data-react-props="' + headerProps.replace(/"/g, '&quot;') + '"></div>' +
        '<div data-react-class="ReactComponents.SeriesList" data-react-props="' + listProps.replace(/"/g, '&quot;') + '"></div>';
      return docFromHtmlString(html);
    }

    function inconsistentAuthorWhitespaceDoc() {
      const listProps = JSON.stringify({
        series: [
          { book: { bookId: 'a1', author: { name: 'Mark  Dawson' }, title: 'One (#1)', bookTitleBare: 'One' } },
          { book: { bookId: 'a2', author: { name: 'Mark Dawson' }, title: 'Two (#2)', bookTitleBare: 'Two' } },
        ],
        seriesHeaders: ['Book 1', 'Book 2'],
      });
      const headerProps = JSON.stringify({ title: 'Atticus Priest Series' });
      const html =
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
    test('inconsistent author whitespace is normalized', () => {
      const doc = inconsistentAuthorWhitespaceDoc();
      expect(script.buildList(doc)).toBe([
        'Mark Dawson - Atticus Priest 01 - One',
        'Mark Dawson - Atticus Priest 02 - Two',
      ].join('\n'));
      expect(script.buildFilename(doc)).toBe('Mark Dawson - Atticus Priest.txt');
    });
  });
});
