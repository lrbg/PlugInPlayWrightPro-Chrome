# PlaywrightPro — Chrome Extension

Chrome extension for recording, generating, and running **Playwright TypeScript** tests without writing a single line of code. Includes a companion server for local execution and CI/CD integration with GitHub Actions and Azure DevOps.

---

## Features

| Feature | Description |
|---|---|
| **Test Case Form** | Define test metadata: number, name, description, steps, expected/actual result, tags |
| **Action Recorder** | Auto-captures clicks, text inputs, dropdowns, checkboxes, keyboard presses, navigation |
| **Smart Selectors** | Prioritizes `data-testid` → `aria-label` → role+name → placeholder → label → CSS path |
| **Assertions** | Add `expect()` assertions with selector, type, and expected value — all with 30 s timeout |
| **Screenshots** | Capture in-test evidence with descriptive captions |
| **Script Library** | Save, preview, edit, export `.spec.ts`, push directly to GitHub |
| **HTML Reports** | Generate and download full HTML test reports per script |
| **Dashboard** | Pass rate, fail rate, avg duration, results by day, top scripts, recent runs — with Clear Metrics button |
| **Local Execution** | Run tests via companion server using `channel: 'chrome'` |
| **Auto-start Server** | macOS LaunchAgent starts companion server automatically on login |
| **CI/CD** | GitHub Actions + Azure DevOps YAML included |
| **Webhook** | Receive CI/CD pass/fail results back in the Dashboard |

---

## Requirements

| Dependency | Version | Notes |
|---|---|---|
| **Node.js** | 18+ | Required for companion server and build tools |
| **npm** | 8+ | Included with Node.js |
| **Google Chrome** | 120+ | Required for extension and `channel: 'chrome'` test execution |
| **@playwright/test** | 1.49+ | Installed at root via `npm install` |
| **TypeScript** | 5.7+ | Dev dependency — installed automatically |

> Google Chrome must be installed on the machine where the companion server runs tests. Playwright uses the installed Chrome binary (not the bundled Chromium) when `channel: 'chrome'` is set.

---

## Installation

### macOS / Linux

```bash
# 1. Clone the repository
git clone https://github.com/lrbg/PlugInPlayWrightPro-Chrome.git
cd PlugInPlayWrightPro-Chrome

# 2. Install all dependencies (root + extension + companion server)
npm run install:all

# 3. Install Playwright browsers
npx playwright install chromium --with-deps

# 4. Build the Chrome extension
npm run build:extension
# → Output: extension/dist/

# 5. Load the extension in Chrome
#    Open chrome://extensions
#    Enable Developer mode (top right toggle)
#    Click "Load unpacked"
#    Select the extension/dist/ folder

# 6. Start the companion server (required for running tests locally)
npm run start:server
# → Server running at http://localhost:3001
```

### Windows (Chrome)

```powershell
# 1. Install Node.js 18+ from https://nodejs.org (LTS recommended)
# 2. Install Google Chrome from https://www.google.com/chrome

# 3. Clone and install
git clone https://github.com/lrbg/PlugInPlayWrightPro-Chrome.git
cd PlugInPlayWrightPro-Chrome
npm run install:all

# 4. Install Playwright Chromium (used for CI projects; Chrome channel uses installed Chrome)
npx playwright install chromium

# 5. Build the extension
npm run build:extension

# 6. Load the extension in Chrome (Windows)
#    Open Chrome → go to chrome://extensions
#    Enable Developer mode (toggle, top right)
#    Click "Load unpacked"
#    Browse to: C:\path\to\PlugInPlayWrightPro-Chrome\extension\dist
#    Click "Select Folder"

# 7. Start the companion server (run in PowerShell or cmd)
npm run start:server
```

> **Windows note:** The companion server spawns `npx playwright test` with `channel: 'chrome'`.
> Make sure Google Chrome is installed at its default path (`C:\Program Files\Google\Chrome\Application\chrome.exe`).
> If Chrome is installed elsewhere, set the `CHROME_PATH` environment variable or adjust `playwright.config.ts`.

### Auto-start companion server on login (macOS only)

```bash
# First run: builds and starts immediately
bash start-server.sh

# Enable as a background service (starts on every login, auto-restarts on crash)
launchctl load ~/Library/LaunchAgents/com.playwrightpro.companion.plist

# Check status
launchctl list | grep playwrightpro

# View logs
tail -f /tmp/playwrightpro-companion.log
tail -f /tmp/playwrightpro-companion.error.log

# Stop
launchctl unload ~/Library/LaunchAgents/com.playwrightpro.companion.plist
```

> On Windows, you can achieve the same with **Task Scheduler**:
> Create a task that runs `node C:\path\to\companion-server\dist\server.js` at login.

---

## How to Use

### 1. Record a test

1. Click the **PlaywrightPro** extension icon in Chrome
2. Go to the **Test Case** tab — fill in: Number (`TC-001`), Name, Description, Steps, Expected Result
3. Click **Save Test Case** → automatically switches to **Recorder** tab
4. Click **⏺ Start Recording**
5. Interact with your web page — clicks, typing, dropdowns are all captured
6. Click **⏹ Stop Recording**
7. Add assertions with the **✅ Assert** button (choose selector, assertion type, and value)
8. Capture evidence screenshots with **📸 Screenshot**
9. Click **💾 Save Script**

### 2. Run a test locally

1. Make sure the companion server is running (`npm run start:server` or via LaunchAgent)
2. Go to the **Library** tab
3. Click **▶ Run** on any saved script
4. Results appear immediately in the script row and in the **Dashboard** tab

### 3. Export and view reports

- **Library** tab → **📄 Report** → downloads a self-contained `.html` report
- `npx playwright show-report` → opens Playwright's built-in HTML report from the last run

### 4. Push scripts to GitHub

- Configure GitHub Token and Repository in **⚙️ Settings** tab
- Library tab → **⬆ Push** on any script → commits the `.spec.ts` to your repo

---

## Project Structure

```
PlugInPlayWrightPro-Chrome/
├── extension/                  # Chrome Extension (React + TypeScript + Webpack)
│   ├── src/
│   │   ├── background/         # Service worker — manages recording sessions & messages
│   │   ├── content/            # recorder.ts — injected into pages, captures DOM events
│   │   ├── popup/              # React UI — App.tsx + 5 tab components
│   │   ├── types/              # index.ts — all TypeScript interfaces
│   │   └── utils/
│   │       ├── scriptGenerator.ts   # RecordedAction[] → Playwright TypeScript code
│   │       ├── selectorBuilder.ts   # Selector spec → page.getByRole() / locator() calls
│   │       ├── storage.ts           # chrome.storage.local wrapper
│   │       └── reportGenerator.ts   # HTML report builder
│   └── dist/                   # Built extension — load this folder in Chrome
│
├── companion-server/           # Node.js + Express — local test execution
│   ├── src/
│   │   ├── server.ts           # API: POST /run, GET /health, POST /webhook
│   │   ├── runner.ts           # Spawns: npx playwright test {file} --project=chrome
│   │   └── webhook.ts          # Receives CI/CD result callbacks
│   └── dist/                   # Compiled server (run with: node dist/server.js)
│
├── generated-tests/            # Your .spec.ts files are saved here
├── screenshots/                # Test evidence screenshots
├── playwright.config.ts        # Playwright config (channel: 'chrome', projects)
├── start-server.sh             # Builds and starts companion server (macOS/Linux)
├── .github/workflows/          # GitHub Actions CI/CD pipeline
├── azure-pipelines/            # Azure DevOps pipeline YAML
└── docs/CI_CD_SETUP.md         # CI/CD configuration guide
```

---

## CI/CD Setup

See [`docs/CI_CD_SETUP.md`](docs/CI_CD_SETUP.md) for full details.

### GitHub Actions

Push to `main`/`develop` triggers the workflow automatically.

**Required secrets:**
- `WEBHOOK_SECRET` — shared secret for webhook authentication (optional)

**Required variables:**
- `BASE_URL` — base URL for tests (e.g. `https://staging.example.com`)
- `WEBHOOK_URL` — companion server webhook endpoint (optional, for dashboard results)

### Azure DevOps

See `azure-pipelines/azure-pipelines.yml`.

**Required pipeline variables:** `BASE_URL`, `WEBHOOK_URL`, `WEBHOOK_SECRET`

---

## Webhook Integration

To receive CI/CD results back in the Dashboard:

1. Expose your companion server to the internet (e.g. ngrok, VPN, or public server)
2. Set `WEBHOOK_URL` in your CI/CD to `http://your-server:3001/webhook`
3. Set `WEBHOOK_SECRET` in CI/CD secrets and companion server environment
4. Results appear automatically in the **Dashboard** tab after each CI run

**Webhook payload format:**
```json
{
  "scriptId": "TC-001",
  "testCaseNumber": "TC-001",
  "scriptName": "Login test",
  "status": "pass",
  "duration": 3200,
  "startedAt": "2024-01-15T10:30:00Z",
  "finishedAt": "2024-01-15T10:30:03Z",
  "source": "github-actions"
}
```

---

## Settings Reference

Configure from the extension **⚙️ Settings** tab:

| Section | Setting | Description |
|---|---|---|
| Storage | GitHub Token | Personal Access Token with `repo` scope |
| Storage | Repository | `owner/repo-name` |
| Storage | Branch | Default: `main` |
| Server | Companion URL | Default: `http://localhost` |
| Server | Port | Default: `3001` |
| Playwright | Browser Channel | `chrome` / `chromium` / `msedge` |
| Playwright | Base URL | Default base URL prepended to relative paths |
| Playwright | Timeout | Per-test timeout in ms (default: 30 000) |
| Playwright | Retries | Retry count on failure (default: 1) |
| Playwright | Workers | Parallel workers (default: 2) |
| Playwright | Headless | Run browser without UI (default: off) |
| CI/CD | Azure Organization | Azure DevOps org name |
| CI/CD | Azure PAT | Azure DevOps personal access token |
| Webhook | Enable | Toggle webhook receiver on/off |
| Webhook | Secret | Shared secret for request authentication |

---

## Companion Server API

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Returns server status, Node version, project paths |
| `/run` | POST | Receives test code, writes `.spec.ts`, runs Playwright, returns result |
| `/run-file` | POST | Runs an existing test file by path |
| `/webhook` | POST | Receives CI/CD result payloads |

**POST /run body:**
```json
{
  "scriptId": "TC-001",
  "testCaseNumber": "TC-001",
  "scriptName": "My test",
  "code": "import { test, expect } from '@playwright/test'; ...",
  "baseUrl": "https://example.com",
  "headless": false
}
```
