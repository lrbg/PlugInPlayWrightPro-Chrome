import { Script, TestResult } from '../types';

export function generateHTMLReport(script: Script, results?: TestResult[]): string {
  const lastResult = results?.[0];
  const statusColor = lastResult?.status === 'pass' ? '#22c55e' : lastResult?.status === 'fail' ? '#ef4444' : '#f59e0b';
  const statusText = lastResult?.status?.toUpperCase() || 'NOT RUN';

  const actionRows = script.actions
    .map((action, index) => {
      const icon = getActionIcon(action.type);
      const desc = action.description || getActionDescription(action);
      const screenshotHtml = action.screenshot
        ? `<div class="screenshot-container">
            <img src="${action.screenshot}" alt="Screenshot" class="screenshot-img" />
            ${action.screenshotDescription ? `<p class="screenshot-desc">${action.screenshotDescription}</p>` : ''}
           </div>`
        : '';
      return `
        <tr class="action-row ${action.isAssertion ? 'assertion-row' : ''}">
          <td>${index + 1}</td>
          <td>${icon} ${action.type}</td>
          <td>${desc}</td>
          <td><code>${action.selector || action.url || ''}</code></td>
          <td>${action.value || action.assertionValue || ''}</td>
          <td>${screenshotHtml}</td>
        </tr>`;
    })
    .join('');

  const resultRows = (results || [])
    .slice(0, 10)
    .map(
      (r) => `
      <tr>
        <td>${r.startedAt}</td>
        <td><span class="badge badge-${r.status}">${r.status.toUpperCase()}</span></td>
        <td>${formatDuration(r.duration)}</td>
        <td>${r.source}</td>
        <td>${r.error ? `<span class="error-text">${r.error}</span>` : '—'}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Report: ${script.testCase.number} - ${script.testCase.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e40af, #7c3aed); padding: 30px; border-radius: 12px; margin-bottom: 24px; }
    .header h1 { font-size: 1.8rem; margin-bottom: 8px; }
    .header .meta { display: flex; gap: 20px; flex-wrap: wrap; margin-top: 12px; opacity: 0.9; font-size: 0.9rem; }
    .status-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-weight: bold; font-size: 1rem; background: ${statusColor}22; color: ${statusColor}; border: 1px solid ${statusColor}; }
    .section { background: #1e293b; border-radius: 10px; padding: 20px; margin-bottom: 20px; border: 1px solid #334155; }
    .section h2 { font-size: 1.1rem; color: #94a3b8; margin-bottom: 16px; border-bottom: 1px solid #334155; padding-bottom: 8px; }
    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .info-item label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    .info-item p { margin-top: 4px; color: #e2e8f0; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th { background: #0f172a; color: #94a3b8; padding: 10px; text-align: left; border-bottom: 1px solid #334155; }
    td { padding: 10px; border-bottom: 1px solid #1e293b; vertical-align: top; }
    tr:hover td { background: #1e293b; }
    .assertion-row td { background: #1e3a5f22; }
    code { background: #0f172a; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; color: #7dd3fc; word-break: break-all; }
    .badge { padding: 3px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: bold; }
    .badge-pass { background: #16653422; color: #22c55e; }
    .badge-fail { background: #7f1d1d22; color: #ef4444; }
    .badge-error { background: #78350f22; color: #f59e0b; }
    .error-text { color: #ef4444; font-size: 0.8rem; }
    .screenshot-img { max-width: 200px; max-height: 150px; border-radius: 6px; border: 1px solid #334155; cursor: pointer; }
    .screenshot-desc { font-size: 0.75rem; color: #94a3b8; margin-top: 4px; }
    .screenshot-img:hover { transform: scale(1.05); transition: transform 0.2s; }
    .stats { display: flex; gap: 16px; flex-wrap: wrap; }
    .stat { background: #0f172a; border-radius: 8px; padding: 16px; flex: 1; min-width: 120px; text-align: center; }
    .stat .value { font-size: 1.8rem; font-weight: bold; color: #7c3aed; }
    .stat .label { font-size: 0.75rem; color: #64748b; margin-top: 4px; }
    .footer { text-align: center; color: #475569; font-size: 0.8rem; margin-top: 30px; }
    @media print { body { background: white; color: black; } .section { border: 1px solid #ccc; } code { background: #f1f5f9; color: #0369a1; } }
  </style>
</head>
<body>
  <div class="header">
    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
      <div>
        <h1>🎭 PlaywrightPro Report</h1>
        <h2 style="font-size:1.2rem; opacity:0.9;">${script.testCase.number}: ${script.testCase.name}</h2>
      </div>
      <span class="status-badge">${statusText}</span>
    </div>
    <div class="meta">
      <span>📅 Generated: ${new Date().toLocaleString()}</span>
      <span>⏱ Duration: ${lastResult ? formatDuration(lastResult.duration) : 'N/A'}</span>
      <span>🔄 Runs: ${script.runCount}</span>
      <span>✅ Pass: ${script.passCount} | ❌ Fail: ${script.failCount}</span>
    </div>
  </div>

  <div class="section">
    <h2>📋 Test Case Info</h2>
    <div class="info-grid">
      <div class="info-item"><label>Number</label><p>${script.testCase.number}</p></div>
      <div class="info-item"><label>Name</label><p>${script.testCase.name}</p></div>
      <div class="info-item"><label>Status</label><p>${script.testCase.status}</p></div>
      <div class="info-item"><label>Base URL</label><p>${script.testCase.baseUrl || '—'}</p></div>
    </div>
    <div style="margin-top:16px;">
      <div class="info-item" style="margin-bottom:12px;"><label>Description</label><p style="margin-top:4px;">${script.testCase.description || '—'}</p></div>
      <div class="info-item" style="margin-bottom:12px;"><label>Steps</label><p style="margin-top:4px; white-space:pre-wrap;">${script.testCase.steps || '—'}</p></div>
      <div class="info-item" style="margin-bottom:12px;"><label>Expected Result</label><p style="margin-top:4px;">${script.testCase.expectedResult || '—'}</p></div>
      <div class="info-item"><label>Actual Result</label><p style="margin-top:4px;">${script.testCase.actualResult || '—'}</p></div>
    </div>
  </div>

  <div class="section">
    <h2>📊 Statistics</h2>
    <div class="stats">
      <div class="stat"><div class="value">${script.runCount}</div><div class="label">Total Runs</div></div>
      <div class="stat"><div class="value" style="color:#22c55e">${script.passCount}</div><div class="label">Passed</div></div>
      <div class="stat"><div class="value" style="color:#ef4444">${script.failCount}</div><div class="label">Failed</div></div>
      <div class="stat"><div class="value">${script.runCount > 0 ? Math.round((script.passCount / script.runCount) * 100) : 0}%</div><div class="label">Pass Rate</div></div>
      <div class="stat"><div class="value">${script.avgDuration ? formatDuration(script.avgDuration) : 'N/A'}</div><div class="label">Avg Duration</div></div>
    </div>
  </div>

  <div class="section">
    <h2>🔄 Recorded Actions (${script.actions.length})</h2>
    <table>
      <thead>
        <tr><th>#</th><th>Type</th><th>Description</th><th>Selector / URL</th><th>Value</th><th>Evidence</th></tr>
      </thead>
      <tbody>${actionRows}</tbody>
    </table>
  </div>

  ${results && results.length > 0 ? `
  <div class="section">
    <h2>📈 Run History</h2>
    <table>
      <thead><tr><th>Date</th><th>Status</th><th>Duration</th><th>Source</th><th>Error</th></tr></thead>
      <tbody>${resultRows}</tbody>
    </table>
  </div>` : ''}

  <div class="section">
    <h2>📝 Generated Script</h2>
    <pre style="background:#0f172a; padding:16px; border-radius:8px; overflow-x:auto; font-size:0.8rem; color:#a5f3fc; border:1px solid #334155;"><code>${escapeHtml(script.generatedCode)}</code></pre>
  </div>

  <div class="footer">
    <p>Generated by PlaywrightPro Chrome Extension | ${new Date().toISOString()}</p>
  </div>
</body>
</html>`;
}

function getActionIcon(type: string): string {
  const icons: Record<string, string> = {
    navigate: '🌐', click: '👆', fill: '⌨️', select: '📋',
    check: '☑️', uncheck: '⬜', hover: '🖱️', press: '⌨️',
    screenshot: '📸', assertion: '✅', wait: '⏳',
  };
  return icons[type] || '▶️';
}

function getActionDescription(action: { type: string; selector: string; value?: string; url?: string }): string {
  switch (action.type) {
    case 'navigate': return `Go to ${action.url}`;
    case 'click': return `Click on ${action.selector}`;
    case 'fill': return `Type "${action.value}" in ${action.selector}`;
    case 'select': return `Select "${action.value}" in ${action.selector}`;
    default: return `${action.type} ${action.selector || ''}`;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
