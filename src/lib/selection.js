/**
 * Selection-comment helpers: map a text selection in rich diff to exact
 * source lines, and round-trip the selected text through the comment body
 * as a Markdown blockquote so it can be highlighted again on reload.
 *
 * GitHub review comments are line-based. A selected sentence is stored as
 * a `> quote` at the top of the comment, and the comment is anchored to the
 * source line(s) that contain the quote. Any GitHub client shows the quote,
 * and this extension uses it to highlight the exact words in the rendered
 * block.
 *
 * Loaded in two contexts:
 *   • Extension content script  → exports attached to `window.GRDC.*`
 *   • Node test runner          → exports via `module.exports`
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

  // Needle length used for the head / tail probes of a long selection.
  // Long selections can span inline markup the stripper does not handle
  // (HTML, footnotes), so the start and the end are located separately.
  const PROBE_LEN = 40;

  /**
   * Resolve a selected text to the source line range that contains it.
   *
   * @param {{concat: string, lineOffsets: number[]}} index  from buildSourceIndex
   * @param {string} selectedText  raw `Selection.toString()`
   * @param {number} hintLine      1-based line of the block the selection starts in
   * @param {function} clean       cleanRenderedText
   * @param {function} lineAt      findLineAtOffset
   * @returns {{startLine: number, endLine: number} | null}
   */
  function resolveSelectionLines(index, selectedText, hintLine, clean, lineAt) {
    const needle = clean(selectedText || '');
    if (needle.length < 2) return null;
    const hintIdx = Math.max(0, Math.min(index.lineOffsets.length - 1, (hintLine || 1) - 1));
    const from = index.lineOffsets[hintIdx] || 0;

    const find = (s, start) => {
      let pos = index.concat.indexOf(s, start);
      if (pos === -1) pos = index.concat.indexOf(s);
      return pos;
    };

    let startPos = find(needle, from);
    let endPos = startPos === -1 ? -1 : startPos + needle.length - 1;

    if (startPos === -1) {
      const head = needle.slice(0, PROBE_LEN);
      const tail = needle.slice(-PROBE_LEN);
      startPos = find(head, from);
      if (startPos === -1) return null;
      const tailPos = index.concat.indexOf(tail, startPos);
      endPos = tailPos === -1 ? startPos + head.length - 1 : tailPos + tail.length - 1;
    }

    // Trailing separator spaces belong to the previous line.
    while (endPos > startPos && index.concat[endPos] === ' ') endPos--;

    return {
      startLine: lineAt(index.lineOffsets, startPos),
      endLine: lineAt(index.lineOffsets, endPos),
    };
  }

  /** Collapse whitespace so a multi-line DOM selection becomes one quote line. */
  function normalizeQuote(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  /** Prefix a comment body with the selected text as a Markdown blockquote. */
  function buildQuotedBody(quote, comment) {
    const q = normalizeQuote(quote);
    const c = String(comment || '').trim();
    if (!q) return c;
    return `> ${q}\n\n${c}`;
  }

  /**
   * Extract the leading blockquote of a comment body, if any. Returns the
   * quote text with the `>` markers removed and whitespace collapsed.
   */
  function extractLeadingQuote(body) {
    const lines = String(body || '').replace(/\r\n/g, '\n').split('\n');
    const quoted = [];
    for (const line of lines) {
      const m = line.match(/^\s{0,3}>\s?(.*)$/);
      if (!m) break;
      quoted.push(m[1]);
    }
    const q = normalizeQuote(quoted.join(' '));
    return q || null;
  }

  /**
   * Find `text` inside the rendered text of `rootEl` and return a DOM Range
   * that covers it. Matching is case-insensitive and whitespace-insensitive,
   * because the quote went through normalizeQuote before it was stored.
   *
   * @param {Element} rootEl
   * @param {string} text
   * @param {Document} doc  owner document (injectable for jsdom tests)
   * @param {function(Node): boolean} [skip]  return true to ignore a subtree
   * @returns {Range | null}
   */
  function findTextRange(rootEl, text, doc, skip) {
    const target = normalizeQuote(text).toLowerCase();
    if (!rootEl || !target) return null;
    doc = doc || rootEl.ownerDocument;

    // Build a whitespace-collapsed string of the element's text, and keep a
    // map from each character back to (text node, offset).
    const NodeFilterRef = (doc.defaultView && doc.defaultView.NodeFilter) || { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 };
    const walker = doc.createTreeWalker(rootEl, NodeFilterRef.SHOW_TEXT);
    const chars = [];
    const map = [];
    let prevSpace = true;
    let node;
    while ((node = walker.nextNode())) {
      if (skip && skip(node)) continue;
      const v = node.nodeValue;
      for (let i = 0; i < v.length; i++) {
        const ch = v[i];
        if (/\s/.test(ch)) {
          if (prevSpace) continue;
          chars.push(' ');
          map.push([node, i]);
          prevSpace = true;
        } else {
          chars.push(ch.toLowerCase());
          map.push([node, i]);
          prevSpace = false;
        }
      }
    }
    const hay = chars.join('');
    const pos = hay.indexOf(target);
    if (pos === -1) return null;
    const [startNode, startOff] = map[pos];
    const [endNode, endOff] = map[pos + target.length - 1];
    const range = doc.createRange();
    range.setStart(startNode, startOff);
    range.setEnd(endNode, endOff + 1);
    return range;
  }

  return {
    resolveSelectionLines,
    normalizeQuote,
    buildQuotedBody,
    extractLeadingQuote,
    findTextRange,
  };
});
