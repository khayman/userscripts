// ==UserScript==
// @name         Goodreads Extract Series
// @namespace    https://github.com/khayman/userscripts/goodreads-extract-series
// @version      0.2.6
// @description  Copy an "Author - Series NN - Title" list from a Goodreads series page
// @author       khay
// @match        https://www.goodreads.com/series/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  var SERIES_SUFFIX = /\s+Series$/i;
  // Match "#N" or "#N.M" inside the parenthesised series token, e.g.
  // "Title (Series, #1)" or "Title (Series #0.5)". The closing ")" is
  // required so that omnibus ranges like "(Series, #1-5)" don't capture "1"
  // and get misnumbered as a primary work.
  var NUMBER_RE = /#\s*([\d.]+)\)/;
  var HEADER_RE = /^Book\s+([\d.]+)$/i;
  var PAREN_RE = /\s*\([^)]*\)\s*$/;
  var PAD_WIDTH = 2;

  function padSeriesNumber(numStr) {
    var parts = numStr.split('.');
    var intPart = parts[0].padStart(PAD_WIDTH, '0');
    return parts.length > 1 ? intPart + '.' + parts[1] : intPart;
  }

  function stripSeriesSuffix(title) {
    return title.replace(SERIES_SUFFIX, '').trim();
  }

  function sanitize(str) {
    return str.replace(/[\/\\:*?"<>|\x00-\x1F]/g, '_');
  }

  function getSeriesName(doc) {
    doc = doc || document;
    var header = doc.querySelector('[data-react-class="ReactComponents.SeriesHeader"]');
    if (header) {
      try {
        var props = JSON.parse(header.getAttribute('data-react-props') || '{}');
        if (props && props.title) return stripSeriesSuffix(props.title);
      } catch (_) { /* fall through */ }
      var h1 = header.querySelector('h1');
      if (h1) return stripSeriesSuffix(h1.textContent);
    }
    var titleEl = doc.querySelector('.responsiveSeriesHeader__title h1');
    return titleEl ? stripSeriesSuffix(titleEl.textContent) : null;
  }

  function collectBookEntries(doc) {
    doc = doc || document;
    var lists = doc.querySelectorAll('[data-react-class="ReactComponents.SeriesList"]');
    var seen = new Set();
    var seenSlots = new Set();
    var entries = [];
    lists.forEach(function (list) {
      var props;
      try {
        props = JSON.parse(list.getAttribute('data-react-props') || '{}');
      } catch (_) { return; }
      if (!props || !Array.isArray(props.series)) return;
      var headers = Array.isArray(props.seriesHeaders) ? props.seriesHeaders : [];
      props.series.forEach(function (entry, i) {
        var book = entry && entry.book;
        if (!book) return;
        var id = book.bookId;
        if (id && seen.has(id)) return;
        if (id) seen.add(id);
        var author = book.author && book.author.name ? book.author.name.replace(/\s+/g, ' ').trim() : '';
        var titleRaw = book.title || '';
        // Prefer the positionally-aligned seriesHeaders entry (e.g.
        // "Book 7") as the source of the *current* series number. A title
        // like "Admiral's Oath (Dakotan Confederacy #1) (Castle Federation,
        // #7)" carries a foreign series' "#1" which would otherwise
        // shadow the real number. Fall back to the title's "#N)" token
        // only when the header is missing or doesn't parse.
        var m = null;
        var header = headers[i];
        if (typeof header === 'string') {
          m = header.match(HEADER_RE);
        }
        if (!m) {
          m = titleRaw.match(NUMBER_RE);
        }
        if (!m) return;
        var numericSlot = parseFloat(m[1]);
        if (seenSlots.has(numericSlot)) return;
        seenSlots.add(numericSlot);
        var bookTitle = book.bookTitleBare || titleRaw.replace(PAREN_RE, '').trim();
        entries.push({ author: author, title: bookTitle, seriesNumber: m[1] });
      });
    });
    return entries;
  }

  function buildList(doc) {
    doc = doc || document;
    var series = getSeriesName(doc);
    if (!series) return null;
    var entries = collectBookEntries(doc);
    if (entries.length === 0) return null;
    entries.sort(function (a, b) {
      return parseFloat(a.seriesNumber) - parseFloat(b.seriesNumber);
    });
    return entries
      .map(function (e) {
        return sanitize(e.author) + ' - ' + sanitize(series) + ' ' + padSeriesNumber(e.seriesNumber) + ' - ' + sanitize(e.title);
      })
      .join('\n');
  }

  function buildFilename(doc) {
    doc = doc || document;
    var series = getSeriesName(doc);
    var entries = collectBookEntries(doc);
    var author = '';
    if (entries.length > 0) {
      var authors = new Set();
      entries.forEach(function (e) { authors.add(e.author); });
      author = authors.size === 1 ? entries[0].author : 'Various Authors';
    }
    var base;
    if (author && series) {
      base = author + ' - ' + series;
    } else if (series) {
      base = series;
    } else {
      base = 'series';
    }
    return sanitize(base) + '.txt';
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_) { /* fall through to legacy */ }
    }
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function downloadText(text, filename) {
    try {
      var blob = new Blob([text], { type: 'text/plain' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    } catch (_) {
      return false;
    }
  }

  function createButton(opts) {
    var IDLE_BG = '#f5f5f5';
    var IDLE_HOVER = '#e9e9e9';
    var IDLE_COLOR = '#333';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = opts.className;
    btn.textContent = opts.idleLabel;
    Object.assign(btn.style, {
      marginLeft: opts.marginLeft != null ? opts.marginLeft : '12px',
      padding: '4px 10px',
      fontSize: '13px',
      fontFamily: 'inherit',
      cursor: 'pointer',
      border: '1px solid #ccc',
      borderRadius: '3px',
      background: IDLE_BG,
      color: IDLE_COLOR,
      verticalAlign: 'middle',
    });

    var state = 'idle';
    var resetTimer = null;

    function setLabel(label, kind) {
      if (kind === 'success') {
        btn.style.background = '#d4edda';
        btn.style.color = '#155724';
      } else if (kind === 'warn') {
        btn.style.background = '#fff3cd';
        btn.style.color = '#856404';
      } else if (kind === 'error') {
        btn.style.background = '#f8d7da';
        btn.style.color = '#721c24';
      } else {
        btn.style.background = IDLE_BG;
        btn.style.color = IDLE_COLOR;
      }
      btn.textContent = label;
      state = kind || 'idle';
    }

    btn.addEventListener('click', async function () {
      var result = null;
      try { result = await opts.onClick(); } catch (_) { result = { label: 'Failed', kind: 'error' }; }
      if (result) setLabel(result.label, result.kind);
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(function () { setLabel(opts.idleLabel, 'idle'); }, 2000);
    });

    btn.addEventListener('mouseenter', function () {
      if (state === 'idle') btn.style.background = IDLE_HOVER;
    });
    btn.addEventListener('mouseleave', function () {
      if (state === 'idle') btn.style.background = IDLE_BG;
    });

    return btn;
  }

  function injectButtons() {
    var titleEl = document.querySelector('.responsiveSeriesHeader__title');
    if (!titleEl) return false;
    if (titleEl.querySelector('.gr-extract-series-copy-btn, .gr-extract-series-download-btn')) return true;

    var copyBtn = createButton({
      className: 'gr-extract-series-copy-btn',
      idleLabel: 'Copy titles',
      marginLeft: 'auto',
      onClick: async function () {
        var list = buildList();
        if (!list) return { label: 'No numbered titles found', kind: 'warn' };
        var count = list.split('\n').length;
        var ok = false;
        try { ok = await copyToClipboard(list); } catch (_) { ok = false; }
        return ok
          ? { label: 'Copied ' + count + ' titles', kind: 'success' }
          : { label: 'Copy failed', kind: 'error' };
      },
    });

    var downloadBtn = createButton({
      className: 'gr-extract-series-download-btn',
      idleLabel: 'Download titles',
      onClick: async function () {
        var list = buildList();
        if (!list) return { label: 'No numbered titles found', kind: 'warn' };
        var count = list.split('\n').length;
        var filename = buildFilename();
        var ok = false;
        try { ok = downloadText(list, filename); } catch (_) { ok = false; }
        return ok
          ? { label: 'Downloaded ' + count + ' titles', kind: 'success' }
          : { label: 'Download failed', kind: 'error' };
      },
    });

    titleEl.appendChild(copyBtn);
    titleEl.appendChild(downloadBtn);
    return true;
  }

  function waitForHeader() {
    var tries = 0;
    var maxTries = 40;
    function tick() {
      if (injectButtons()) return;
      if (++tries >= maxTries) return;
      setTimeout(tick, 500);
    }
    tick();
  }

  // --- Exports for Node testing (non-browser) ---
  // eslint-disable-next-line no-undef
  if (typeof module !== 'undefined' && module.exports) {
    // eslint-disable-next-line no-undef
    module.exports = {
      padSeriesNumber: padSeriesNumber,
      stripSeriesSuffix: stripSeriesSuffix,
      sanitize: sanitize,
      getSeriesName: getSeriesName,
      collectBookEntries: collectBookEntries,
      buildList: buildList,
      buildFilename: buildFilename,
    };
    return;
  }

  // --- Browser bootstrap ---
  if (typeof document !== 'undefined') {
    waitForHeader();
  }
})();
