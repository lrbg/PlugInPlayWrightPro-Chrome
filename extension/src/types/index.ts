export interface TestCase {
  id: string;
  number: string;
  name: string;
  description: string;
  steps: string;
  expectedResult: string;
  actualResult: string;
  status: 'pending' | 'pass' | 'fail' | 'skipped';
  createdAt: string;
  updatedAt: string;
  tags: string[];
  baseUrl: string;
}

export interface RecordedAction {
  id: string;
  type: ActionType;
  selector: string;
  value?: string;
  url?: string;
  description?: string;
  timestamp: number;
  screenshot?: string;
  screenshotDescription?: string;
  isAssertion?: boolean;
  assertionType?: AssertionType;
  assertionValue?: string;
  assertionDescription?: string;
}

export type ActionType =
  | 'navigate'
  | 'click'
  | 'fill'
  | 'select'
  | 'check'
  | 'uncheck'
  | 'hover'
  | 'press'
  | 'screenshot'
  | 'assertion'
  | 'wait';

export type AssertionType =
  | 'toBeVisible'
  | 'toBeHidden'
  | 'toHaveText'
  | 'toHaveValue'
  | 'toHaveURL'
  | 'toHaveTitle'
  | 'toBeEnabled'
  | 'toBeDisabled'
  | 'toHaveCount'
  | 'toContainText'
  | 'toBeChecked';

export interface Script {
  id: string;
  testCase: TestCase;
  actions: RecordedAction[];
  generatedCode: string;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  lastRunStatus?: 'pass' | 'fail' | 'running' | 'error';
  runCount: number;
  passCount: number;
  failCount: number;
  avgDuration?: number;
}

export interface TestResult {
  id: string;
  scriptId: string;
  scriptName: string;
  testCaseNumber: string;
  status: 'pass' | 'fail' | 'error';
  duration: number;
  startedAt: string;
  finishedAt: string;
  error?: string;
  source: 'local' | 'github-actions' | 'azure-devops' | 'webhook';
  screenshots: string[];
  retries: number;
}

export interface AppSettings {
  // Storage settings
  githubToken: string;
  githubRepo: string;
  githubBranch: string;
  localOutputPath: string;
  screenshotsPath: string;

  // Companion server
  companionServerUrl: string;
  companionServerPort: number;

  // Webhook
  webhookSecret: string;
  webhookPort: number;
  enableWebhook: boolean;

  // CI/CD
  azureOrganization: string;
  azureProject: string;
  azurePAT: string;
  azurePipelineId: string;

  // Playwright config
  playwrightChannel: 'chrome' | 'chromium' | 'msedge';
  baseUrl: string;
  timeout: number;
  retries: number;
  workers: number;
  headless: boolean;

  // General
  theme: 'dark' | 'light';
  language: string;
}

export type Tab = 'testcase' | 'recorder' | 'library' | 'dashboard' | 'settings';

export interface DashboardMetrics {
  totalScripts: number;
  totalRuns: number;
  passRate: number;
  failRate: number;
  avgDuration: number;
  lastRunAt?: string;
  recentResults: TestResult[];
  resultsByDay: { date: string; pass: number; fail: number }[];
}

export interface Message {
  type:
    | 'START_RECORDING'
    | 'STOP_RECORDING'
    | 'ACTION_RECORDED'
    | 'GET_STATUS'
    | 'STATUS_RESPONSE'
    | 'TAKE_SCREENSHOT'
    | 'SCREENSHOT_TAKEN';
  payload?: unknown;
}
