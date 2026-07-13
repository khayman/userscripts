// Generates golden files under test/fixtures/expected/<name>.txt from
// buildList() output against the committed skeleton fixtures.
//
// Run: bun run golden:update
//
// With no arguments only the baseline (leonid-mcgill.html) is generated. Pass an
// explicit list of names to regenerate promoted or pending fixtures, e.g.
//   bun run scripts/gen-golden.js leonid-mcgill.html easy-rawlins.html
// or `bun run scripts/gen-golden.js --all` to regenerate every skeleton.

const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const { Window } = require('happy-dom');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_DIR = path.join(ROOT, 'test', 'fixtures');
const MOCK_DIR = path.join(FIXTURE_DIR, 'skeletons');
const OUT_DIR = path.join(FIXTURE_DIR, 'expected');

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
    .filter((f) => /\.html$/.test(f))
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
  console.log(file + ' -> test/fixtures/expected/' + outName + ' (' + list.split('\n').length + ' lines)');
  return true;
}

const argv = process.argv.slice(2);
const files =
  argv.length === 0 ? ['leonid-mcgill.html']
  : argv[0] === '--all' ? allMocks()
  : argv;

for (const f of files) genOne(f);
