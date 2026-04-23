import { Script, RecordedAction, TestCase } from '../types';
import { buildLocatorCode, sanitizeForCode } from './selectorBuilder';

/** Strip every dangerous character from every string field before code generation. */
function sanitizeAction(a: RecordedAction): RecordedAction {
  return {
    ...a,
    selector:              ws(a.selector),
    value:                 a.value               !== undefined ? ws(a.value)               : undefined,
    description:           a.description         !== undefined ? ws(a.description)         : undefined,
    url:                   a.url                 !== undefined ? ws(a.url)                 : undefined,
    assertionValue:        a.assertionValue      !== undefined ? ws(a.assertionValue)      : undefined,
    assertionDescription:  a.assertionDescription !== undefined ? ws(a.assertionDescription) : undefined,
    screenshotDescription: a.screenshotDescription !== undefined ? ws(a.screenshotDescription) : undefined,
  };
}

function ws(s?: string): string {
  if (s === undefined || s === null) return '';
  return String(s)
    .replace(/\r\n/g, ' ')
    .replace(/[\n\r\t\0]/g, ' ')
    .replace(/\u2028/g, ' ')   // Unicode line separator
    .replace(/\u2029/g, ' ')   // Unicode paragraph separator
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Remove noise from recorded actions before generating code.
 *
 * Rules:
 *  1. Consecutive fills on the SAME selector → keep only the last (intermediate
 *     keystroke snapshots are noise; only the final typed value matters).
 *  2. Consecutive navigates → keep only the last (SPA route changes that happen
 *     automatically as a side-effect of a click should collapse to one goto).
 *  3. A navigate that occurs within 8 s of the previous user action (click /
 *     fill / select) is "automatic" — the test shouldn't call goto() for it
 *     because the click already triggered the navigation.  Instead generate
 *     waitForLoadState so Playwright waits for the SPA to settle.
 */
function deduplicateActions(actions: RecordedAction[]): RecordedAction[] {
  // Pass 1: collapse consecutive fills on the same selector
  const pass1: RecordedAction[] = [];
  for (let i = 0; i < actions.length; i++) {
    const cur = actions[i];
    if (cur.type === 'fill') {
      // Skip if the very next action is also a fill on the same selector
      const next = actions[i + 1];
      if (next?.type === 'fill' && next.selector === cur.selector) continue;
    }
    pass1.push(cur);
  }

  // Pass 2: collapse consecutive navigates (keep last)
  const pass2: RecordedAction[] = [];
  for (let i = 0; i < pass1.length; i++) {
    const cur = pass1[i];
    if (cur.type === 'navigate') {
      const next = pass1[i + 1];
      if (next?.type === 'navigate') continue; // skip intermediate
    }
    pass2.push(cur);
  }

  // Pass 3: tag navigates that are automatic SPA transitions.
  // Heuristic: if a navigate follows a user action (click/fill/select/check)
  // within 8 seconds, it was triggered by that action — mark it.
  const USER_ACTIONS = new Set(['click', 'fill', 'select', 'check', 'uncheck', 'press']);
  let lastUserTs = 0;
  return pass2.map((a) => {
    if (USER_ACTIONS.has(a.type)) {
      lastUserTs = a.timestamp;
      return a;
    }
    if (a.type === 'navigate' && lastUserTs > 0 && (a.timestamp - lastUserTs) < 8000) {
      return { ...a, _autoNav: true } as RecordedAction & { _autoNav: boolean };
    }
    return a;
  });
}

export function generatePlaywrightScript(script: Script): string {
  const rawActions = script.actions.map(sanitizeAction);
  const actions    = deduplicateActions(rawActions);

  // Sanitize testCase string fields (description/steps may have raw newlines from textarea)
  const testCase: TestCase = {
    ...script.testCase,
    number:         ws(script.testCase.number) || 'TC-001',
    name:           ws(script.testCase.name) || 'Unnamed',
    description:    ws(script.testCase.description),
    steps:          ws(script.testCase.steps),
    expectedResult: ws(script.testCase.expectedResult),
    actualResult:   ws(script.testCase.actualResult),
  };
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
    lines.push(`    await page.waitForLoadState('domcontentloaded');`);
    lines.push(`  });`);
    lines.push(``);
  }

  lines.push(`  test('${escapeString(testCase.name)}', async ({ page }) => {`);

  if (testCase.steps) {
    lines.push(`    // Steps: ${safeComment(testCase.steps)}`);
  }
  lines.push(``);

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
  action: RecordedAction & { _autoNav?: boolean },
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
      if (action._autoNav) {
        // Full-page or cross-domain navigation triggered by a user action.
        // 'load' waits for all JS/CSS resources (form elements rendered by JS
        // are available), without timing out on sites with persistent connections.
        lines.push(`await page.waitForLoadState('load');`);
      } else {
        lines.push(`await page.goto('${escapeUrl(action.url || '')}');`);
        lines.push(`await page.waitForLoadState('load');`);
      }
      break;

    case 'click':
      lines.push(`await ${locator}.click();`);
      lines.push(`await page.waitForLoadState('domcontentloaded');`);
      break;

    case 'fill': {
      // pressSequentially fires individual key events (keydown/keypress/keyup)
      // so React/Angular/Vue autocomplete handlers receive each keystroke.
      const val = escapeString(action.value || '');
      lines.push(`await ${locator}.pressSequentially('${val}', { delay: 50 });`);
      break;
    }

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
  // 30 s timeout lets Playwright retry through AJAX delays, slow renders, etc.
  const t = `{ timeout: 30_000 }`;
  const v = escapeString(action.assertionValue || '');
  switch (action.assertionType) {
    case 'toBeVisible':   return [`await expect(${locator}).toBeVisible(${t});`];
    case 'toBeHidden':    return [`await expect(${locator}).toBeHidden(${t});`];
    case 'toHaveText':    return [`await expect(${locator}).toHaveText('${v}', ${t});`];
    case 'toContainText': return [`await expect(${locator}).toContainText('${v}', ${t});`];
    case 'toHaveValue':   return [`await expect(${locator}).toHaveValue('${v}', ${t});`];
    case 'toHaveURL':     return [`await expect(page).toHaveURL('${v}', ${t});`];
    case 'toHaveTitle':   return [`await expect(page).toHaveTitle('${v}', ${t});`];
    case 'toBeEnabled':   return [`await expect(${locator}).toBeEnabled(${t});`];
    case 'toBeDisabled':  return [`await expect(${locator}).toBeDisabled(${t});`];
    case 'toBeChecked':   return [`await expect(${locator}).toBeChecked(${t});`];
    case 'toHaveCount':   return [`await expect(${locator}).toHaveCount(${Number(action.assertionValue) || 0}, ${t});`];
    default:              return [`await expect(${locator}).toBeVisible(${t});`];
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
