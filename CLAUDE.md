# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Build & Dev Commands

### Extension (Chrome Extension — React + TypeScript + Webpack)

```bash
cd extension
npm install              # install deps
npm run build            # production build → extension/dist/
npm run dev              # webpack watch mode (rebuild on save)
npm run build:dev        # dev build (source maps, no minification)
```

After any change to `extension/src/`, run `npm run build` and then reload the extension in `chrome://extensions`.

### Companion Server (Node.js + Express + TypeScript)

```bash
cd companion-server
npm install
npm run build            # tsc → companion-server/dist/
npm run dev              # ts-node-dev watch mode
node dist/server.js      # run the compiled server directly
```

### Root workspace shortcuts

```bash
npm run install:all      # installs root + extension + server deps
npm run build            # builds both extension and companion server
npm run build:extension  # extension only
npm run build:server     # server only
npm run start:server     # starts companion server (port 3001)
```

### Run Playwright tests

```bash
npx playwright test                          # all tests in generated-tests/
npx playwright test --project=chrome        # Chrome channel only
npx playwright test --headed                # visible browser
npx playwright test tests/TC-001-*.spec.ts  # single test by file
npx playwright test --ui                    # Playwright UI mode
```

### Auto-start companion server (macOS LaunchAgent)

```bash
# Enable auto-start on login
launchctl load ~/Library/LaunchAgents/com.playwrightpro.companion.plist

# Disable
launchctl unload ~/Library/LaunchAgents/com.playwrightpro.companion.plist

# Logs
tail -f /tmp/playwrightpro-companion.log
tail -f /tmp/playwrightpro-companion.error.log

# Health check
curl http://localhost:3001/health
```

---

## Architecture

### Two-process model

```
┌─────────────────────────────────────────┐
│  Chrome Extension (extension/dist/)     │
│  ┌────────────────────────────────────┐ │
│  │  Popup UI (React 18)               │ │
│  │  App.tsx — 5-tab shell             │ │
│  │  ├─ TestCaseForm  (tab: testcase)  │ │
│  │  ├─ Recorder      (tab: recorder)  │ │
│  │  ├─ ScriptLibrary (tab: library)   │ │
│  │  ├─ Dashboard     (tab: dashboard) │ │
│  │  └─ Settings      (tab: settings)  │ │
│  └────────────────────────────────────┘ │
│  background/service-worker.ts           │
│  content/recorder.ts  ← injected into  │
│                          every page     │
└──────────────┬──────────────────────────┘
               │ fetch POST /run
               ▼
┌─────────────────────────────────────────┐
│  Companion Server  (companion-server/)  │
│  Express  :3001                         │
│  POST /run  → writes .spec.ts, spawns   │
│               npx playwright test       │
│  GET  /health                           │
│  POST /webhook  ← CI/CD callbacks       │
└─────────────────────────────────────────┘
```

### Data flow: record → generate → run

1. **Record**: `content/recorder.ts` listens to DOM events (click/input/change) → sends `ACTION_RECORDED` messages to `service-worker.ts` → service worker forwards to popup via `chrome.runtime.onMessage`.
2. **Generate**: `utils/scriptGenerator.ts` converts `RecordedAction[]` to Playwright TypeScript. `utils/selectorBuilder.ts` converts selector spec strings (e.g. `role::button::Login`) to `page.getByRole(...)` calls.
3. **Persist**: `utils/storage.ts` wraps `chrome.storage.local`. Keys: `ppp_scripts`, `ppp_results`, `ppp_settings`.
4. **Run**: `ScriptLibrary` POSTs the generated code to `companion-server` → companion writes a temp `.spec.ts`, spawns `npx playwright test`, returns pass/fail/error result. The temp file is deleted after execution.

### Selector spec format

Selectors are stored as structured strings parsed by `buildLocatorCode()`:

| Spec prefix | Generated locator |
|---|---|
| `testid::VALUE` | `page.getByTestId('VALUE')` |
| `arialabel::VALUE` | `page.getByLabel('VALUE')` |
| `label::VALUE` | `page.getByLabel('VALUE')` |
| `role::ROLE::NAME` | `page.getByRole('ROLE', { name: 'NAME', exact: false })` |
| `placeholder::VALUE` | `page.getByPlaceholder('VALUE')` |
| `text::VALUE` | `page.getByText('VALUE', { exact: false })` |
| `css::SELECTOR` | `page.locator('SELECTOR')` |

`buildSelector()` in `recorder.ts` assigns priorities: testId → ariaLabel → role+text (unique only) → CSS class disambiguator → placeholder → label → name → text → CSS path.

### Key design decisions

- **`isUniqueByText()`** runs at record time to prevent Playwright strict-mode violations: if multiple elements share the same role+text, the recorder falls through to a more specific selector.
- **`deduplicateActions()`** in `scriptGenerator.ts` collapses consecutive fills on the same field and detects automatic SPA navigations (within 8 s of a user action) → emits `waitForLoadState('load')` instead of `goto()`.
- **`waitForLoadState` strategy**: `'domcontentloaded'` in `beforeEach`, `'load'` after every navigate action, `'domcontentloaded'` after every click.
- **Assertion timeout**: All `expect()` calls use `{ timeout: 30_000 }` to handle AJAX-loaded content.
- **Input sanitization**: `ws()` strips newlines/null bytes from all action fields before code generation; `escapeString()` escapes for TypeScript string literals; `escapeUrl()` for `page.goto()`.

### Storage layout (`chrome.storage.local`)

| Key | Type | Notes |
|---|---|---|
| `ppp_scripts` | `Script[]` | Saved scripts (include generated code + run stats) |
| `ppp_results` | `TestResult[]` | Last 500 runs (newest first) |
| `ppp_settings` | `AppSettings` | Extension configuration |

### Files to touch for common tasks

| Task | Files |
|---|---|
| Change how selectors are recorded | `extension/src/content/recorder.ts` → `buildSelector()` |
| Change generated Playwright code | `extension/src/utils/scriptGenerator.ts` → `generateActionCode()` |
| Add a new locator type | `extension/src/utils/selectorBuilder.ts` → `buildLocatorCode()` |
| Add a new action type | `extension/src/types/index.ts` + recorder + scriptGenerator |
| Add a new assertion type | `types/index.ts` (AssertionType) + `buildAssertionLine()` in scriptGenerator |
| Change test runner behavior | `companion-server/src/runner.ts` |
| Add a new API endpoint | `companion-server/src/server.ts` |
| Change dashboard metrics | `extension/src/popup/components/Dashboard.tsx` |
| Add a new setting | `types/index.ts` (AppSettings) + `storage.ts` (DEFAULT_SETTINGS) + `Settings.tsx` |

---

## Two repository directories

The project exists in **two local copies** pointing to the same remote (`github.com/lrbg/PlugInPlayWrightPro-Chrome`):

- `/Users/luisrogelio/Documents/Plug-InPlaywrightPro/` — **active copy loaded in Chrome** — always edit this one
- `/Users/luisrogelio/Documents/PlugInPlayWrightPro-Chrome/` — secondary copy (CWD in some sessions)

After editing and building in `Plug-InPlaywrightPro`, sync changes to `PlugInPlayWrightPro-Chrome` if needed, then commit from `Plug-InPlaywrightPro`.
