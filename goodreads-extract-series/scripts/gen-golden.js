// Generates golden files under test/expected/<name>.txt from buildList()
// output against the committed skeletons in test/series*.html.
//
// Run: bun run golden:update
//
// For now only the baseline (series.html) is generated and enforced by the
// test suite. The other four mocks are edge cases for a later bug-hunt
// session — pass an explicit list of names to regenerate others, e.g.
//   bun run scripts/gen-golden.js series.html series-with-omnibus-at-the-bottom.html
// or `bun run scripts/gen-golden.js --all` to regenerate every skeleton.

const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const { Window } = require('happy-dom');

const ROOT = path.resolve(__dirname, '..');
const MOCK_DIR = path.join(ROOT, 'test');
const OUT_DIR = path.join(ROOT, 'test', 'expected');

// Use createRequire so the userscript's CommonJS `module.exports` handshake
// works under bun's ESM entry point.
const requireUser = createRequire(import.meta.url);
const script = requireUser(path.join(ROOT, 'goodreads-extract-series.user.js'));

function parseDoc(html) {
  const win = new Window();
  win.document.write(html);
  return win.document;
}

function allMocks() {
  return fs
    .readdirSync(MOCK_DIR)
    .filter((f) => /^series.*\.html$/.test(f))
    .sort();
}

function genOne(file) {
  const src = path.join(MOCK_DIR, file);
  const html = fs.readFileSync(src, 'utf8');
  const doc = parseDoc(html);
  const list = script.buildList(doc);
  if (list == null) {
    console.warn(file + ': buildList() returned null — skipped');
    return false;
  }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const outName = file.replace(/\.html$/, '.txt');
  const dst = path.join(OUT_DIR, outName);
  fs.writeFileSync(dst, list + '\n', 'utf8');
  console.log(file + ' -> test/expected/' + outName + ' (' + list.split('\n').length + ' lines)');
  return true;
}

const argv = process.argv.slice(2);
const files =
  argv.length === 0 ? ['series.html']
  : argv[0] === '--all' ? allMocks()
  : argv;

for (const f of files) genOne(f);
