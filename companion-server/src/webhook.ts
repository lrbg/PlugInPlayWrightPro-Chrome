import { Request, Response } from 'express';
import * as crypto from 'crypto';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

interface WebhookPayload {
  scriptId: string;
  testCaseNumber: string;
  scriptName: string;
  status: 'pass' | 'fail' | 'error';
  duration: number;
  startedAt: string;
  finishedAt: string;
  error?: string;
  source: 'github-actions' | 'azure-devops' | 'webhook';
  retries?: number;
  screenshots?: string[];
}

const recentWebhookResults: WebhookPayload[] = [];

export function handleWebhook(req: Request, res: Response): void {
  // Verify secret if configured
  if (WEBHOOK_SECRET) {
    const signature = req.headers['x-webhook-secret'];
    if (!signature || signature !== WEBHOOK_SECRET) {
      res.status(401).json({ error: 'Invalid webhook secret' });
      return;
    }
  }

  const payload = req.body as WebhookPayload;

  if (!payload.status || !['pass', 'fail', 'error'].includes(payload.status)) {
    res.status(400).json({ error: 'Invalid payload: status must be pass, fail, or error' });
    return;
  }

  recentWebhookResults.unshift({
    ...payload,
    source: payload.source || 'webhook',
  });

  if (recentWebhookResults.length > 100) {
    recentWebhookResults.splice(100);
  }

  console.log(`📥 Webhook received: ${payload.testCaseNumber} - ${payload.status.toUpperCase()}`);

  res.json({ success: true, received: new Date().toISOString() });
}

export function getWebhookResults(): WebhookPayload[] {
  return recentWebhookResults;
}

export function generateHmacSignature(secret: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}
