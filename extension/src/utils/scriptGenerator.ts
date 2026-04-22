import { Script, RecordedAction, TestCase } from '../types';
import { buildLocatorCode, sanitizeForCode } from './selectorBuilder';

export function generatePlaywrightScript(script: Script): string {
  const { testCase, actions } = script;
  const lines: string[] = [];

  lines.push(`import { test, expect } from '@playwright/test';`);
  lines.push(`import * as path from 'path';`);
  lines.push(``);
  lines.push(`/**`);
  lines.push(` * Test Case : ${safeComment(testCase.number)}`);
  lines.push(` * Name      : ${safeComment(testCase.name)}`);
  lines.push(` * Description: ${safeComment(testCase.description)}`);
  lines.push(` * Expected  : ${safeComment(testCase.expectedResult)}`);
  lines.push(` * Generated : ${new Date().toISOString()}`);
  lines.push(` */`);
  lines.push(``);
  lines.push(`test.describe('${escapeString(testCase.number)}: ${escapeString(testCase.name)}', () => {`);

  const firstNav = actions.find((a) => a.type === 'navigate');
  if (firstNav?.url) {
    lines.push(`  test.beforeEach(async ({ page }) => {`);
    lines.push(`    await page.goto('${escapeUrl(firstNav.url)}');`);
    lines.push(`  });`);
    lines.push(``);
  }

  lines.push(`  test('${escapeString(testCase.name)}', async ({ page }) => {`);

  if (testCase.steps) {
    lines.push(`    // Steps: ${safeComment(testCase.steps)}`);
  }
  lines.push(``);

  // Skip the first navigate (already in beforeEach)
  const firstNavIdx = actions.findIndex((a) => a.type === 'navigate');
  let screenshotIndex = 1;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    if (i === firstNavIdx && action.type === 'navigate') continue;

    const code = generateActionCode(action, screenshotIndex, testCase.number);
    if (action.type === 'screenshot') screenshotIndex++;
    lines.push(...code.map((l) => `    ${l}`));
  }

  lines.push(`  });`);
  lines.push(`});`);
  lines.push(``);

  return lines.join('\n');
}

function generateActionCode(
  action: RecordedAction,
  screenshotIndex: number,
  tcNumber: string
): string[] {
  const lines: string[] = [];
  const locator = buildLocatorCode(action.selector, '', action.value);

  if (action.description) {
    lines.push(`// ${safeComment(action.description)}`);
  }

  switch (action.type) {
    case 'navigate':
      lines.push(`await page.goto('${escapeUrl(action.url || '')}');`);
      break;

    case 'click':
      lines.push(`await ${locator}.click();`);
      break;

    case 'fill':
      lines.push(`await ${locator}.fill('${escapeString(action.value || '')}');`);
      break;

    case 'select':
      lines.push(`await ${locator}.selectOption('${escapeString(action.value || '')}');`);
      break;

    case 'check':
      lines.push(`await ${locator}.check();`);
      break;

    case 'uncheck':
      lines.push(`await ${locator}.uncheck();`);
      break;

    case 'hover':
      lines.push(`await ${locator}.hover();`);
      break;

    case 'press':
      lines.push(`await page.keyboard.press('${escapeString(action.value || '')}');`);
      break;

    case 'wait':
      lines.push(`await page.waitForTimeout(${Number(action.value) || 1000});`);
      break;

    case 'screenshot': {
      const filename = `${tcNumber}-step-${screenshotIndex}`;
      lines.push(`await page.screenshot({`);
      lines.push(`  path: path.join('screenshots', '${filename}.png'),`);
      lines.push(`  fullPage: false,`);
      lines.push(`});`);
      if (action.screenshotDescription) {
        lines.push(`// Evidence: ${safeComment(action.screenshotDescription)}`);
      }
      break;
    }

    case 'assertion':
      lines.push(...generateAssertionCode(action, locator));
      break;
  }

  lines.push('');
  return lines;
}

function generateAssertionCode(action: RecordedAction, locator: string): string[] {
  const prefix = action.assertionDescription
    ? [`// Assert: ${safeComment(action.assertionDescription)}`]
    : [];
  return [...prefix, ...buildAssertionLine(action, locator)];
}

function buildAssertionLine(action: RecordedAction, locator: string): string[] {
  switch (action.assertionType) {
    case 'toBeVisible':   return [`await expect(${locator}).toBeVisible();`];
    case 'toBeHidden':    return [`await expect(${locator}).toBeHidden();`];
    case 'toHaveText':    return [`await expect(${locator}).toHaveText('${escapeString(action.assertionValue || '')}');`];
    case 'toContainText': return [`await expect(${locator}).toContainText('${escapeString(action.assertionValue || '')}');`];
    case 'toHaveValue':   return [`await expect(${locator}).toHaveValue('${escapeString(action.assertionValue || '')}');`];
    case 'toHaveURL':     return [`await expect(page).toHaveURL('${escapeString(action.assertionValue || '')}');`];
    case 'toHaveTitle':   return [`await expect(page).toHaveTitle('${escapeString(action.assertionValue || '')}');`];
    case 'toBeEnabled':   return [`await expect(${locator}).toBeEnabled();`];
    case 'toBeDisabled':  return [`await expect(${locator}).toBeDisabled();`];
    case 'toBeChecked':   return [`await expect(${locator}).toBeChecked();`];
    case 'toHaveCount':   return [`await expect(${locator}).toHaveCount(${Number(action.assertionValue) || 0});`];
    default:              return [`await expect(${locator}).toBeVisible();`];
  }
}

/** Escape a string for use inside single-quoted TypeScript string literals. */
function escapeString(raw: string): string {
  return raw
    .replace(/\\/g, '\\\\')   // backslash first
    .replace(/'/g, "\\'")      // single quotes
    .replace(/"/g, '\\"')      // double quotes (defensive)
    .replace(/\r\n/g, '\\n')   // CRLF → \n literal
    .replace(/\n/g, '\\n')     // LF
    .replace(/\r/g, '\\n')     // CR
    .replace(/\t/g, '\\t')     // tabs
    .replace(/\0/g, '');       // null bytes
}

/** Escape a URL for use in page.goto() — keep encoded chars, only fix quotes. */
function escapeUrl(url: string): string {
  return url
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '')
    .replace(/\r/g, '')
    .replace(/\t/g, '');
}

/** Strip anything that would break a JS // comment (newlines). */
function safeComment(raw: string): string {
  return raw
    .replace(/\r\n/g, ' | ')
    .replace(/[\n\r]/g, ' | ')
    .replace(/\t/g, ' ')
    .replace(/\*\//g, '* /')   // prevent */ from closing JSDoc
    .trim();
}

export function generatePlaywrightConfig(settings: {
  channel: string;
  baseUrl: string;
  timeout: number;
  retries: number;
  workers: number;
  headless: boolean;
}): string {
  return `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : ${settings.retries},
  workers: process.env.CI ? 1 : ${settings.workers},
  timeout: ${settings.timeout},
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.BASE_URL || '${escapeString(settings.baseUrl)}',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    channel: '${settings.channel}',
    headless: process.env.CI ? true : ${settings.headless},
  },
  projects: [
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: '${settings.channel}',
      },
    },
  ],
});
`;
}
