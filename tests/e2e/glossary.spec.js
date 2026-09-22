/**
 * E2E: terms from GLOSSARY.md are underlined in rich diff (first occurrence
 * per block) and show their definition in a popup on hover. Shift+G hides them.
 */
const { test, expect } = require('@playwright/test');
const { setupExtensionPage } = require('./_helpers');
const fixtures = require('./fixtures/sources');

const fm = fixtures.yamlFrontmatter;

const GLOSSARY = [
  '# Glossary',
  '',
  '## Documents',
  '',
  '- **overview** — the first section of a design doc, readable in a minute.',
  '- **extension** — the browser add-on under test, see `content.js`.',
].join('\n');

async function highlighted(page) {
  return page.evaluate(() => {
    const h = CSS.highlights.get('grdc-glossary');
    return h ? Array.from(h).map((r) => r.toString()) : null;
  });
}

test.describe('glossary terms', () => {
  test.beforeEach(async ({ page }) => {
    await setupExtensionPage(page, 'yaml-frontmatter', {
      rawSource: { [fm.path]: fm.source, 'GLOSSARY.md': GLOSSARY },
    });
    await expect.poll(() => highlighted(page)).not.toEqual([]);
  });

  test('highlights glossary terms in rendered blocks', async ({ page }) => {
    const terms = await highlighted(page);
    expect(terms).toContain('extension');
    expect(terms).toContain('Overview');
    expect(terms).toContain('overview');
  });

  test('hovering a term shows its definition', async ({ page }) => {
    const box = await page.evaluate(() => {
      const range = Array.from(CSS.highlights.get('grdc-glossary')).find((r) => r.toString() === 'extension');
      const rect = range.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    await page.mouse.move(box.x - 40, box.y);
    await page.mouse.move(box.x, box.y, { steps: 4 });
    const pop = page.locator('.grdc-glossary-pop');
    await expect(pop).toBeVisible();
    await expect(pop.locator('.grdc-glossary-pop-term')).toHaveText('extension');
    await expect(pop.locator('.grdc-glossary-pop-section')).toHaveText('Documents');
    await expect(pop.locator('.grdc-glossary-pop-def code')).toHaveText('content.js');
    await expect(pop.locator('.grdc-glossary-pop-foot a')).toHaveText('GLOSSARY.md:6');
  });

  test('Shift+G hides and shows the terms', async ({ page }) => {
    await page.keyboard.press('Shift+G');
    await expect.poll(() => highlighted(page)).toEqual([]);
    await page.keyboard.press('Shift+G');
    await expect.poll(() => highlighted(page)).not.toEqual([]);
  });
});
