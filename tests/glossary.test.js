const test = require('node:test');
const assert = require('node:assert');

const { parseGlossary, buildGlossaryMatcher, findGlossaryMatches } = require('../src/lib/glossary.js');

const GLOSSARY = [
  '# Glossary',                                              // 1
  '',                                                        // 2
  'Shared vocabulary.',                                      // 3
  '',                                                        // 4
  '## Systems',                                              // 5
  '',                                                        // 6
  '- **Acme** — the name of the company.',                   // 7
  '- **order service** — the service that takes orders and', // 8
  '  stores them.',                                          // 9
  '- **API**: the public interface.',                        // 10
  '',                                                        // 11
  '## Work',                                                 // 12
  '',                                                        // 13
  '- **order** – something a customer buys.',                // 14
  '- **batch / run** - a group of orders shipped together.', // 15
  '',                                                        // 16
  '```',                                                     // 17
  '- **ignored** — inside a fence',                          // 18
  '```',                                                     // 19
].join('\n');

test('parseGlossary reads entries, sections, separators and continuation lines', () => {
  const e = parseGlossary(GLOSSARY);
  assert.deepStrictEqual(e.map(x => [x.term, x.section, x.line]), [
    ['Acme', 'Systems', 7],
    ['order service', 'Systems', 8],
    ['API', 'Systems', 10],
    ['order', 'Work', 14],
    ['batch / run', 'Work', 15],
  ]);
  assert.strictEqual(e[1].definition, 'the service that takes orders and stores them.');
  assert.deepStrictEqual(e[4].names, ['batch', 'run']);
});

const matcher = buildGlossaryMatcher(parseGlossary(GLOSSARY));
const terms = (text) => findGlossaryMatches(text, matcher).map(m => [text.slice(m.start, m.end), m.entry.term]);

test('longer terms win and plurals match', () => {
  assert.deepStrictEqual(terms('The order service keeps two orders.'),
    [['order service', 'order service'], ['orders', 'order']]);
});

test('lowercase terms ignore case, capitalised terms need exact case', () => {
  assert.deepStrictEqual(terms('Order at Acme via the API, not acme or api.'),
    [['Order', 'order'], ['Acme', 'Acme'], ['API', 'API']]);
});

test('terms only match whole words, and aliases resolve to their entry', () => {
  assert.deepStrictEqual(terms('reorder the ordering, then run a batch'),
    [['run', 'batch / run'], ['batch', 'batch / run']]);
  assert.deepStrictEqual(terms('pre-order'), []);
});

test('matching across a line break inside a term', () => {
  assert.deepStrictEqual(terms('the order\n service'), [['order\n service', 'order service']]);
});

test('empty glossary gives no matcher', () => {
  assert.strictEqual(buildGlossaryMatcher([]), null);
  assert.deepStrictEqual(findGlossaryMatches('order', null), []);
});
