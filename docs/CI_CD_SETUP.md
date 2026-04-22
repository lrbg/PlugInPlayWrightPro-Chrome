# CI/CD Setup Guide

## GitHub Actions

### Preconditions

1. Your tests must be in the `generated-tests/` folder and pushed to the repo
2. `package.json` must have `@playwright/test` as a dev dependency
3. A `playwright.config.ts` must exist at the root

### Setup Steps

1. **Configure repository secrets** (`Settings → Secrets and variables → Actions`):
   - `WEBHOOK_SECRET` — Secret to authenticate webhook calls (optional)

2. **Configure repository variables** (`Settings → Secrets and variables → Actions → Variables`):
   - `BASE_URL` — e.g. `https://staging.yourapp.com`
   - `WEBHOOK_URL` — e.g. `https://yourserver.ngrok.io/webhook` (optional)

3. The workflow is in `.github/workflows/playwright.yml` — it runs automatically.

4. **Manual trigger**: Go to `Actions → Playwright Tests → Run workflow`
   - You can specify a specific test file and override `BASE_URL`

### CI Browser Note

GitHub Actions (`ubuntu-latest`) does not have Google Chrome installed by default.
The workflow uses `--project=chromium-ci` which uses the bundled Chromium.

To use real Chrome in CI, add this step before running tests:
```yaml
- name: Install Google Chrome
  run: |
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
    sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'
    sudo apt-get update
    sudo apt-get install -y google-chrome-stable
```
Then use `--project=chrome` in the test command.

---

## Azure DevOps

### Preconditions

1. An Azure DevOps organization and project must exist
2. A pipeline pointing to `azure-pipelines/azure-pipelines.yml` must be created

### Setup Steps

1. In Azure DevOps, go to `Pipelines → New Pipeline`
2. Connect to GitHub, select this repository
3. Choose `Existing Azure Pipelines YAML file`
4. Select `/azure-pipelines/azure-pipelines.yml`

5. **Configure pipeline variables** (`Edit → Variables`):
   - `BASE_URL` — e.g. `https://staging.yourapp.com`
   - `WEBHOOK_URL` — e.g. `https://yourserver.ngrok.io/webhook` (optional, mark as secret)
   - `WEBHOOK_SECRET` — Webhook secret (mark as secret)

6. Test results are published to the **Tests** tab of each build run.
7. Playwright HTML report is available as a build artifact.

---

## Webhook for Dashboard Integration

The companion server receives POST requests with test results and stores them for the dashboard.

### Running the companion server publicly (for CI/CD → webhook)

Use **ngrok** to expose your local server:
```bash
# In one terminal
npm run start:server

# In another terminal
ngrok http 3001
# Copy the https URL, e.g. https://abc123.ngrok.io
```

Then set `WEBHOOK_URL=https://abc123.ngrok.io/webhook` in your CI/CD.

### Webhook payload format

```json
{
  "scriptId": "TC-001",
  "testCaseNumber": "TC-001",
  "scriptName": "Login test",
  "status": "pass",
  "duration": 3200,
  "startedAt": "2024-01-15T10:30:00Z",
  "finishedAt": "2024-01-15T10:30:03Z",
  "source": "github-actions",
  "retries": 0,
  "error": null
}
```

### Authentication header

```
X-Webhook-Secret: your-secret-value
```
