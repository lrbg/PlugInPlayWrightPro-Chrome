import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import { runTest } from './runner';
import { handleWebhook } from './webhook';

const app = express();
const PORT = process.env.PORT || 3001;
const TESTS_DIR = process.env.TESTS_DIR || path.join(process.cwd(), '..', 'generated-tests');
const RESULTS_DIR = path.join(process.cwd(), 'test-results');

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

fs.mkdirSync(TESTS_DIR, { recursive: true });
fs.mkdirSync(RESULTS_DIR, { recursive: true });
fs.mkdirSync(path.join(process.cwd(), 'screenshots'), { recursive: true });

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    testsDir: TESTS_DIR,
    timestamp: new Date().toISOString(),
  });
});

// Run a test
app.post('/run', async (req: Request, res: Response) => {
  const { scriptId, testCaseNumber, scriptName, code, baseUrl } = req.body as {
    scriptId: string;
    testCaseNumber: string;
    scriptName: string;
    code: string;
    baseUrl?: string;
  };

  if (!code) {
    res.status(400).json({ error: 'code is required' });
    return;
  }

  const filename = `${testCaseNumber || 'test'}-${Date.now()}.spec.ts`;
  const filePath = path.join(TESTS_DIR, filename);

  try {
    fs.writeFileSync(filePath, code, 'utf-8');

    const result = await runTest(filePath, baseUrl);

    // Persist result
    const resultFile = path.join(RESULTS_DIR, `${scriptId || 'result'}-${Date.now()}.json`);
    fs.writeFileSync(resultFile, JSON.stringify({ ...result, scriptId, testCaseNumber, scriptName }, null, 2));

    res.json(result);
  } catch (err) {
    res.status(500).json({ status: 'error', error: String(err), duration: 0 });
  } finally {
    try { fs.unlinkSync(filePath); } catch {}
  }
});

// Run a saved test file by path
app.post('/run-file', async (req: Request, res: Response) => {
  const { filePath, baseUrl } = req.body as { filePath: string; baseUrl?: string };
  if (!filePath || !fs.existsSync(filePath)) {
    res.status(400).json({ error: 'File not found' });
    return;
  }
  const result = await runTest(filePath, baseUrl);
  res.json(result);
});

// Save a test file to disk
app.post('/save', (req: Request, res: Response) => {
  const { filename, code, directory } = req.body as {
    filename: string;
    code: string;
    directory?: string;
  };
  const targetDir = directory ? path.resolve(directory) : TESTS_DIR;
  fs.mkdirSync(targetDir, { recursive: true });
  const filePath = path.join(targetDir, filename);
  fs.writeFileSync(filePath, code, 'utf-8');
  res.json({ success: true, path: filePath });
});

// List saved test files
app.get('/tests', (_req: Request, res: Response) => {
  const files = fs.readdirSync(TESTS_DIR).filter((f) => f.endsWith('.spec.ts'));
  res.json({ files, count: files.length });
});

// Get recent results
app.get('/results', (_req: Request, res: Response) => {
  const files = fs.readdirSync(RESULTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, 50);

  const results = files.map((f) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, f), 'utf-8'));
    } catch {
      return null;
    }
  }).filter(Boolean);

  res.json({ results });
});

// Webhook endpoint for CI/CD results
app.post('/webhook', handleWebhook);

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`\n🎭 PlaywrightPro Companion Server`);
  console.log(`   Port:      ${PORT}`);
  console.log(`   Tests dir: ${TESTS_DIR}`);
  console.log(`   Results:   ${RESULTS_DIR}`);
  console.log(`   Health:    http://localhost:${PORT}/health\n`);
});

export { app };
