# 🎭 PlaywrightPro - Chrome Extension

Chrome extension for recording, managing, and executing **Playwright TypeScript** test scripts. Includes CI/CD integration with GitHub Actions and Azure DevOps.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📋 **Test Case Form** | Number, name, description, steps, expected/actual result, tags |
| ⏺ **Action Recorder** | Records clicks, inputs, selects, dropdowns automatically |
| ✅ **Assertions** | Add `expect()` assertions manually with selector and type |
| 📸 **Screenshots** | Capture evidence with descriptions |
| 📚 **Script Library** | Save, edit, export `.spec.ts`, push to GitHub |
| 📄 **HTML Reports** | Generate and export full HTML test reports |
| 📊 **Dashboard** | Metrics, pass rate, run history, bar charts |
| ▶ **Run Locally** | Execute via companion server using `channel: 'chrome'` |
| 🔄 **CI/CD Ready** | GitHub Actions + Azure DevOps YAML included |
| 🔗 **Webhook** | Receive CI/CD results in dashboard |

---

## 🚀 Quick Setup

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Build the extension

```bash
npm run build:extension
# Output: extension/dist/
```

### 3. Load extension in Chrome

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/dist/` folder

### 4. Start the companion server (for local test execution)

```bash
npm run start:server
# Server running at http://localhost:3001
```

---

## 📁 Project Structure

```
PlugInPlayWrightPro-Chrome/
├── extension/              # Chrome Extension (React + TypeScript)
│   ├── src/
│   │   ├── background/     # Service worker
│   │   ├── content/        # Page recorder script
│   │   ├── popup/          # React UI (5 tabs)
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Script/report generators
│   └── dist/               # Built extension (load this in Chrome)
├── companion-server/       # Node.js server for local test execution
├── generated-tests/        # Your .spec.ts files live here
├── playwright.config.ts    # Playwright configuration (channel: chrome)
├── .github/workflows/      # GitHub Actions CI/CD
└── azure-pipelines/        # Azure DevOps pipeline
```

---

## 🎯 How to Use

### Recording a test

1. Click the extension icon → **Test Case** tab
2. Fill in: Number (`TC-001`), Name, Description, Steps, Expected Result
3. Click **Save Test Case** → auto-switches to **Recorder** tab
4. Click **⏺ Start Recording** → interact with your web page
5. Click **⏹ Stop Recording** when done
6. Add assertions with **✅ Assert** button
7. Take evidence screenshots with **📸 Screenshot** button
8. Click **💾 Save Script**

### Running a test locally

1. Start the companion server: `npm run start:server`
2. Go to **Library** tab → click **▶ Run** on any script

### Running on Chrome (not Chromium)

```bash
# The playwright.config.ts uses channel: 'chrome' by default
npx playwright test --project=chrome

# Or with the chromium-ci project for CI environments
npx playwright test --project=chromium-ci
```

### Exporting reports

- Library tab → **📄 Report** → downloads `.html` report
- `npx playwright test:report` → opens Playwright's built-in HTML report

---

## 🔄 CI/CD Setup

See [`docs/CI_CD_SETUP.md`](docs/CI_CD_SETUP.md) for detailed instructions.

### GitHub Actions

Triggered automatically on push to `main`/`develop` or manually via `workflow_dispatch`.

**Required secrets:**
- `WEBHOOK_SECRET` — for receiving results in dashboard (optional)

**Required variables:**
- `BASE_URL` — base URL for tests (e.g. `https://staging.example.com`)
- `WEBHOOK_URL` — companion server webhook URL (optional)

### Azure DevOps

See `azure-pipelines/azure-pipelines.yml`.

**Required pipeline variables:**
- `BASE_URL`, `WEBHOOK_URL`, `WEBHOOK_SECRET`

---

## 🔗 Webhook Integration

To receive CI/CD results in the dashboard:

1. Start companion server with webhook enabled
2. Set `WEBHOOK_URL` in your CI/CD to: `http://your-server:3001/webhook`
3. Set `WEBHOOK_SECRET` in both CI/CD secrets and companion server env
4. Results appear automatically in the **Dashboard** tab

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

## ⚙️ Settings Reference

Configure from the extension **⚙️ Settings** tab:

| Section | Setting | Description |
|---|---|---|
| Storage | GitHub Token | PAT with `repo` scope |
| Storage | Repository | `owner/repo-name` |
| Storage | Tests Path | Path in repo for `.spec.ts` files |
| Server | Companion URL | Default: `http://localhost:3001` |
| Playwright | Browser Channel | `chrome` / `chromium` / `msedge` |
| Playwright | Base URL | Default base URL for all tests |
| CI/CD | Azure PAT | Azure DevOps personal access token |
| Webhook | Enable | Toggle webhook receiver |
| Webhook | Secret | Shared secret for authentication |

---

## 📋 Requirements

- **Chrome** 120+
- **Node.js** 18+
- **Google Chrome** installed (for `channel: 'chrome'` execution)
- `@playwright/test` installed (`npm ci`)
