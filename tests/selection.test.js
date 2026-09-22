const test = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

const { buildSourceIndex, cleanRenderedText, findLineAtOffset } = require('../src/lib/textMatch.js');
const {
  resolveSelectionLines,
  normalizeQuote,
  buildQuotedBody,
  extractLeadingQuote,
  findTextRange,
} = require('../src/lib/selection.js');

const SOURCE = [
  '# Design',                                           // 1
  '',                                                   // 2
  'The service stores events in **Postgres**. It keeps', // 3
  'a copy in S3 for audits. Retention is 30 days.',      // 4
  '',                                                   // 5
  '- First item with a [link](https://x.y) inside',     // 6
  '- Second item',                                      // 7
  '',                                                   // 8
  'The service stores events again.',                   // 9
];

const index = buildSourceIndex(SOURCE);
const resolve = (text, hint) =>
  resolveSelectionLines(index, text, hint, cleanRenderedText, findLineAtOffset);

test('resolves a sentence inside a hard-wrapped paragraph to its line', () => {
  assert.deepStrictEqual(resolve('Retention is 30 days.', 3), { startLine: 4, endLine: 4 });
});

test('resolves a sentence that crosses a source line break to a range', () => {
  assert.deepStrictEqual(resolve('It keeps a copy in S3', 3), { startLine: 3, endLine: 4 });
});

test('matches through stripped inline markdown', () => {
  assert.deepStrictEqual(resolve('events in Postgres', 3), { startLine: 3, endLine: 3 });
  assert.deepStrictEqual(resolve('with a link inside', 6), { startLine: 6, endLine: 6 });
});

test('prefers the occurrence at or after the hint line', () => {
  assert.deepStrictEqual(resolve('The service stores events', 9), { startLine: 9, endLine: 9 });
  assert.deepStrictEqual(resolve('The service stores events', 3), { startLine: 3, endLine: 3 });
});

test('returns null for text that is not in the source', () => {
  assert.strictEqual(resolve('nowhere to be found', 1), null);
  assert.strictEqual(resolve('x', 1), null);
});

test('quote body round-trips through extractLeadingQuote', () => {
  const body = buildQuotedBody('  Retention is\n 30 days. ', 'Why 30?');
  assert.strictEqual(body, '> Retention is 30 days.\n\nWhy 30?');
  assert.strictEqual(extractLeadingQuote(body), 'Retention is 30 days.');
  assert.strictEqual(extractLeadingQuote('no quote here'), null);
  assert.strictEqual(extractLeadingQuote('> line one\n> line two\n\nbody'), 'line one line two');
  assert.strictEqual(normalizeQuote(' a \n b '), 'a b');
});

test('findTextRange locates text across inline elements', () => {
  const dom = new JSDOM('<p id="p">The service stores events in <strong>Postgres</strong>.\n It keeps a copy.</p>');
  const doc = dom.window.document;
  const p = doc.getElementById('p');
  const range = findTextRange(p, 'events in postgres. it keeps', doc);
  assert.ok(range);
  assert.strictEqual(range.toString(), 'events in Postgres.\n It keeps');
  assert.strictEqual(findTextRange(p, 'missing words', doc), null);
});

test('findTextRange skips excluded subtrees', () => {
  const dom = new JSDOM('<p id="p">Alpha <span class="x">Beta</span> Gamma</p>');
  const doc = dom.window.document;
  const p = doc.getElementById('p');
  const skip = (n) => !!(n.parentElement && n.parentElement.closest('.x'));
  assert.strictEqual(findTextRange(p, 'Beta', doc, skip), null);
  assert.strictEqual(findTextRange(p, 'Alpha Gamma', doc, skip).toString(), 'Alpha Beta Gamma');
});
