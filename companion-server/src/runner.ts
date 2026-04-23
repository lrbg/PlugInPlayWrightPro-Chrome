import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface RunResult {
  status: 'pass' | 'fail' | 'error';
  duration: number;
  output: string;
  error?: string;
}

// __dirname = companion-server/dist — two levels up reaches the project root
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

function getConfigPath(): string {
  const candidates = [
    path.join(PROJECT_ROOT, 'playwright.config.ts'),
    path.join(PROJECT_ROOT, 'playwright.config.js'),
    path.join(__dirname, '..', '..', 'playwright.config.ts'),
  ];
  return candidates.find(fs.existsSync) || '';
}

function getNpxBin(): string {
  // Use the npx that belongs to the same Node.js running this server
  // This guarantees the correct Node version (18+) is used for Playwright
  const nodeDir = path.dirname(process.execPath);
  const npx = path.join(nodeDir, 'npx');
  return fs.existsSync(npx) ? npx : 'npx';
}

export function runTest(
  testFilePath: string,
  baseUrl?: string,
  headless = false
): Promise<RunResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const configPath = getConfigPath();
    const absoluteTestPath = path.resolve(testFilePath);
    const npxBin = getNpxBin();

    // Ensure screenshots dir exists relative to project root
    fs.mkdirSync(path.join(PROJECT_ROOT, 'screenshots'), { recursive: true });

    const args = [
      'playwright',
      'test',
      absoluteTestPath,
      '--reporter=list',
      '--project=chrome',
    ];
    if (!headless) args.push('--headed');
    if (configPath) args.push(`--config=${configPath}`);

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...(baseUrl ? { BASE_URL: baseUrl } : {}),
    };

    console.log(`[runner] node: ${process.execPath} (${process.version})`);
    console.log(`[runner] npx:  ${npxBin}`);
    console.log(`[runner] cwd:  ${PROJECT_ROOT}`);
    console.log(`[runner] test: ${absoluteTestPath}`);
    console.log(`[runner] cfg:  ${configPath || 'none'}`);

    // shell:false is required on macOS — shell:true uses /bin/sh via PATH which may not exist
    const proc = spawn(npxBin, args, {
      cwd: PROJECT_ROOT,
      env,
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      process.stdout.write(chunk);
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      process.stderr.write(chunk);
    });

    proc.on('close', (code) => {
      const duration = Date.now() - startTime;
      const output = stdout + stderr;

      if (code === 0) {
        resolve({ status: 'pass', duration, output });
        return;
      }

      // Build a concise error message from Playwright output
      const lines = output.split('\n');
      const errorLines = lines
        .filter((l) =>
          l.match(/Error:|✗|×|FAILED|expect\(|TimeoutError|locator|Could not find/i)
        )
        .slice(0, 6)
        .join(' | ')
        .trim();

      resolve({
        status: 'fail',
        duration,
        output,
        error: errorLines || `Exit code ${code} — check companion server logs for full output`,
      });
    });

    proc.on('error', (err) => {
      console.error('[runner] spawn error:', err.message);
      resolve({
        status: 'error',
        duration: Date.now() - startTime,
        output: err.message,
        error: `Cannot launch Playwright: ${err.message}. Run 'npx playwright install' in the project root.`,
      });
    });

    const timeout = setTimeout(() => {
      proc.kill();
      resolve({
        status: 'error',
        duration: Date.now() - startTime,
        output: 'Timed out',
        error: 'Test timed out after 5 minutes',
      });
    }, 300_000);

    proc.on('close', () => clearTimeout(timeout));
  });
}
