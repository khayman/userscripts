// Debug/exploration aid — NOT part of the test run (no `.test.` in the name, // so `bun test` ignores it).
// Use to eyeball extraction against the real // verbatim Goodreads page bytes. EYEBALL!
//
// Usage:
//   node test/test-extract.js series.html
//   node test/test-extract.js series-with-omnibus-at-the-bottom.html
//
// Reads from test/_verbatim/<file> (gitignored cuz huge and not mine to share). If the verbatim copy is missing, falls back to the committed skeleton.

const fs = require('fs');
const path = require('path');
const { Window } = require('happy-dom');

const TEST_DIR = __dirname;
const VERBATIM_DIR = path.join(TEST_DIR, '_verbatim');
const ROOT = path.resolve(TEST_DIR, '..');

const file = process.argv[2] || 'series.html';
const verbatimPath = path.join(VERBATIM_DIR, file);
const skeletonPath = path.join(TEST_DIR, file);
const srcPath = fs.existsSync(verbatimPath) ? verbatimPath : skeletonPath;

if (!fs.existsSync(srcPath)) {
  console.error('Not found: ' + srcPath);
  process.exit(1);
}
const using = srcPath === verbatimPath ? 'verbatim' : 'skeleton (no verbatim found)';
console.log('Reading ' + file + ' (' + using + '): ' + srcPath);

const html = fs.readFileSync(srcPath, 'utf8');
const win = new Window();
win.document.write(html);
const doc = win.document;

const lists = doc.querySelectorAll('[data-react-class="ReactComponents.SeriesList"]');
console.log('Number of SeriesList:', lists.length);

const mod = require(path.join(ROOT, 'goodreads-extract-series.user.js'));

console.log('Series name:', mod.getSeriesName(doc));

const entries = mod.collectBookEntries(doc);
console.log('Entries:', entries.length);
entries.forEach((e) => console.log('  #' + e.seriesNumber + ' | ' + e.author + ' | ' + e.title));

console.log('\n---- buildList ----');
const list = mod.buildList(doc);
console.log(list || '(null)');

console.log('\n---- buildFilename ----');
console.log(mod.buildFilename(doc));

// Dump any raw props entries whose title matches a substring.
// Handy when chasing a specific book the extractor got wrong.
// Pass extra argv as the needle:
//   `node test/test-extract.js series.html "Wait for Signs"`.
const needle = process.argv[3];
if (needle) {
  console.log('\n---- raw props entries matching "' + needle + '" ----');
  lists.forEach((list, i) => {
    const props = JSON.parse(list.getAttribute('data-react-props') || '{}');
    if (!Array.isArray(props.series)) return;
    props.series.forEach((entry) => {
      const b = entry && entry.book;
      if (!b) return;
      const title = b.title || '';
      if (title.toLowerCase().includes(needle.toLowerCase())) {
        console.log('FOUND entry:', JSON.stringify(entry, null, 2));
      }
    });
  });
}
