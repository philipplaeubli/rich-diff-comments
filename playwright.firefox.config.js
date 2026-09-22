// Same GitHub e2e suite as playwright.config.js, run on Playwright's Firefox.
// One-time setup: npx playwright install firefox
const base = require('./playwright.config.js');

module.exports = {
  ...base,
  use: { ...base.use, browserName: 'firefox' },
};
