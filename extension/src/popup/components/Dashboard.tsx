import React, { useState, useEffect } from 'react';
import { Script, TestResult, DashboardMetrics } from '../../types';
import { getScripts, getResults, clearResults, resetScriptStats } from '../../utils/storage';

interface Props {
  refreshKey: number;
}

export function Dashboard({ refreshKey }: Props) {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalScripts: 0,
    totalRuns: 0,
    passRate: 0,
    failRate: 0,
    avgDuration: 0,
    recentResults: [],
    resultsByDay: [],
  });
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, [refreshKey]);

  const handleClear = async () => {
    if (!confirm('Clear all test results and reset script stats? This cannot be undone.')) return;
    await Promise.all([clearResults(), resetScriptStats()]);
    loadMetrics();
  };

  const loadMetrics = async () => {
    setLoading(true);
    const [scriptList, resultList] = await Promise.all([getScripts(), getResults()]);
    setScripts(scriptList);

    const totalRuns = resultList.length;
    const passResults = resultList.filter((r) => r.status === 'pass');
    const failResults = resultList.filter((r) => r.status !== 'pass');
    const avgDuration =
      totalRuns > 0
        ? resultList.reduce((sum, r) => sum + (r.duration || 0), 0) / totalRuns
        : 0;

    const dayMap: Record<string, { pass: number; fail: number }> = {};
    const last7 = resultList.slice(0, 50);
    for (const r of last7) {
      const date = r.startedAt.split('T')[0];
      if (!dayMap[date]) dayMap[date] = { pass: 0, fail: 0 };
      if (r.status === 'pass') dayMap[date].pass++;
      else dayMap[date].fail++;
    }
    const resultsByDay = Object.entries(dayMap)
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7);

    setMetrics({
      totalScripts: scriptList.length,
      totalRuns,
      passRate: totalRuns > 0 ? (passResults.length / totalRuns) * 100 : 0,
      failRate: totalRuns > 0 ? (failResults.length / totalRuns) * 100 : 0,
      avgDuration,
      lastRunAt: resultList[0]?.startedAt,
      recentResults: resultList.slice(0, 10),
      resultsByDay,
    });
    setLoading(false);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const barWidth = (count: number, max: number) => {
    if (max === 0) return '0%';
    return `${Math.max(4, (count / max) * 100)}%`;
  };

  const maxDay = Math.max(...metrics.resultsByDay.map((d) => d.pass + d.fail), 1);

  const topScripts = scripts
    .filter((s) => s.runCount > 0)
    .sort((a, b) => b.runCount - a.runCount)
    .slice(0, 5);

  if (loading) return <div className="panel"><div className="loading">Loading metrics…</div></div>;

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-icon">📊</span>
        <h2>Dashboard</h2>
        {metrics.lastRunAt && (
          <span className="last-run">Last run: {new Date(metrics.lastRunAt).toLocaleString()}</span>
        )}
        <button
          className="btn btn-danger btn-sm"
          onClick={handleClear}
          title="Clear all results and reset stats"
          style={{ marginLeft: 'auto' }}
        >
          Clear Metrics
        </button>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-value">{metrics.totalScripts}</div>
          <div className="metric-label">Total Scripts</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{metrics.totalRuns}</div>
          <div className="metric-label">Total Runs</div>
        </div>
        <div className="metric-card metric-pass">
          <div className="metric-value">{metrics.passRate.toFixed(1)}%</div>
          <div className="metric-label">Pass Rate</div>
        </div>
        <div className="metric-card metric-fail">
          <div className="metric-value">{metrics.failRate.toFixed(1)}%</div>
          <div className="metric-label">Fail Rate</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{formatDuration(metrics.avgDuration)}</div>
          <div className="metric-label">Avg Duration</div>
        </div>
      </div>

      {metrics.resultsByDay.length > 0 && (
        <div className="chart-section">
          <h3 className="section-title">Results (Last 7 Days)</h3>
          <div className="bar-chart">
            {metrics.resultsByDay.map((day) => (
              <div key={day.date} className="bar-group">
                <div className="bars">
                  <div
                    className="bar bar-pass"
                    style={{ height: barWidth(day.pass, maxDay) }}
                    title={`Pass: ${day.pass}`}
                  />
                  <div
                    className="bar bar-fail"
                    style={{ height: barWidth(day.fail, maxDay) }}
                    title={`Fail: ${day.fail}`}
                  />
                </div>
                <div className="bar-label">{day.date.slice(5)}</div>
              </div>
            ))}
          </div>
          <div className="chart-legend">
            <span><span className="legend-dot dot-green" />Pass</span>
            <span><span className="legend-dot dot-red" />Fail</span>
          </div>
        </div>
      )}

      {topScripts.length > 0 && (
        <div className="section-card">
          <h3 className="section-title">Top Scripts by Runs</h3>
          {topScripts.map((s) => (
            <div key={s.id} className="script-metric-row">
              <div className="script-metric-info">
                <span className="tc-number">{s.testCase.number}</span>
                <span className="tc-name-sm">{s.testCase.name}</span>
              </div>
              <div className="script-metric-stats">
                <span className="metric-runs">{s.runCount} runs</span>
                <div className="pass-bar-container">
                  <div
                    className="pass-bar"
                    style={{ width: `${s.runCount > 0 ? (s.passCount / s.runCount) * 100 : 0}%` }}
                  />
                </div>
                <span className="metric-pct">
                  {s.runCount > 0 ? Math.round((s.passCount / s.runCount) * 100) : 0}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {metrics.recentResults.length > 0 && (
        <div className="section-card">
          <h3 className="section-title">Recent Results</h3>
          {metrics.recentResults.map((r) => (
            <div key={r.id} className={`result-row result-${r.status}`}>
              <div className="result-info">
                <span className={`badge badge-${r.status}`}>{r.status.toUpperCase()}</span>
                <span className="result-name">{r.testCaseNumber}: {r.scriptName}</span>
              </div>
              <div className="result-meta">
                <span>{formatDuration(r.duration)}</span>
                <span className="result-source">{r.source}</span>
                <span>{new Date(r.startedAt).toLocaleTimeString()}</span>
              </div>
              {r.error && <div className="result-error">{r.error}</div>}
            </div>
          ))}
        </div>
      )}

      {metrics.totalRuns === 0 && (
        <div className="empty-state">
          No test runs yet. Run a script from the Library tab to see metrics here.
        </div>
      )}
    </div>
  );
}
