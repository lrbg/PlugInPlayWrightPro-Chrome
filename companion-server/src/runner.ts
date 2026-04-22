import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface RunResult {
  status: 'pass' | 'fail' | 'error';
  duration: number;
  output: string;
  error?: string;
  screenshots?: string[];
}

const CONFIG_PATH = path.join(process.cwd(), '..', 'playwright.config.ts');
const FALLBACK_CONFIG = path.join(process.cwd(), 'playwright.config.ts');

function getConfigPath(): string {
  if (fs.existsSync(CONFIG_PATH)) return CONFIG_PATH;
  if (fs.existsSync(FALLBACK_CONFIG)) return FALLBACK_CONFIG;
  return '';
}

export function runTest(testFilePath: string, baseUrl?: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const configPath = getConfigPath();

    const args = ['playwright', 'test', testFilePath, '--reporter=json'];
    if (configPath) args.push(`--config=${configPath}`);

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...(baseUrl ? { BASE_URL: baseUrl } : {}),
    };

    const proc = spawn('npx', args, {
      cwd: path.dirname(testFilePath),
      env,
      shell: process.platform === 'win32',
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      const duration = Date.now() - startTime;
      const output = stdout + stderr;

      if (code === 0) {
        resolve({ status: 'pass', duration, output });
      } else {
        const errorMatch = output.match(/Error:\s*(.+)/);
        const errorMsg = errorMatch ? errorMatch[1] : `Exit code: ${code}`;
        resolve({ status: 'fail', duration, output, error: errorMsg.slice(0, 500) });
      }
    });

    proc.on('error', (err) => {
      const duration = Date.now() - startTime;
      resolve({
        status: 'error',
        duration,
        output: err.message,
        error: `Failed to start Playwright: ${err.message}. Make sure @playwright/test is installed.`,
      });
    });

    // Timeout safety: 5 minutes
    setTimeout(() => {
      proc.kill();
      resolve({
        status: 'error',
        duration: Date.now() - startTime,
        output: 'Test timed out after 5 minutes',
        error: 'Timeout',
      });
    }, 300_000);
  });
}
