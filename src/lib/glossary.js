/**
 * Glossary helpers: parse a GLOSSARY.md into terms and find those terms in
 * rendered text, so the rich diff can highlight them and show a definition.
 *
 * Understood entry forms (one per list item, continuation lines indented):
 *   - **term** — definition        (em dash, en dash, hyphen, or colon)
 *   - **term**: definition
 *   - **term / other name** — definition   (both names match)
 *   **term** — definition          (without a list marker)
 * `##` / `###` headings become the entry's section.
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

  const ENTRY_RE = /^\s{0,3}(?:[-*+]\s+)?\*\*([^*]+?)\*\*\s*(?:[—–:]|-(?=\s))\s*(.*)$/;

  /**
   * @returns {Array<{term: string, names: string[], definition: string, section: string|null, line: number}>}
   */
  function parseGlossary(source) {
    const lines = String(source || '').replace(/\r\n/g, '\n').split('\n');
    const entries = [];
    let section = null;
    let current = null;
    let fence = false;
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i];
      if (/^\s{0,3}(```|~~~)/.test(text)) { fence = !fence; current = null; continue; }
      if (fence) continue;
      const h = text.match(/^#{2,6}\s+(.+?)\s*#*\s*$/);
      if (h) { section = h[1]; current = null; continue; }
      const m = text.match(ENTRY_RE);
      if (m) {
        const term = m[1].trim().replace(/:$/, '');
        const names = term.split(/\s+\/\s+|\s*,\s*/).map(n => n.trim()).filter(Boolean);
        current = { term, names, definition: m[2].trim(), section, line: i + 1 };
        entries.push(current);
        continue;
      }
      if (current && /^\s+\S/.test(text) && !/^\s*[-*+]\s/.test(text)) {
        current.definition = (current.definition + ' ' + text.trim()).trim();
        continue;
      }
      current = null;
    }
    return entries;
  }

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Build a matcher. Lowercase names match case-insensitively; names with
   * capitals (product names, acronyms) match only with that exact case.
   * A trailing `s` / `es` plural is accepted. Longer names win, so
   * "asset rule" is found before "asset".
   */
  function buildGlossaryMatcher(entries) {
    const byKey = new Map();
    const names = [];
    for (const e of entries || []) {
      for (const n of e.names) {
        const exact = n !== n.toLowerCase();
        const key = exact ? n : n.toLowerCase();
        if (byKey.has(key)) continue;
        byKey.set(key, e);
        names.push({ name: n, exact });
      }
    }
    if (names.length === 0) return null;
    names.sort((a, b) => b.name.length - a.name.length);
    const source = names.map(({ name, exact }) => {
      const body = name.split(/(\s+)/).map((part) => {
        if (/^\s+$/.test(part)) return '\\s+';
        return part.split('').map((ch) => {
          const lower = ch.toLowerCase();
          const upper = ch.toUpperCase();
          return !exact && lower !== upper ? `[${lower}${upper}]` : escapeRe(ch);
        }).join('');
      }).join('');
      return `(?:${body})`;
    }).join('|');
    // Unicode-aware word boundaries via lookarounds.
    const regex = new RegExp(`(?<![\\p{L}\\p{N}_-])(${source})(?:e?s)?(?![\\p{L}\\p{N}_])`, 'gu');
    return {
      regex,
      lookup(matched) {
        const norm = matched.replace(/\s+/g, ' ');
        return byKey.get(norm) || byKey.get(norm.toLowerCase()) || null;
      },
    };
  }

  /** Find glossary terms in a string: [{ start, end, entry }]. */
  function findGlossaryMatches(text, matcher) {
    if (!matcher || !text) return [];
    const out = [];
    matcher.regex.lastIndex = 0;
    let m;
    while ((m = matcher.regex.exec(text)) !== null) {
      const entry = matcher.lookup(m[1]);
      if (entry) out.push({ start: m.index, end: m.index + m[0].length, entry });
    }
    return out;
  }

  return {
    parseGlossary,
    buildGlossaryMatcher,
    findGlossaryMatches,
  };
});
