import React, { useState, useEffect } from 'react';
import { AppSettings } from '../../types';
import { getSettings, saveSettings } from '../../utils/storage';
import { generatePlaywrightConfig } from '../../utils/scriptGenerator';

interface Props {
  onSave: (settings: AppSettings) => void;
}

type SettingsSection = 'storage' | 'server' | 'playwright' | 'cicd' | 'webhook';

export function Settings({ onSave }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSection>('storage');
  const [testingServer, setTestingServer] = useState(false);
  const [serverStatus, setServerStatus] = useState<'unknown' | 'ok' | 'error'>('unknown');

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  if (!settings) return <div className="panel"><div className="loading">Loading…</div></div>;

  const set = (key: keyof AppSettings, value: unknown) =>
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev);

  const handleSave = async () => {
    if (!settings) return;
    await saveSettings(settings);
    onSave(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const testServer = async () => {
    setTestingServer(true);
    try {
      const url = `${settings.companionServerUrl}:${settings.companionServerPort}/health`;
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 4000)
      );
      const resp = await Promise.race([fetch(url), timeout]);
      setServerStatus(resp.ok ? 'ok' : 'error');
    } catch {
      setServerStatus('error');
    }
    setTestingServer(false);
  };

  const downloadConfig = () => {
    const config = generatePlaywrightConfig({
      channel: settings.playwrightChannel,
      baseUrl: settings.baseUrl,
      timeout: settings.timeout,
      retries: settings.retries,
      workers: settings.workers,
      headless: settings.headless,
    });
    const blob = new Blob([config], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'playwright.config.ts';
    a.click();
    URL.revokeObjectURL(url);
  };

  const sections: { id: SettingsSection; icon: string; label: string }[] = [
    { id: 'storage', icon: '💾', label: 'Storage' },
    { id: 'server', icon: '🖥️', label: 'Server' },
    { id: 'playwright', icon: '🎭', label: 'Playwright' },
    { id: 'cicd', icon: '🔄', label: 'CI/CD' },
    { id: 'webhook', icon: '🔗', label: 'Webhook' },
  ];

  const field = (
    key: keyof AppSettings,
    label: string,
    type: 'text' | 'number' | 'password' = 'text',
    placeholder = ''
  ) => (
    <div className="field">
      <label>{label}</label>
      <input
        type={type}
        value={settings[key] as string | number}
        onChange={(e) => set(key, type === 'number' ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-icon">⚙️</span>
        <h2>Settings</h2>
      </div>

      <div className="settings-tabs">
        {sections.map((s) => (
          <button
            key={s.id}
            className={`settings-tab ${activeSection === s.id ? 'active' : ''}`}
            onClick={() => setActiveSection(s.id)}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      <div className="settings-content">
        {activeSection === 'storage' && (
          <>
            <h3 className="section-title">GitHub Integration</h3>
            {field('githubToken', 'GitHub Token (PAT)', 'password', 'ghp_...')}
            {field('githubRepo', 'Repository', 'text', 'owner/repo-name')}
            {field('githubBranch', 'Branch', 'text', 'main')}
            {field('localOutputPath', 'Tests Path in Repo', 'text', 'tests/e2e')}
            <h3 className="section-title" style={{ marginTop: 16 }}>Local Storage</h3>
            {field('screenshotsPath', 'Screenshots Path', 'text', 'screenshots')}
          </>
        )}

        {activeSection === 'server' && (
          <>
            <h3 className="section-title">Companion Server</h3>
            <div className="info-banner">
              The companion server is a local Node.js app that runs Playwright tests on your machine.
              Start it with <code>npm start</code> in the <code>companion-server</code> folder.
            </div>
            {field('companionServerUrl', 'Server URL', 'text', 'http://localhost')}
            {field('companionServerPort', 'Port', 'number', '3001')}
            <div className="field">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  className="btn btn-secondary"
                  onClick={testServer}
                  disabled={testingServer}
                >
                  {testingServer ? '⏳ Testing…' : '🔌 Test Connection'}
                </button>
                {serverStatus === 'ok' && <span style={{ color: '#22c55e' }}>✓ Connected</span>}
                {serverStatus === 'error' && <span style={{ color: '#ef4444' }}>✗ Not reachable</span>}
              </div>
            </div>
          </>
        )}

        {activeSection === 'playwright' && (
          <>
            <h3 className="section-title">Playwright Configuration</h3>
            {field('baseUrl', 'Base URL', 'text', 'https://example.com')}
            <div className="field">
              <label>Browser Channel</label>
              <select
                value={settings.playwrightChannel}
                onChange={(e) => set('playwrightChannel', e.target.value)}
              >
                <option value="chrome">Google Chrome</option>
                <option value="chromium">Chromium</option>
                <option value="msedge">Microsoft Edge</option>
              </select>
            </div>
            {field('timeout', 'Timeout (ms)', 'number', '30000')}
            {field('retries', 'Retries', 'number', '1')}
            {field('workers', 'Workers', 'number', '2')}
            <div className="field">
              <label>Headless</label>
              <select
                value={settings.headless ? 'true' : 'false'}
                onChange={(e) => set('headless', e.target.value === 'true')}
              >
                <option value="false">No (show browser)</option>
                <option value="true">Yes (headless)</option>
              </select>
            </div>
            <button className="btn btn-secondary" onClick={downloadConfig}>
              📥 Download playwright.config.ts
            </button>
          </>
        )}

        {activeSection === 'cicd' && (
          <>
            <h3 className="section-title">Azure DevOps</h3>
            {field('azureOrganization', 'Organization', 'text', 'my-org')}
            {field('azureProject', 'Project', 'text', 'my-project')}
            {field('azurePAT', 'Personal Access Token', 'password', 'PAT token...')}
            {field('azurePipelineId', 'Pipeline ID', 'text', '123')}
            <h3 className="section-title" style={{ marginTop: 16 }}>GitHub Actions</h3>
            <div className="info-banner">
              GitHub Actions uses the token configured in the Storage section.
              The workflow file is already in <code>.github/workflows/playwright.yml</code>.
            </div>
          </>
        )}

        {activeSection === 'webhook' && (
          <>
            <h3 className="section-title">Webhook for CI/CD Results</h3>
            <div className="info-banner">
              Configure your CI/CD to POST results to the companion server webhook endpoint.
              The companion server will forward results to the extension's dashboard.
            </div>
            <div className="field">
              <label>Enable Webhook</label>
              <select
                value={settings.enableWebhook ? 'true' : 'false'}
                onChange={(e) => set('enableWebhook', e.target.value === 'true')}
              >
                <option value="false">Disabled</option>
                <option value="true">Enabled</option>
              </select>
            </div>
            {field('webhookPort', 'Webhook Port', 'number', '4001')}
            {field('webhookSecret', 'Webhook Secret', 'password', 'your-secret')}
            <div className="info-banner">
              <strong>Webhook URL:</strong>{' '}
              <code>
                {settings.companionServerUrl}:{settings.companionServerPort}/webhook
              </code>
              <br />
              <strong>Headers:</strong> <code>X-Webhook-Secret: your-secret</code>
            </div>
          </>
        )}
      </div>

      <div className="form-actions">
        <button className={`btn btn-primary ${saved ? 'btn-success' : ''}`} onClick={handleSave}>
          {saved ? '✓ Saved' : '💾 Save Settings'}
        </button>
      </div>
    </div>
  );
}
