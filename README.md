# Firefox port (GitHub target)

This fork runs the GitHub extension in Firefox 140 or later and adds comments on a text selection.

## Comment on a selection

1. Open a PR, go to the changed files, and switch a Markdown file to rich diff.
2. Select a sentence or a few words. You can select across blocks of the same file.
3. Click the **Comment** button below the selection, or press `c`.
4. Type the comment and click **Comment**.

The extension finds the exact source line (or line range) of the selection, also in hard-wrapped paragraphs. The comment starts with the selection as a `> quote`, so every GitHub client shows what the comment is about. On reload, the extension highlights the quoted words in the rendered text. Clear the **Quote** checkbox to post without the quote. **Suggest change** inserts a GitHub `suggestion` block with the raw source lines.

## OpenSpec outline

When a PR changes files under `openspec/`, the sidebar gets a Spec tab (shortcut `4`). It shows each change as an outline: the proposal sections, each capability with its ADDED, MODIFIED, REMOVED, and RENAMED requirements and their scenarios, and the tasks with progress. It also shows thread counts, and a warning for each requirement without a scenario or without SHALL or MUST. The outline reads the raw files, so it works before you render any file. Click a row to jump to the rendered block, or to the source-diff line if the file is not in rich diff.

## Glossary terms

If the repository has a `GLOSSARY.md` (at the root, in `docs/`, or in `openspec/`, or changed in the PR), terms from it get a dotted underline in the rendered Markdown. Hover a term to see its definition, its section, and a link to its line in the glossary. Only the first occurrence of a term in each block is underlined. Press `Shift+G` to hide or show the terms. Entries use the form `- **term** — definition`, and `**a / b**` defines two names for one entry.

## Install in Firefox

Firefox release builds only install signed extensions. Pick one of these:

- Temporary (until Firefox restarts): open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on**, and select `extensions/github/manifest.json`. Run `./scripts/dev-sync.sh github` first.
- Permanent: sign it as an unlisted add-on with your addons.mozilla.org API key, then open the `.xpi` in Firefox:

```bash
./scripts/dev-sync.sh github
web-ext sign -s extensions/github --channel=unlisted --api-key=$AMO_JWT_ISSUER --api-secret=$AMO_JWT_SECRET
```

`npm run build:firefox` builds an unsigned zip into `releases/`. `npm run test:e2e:firefox` runs the browser tests on Firefox.

---

# Markdown PR Comments for GitHub and Azure DevOps

Two separate Chrome/Edge extensions that let you leave **and view** inline pull-request review comments directly in rendered Markdown:

- **Markdown PR — Markdown PR Comments for GitHub** targets GitHub rich diff.
- **Markdown PR — Azure DevOps PR Comments** targets Azure DevOps Preview mode.

Install only the target you use; each package requests access solely to its own service.

## Problem

GitHub rich diff and Azure DevOps Preview render Markdown beautifully, but neither provides the complete block-level review workflow available in source diff. Reviewers otherwise switch views repeatedly to comment, find conversations, and scan what changed.

## What this does

- Overlays a `+` button on every paragraph, heading, list item, table row, and code block in rich diff.
- Click `+` → write a comment → posts as a real PR review comment on the correct source line.
- Renders existing review threads inline at the rendered block that corresponds to each commented line.
- **Reply** to threads, **resolve / unresolve** them, and see resolved state — all from the rendered view. GitHub also exposes outdated-thread state.
- **Threads sidebar** docked to the right edge lists every review thread (author, snippet, file:line, and target-supported status tags) — click to jump, with prev/next chevrons and a comment counter.
- **Outline tab** in the sidebar shows the heading tree of every changed `.md` file with comment-count pills, per-section folding, and bulk `Fold H1 / H2 / H3` / `Expand all` controls.
- **Changes tab** in the sidebar lists every changed block (paragraph / list item / table row / code block / heading / blockquote) with a `+` / `−` / `±` kind glyph, file:line, and a snippet. The header also gets a `◀ N/M ▶` counter so you can step through changes without opening the tab. Best way to scan a Markdown PR for the first time without re-reading the unchanged prose.
- **Start rendered review in one click:** GitHub can render every changed Markdown file as rich diff in one sweep; Azure DevOps can open the selected or first changed Markdown file in its sticky Preview mode.
- **Azure DevOps Preview highlights:** added sections are green, modified sections use a warm warning highlight, and new files receive a subtle marker.
- **Azure DevOps mentions:** type `@` in a comment, reply, or edit to find teammates and post a native Azure DevOps mention; inline conversations and sidebar snippets retain readable names.
- **Keyboard shortcuts:** `j` / `k` next / previous thread, `h` / `l` first / last thread, `[` / `]` previous / next change, `{` / `}` (Shift+[, Shift+]) first / last change, `1` / `2` / `3` switch sidebar tab (Changes / Threads / Outline), `t` toggle the sidebar, `Shift+T` reset its position.
- No PAT required — each target uses the existing signed-in session for its service.

(For submitting a full review / approve / request changes, use GitHub's native **"Review changes"** button at the top of the Files-changed tab.)

See the shared [feature parity roadmap](docs/FEATURES.md) for both targets and the small [GitHub](docs/github/FEATURES.md) / [Azure DevOps](docs/ado/FEATURES.md) platform notes for host-specific behavior.

## Install

### For end users

**Azure DevOps:**

- **Chrome / Brave / Vivaldi / Arc / any Chromium browser:** <https://chromewebstore.google.com/detail/markdown-pr-comments-for/habbfnkhgmnkhlbakjlnapadamjijbdh>
- **Microsoft Edge:** <https://microsoftedge.microsoft.com/addons/detail/ajgoipjphffaapagamibikngconoanac>

**GitHub:**

- **Chrome / Brave / Vivaldi / Arc / any Chromium browser:** <https://chromewebstore.google.com/detail/markdown-pr-comments-for/bdkcmcdfnhonfcpdgcmemkpcmnhnhemj> — short link: <https://aka.ms/md-pr>
- **Microsoft Edge:** <https://microsoftedge.microsoft.com/addons/detail/agomibenjlnikaldoddminkjbokfocgb>

No separate login, setup, or Personal Access Token is required. See [INSTALL.md](INSTALL.md) for both walkthroughs.

> 📌 **Just installed?** Hard-refresh (Ctrl+Shift+R / Cmd+Shift+R) any GitHub or Azure DevOps PR tab that was already open when you installed — see [INSTALL.md → Just installed?](INSTALL.md#just-installed).

### For local development

1. `git clone https://github.com/chienyuanchang/rich-diff-comments`
2. Open Chrome → `chrome://extensions/` (or Edge → `edge://extensions/`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select one target folder:
  - **GitHub:** `extensions/github/`
  - **Azure DevOps:** `extensions/ado/`
5. Open a pull request's changed-files view. Select rich diff for a GitHub Markdown file, or use the Azure DevOps sidebar's **Open Markdown Preview** action.

After editing a target's content script, click the reload icon on the extension card and hard-refresh the PR (Ctrl+Shift+R). If you edit anything under `src/lib/`, run `.\scripts\dev-sync.ps1 -Target github` or `-Target ado` first, then reload that extension.

## Usage

1. Open a PR's changed-files view
2. Select **rich diff** for a GitHub Markdown file, or click **Open Markdown Preview** in the Azure DevOps sidebar
3. Hover a block → click the `+` button → type → **Comment**
4. Existing comments appear inline as a `💬 N comments` badge — click to expand

## Files

```
extensions/github/     Chrome / Edge load unpacked from here
  manifest.json           Extension manifest (Manifest V3)
  content.js              Main content script (DOM + fetch glue)
  styles.css              Comment button and box styles
  icons/                  Extension icons
  src/lib/                Mirrored from repo-root src/lib (git-ignored)
  PRIVACY.md              Mirrored from repo-root PRIVACY.md (git-ignored)
extensions/ado/        Separate Azure DevOps Chrome / Edge extension
  manifest.json           ADO-only hosts and package metadata
  content.js              ADO Preview, REST, comments, and navigation UI
  styles.css              Fluent light/dark/high-contrast interface
  icons/                  Reversed-color ADO icon set
  src/                    Mirrored shared helpers + ADO adapter (git-ignored)
  PRIVACY.md              Mirrored from PRIVACY_ADO.md (git-ignored)
src/lib/               Shared pure helpers — source of truth
  textMatch.js            block text → source-line matching
  responses.js            GitHub API response parsing, path validation, escapeHtml, formatTimeAgo
  tableRows.js            table row → source-line arithmetic
  markdownPreview.js      offline markdown → HTML for the Preview tab
  codeBlocks.js           fence detection + thread-head sorting
scripts/
  package.ps1             Build the publish zip (-Target github|ado)
  dev-sync.ps1            Mirror src/lib + PRIVACY.md into extensions/<target>/
tests/                 Node test runner specs (`npm test`)
test_md_files/         Synthetic Markdown fixture for manual rich-diff testing
docs/github/APPROACH.md   GitHub strategy and design choices
docs/FEATURES.md       Shared feature parity roadmap and target status
docs/github/FEATURES.md   GitHub-specific feature mechanics and constraints
docs/ado/FEATURES.md      ADO-specific feature mechanics and constraints
docs/github/DEV_NOTES.md  Implementation notes & GitHub internal data shapes
docs/ado/ADO_DEV_NOTES.md ADO REST, DOM, lifecycle, and debugging findings
docs/ado/ADO_ADAPTER_PLAN.md   Design and validation record for the Azure DevOps target
docs/PUBLISHING.md     Store submission and release workflow
```

## Tests

All suites are local — no live GitHub or Azure DevOps calls.

```bash
npm install         # one-time: fetches jsdom + @playwright/test (devDeps only)
npx playwright install chromium    # one-time: ~150 MB Chromium for e2e tests

npm test                  # 410 unit/static tests (Node:test + jsdom)
npm run test:e2e          # 21 GitHub Playwright fixtures
npm run test:e2e:ado      # 63 ADO Preview + mocked REST Playwright fixtures
npm run test:e2e:all      # both browser targets
npm run test:all          # Node tests plus both browser targets
```

**Unit tests** (`tests/*.test.js`) cover the pure helpers (line matching, response parsing, table arithmetic, code-block fence detection, anchor-key encoding) and DOM-coupled glue (per-file block→line mapping, `+`-button anchor selection, `styles.css` coverage).

**GitHub E2E tests** (`tests/e2e/*.spec.js`) drive the GitHub extension against captured rich-diff HTML fixtures. **ADO E2E tests** (`tests/e2e-ado/*.spec.js`) drive the separate ADO manifest against Preview-shaped fixtures and a stateful mocked ADO REST API. Both cover what jsdom cannot: real CSS layout, `:hover`, keyboard events, scrolling, and SPA timing.

The extension itself ships zero runtime npm dependencies — `jsdom` and `@playwright/test` are devDependencies only. The published zip contains no `node_modules`, no `package.json`, no test files.

GitHub network mutations remain covered by the [manual test checklist](docs/github/DEV_NOTES.md#manual-test-checklist). The ADO fixture suite covers create, reply, status, edit, and delete requests without contacting a live organization.

## Packaging a release

Build a publish-ready zip for the Chrome Web Store / Edge Add-ons:

```powershell
# From this folder
.\scripts\package.ps1
.\scripts\package.ps1 -Target ado
# → rdc-<version>.zip for GitHub; rdc-ado-<version>.zip for ADO
```

See [docs/PUBLISHING.md](docs/PUBLISHING.md) for the full publishing workflow (store submission, listing copy, permissions justification, versioning).

For a guided pre-submission audit + per-version release-doc generation, the [`rdc-publish-check`](.github/skills/rdc-publish-check/SKILL.md) skill automates the workflow.

## Limitations

- Mermaid diagrams and other non-text blocks can't be matched against source — comments near them may anchor to the previous matched block.
- Requires rendered Markdown to be active for the file (GitHub rich diff or Azure DevOps Preview).
- Service APIs may reject comments on source lines that are not reviewable in the current pull-request iteration.

## See also

- [docs/FEATURES.md](docs/FEATURES.md) — authoritative shared roadmap and GitHub/ADO parity status.
- [docs/github/FEATURES.md](docs/github/FEATURES.md) and [docs/ado/FEATURES.md](docs/ado/FEATURES.md) — host-specific mechanics, constraints, and intentional differences.
- [docs/github/APPROACH.md](docs/github/APPROACH.md) — GitHub strategy and design choices (start here if you're new).
- [docs/github/DEV_NOTES.md](docs/github/DEV_NOTES.md) — internal GitHub data shapes, gotchas, and debugging recipes.
- [docs/ado/ADO_DEV_NOTES.md](docs/ado/ADO_DEV_NOTES.md) — Azure DevOps REST, DOM, lifecycle, and debugging findings.

## Legal

These are independent, third-party browser extensions. They are not affiliated with, endorsed by, sponsored by, or otherwise connected to GitHub, Inc. or Microsoft Corporation. "GitHub" and "Azure DevOps" are used only to identify the services the extensions work with.

Released under the [MIT License](LICENSE).
