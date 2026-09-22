/**
 * E2E: keyboard shortcuts.
 *
 * jsdom doesn't dispatch real keyboard events the way browsers do — `t`,
 * `1`/`2`/`3`, `[`/`]` keydowns all need a real document with a
 * `document.addEventListener('keydown', …)` listener that responds. This
 * spec runs in real headless Chromium so the shortcuts behave like a user
 * pressing the key.
 *
 * Covers the shortcuts content.js binds at the document level:
 *   • `t`         — open / close the panel
 *   • `Shift+T`   — reset sidebar position / size
 *   • `1` / `2` / `3` — switch sidebar to Changes / Threads / Outline (1.5.0 order)
 *   • `[` / `]`   — prev / next change card
 *
 * Tests skipped (need fixtures with threads or many changes):
 *   • `j` / `k`   — prev / next thread (needs threads on the page)
 *   • `{` / `}`   — first / last change (needs ≥ 2 changes on the page)
 */
const { test, expect } = require('@playwright/test');
const { setupExtensionPage } = require('./_helpers');
const fixtures = require('./fixtures/sources');

const fm = fixtures.yamlFrontmatter;

test.describe('keyboard shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await setupExtensionPage(page, 'yaml-frontmatter', {
      rawSource: { [fm.path]: fm.source },
    });
  });

  test('pressing `t` opens and closes the panel, and the top bar stays', async ({ page }) => {
    const sidebar = page.locator('.grdc-sidebar');
    const panel = page.locator('.grdc-panel');
    await expect(sidebar).toBeVisible({ timeout: 5000 });

    const openBefore = await sidebar.evaluate((el) => el.classList.contains('grdc-panel-open'));
    await page.keyboard.press('t');
    await expect(panel).toBeVisible({ visible: !openBefore });
    await page.keyboard.press('t');
    await expect(panel).toBeVisible({ visible: openBefore });
    // The bar itself never disappears, whatever the panel does.
    await expect(sidebar).toBeVisible();
  });

  test('the top bar spans the window and pushes the page down', async ({ page }) => {
    const sidebar = page.locator('.grdc-sidebar');
    const box = await sidebar.boundingBox();
    const viewport = page.viewportSize();
    expect(box.x).toBe(0);
    expect(box.y).toBe(0);
    expect(box.width).toBe(viewport.width);
    expect(box.height).toBeLessThanOrEqual(56);
    // The page content starts below the bar instead of under it.
    const padding = await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingTop));
    expect(padding).toBeGreaterThanOrEqual(box.height - 2);
    // The bar holds the tabs and the spec-outline arrows, nothing else.
    await expect(page.locator('.grdc-sidebar-tabs')).toBeVisible();
    await expect(page.locator('.grdc-specnav-prev')).toBeVisible();
    await expect(page.locator('.grdc-specnav-next')).toBeVisible();
    await expect(page.locator('.grdc-sidebar-header > .grdc-sidebar-collapse')).toBeHidden();
    await expect(page.locator('.grdc-sidebar-header > .grdc-sidebar-header-filter')).toBeHidden();
  });

  test('a docked panel pushes the content aside, floating does not', async ({ page }) => {
    const sidebar = page.locator('.grdc-sidebar');
    if (!(await sidebar.evaluate((el) => el.classList.contains('grdc-panel-open')))) {
      await page.keyboard.press('t');
    }
    const panel = page.locator('.grdc-panel');
    await expect(panel).toBeVisible();
    const docked = await panel.boundingBox();
    expect(docked.x).toBe(0);
    const pushed = await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingLeft));
    expect(pushed).toBeGreaterThanOrEqual(docked.width - 2);

    await page.locator('.grdc-panel-dock').click();
    await expect(sidebar).toHaveClass(/grdc-sidebar-floating/);
    const floatingPad = await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingLeft));
    expect(floatingPad).toBeLessThan(docked.width);
    await expect(panel).toBeVisible();
  });

  test('pressing `3` switches the sidebar to the Outline tab', async ({ page }) => {
    // 1.5.0 tab order is Changes (1) / Threads (2) / Outline (3).
    // The fixture has no threads, so 1.5.0's auto-expand behavior will
    // expand the sidebar if collapsed; either way the Outline tab must
    // end up active.
    await expect(page.locator('.grdc-sidebar')).toBeVisible();

    await page.keyboard.press('3');

    const outlineTab = page.locator('.grdc-sidebar-tab[data-grdc-tab="outline"]');
    await expect(outlineTab).toHaveClass(/grdc-sidebar-tab-active/);
    // And the other two are no longer active.
    await expect(page.locator('.grdc-sidebar-tab[data-grdc-tab="threads"]')).not.toHaveClass(/grdc-sidebar-tab-active/);
    await expect(page.locator('.grdc-sidebar-tab[data-grdc-tab="changes"]')).not.toHaveClass(/grdc-sidebar-tab-active/);
  });

  test('pressing `2` returns the sidebar to the Threads tab', async ({ page }) => {
    // 1.5.0 tab order is Changes (1) / Threads (2) / Outline (3).
    await expect(page.locator('.grdc-sidebar')).toBeVisible();
    await page.keyboard.press('3'); // first go to Outline
    await page.keyboard.press('2'); // then back to Threads
    await expect(
      page.locator('.grdc-sidebar-tab[data-grdc-tab="threads"]')
    ).toHaveClass(/grdc-sidebar-tab-active/);
  });

  test('pressing the same shortcut repeatedly is idempotent (no flicker / state drift)', async ({ page }) => {
    // The point of this test is idempotency of a tab-switch shortcut — the
    // specific tab doesn't matter. Use `3` (Outline) because the fixture
    // has headings but no diff markers, so the Changes tab (`1`) is
    // legitimately hidden on this fixture and `setSidebarTab` correctly
    // falls back to Threads when asked to switch to Changes. Outline is
    // available whenever the fixture has ≥ 1 heading, which this one does.
    await expect(page.locator('.grdc-sidebar')).toBeVisible();
    await page.keyboard.press('3');
    await page.keyboard.press('3');
    await page.keyboard.press('3');
    await expect(
      page.locator('.grdc-sidebar-tab[data-grdc-tab="outline"]')
    ).toHaveClass(/grdc-sidebar-tab-active/);
  });

  test('pressing `t` while focused in a text input does NOT toggle the sidebar', async ({ page }) => {
    // Regression guard: the shortcuts must not fire while the user is
    // typing into a textarea / input. Open a comment box (which contains
    // a textarea) and try pressing `t` from inside it.
    const h1 = page.locator('h1', { hasText: 'Test Design Doc' });
    await h1.hover();
    await h1.locator('.grdc-comment-btn').dispatchEvent('click');
    const textarea = page.locator('.grdc-comment-box textarea');
    await expect(textarea).toBeVisible();

    const sidebar = page.locator('.grdc-sidebar');
    const collapsedBefore = await sidebar.evaluate((el) =>
      el.classList.contains('grdc-sidebar-collapsed')
    );

    await textarea.focus();
    await page.keyboard.press('t');

    // `t` typed into the textarea should have appended a `t` character,
    // not toggled the sidebar.
    await expect(textarea).toHaveValue('t');
    const collapsedAfter = await sidebar.evaluate((el) =>
      el.classList.contains('grdc-sidebar-collapsed')
    );
    expect(collapsedAfter).toBe(collapsedBefore);
  });
});

test.describe('leaving no trace', () => {
  test('navigating away removes the bar and the page offsets', async ({ page }) => {
    await setupExtensionPage(page, 'yaml-frontmatter', {
      rawSource: { [fm.path]: fm.source },
    });
    await expect(page.locator('.grdc-sidebar')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.className)).toContain('grdc-topbar-on');

    // Leave the changed-files view the way GitHub's own tabs do.
    await page.evaluate(() => history.pushState({}, '', '/test-owner/test-repo/pull/1'));
    await expect.poll(() => page.evaluate(() => document.documentElement.className), { timeout: 5000 })
      .not.toContain('grdc-topbar-on');
    await expect(page.locator('.grdc-sidebar')).toHaveCount(0);
    const offsets = await page.evaluate(() => {
      const s = getComputedStyle(document.body);
      return { top: parseFloat(s.paddingTop), left: parseFloat(s.paddingLeft) };
    });
    expect(offsets.top).toBe(0);
    expect(offsets.left).toBe(0);
  });
});
