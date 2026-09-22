/**
 * E2E: select words in rich diff → "Comment" pop-up → comment box with the
 * selection as a quote, anchored to the exact source line. Posting sends
 * the quote as a leading `> …` line and highlights the quoted words.
 */
const { test, expect } = require('@playwright/test');
const { setupExtensionPage, FAKE_HEAD_OID } = require('./_helpers');
const fixtures = require('./fixtures/sources');

const fm = fixtures.yamlFrontmatter;
const BASE_OID = 'b'.repeat(40);

// Select `text` inside the first element matching `selector`, then fire the
// mouseup that the extension listens for.
async function selectText(page, selector, text) {
  await page.evaluate(({ selector, text }) => {
    const el = Array.from(document.querySelectorAll(selector))
      .find((e) => e.textContent.includes(text));
    if (!el) throw new Error('text not found: ' + text);
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const i = node.nodeValue.indexOf(text);
      if (i !== -1) {
        const r = document.createRange();
        r.setStart(node, i);
        r.setEnd(node, i + text.length);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
        return;
      }
    }
    throw new Error('text not found: ' + text);
  }, { selector, text });
}

test.describe('comment on a text selection', () => {
  test.beforeEach(async ({ page }) => {
    await setupExtensionPage(page, 'yaml-frontmatter', {
      rawSource: { [fm.path]: fm.source },
    });
  });

  test('selecting words shows the Comment pop-up and opens a quoted box on the right line', async ({ page }) => {
    await selectText(page, '.markdown-body p', 'overview paragraph');
    const pop = page.locator('.grdc-selection-pop');
    await expect(pop).toBeVisible();

    await pop.click();
    const box = page.locator('.grdc-comment-box');
    await expect(box).toBeVisible();
    await expect(box.locator('.grdc-line-input')).toHaveValue('17');
    await expect(box.locator('.grdc-quote-preview blockquote')).toHaveText('overview paragraph');
    await expect(pop).toHaveCount(0);
  });

  test('pressing c opens the box for the current selection', async ({ page }) => {
    await selectText(page, '.markdown-body p', 'overview paragraph');
    await page.keyboard.press('c');
    await expect(page.locator('.grdc-comment-box .grdc-quote-preview')).toBeVisible();
  });

  test('Suggest change inserts a suggestion block with the source line', async ({ page }) => {
    await selectText(page, '.markdown-body p', 'overview paragraph');
    await page.locator('.grdc-selection-pop').click();
    await page.locator('.grdc-btn-suggest').click();
    const value = await page.locator('.grdc-comment-box textarea').inputValue();
    expect(value).toContain('```suggestion\nThis is the overview paragraph with some **emphasis**.\n```');
    await expect(page.locator('.grdc-quote-toggle input')).not.toBeChecked();
  });

  test('posting sends the quote and highlights the quoted words', async ({ page }) => {
    let posted = null;
    await page.route('https://github.com/test-owner/test-repo/pull/1/changes', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ payload: { pullRequestsChangesRoute: {
          comparison: { headOid: FAKE_HEAD_OID, baseOid: BASE_OID },
        } } }),
      }));
    await page.route('https://github.com/test-owner/test-repo/pull/1/page_data/create_review_comment', (route) => {
      posted = JSON.parse(route.request().postData());
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ thread: {
          id: 'T1',
          commentsData: { comments: [{ databaseId: 1, body: posted.text, author: { login: 'phil' } }] },
        } }),
      });
    });

    await selectText(page, '.markdown-body p', 'overview paragraph');
    await page.locator('.grdc-selection-pop').click();
    await page.locator('.grdc-comment-box textarea').fill('Rename this?');
    await page.locator('.grdc-comment-box .grdc-btn-primary').click();

    await expect(page.locator('.grdc-existing-thread')).toHaveCount(1);
    expect(posted.text).toBe('> overview paragraph\n\nRename this?');
    expect(posted.line).toBe(17);

    const highlighted = await page.evaluate(() => {
      const h = CSS.highlights && CSS.highlights.get('grdc-quote');
      return h ? Array.from(h).map((r) => r.toString()) : null;
    });
    expect(highlighted).toEqual(['overview paragraph']);
  });
});
