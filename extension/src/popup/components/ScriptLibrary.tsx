import React, { useState, useEffect } from 'react';
import { Script, TestResult } from '../../types';
import { getScripts, deleteScript, getResults } from '../../utils/storage';
import { generateHTMLReport } from '../../utils/reportGenerator';

interface Props {
  onEditScript: (script: Script) => void;
  onRunScript: (script: Script, headless: boolean) => Promise<void>;
  companionUrl: string;
  refreshKey: number;
}

export function ScriptLibrary({ onEditScript, onRunScript, companionUrl, refreshKey }: Props) {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [results, setResults] = useState<TestResult[]>([]);
  const [search, setSearch] = useState('');
  const [running, setRunning] = useState<string | null>(null);
  const [serverOnline, setServerOnline] = useState(false);
  const [serverChecking, setServerChecking] = useState(false);
  const [headless, setHeadless] = useState(false);

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  // Check server on mount + whenever companionUrl changes + poll every 10s
  useEffect(() => {
    checkServer();
    const interval = setInterval(checkServer, 10_000);
    return () => clearInterval(interval);
  }, [companionUrl]);

  const loadData = async () => {
    const [s, r] = await Promise.all([getScripts(), getResults()]);
    setScripts(s);
    setResults(r);
  };

  const checkServer = async () => {
    if (serverChecking) return;
    setServerChecking(true);
    try {
      // AbortSignal.timeout may be unreliable in extension context — use Promise.race
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 4000)
      );
      const fetchPromise = fetch(`${companionUrl}/health`);
      const resp = await Promise.race([fetchPromise, timeoutPromise]);
      setServerOnline(resp.ok);
    } catch {
      setServerOnline(false);
    } finally {
      setServerChecking(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this script?')) return;
    await deleteScript(id);
    await loadData();
  };

  const handleRun = async (script: Script) => {
    setRunning(script.id);
    try {
      await onRunScript(script, headless);
    } finally {
      setRunning(null);
      await loadData();
    }
  };

  const handleExportScript = (script: Script) => {
    const blob = new Blob([script.generatedCode], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${script.testCase.number}-${slugify(script.testCase.name)}.spec.ts`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportReport = async (script: Script) => {
    const scriptResults = results.filter((r) => r.scriptId === script.id);
    const html = generateHTMLReport(script, scriptResults);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${script.testCase.number}-${slugify(script.testCase.name)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePushToGitHub = async (script: Script) => {
    try {
      const settings = await chrome.storage.local.get('ppp_settings');
      const s = settings['ppp_settings'] || {};
      if (!s.githubToken || !s.githubRepo) {
        alert('Configure GitHub token and repo in Settings first.');
        return;
      }
      const filename = `${script.testCase.number}-${slugify(script.testCase.name)}.spec.ts`;
      const path = `${s.localOutputPath || 'tests'}/${filename}`;
      const content = btoa(script.generatedCode);
      const apiUrl = `https://api.github.com/repos/${s.githubRepo}/contents/${path}`;

      let sha: string | undefined;
      try {
        const existing = await fetch(apiUrl, {
          headers: { Authorization: `token ${s.githubToken}` },
        });
        if (existing.ok) {
          const data = await existing.json();
          sha = data.sha;
        }
      } catch {}

      const body: Record<string, unknown> = {
        message: `Add/Update test: ${script.testCase.number} - ${script.testCase.name}`,
        content,
        branch: s.githubBranch || 'main',
      };
      if (sha) body.sha = sha;

      const resp = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          Authorization: `token ${s.githubToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (resp.ok) {
        alert(`✅ Pushed to GitHub: ${s.githubRepo}/${path}`);
      } else {
        const err = await resp.json();
        alert(`❌ GitHub error: ${err.message}`);
      }
    } catch (err) {
      alert(`❌ Error: ${err}`);
    }
  };

  const filtered = scripts.filter(
    (s) =>
      s.testCase.name.toLowerCase().includes(search.toLowerCase()) ||
      s.testCase.number.toLowerCase().includes(search.toLowerCase()) ||
      s.testCase.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const getLastResult = (scriptId: string): TestResult | undefined =>
    results.find((r) => r.scriptId === scriptId);

  const statusBadge = (status?: string) => {
    if (!status) return <span className="badge badge-pending">Not Run</span>;
    return <span className={`badge badge-${status}`}>{status.toUpperCase()}</span>;
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-icon">📚</span>
        <h2>Script Library</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <div className="server-status">
            <span className={`dot ${serverOnline ? 'dot-green' : 'dot-red'}`} />
            <span className="server-label">{serverOnline ? 'Server Online' : 'Server Offline'}</span>
          </div>
          <select
            value={headless ? 'headless' : 'headed'}
            onChange={(e) => setHeadless(e.target.value === 'headless')}
            title="Browser visibility when running tests"
            style={{ fontSize: 11, padding: '2px 4px', borderRadius: 4, border: '1px solid #555', background: '#2a2a2a', color: '#ccc', cursor: 'pointer' }}
          >
            <option value="headed">👁 Visible</option>
            <option value="headless">🙈 Headless</option>
          </select>
        </div>
      </div>

      {!serverOnline && (
        <div className="warning-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span>
            {serverChecking
              ? '⏳ Checking companion server…'
              : `⚠️ Server offline — run: bash start-server.sh  (port 3001)`}
          </span>
          {!serverChecking && (
            <button className="btn btn-xs btn-secondary" onClick={checkServer} style={{ flexShrink: 0 }}>
              🔄 Retry
            </button>
          )}
        </div>
      )}

      <div className="search-bar">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by number, name or tag..."
        />
        <span className="search-count">{filtered.length} scripts</span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          {scripts.length === 0
            ? 'No scripts saved yet. Create a test case and record actions.'
            : 'No scripts match your search.'}
        </div>
      ) : (
        <div className="script-list">
          {filtered.map((script) => {
            const lastResult = getLastResult(script.id);
            const isRunning = running === script.id;
            return (
              <div key={script.id} className="script-card">
                <div className="script-card-header">
                  <div className="script-card-title">
                    <span className="tc-number">{script.testCase.number}</span>
                    <span className="tc-name">{script.testCase.name}</span>
                  </div>
                  {statusBadge(lastResult?.status)}
                </div>

                <div className="script-card-meta">
                  <span>📅 {new Date(script.updatedAt).toLocaleDateString()}</span>
                  <span>🔄 {script.runCount} runs</span>
                  {script.runCount > 0 && (
                    <span>✅ {Math.round((script.passCount / script.runCount) * 100)}% pass</span>
                  )}
                </div>

                {script.testCase.tags?.length > 0 && (
                  <div className="tags">
                    {script.testCase.tags.map((t) => (
                      <span key={t} className="tag">{t}</span>
                    ))}
                  </div>
                )}

                <div className="script-card-actions">
                  <button
                    className="btn btn-xs btn-primary"
                    onClick={() => handleRun(script)}
                    disabled={!serverOnline || isRunning}
                    title={serverOnline ? 'Run locally' : 'Companion server required'}
                  >
                    {isRunning ? '⏳ Running…' : '▶ Run'}
                  </button>
                  <button className="btn btn-xs btn-secondary" onClick={() => onEditScript(script)}>
                    ✏️ Edit
                  </button>
                  <button className="btn btn-xs btn-secondary" onClick={() => handleExportScript(script)}>
                    📥 .spec.ts
                  </button>
                  <button className="btn btn-xs btn-secondary" onClick={() => handleExportReport(script)}>
                    📄 Report
                  </button>
                  <button className="btn btn-xs btn-secondary" onClick={() => handlePushToGitHub(script)}>
                    🐙 GitHub
                  </button>
                  <button className="btn btn-xs btn-danger" onClick={() => handleDelete(script.id)}>
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
