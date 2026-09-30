const test = require('node:test');
const assert = require('node:assert');

const {
  classifyOpenSpecPath,
  parseSections,
  parseMeta,
  parseDecisions,
  parseSpec,
  lintSpec,
  parseTasks,
  plainInline,
  buildOpenSpecOutline,
  countThreadsInRange,
  hasLineInRange,
} = require('../src/lib/openspec.js');

const SPEC = [
  '## Purpose',                                        // 1
  '',                                                  // 2
  'Sends reminders so that nobody misses a due date again.', // 3
  '',                                                  // 4
  '## ADDED Requirements',                             // 5
  '',                                                  // 6
  '### Requirement: Reminders are sent before due',    // 7
  'The system SHALL send a reminder one day before.',  // 8
  '',                                                  // 9
  '#### Scenario: Due tomorrow',                       // 10
  '- **WHEN** a task is due tomorrow',                 // 11
  '- **THEN** a reminder is sent',                     // 12
  '',                                                  // 13
  '#### Scenario: Already done',                       // 14
  '- **WHEN** the task is done',                       // 15
  '- **THEN** no reminder is sent',                    // 16
  '',                                                  // 17
  '### Requirement: Reminders can be muted',           // 18
  'Users can mute reminders.',                         // 19
  '',                                                  // 20
  '```md',                                             // 21
  '### Requirement: inside a fence is ignored',        // 22
  '```',                                               // 23
  '',                                                  // 24
  '## MODIFIED Requirements',                          // 25
  '',                                                  // 26
  '### Requirement: Digest email',                     // 27
  'The digest MUST list open tasks.',                  // 28
  '',                                                  // 29
  '#### Scenario: Weekly digest',                      // 30
  '- **WHEN** it is Monday',                           // 31
  '- **THEN** the digest is sent',                     // 32
  '',                                                  // 33
  '## REMOVED Requirements',                           // 34
  '',                                                  // 35
  '### Requirement: SMS reminders',                    // 36
  '**Reason**: nobody used it',                        // 37
  '**Migration**: email reminders cover the same need', // 38
].join('\n');

const TASKS = [
  '## 1. Backend',
  '',
  '- [x] 1.1 Add the `reminders` table',
  '- [ ] 1.2 Send reminders',
  '',
  '## 2. Frontend',
  '',
  '- [X] 2.1 Mute toggle',
  '  - [ ] 2.1.1 Nested follow-up',
].join('\n');

test('classifyOpenSpecPath recognises change artifacts and main specs', () => {
  assert.deepStrictEqual(classifyOpenSpecPath('openspec/changes/add-reminders/proposal.md'),
    { change: 'add-reminders', kind: 'proposal', capability: null });
  assert.deepStrictEqual(classifyOpenSpecPath('openspec/changes/add-reminders/specs/notify/reminders/spec.md'),
    { change: 'add-reminders', kind: 'spec', capability: 'notify/reminders' });
  assert.deepStrictEqual(classifyOpenSpecPath('openspec/changes/add-reminders/architecture-decisions.md'),
    { change: 'add-reminders', kind: 'decisions', capability: null });
  assert.deepStrictEqual(classifyOpenSpecPath('openspec/changes/add-reminders/.openspec.yaml'),
    { change: 'add-reminders', kind: 'meta', capability: null });
  assert.deepStrictEqual(classifyOpenSpecPath('openspec/specs/notify/spec.md'),
    { change: null, kind: 'spec', capability: 'notify' });
  assert.deepStrictEqual(classifyOpenSpecPath('svc/openspec/changes/x/tasks.md'),
    { change: 'x', kind: 'tasks', capability: null });
  assert.strictEqual(classifyOpenSpecPath('docs/README.md'), null);
});

test('parseSpec reads delta groups, requirements, scenarios and ranges', () => {
  const s = parseSpec(SPEC);
  assert.strictEqual(s.purpose.line, 1);
  assert.strictEqual(s.purpose.text, 'Sends reminders so that nobody misses a due date again.');
  assert.deepStrictEqual(s.groups.map(g => g.op), ['ADDED', 'MODIFIED', 'REMOVED']);
  const [first, second] = s.groups[0].requirements;
  assert.strictEqual(first.name, 'Reminders are sent before due');
  assert.strictEqual(first.line, 7);
  assert.strictEqual(first.endLine, 17);
  assert.deepStrictEqual(first.scenarios.map(x => [x.name, x.line]), [['Due tomorrow', 10], ['Already done', 14]]);
  assert.strictEqual(first.normative, true);
  assert.strictEqual(second.name, 'Reminders can be muted');
  assert.strictEqual(second.scenarios.length, 0);
  assert.strictEqual(second.normative, false);
  assert.strictEqual(second.endLine, 24);
  assert.strictEqual(s.requirementCount, 4);
  assert.strictEqual(s.scenarioCount, 3);
});

test('lintSpec flags missing scenarios and missing SHALL, but not REMOVED', () => {
  const w = lintSpec(parseSpec(SPEC));
  assert.deepStrictEqual(w.map(x => [x.line, x.message]), [[18, 'No scenario'], [18, 'No SHALL or MUST']]);
  assert.deepStrictEqual(lintSpec(parseSpec('# nothing')).map(x => x.message), ['No requirements section']);
});

test('lintSpec wants a Reason and a Migration on REMOVED, and a Purpose of 50 characters', () => {
  const spec = [
    '## Purpose',                     // 1
    '',                               // 2
    'Too short.',                     // 3
    '',                               // 4
    '## REMOVED Requirements',        // 5
    '',                               // 6
    '### Requirement: Old export',    // 7
    '**Reason**: nobody used it',     // 8
    '',                               // 9
    '## RENAMED Requirements',        // 10
    '',                               // 11
    '- FROM: `### Requirement: A`',   // 12
    '- TO: `### Requirement: B`',     // 13
  ].join('\n');
  assert.deepStrictEqual(lintSpec(parseSpec(spec)).map(x => [x.line, x.message]), [
    [7, 'Removed without a **Migration**'],
    [1, 'Purpose shorter than 50 characters'],
  ]);
});

test('parseDecisions reads one decision per D<n> heading, with ranges and numbering warnings', () => {
  const doc = [
    '## D1. Remind from a nightly job',  // 1
    '',                                  // 2
    'Why, and what lost.',               // 3
    '',                                  // 4
    '```md',                             // 5
    '## D9. inside a fence is ignored',  // 6
    '```',                               // 7
    '',                                  // 8
    '### A detail stays inside D1',      // 9
    '',                                  // 10
    '## D3. Email only',                 // 11
    '',                                  // 12
    '## Notes',                          // 13
  ].join('\n');
  const d = parseDecisions(doc);
  assert.deepStrictEqual(d.decisions.map(x => [x.number, x.title, x.line, x.endLine]), [
    [1, 'Remind from a nightly job', 1, 10],
    [3, 'Email only', 11, 12],
    [null, 'Notes', 13, 13],
  ]);
  assert.deepStrictEqual(d.warnings.map(w => [w.line, w.message]), [
    [11, 'Numbered D3, expected D2'],
    [13, 'Not numbered D1, D2, …'],
  ]);
});

test('parseSpec reads a main spec with a plain Requirements section', () => {
  const s = parseSpec('## Requirements\n\n### Requirement: A\nIt SHALL work.\n\n#### Scenario: B\n- ok\n');
  assert.strictEqual(s.groups[0].op, null);
  assert.strictEqual(s.groups[0].requirements[0].scenarios.length, 1);
});

test('parseTasks counts progress per group, including nested tasks', () => {
  const t = parseTasks(TASKS);
  assert.strictEqual(t.total, 4);
  assert.strictEqual(t.done, 2);
  assert.deepStrictEqual(t.groups.map(g => [g.title, g.tasks.length]), [['1. Backend', 2], ['2. Frontend', 2]]);
  assert.deepStrictEqual(t.groups[0].tasks[0], { id: '1.1', text: 'Add the `reminders` table', done: true, line: 3, depth: 0 });
  assert.strictEqual(t.groups[1].tasks[1].depth, 1);
  assert.strictEqual(t.groups[1].tasks[1].id, '2.1.1');
});

test('parseSections and parseMeta', () => {
  const secs = parseSections('## Why\ntext\n```\n## not a heading\n```\n## What Changes\n### Detail\n');
  assert.deepStrictEqual(secs.map(s => [s.level, s.title, s.line]), [[2, 'Why', 1], [2, 'What Changes', 6], [3, 'Detail', 7]]);
  assert.deepStrictEqual(parseMeta('schema: custom-flow\ncreated: 2026-01-01\n'), { schema: 'custom-flow' });
  assert.deepStrictEqual(parseMeta(''), { schema: null });
});

test('buildOpenSpecOutline groups files per change with stats', () => {
  const out = buildOpenSpecOutline([
    { path: 'openspec/changes/add-reminders/tasks.md', source: TASKS },
    { path: 'openspec/changes/add-reminders/specs/notify/spec.md', source: SPEC },
    { path: 'openspec/changes/add-reminders/proposal.md', source: '## Why\nx\n' },
    { path: 'openspec/changes/add-reminders/architecture-decisions.md', source: '## D1. Nightly job\n\n## D2. Email only\n' },
    { path: 'openspec/changes/add-reminders/.openspec.yaml', source: 'schema: spec-driven\n' },
    { path: 'openspec/specs/other/spec.md', source: '## Requirements\n' },
    { path: 'README.md', source: '# hi' },
  ]);
  assert.deepStrictEqual(out.map(c => c.change), ['add-reminders', null]);
  const c = out[0];
  assert.strictEqual(c.schema, 'spec-driven');
  assert.strictEqual(c.proposal.sections[0].title, 'Why');
  assert.deepStrictEqual(c.decisions.parsed.decisions.map(d => d.title), ['Nightly job', 'Email only']);
  assert.deepStrictEqual(c.stats, { capabilities: 1, requirements: 4, scenarios: 3, decisions: 2, warnings: 2, tasksDone: 2, tasksTotal: 4 });
});

test('buildOpenSpecOutline keeps files whose source could not be loaded', () => {
  const out = buildOpenSpecOutline([{ path: 'openspec/changes/x/specs/a/spec.md', source: null }]);
  assert.strictEqual(out[0].specs[0].parsed, null);
});

test('countThreadsInRange and plainInline', () => {
  const heads = [
    { path: 'a.md', line: 8 },
    { path: 'a.md', line: 30, startLine: 16 },
    { path: 'a.md', line: 40 },
    { path: 'b.md', line: 8 },
  ];
  assert.strictEqual(countThreadsInRange(heads, 'a.md', 7, 17), 2);
  assert.strictEqual(plainInline('Add the `x` **table** [doc](http://a)', 0), 'Add the x table doc');
  assert.strictEqual(plainInline('abcdefghij', 5), 'abcd…');
});

test('hasLineInRange works with a Set and with an array', () => {
  const set = new Set([4, 19, 44]);
  assert.strictEqual(hasLineInRange(set, 7, 24), true);
  assert.strictEqual(hasLineInRange(set, 20, 43), false);
  assert.strictEqual(hasLineInRange(set, 19, 19), true);
  // Wide range, few lines: the loop runs over the lines instead.
  assert.strictEqual(hasLineInRange(set, 1, 1000), true);
  assert.strictEqual(hasLineInRange([4, 19], 5, 18), false);
  assert.strictEqual(hasLineInRange(null, 1, 5), false);
});
