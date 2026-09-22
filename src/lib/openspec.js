/**
 * OpenSpec helpers: recognise OpenSpec files in a PR and parse them into a
 * review outline (proposal sections, spec requirements and scenarios,
 * tasks with progress, plus the validation warnings OpenSpec itself raises).
 *
 * Layout this understands (https://github.com/Fission-AI/OpenSpec):
 *   openspec/changes/<change>/.openspec.yaml        schema: <name>
 *   openspec/changes/<change>/proposal.md           ## Why, ## What Changes, ...
 *   openspec/changes/<change>/design.md             (optional)
 *   openspec/changes/<change>/tasks.md              ## 1. Group / - [ ] 1.1 Task
 *   openspec/changes/<change>/specs/<cap>/spec.md   ## ADDED Requirements / ### Requirement: / #### Scenario:
 *   openspec/specs/<cap>/spec.md                    ## Requirements (main specs)
 *
 * No DOM, no fetch — safe to unit-test in Node.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  } else {
    root.GRDC = root.GRDC || {};
    Object.assign(root.GRDC, api);
  }
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const DELTA_OPS = ['ADDED', 'MODIFIED', 'REMOVED', 'RENAMED'];

  /**
   * Classify a repo path. Returns null for non-OpenSpec paths, otherwise
   * { change, kind, capability } where `change` is null for main specs and
   * `kind` is one of proposal | design | tasks | spec | meta | other.
   */
  function classifyOpenSpecPath(path) {
    const p = String(path || '');
    let m = p.match(/(?:^|\/)openspec\/changes\/(?:archive\/)?([^/]+)\/(.+)$/);
    if (m) {
      const change = m[1];
      const rest = m[2];
      if (rest === 'proposal.md') return { change, kind: 'proposal', capability: null };
      if (rest === 'design.md') return { change, kind: 'design', capability: null };
      if (rest === 'tasks.md') return { change, kind: 'tasks', capability: null };
      if (rest === '.openspec.yaml') return { change, kind: 'meta', capability: null };
      const s = rest.match(/^specs\/(.+)\/spec\.md$/);
      if (s) return { change, kind: 'spec', capability: s[1] };
      return { change, kind: 'other', capability: null };
    }
    m = p.match(/(?:^|\/)openspec\/specs\/(.+)\/spec\.md$/);
    if (m) return { change: null, kind: 'spec', capability: m[1] };
    return null;
  }

  // Iterate lines outside fenced code blocks: yields [lineNumber(1-based), text].
  function* proseLines(source) {
    const lines = String(source || '').replace(/\r\n/g, '\n').split('\n');
    let fence = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const f = line.match(/^\s{0,3}(```+|~~~+)/);
      if (f) {
        if (!fence) fence = f[1][0];
        else if (f[1][0] === fence) fence = null;
        continue;
      }
      if (fence) continue;
      yield [i + 1, line];
    }
  }

  function lineCount(source) {
    return String(source || '').replace(/\r\n/g, '\n').split('\n').length;
  }

  /** `## ` / `### ` headings (levels 2 and 3) with their lines, for proposal / design. */
  function parseSections(source) {
    const out = [];
    for (const [line, text] of proseLines(source)) {
      const m = text.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/);
      if (m) out.push({ level: m[1].length, title: m[2], line });
    }
    return out;
  }

  /** Read `schema: <name>` from .openspec.yaml. */
  function parseMeta(source) {
    const m = String(source || '').match(/^schema:\s*["']?([^"'\n]+?)["']?\s*$/m);
    return { schema: m ? m[1] : null };
  }

  /**
   * Parse a spec (delta or main). Returns
   * { purpose, groups: [{ op, title, line, requirements: [...] }], requirementCount, scenarioCount }
   * where each requirement is { name, line, endLine, scenarios: [{ name, line }], normative, bodyEmpty }.
   * For main specs the group op is null.
   */
  function parseSpec(source) {
    const total = lineCount(source);
    const groups = [];
    let purpose = null;
    let group = null;
    let req = null;
    let inPurpose = false;

    const closeReq = (endLine) => {
      if (req) { req.endLine = endLine; req = null; }
    };

    for (const [line, text] of proseLines(source)) {
      const h2 = text.match(/^##\s+(.+?)\s*$/);
      if (h2 && !text.startsWith('###')) {
        closeReq(line - 1);
        inPurpose = false;
        const title = h2[1];
        const op = DELTA_OPS.find(o => new RegExp('^' + o + '\\s+Requirements\\b', 'i').test(title));
        if (op || /^Requirements\b/i.test(title)) {
          group = { op: op || null, title, line, requirements: [] };
          groups.push(group);
        } else {
          group = null;
          if (/^Purpose\b/i.test(title)) { inPurpose = true; purpose = { line, text: '' }; }
        }
        continue;
      }
      const h3 = text.match(/^###\s+Requirement:\s*(.+?)\s*$/);
      if (h3) {
        closeReq(line - 1);
        if (!group) { group = { op: null, title: 'Requirements', line, requirements: [] }; groups.push(group); }
        req = { name: h3[1], line, endLine: total, scenarios: [], normative: false, bodyEmpty: true };
        group.requirements.push(req);
        continue;
      }
      if (/^###\s/.test(text) && !/^####/.test(text)) {
        // Some other H3 (e.g. RENAMED "FROM/TO" notes) ends the requirement.
        closeReq(line - 1);
        continue;
      }
      const h4 = text.match(/^####\s+Scenario:\s*(.+?)\s*$/);
      if (h4 && req) {
        req.scenarios.push({ name: h4[1], line });
        continue;
      }
      if (inPurpose && purpose && text.trim()) {
        purpose.text = (purpose.text ? purpose.text + ' ' : '') + text.trim();
      }
      if (req && req.scenarios.length === 0 && text.trim()) {
        req.bodyEmpty = false;
        if (/\b(SHALL|MUST)\b/.test(text)) req.normative = true;
      }
    }
    closeReq(total);

    let requirementCount = 0;
    let scenarioCount = 0;
    for (const g of groups) {
      requirementCount += g.requirements.length;
      for (const r of g.requirements) scenarioCount += r.scenarios.length;
    }
    return { purpose, groups, requirementCount, scenarioCount };
  }

  /**
   * Validation warnings in the spirit of `openspec validate`:
   * a requirement needs SHALL/MUST text and at least one scenario, except in
   * REMOVED / RENAMED groups which carry no body.
   */
  function lintSpec(parsed) {
    const warnings = [];
    for (const g of parsed.groups) {
      if (g.op === 'REMOVED' || g.op === 'RENAMED') continue;
      for (const r of g.requirements) {
        if (r.scenarios.length === 0) warnings.push({ line: r.line, requirement: r.name, message: 'No scenario' });
        if (!r.normative) warnings.push({ line: r.line, requirement: r.name, message: 'No SHALL or MUST' });
      }
    }
    if (parsed.groups.length === 0) warnings.push({ line: 1, requirement: null, message: 'No requirements section' });
    return warnings;
  }

  /**
   * Parse tasks.md. Returns { groups: [{ title, line, tasks: [...] }], done, total }
   * with each task { id, text, done, line, depth }.
   */
  function parseTasks(source) {
    const groups = [];
    let group = null;
    let done = 0;
    let total = 0;
    for (const [line, text] of proseLines(source)) {
      const h = text.match(/^#{1,3}\s+(.+?)\s*$/);
      if (h) {
        group = { title: h[1], line, tasks: [] };
        groups.push(group);
        continue;
      }
      const t = text.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(?:(\d+(?:\.\d+)*)\.?\s+)?(.*)$/);
      if (t) {
        if (!group) { group = { title: 'Tasks', line, tasks: [] }; groups.push(group); }
        const isDone = t[2] !== ' ';
        group.tasks.push({ id: t[3] || null, text: t[4].trim(), done: isDone, line, depth: Math.floor(t[1].replace(/\t/g, '  ').length / 2) });
        total++;
        if (isDone) done++;
      }
    }
    return { groups: groups.filter(g => g.tasks.length > 0), done, total };
  }

  /** Short plain-text version of inline markdown for outline rows. */
  function plainInline(text, max) {
    let s = String(text || '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (max && s.length > max) s = s.slice(0, max - 1).trimEnd() + '…';
    return s;
  }

  /**
   * Build the outline model from the PR's OpenSpec files.
   * @param {Array<{path: string, source: string|null}>} files
   * @returns {Array} one entry per change (main-spec edits under change `null`), in order:
   *   { change, schema, metaPath, proposal, design, specs: [...], tasks, stats }
   */
  function buildOpenSpecOutline(files) {
    const byChange = new Map();
    const get = (id) => {
      if (!byChange.has(id)) {
        byChange.set(id, { change: id, schema: null, metaPath: null, proposal: null, design: null, specs: [], tasks: null });
      }
      return byChange.get(id);
    };
    for (const f of files) {
      const c = classifyOpenSpecPath(f.path);
      if (!c || c.kind === 'other') continue;
      const entry = get(c.change);
      if (f.source == null) {
        if (c.kind === 'spec') entry.specs.push({ capability: c.capability, path: f.path, parsed: null, warnings: [] });
        else if (c.kind !== 'meta') entry[c.kind] = { path: f.path, sections: null, parsed: null };
        continue;
      }
      if (c.kind === 'meta') { entry.schema = parseMeta(f.source).schema; entry.metaPath = f.path; }
      if (c.kind === 'proposal' || c.kind === 'design') entry[c.kind] = { path: f.path, sections: parseSections(f.source) };
      if (c.kind === 'tasks') entry.tasks = { path: f.path, parsed: parseTasks(f.source) };
      if (c.kind === 'spec') {
        const parsed = parseSpec(f.source);
        entry.specs.push({ capability: c.capability, path: f.path, parsed, warnings: lintSpec(parsed) });
      }
    }
    const out = [];
    for (const entry of byChange.values()) {
      entry.specs.sort((a, b) => a.capability.localeCompare(b.capability));
      const stats = { capabilities: entry.specs.length, requirements: 0, scenarios: 0, warnings: 0, tasksDone: 0, tasksTotal: 0 };
      for (const s of entry.specs) {
        if (!s.parsed) continue;
        stats.requirements += s.parsed.requirementCount;
        stats.scenarios += s.parsed.scenarioCount;
        stats.warnings += s.warnings.length;
      }
      if (entry.tasks && entry.tasks.parsed) {
        stats.tasksDone = entry.tasks.parsed.done;
        stats.tasksTotal = entry.tasks.parsed.total;
      }
      entry.stats = stats;
      out.push(entry);
    }
    // Changes first (alphabetical), main-spec edits last.
    out.sort((a, b) => (a.change === null) - (b.change === null) || String(a.change).localeCompare(String(b.change)));
    return out;
  }

  /** True when any line of `lines` (a Set or array) falls inside [start, end]. */
  function hasLineInRange(lines, start, end) {
    if (!lines || start == null) return false;
    const last = end == null ? start : end;
    if (typeof lines.has === 'function' && typeof lines.size === 'number') {
      if (last - start > lines.size) {
        for (const line of lines) if (line >= start && line <= last) return true;
        return false;
      }
      for (let line = start; line <= last; line++) if (lines.has(line)) return true;
      return false;
    }
    for (const line of lines) if (line >= start && line <= last) return true;
    return false;
  }

  /** Count thread heads that fall inside [startLine, endLine] of `path`. */
  function countThreadsInRange(threadHeads, path, startLine, endLine) {
    let n = 0;
    for (const t of threadHeads || []) {
      if (t.path !== path || t.line == null) continue;
      const s = t.startLine != null ? t.startLine : t.line;
      if (t.line >= startLine && s <= endLine) n++;
    }
    return n;
  }

  return {
    classifyOpenSpecPath,
    parseSections,
    parseMeta,
    parseSpec,
    lintSpec,
    parseTasks,
    plainInline,
    buildOpenSpecOutline,
    countThreadsInRange,
    hasLineInRange,
  };
});
