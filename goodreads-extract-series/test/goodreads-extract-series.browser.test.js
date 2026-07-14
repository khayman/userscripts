import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'bun:test';
import { Browser } from 'happy-dom';

const USERSCRIPT_SOURCE = fs.readFileSync(
  path.resolve(import.meta.dirname, '..', 'goodreads-extract-series.user.js'),
  'utf8'
);

const browsers = [];

afterEach(async () => {
  await Promise.all(browsers.splice(0).map((browser) => browser.close()));
});

function reactElement(className, props) {
  return '<div data-react-class="' + className + '" data-react-props="' +
    JSON.stringify(props).replace(/"/g, '&quot;') + '"></div>';
}

function seriesPageHtml({ includeTitle = true, includeBooks = true } = {}) {
  const title = includeTitle
    ? '<div class="responsiveSeriesHeader__title"><h1>Example Series</h1></div>'
    : '';
  const books = includeBooks
    ? reactElement('ReactComponents.SeriesList', {
        series: [{
          book: {
            bookId: 'book-2',
            author: { name: 'Trapezius Milkington' },
            title: 'A Title (Example Series, #2)',
            bookTitleBare: 'A Title',
          },
        }],
        seriesHeaders: ['Book 2'],
      })
    : '';
  return '<!doctype html><html><body>' + title + books + '</body></html>';
}

function installTimers(win) {
  let now = 0;
  let nextId = 1;
  let scheduledCount = 0;
  const timers = [];

  win.setTimeout = (callback, delay = 0, ...args) => {
    const timer = { id: nextId++, at: now + Number(delay), callback, args };
    timers.push(timer);
    scheduledCount++;
    return timer.id;
  };
  win.clearTimeout = (id) => {
    const timer = timers.find((candidate) => candidate.id === id);
    if (timer) timer.cancelled = true;
  };

  return {
    advanceBy(milliseconds) {
      const target = now + milliseconds;
      while (true) {
        timers.sort((a, b) => a.at - b.at || a.id - b.id);
        const timer = timers.find((candidate) => !candidate.cancelled && candidate.at <= target);
        if (!timer) break;
        timers.splice(timers.indexOf(timer), 1);
        now = timer.at;
        timer.callback(...timer.args);
      }
      now = target;
    },
    get pendingCount() {
      return timers.filter((timer) => !timer.cancelled).length;
    },
    get scheduledCount() {
      return scheduledCount;
    },
  };
}

function createHarness(html = seriesPageHtml()) {
  const browser = new Browser();
  const page = browser.newPage();
  const win = page.mainFrame.window;
  browsers.push(browser);
  page.content = html;

  // happy-dom 15's VM setup leaves standard intrinsics undefined under Bun.
  // Seed the built-ins used by the userscript without introducing Node globals.
  for (const name of ['Array', 'JSON', 'Object', 'Promise', 'Set', 'parseFloat']) {
    Object.defineProperty(win, name, {
      configurable: true,
      writable: true,
      value: globalThis[name],
    });
  }

  return {
    page,
    win,
    timers: installTimers(win),
    evaluate() {
      page.evaluate(USERSCRIPT_SOURCE);
    },
  };
}

async function click(button) {
  button.click();
  await Promise.resolve();
  await Promise.resolve();
}

function copyButton(win) {
  return win.document.querySelector('.gr-extract-series-copy-btn');
}

function downloadButton(win) {
  return win.document.querySelector('.gr-extract-series-download-btn');
}

describe('browser path', () => {
  describe('bootstrap and polling', () => {
    test('evaluates without CommonJS globals and immediately injects one complete pair', () => {
      const harness = createHarness();

      expect(harness.page.evaluate('typeof module')).toBe('undefined');
      harness.evaluate();

      expect(harness.win.document.querySelectorAll('.gr-extract-series-copy-btn')).toHaveLength(1);
      expect(harness.win.document.querySelectorAll('.gr-extract-series-download-btn')).toHaveLength(1);
      expect(copyButton(harness.win).textContent).toBe('Copy titles');
      expect(downloadButton(harness.win).textContent).toBe('Download titles');
    });

    test('evaluating the complete userscript again does not duplicate the pair', () => {
      const harness = createHarness();

      harness.evaluate();
      harness.evaluate();

      expect(harness.win.document.querySelectorAll('.gr-extract-series-copy-btn')).toHaveLength(1);
      expect(harness.win.document.querySelectorAll('.gr-extract-series-download-btn')).toHaveLength(1);
    });

    test('polling injects after the responsive header appears', () => {
      const harness = createHarness(seriesPageHtml({ includeTitle: false }));
      harness.evaluate();
      expect(copyButton(harness.win)).toBeNull();

      harness.win.document.body.insertAdjacentHTML(
        'afterbegin',
        '<div class="responsiveSeriesHeader__title"><h1>Example Series</h1></div>'
      );
      harness.timers.advanceBy(500);

      expect(copyButton(harness.win)).not.toBeNull();
      expect(downloadButton(harness.win)).not.toBeNull();
      expect(harness.timers.pendingCount).toBe(0);
    });

    test('polling stops after the configured retry limit', () => {
      const harness = createHarness(seriesPageHtml({ includeTitle: false }));
      harness.evaluate();

      harness.timers.advanceBy(19_500);

      expect(copyButton(harness.win)).toBeNull();
      expect(harness.timers.scheduledCount).toBe(39);
      expect(harness.timers.pendingCount).toBe(0);
      harness.timers.advanceBy(60_000);
      expect(harness.timers.scheduledCount).toBe(39);
    });
  });

  describe('copy button', () => {
    test('uses the modern clipboard API in a secure context', async () => {
      const harness = createHarness();
      const writes = [];
      Object.defineProperty(harness.win, 'isSecureContext', { configurable: true, value: true });
      Object.defineProperty(harness.win.navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (text) => writes.push(text) },
      });
      harness.evaluate();

      await click(copyButton(harness.win));

      expect(writes).toEqual(['Trapezius Milkington - Example 02 - A Title']);
      expect(copyButton(harness.win).textContent).toBe('Copied 1 titles');
    });

    test('falls back to execCommand when the modern clipboard rejects', async () => {
      const harness = createHarness();
      let copiedText = null;
      Object.defineProperty(harness.win, 'isSecureContext', { configurable: true, value: true });
      Object.defineProperty(harness.win.navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async () => { throw new Error('denied'); } },
      });
      harness.win.document.execCommand = (command) => {
        copiedText = harness.win.document.querySelector('textarea').value;
        return command === 'copy';
      };
      harness.evaluate();

      await click(copyButton(harness.win));

      expect(copiedText).toBe('Trapezius Milkington - Example 02 - A Title');
      expect(harness.win.document.querySelector('textarea')).toBeNull();
      expect(copyButton(harness.win).textContent).toBe('Copied 1 titles');
    });
  });

  describe('download button', () => {
    test('downloads the generated text and filename, then revokes the object URL', async () => {
      const harness = createHarness();
      const blobs = [];
      const clicks = [];
      const revoked = [];
      harness.win.Blob = class BlobStub {
        constructor(parts, options) {
          this.parts = parts;
          this.type = options.type;
          blobs.push(this);
        }
      };
      harness.win.URL.createObjectURL = () => 'blob:test-url';
      harness.win.URL.revokeObjectURL = (url) => revoked.push(url);
      harness.win.HTMLAnchorElement.prototype.click = function () {
        clicks.push({ href: this.href, download: this.download });
      };
      harness.evaluate();

      await click(downloadButton(harness.win));

      expect(blobs).toHaveLength(1);
      expect(blobs[0]).toEqual({
        parts: ['Trapezius Milkington - Example 02 - A Title'],
        type: 'text/plain',
      });
      expect(clicks).toEqual([{ href: 'blob:test-url', download: 'Trapezius Milkington - Example.txt' }]);
      expect(revoked).toEqual(['blob:test-url']);
      expect(harness.win.document.querySelector('a')).toBeNull();
      expect(downloadButton(harness.win).textContent).toBe('Downloaded 1 titles');
    });
  });

  describe('button feedback', () => {
    test('success labels reset after two seconds', async () => {
      const harness = createHarness();
      Object.defineProperty(harness.win, 'isSecureContext', { configurable: true, value: true });
      Object.defineProperty(harness.win.navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async () => {} },
      });
      harness.evaluate();

      await click(copyButton(harness.win));
      expect(copyButton(harness.win).textContent).toBe('Copied 1 titles');
      harness.timers.advanceBy(1_999);
      expect(copyButton(harness.win).textContent).toBe('Copied 1 titles');
      harness.timers.advanceBy(1);
      expect(copyButton(harness.win).textContent).toBe('Copy titles');
    });

    test('warning labels reset after two seconds', async () => {
      const harness = createHarness(seriesPageHtml({ includeBooks: false }));
      harness.evaluate();

      await click(copyButton(harness.win));
      expect(copyButton(harness.win).textContent).toBe('No numbered titles found');
      harness.timers.advanceBy(2_000);
      expect(copyButton(harness.win).textContent).toBe('Copy titles');
    });

    test('failure labels reset after two seconds', async () => {
      const harness = createHarness();
      Object.defineProperty(harness.win, 'isSecureContext', { configurable: true, value: false });
      harness.win.document.execCommand = () => false;
      harness.evaluate();

      await click(copyButton(harness.win));
      expect(copyButton(harness.win).textContent).toBe('Copy failed');
      harness.timers.advanceBy(2_000);
      expect(copyButton(harness.win).textContent).toBe('Copy titles');
    });
  });

  describe('Phase 4 regressions', () => {
    test.todo('restores a missing copy or download button independently');
    test.todo('injects into usable React series-header fallbacks');
    test.todo('bootstraps when the page defines module.exports');
  });
});
