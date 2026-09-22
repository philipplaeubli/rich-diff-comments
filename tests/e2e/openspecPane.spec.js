/**
 * E2E: the Spec tab outlines an OpenSpec change from the PR's raw files.
 *
 * The PR's file list comes from the stubbed route data (`diffSummaries`),
 * and the OpenSpec sources come from stubbed blob pages, so the outline is
 * built even though no OpenSpec file is rendered in the fixture.
 *
 * Set GRDC_SCREENSHOT_DIR to also save a screenshot of the pane.
 */
const path = require('path');
const { test, expect } = require('@playwright/test');
const { setupFixture, gotoPRPage, injectExtension, waitForInit, FAKE_HEAD_OID } = require('./_helpers');
const fixtures = require('./fixtures/sources');
const { OPENSPEC_FILES } = require('./fixtures/openspec');

const fm = fixtures.yamlFrontmatter;

async function setup(page, files) {
  await setupFixture(page, 'yaml-frontmatter', {
    rawSource: { [fm.path]: fm.source, ...files },
  });
  const diffSummaries = [fm.path, ...Object.keys(files)].map((p, i) => ({
    path: p, pathDigest: `digest${i}`, changeType: 'ADDED',
  }));
  await page.route('https://github.com/test-owner/test-repo/pull/1/changes', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ payload: { pullRequestsChangesRoute: {
        diffSummaries,
        comparison: { fullDiff: { headOid: FAKE_HEAD_OID } },
      } } }),
    }));
  await gotoPRPage(page);
  await injectExtension(page);
  await waitForInit(page);
}

test.describe('OpenSpec pane', () => {
  test('shows the change outline with requirements, warnings and tasks', async ({ page }) => {
    await setup(page, OPENSPEC_FILES);
    const tab = page.locator('.grdc-sidebar-tab[data-grdc-tab="spec"]');
    await expect(tab).toBeVisible();
    await page.keyboard.press('4');
    const pane = page.locator('.grdc-sidebar-pane-spec');
    await expect(pane).toBeVisible();

    await expect(pane.locator('.grdc-spec-change-name')).toHaveText('add-reminders');
    await expect(pane.locator('.grdc-spec-pill-schema')).toHaveText('spec-driven');
    await expect(pane.locator('.grdc-spec-stats')).toHaveText('2 capabilities · 5 requirements · 6 scenarios · tasks 2/5');
    await expect(pane.locator('.grdc-spec-warn-summary')).toContainText('2 validation warnings');
    await expect(pane.locator('.grdc-spec-req-row')).toHaveCount(5);
    await expect(pane.locator('.grdc-spec-req-row.grdc-spec-op-removed')).toHaveText(/SMS reminders/);
    await expect(pane.locator('.grdc-spec-task-done')).toHaveCount(2);

    if (process.env.GRDC_SCREENSHOT_DIR) {
      await page.locator('.grdc-sidebar').screenshot({ path: path.join(process.env.GRDC_SCREENSHOT_DIR, 'spec-pane.png') });
    }
  });

  test('clicking a row jumps to the source-diff line when the file is not rendered', async ({ page }) => {
    await setup(page, OPENSPEC_FILES);
    await page.keyboard.press('4');
    await page.locator('.grdc-spec-req-row', { hasText: 'Reminders can be muted' }).click();
    const digest = await page.evaluate(async () => {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('openspec/changes/add-reminders/specs/notify/reminders/spec.md'));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    });
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(`#diff-${digest}R18`);
  });

  test('the bar arrows walk the requirements of the spec outline', async ({ page }) => {
    await setup(page, OPENSPEC_FILES);
    await page.keyboard.press('4');
    const count = page.locator('.grdc-specnav-count');
    // Every row of the outline except the scenarios: proposal sections,
    // delta groups, requirements, task groups and tasks.
    await expect(count).toHaveText('1/21');
    // The first click lands on the first row, the next one moves on.
    await page.locator('.grdc-specnav-next').click();
    await expect(count).toHaveText('1/21');
    await page.locator('.grdc-specnav-next').click();
    await expect(count).toHaveText('2/21');
    await page.locator('.grdc-specnav-prev').click();
    await page.locator('.grdc-specnav-prev').click();
    await expect(count).toHaveText('21/21');
  });

  test('rows the PR changed are marked, and "Changed only" keeps just those', async ({ page }) => {
    await setup(page, OPENSPEC_FILES);
    await page.keyboard.press('4');
    await expect(page.locator('.grdc-spec-row').first()).toBeVisible();
    // The OpenSpec files are not rendered in this fixture, so no row is
    // marked as changed and the filter empties the tree.
    await page.locator('.grdc-spec-filter-cb').check();
    await expect(page.locator('.grdc-spec-tree')).toContainText('This PR changes no part of the spec.');
    await page.locator('.grdc-spec-filter-cb').uncheck();
    await expect(page.locator('.grdc-spec-req-row').first()).toBeVisible();
  });

  test('the Spec tab stays hidden on a PR without OpenSpec files', async ({ page }) => {
    await setup(page, {});
    await expect(page.locator('.grdc-sidebar-tab[data-grdc-tab="spec"]')).toBeHidden();
  });
});
