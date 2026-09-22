/**
 * A synthetic OpenSpec change used by openspecPane.spec.js.
 * Two capabilities, five requirements, six scenarios, two validation
 * warnings (line 18 of the reminders spec), and tasks at 2/5.
 */
const CHANGE = 'openspec/changes/add-reminders';

const REMINDERS_SPEC = [
  '## Purpose',                                        // 1
  '',                                                  // 2
  'Sends reminders so nobody misses a due date.',      // 3
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
  '## MODIFIED Requirements',                          // 21
  '',                                                  // 22
  '### Requirement: Digest email',                     // 23
  'The digest MUST list open tasks.',                  // 24
  '',                                                  // 25
  '#### Scenario: Weekly digest',                      // 26
  '- **WHEN** it is Monday',                           // 27
  '- **THEN** the digest is sent',                     // 28
  '',                                                  // 29
  '## REMOVED Requirements',                           // 30
  '',                                                  // 31
  '### Requirement: SMS reminders',                    // 32
  '**Reason**: nobody used it',                        // 33
].join('\n');

const DIGEST_SPEC = [
  '## ADDED Requirements',
  '',
  '### Requirement: Digest can be scheduled',
  'Users SHALL choose the weekday of their digest.',
  '',
  '#### Scenario: Friday digest',
  '- **WHEN** a user picks Friday',
  '- **THEN** the digest arrives on Friday',
  '',
  '#### Scenario: No choice',
  '- **WHEN** a user picks nothing',
  '- **THEN** the digest arrives on Monday',
  '',
  '#### Scenario: Holiday',
  '- **WHEN** the day is a public holiday',
  '- **THEN** the digest still arrives',
].join('\n');

const PROPOSAL = [
  '## Why',
  '',
  'People miss due dates.',
  '',
  '## What Changes',
  '',
  '- Reminders one day before a due date',
  '',
  '## Non-Goals',
  '',
  '- Push notifications',
  '',
  '## Architecture',
  '',
  '### Where reminders are scheduled',
  '',
  'A nightly job.',
].join('\n');

const TASKS = [
  '## 1. Backend',
  '',
  '- [x] 1.1 Add the `reminders` table',
  '- [x] 1.2 Nightly reminder job',
  '- [ ] 1.3 Digest scheduling',
  '',
  '## 2. Frontend',
  '',
  '- [ ] 2.1 Mute toggle',
  '- [ ] 2.2 Digest weekday picker',
].join('\n');

module.exports = {
  OPENSPEC_FILES: {
    [`${CHANGE}/.openspec.yaml`]: 'schema: spec-driven\ncreated: 2026-09-01\n',
    [`${CHANGE}/proposal.md`]: PROPOSAL,
    [`${CHANGE}/specs/notify/reminders/spec.md`]: REMINDERS_SPEC,
    [`${CHANGE}/specs/notify/digest/spec.md`]: DIGEST_SPEC,
    [`${CHANGE}/tasks.md`]: TASKS,
  },
};
