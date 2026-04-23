import { Script, TestResult, AppSettings } from '../types';

const KEYS = {
  SCRIPTS: 'ppp_scripts',
  RESULTS: 'ppp_results',
  SETTINGS: 'ppp_settings',
};

export const DEFAULT_SETTINGS: AppSettings = {
  githubToken: '',
  githubRepo: '',
  githubBranch: 'main',
  localOutputPath: './generated-tests',
  screenshotsPath: './screenshots',
  companionServerUrl: 'http://localhost',
  companionServerPort: 3001,
  webhookSecret: '',
  webhookPort: 4001,
  enableWebhook: false,
  azureOrganization: '',
  azureProject: '',
  azurePAT: '',
  azurePipelineId: '',
  playwrightChannel: 'chrome',
  baseUrl: '',
  timeout: 30000,
  retries: 1,
  workers: 2,
  headless: false,
  theme: 'dark',
  language: 'typescript',
};

export async function getScripts(): Promise<Script[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(KEYS.SCRIPTS, (result) => {
      resolve(result[KEYS.SCRIPTS] || []);
    });
  });
}

export async function saveScript(script: Script): Promise<void> {
  const scripts = await getScripts();
  const index = scripts.findIndex((s) => s.id === script.id);
  if (index >= 0) {
    scripts[index] = script;
  } else {
    scripts.push(script);
  }
  return new Promise((resolve) => {
    chrome.storage.local.set({ [KEYS.SCRIPTS]: scripts }, resolve);
  });
}

export async function deleteScript(id: string): Promise<void> {
  const scripts = await getScripts();
  const filtered = scripts.filter((s) => s.id !== id);
  return new Promise((resolve) => {
    chrome.storage.local.set({ [KEYS.SCRIPTS]: filtered }, resolve);
  });
}

export async function getResults(): Promise<TestResult[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(KEYS.RESULTS, (result) => {
      resolve(result[KEYS.RESULTS] || []);
    });
  });
}

export async function saveResult(result: TestResult): Promise<void> {
  const results = await getResults();
  results.unshift(result);
  const trimmed = results.slice(0, 500);
  return new Promise((resolve) => {
    chrome.storage.local.set({ [KEYS.RESULTS]: trimmed }, resolve);
  });
}

export async function getSettings(): Promise<AppSettings> {
  return new Promise((resolve) => {
    chrome.storage.local.get(KEYS.SETTINGS, (result) => {
      resolve({ ...DEFAULT_SETTINGS, ...(result[KEYS.SETTINGS] || {}) });
    });
  });
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [KEYS.SETTINGS]: settings }, resolve);
  });
}

export async function clearResults(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(KEYS.RESULTS, resolve);
  });
}

export async function resetScriptStats(): Promise<void> {
  const scripts = await getScripts();
  const reset = scripts.map((s) => ({
    ...s,
    runCount: 0,
    passCount: 0,
    failCount: 0,
    avgDuration: 0,
    lastRunAt: undefined,
    lastRunStatus: undefined,
  }));
  return new Promise((resolve) => {
    chrome.storage.local.set({ [KEYS.SCRIPTS]: reset }, resolve);
  });
}
