import React, { useState, useCallback } from 'react';
import { Tab, TestCase, RecordedAction, Script, AppSettings, TestResult } from '../types';
import { TestCaseForm } from './components/TestCaseForm';
import { Recorder } from './components/Recorder';
import { ScriptLibrary } from './components/ScriptLibrary';
import { Dashboard } from './components/Dashboard';
import { Settings } from './components/Settings';
import { saveScript, getSettings, saveResult } from '../utils/storage';
import { generatePlaywrightScript } from '../utils/scriptGenerator';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('testcase');
  const [currentTestCase, setCurrentTestCase] = useState<TestCase | null>(null);
  const [recordedActions, setRecordedActions] = useState<RecordedAction[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showNotif = (msg: string, type: 'success' | 'error' = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleTestCaseSave = (tc: TestCase) => {
    setCurrentTestCase(tc);
    showNotif(`Test case "${tc.number}" saved. Go to Recorder to record actions.`);
    setTimeout(() => setActiveTab('recorder'), 500);
  };

  const handleActionsChange = useCallback((actions: RecordedAction[]) => {
    setRecordedActions(actions);
  }, []);

  const handleSaveScript = async () => {
    if (!currentTestCase) {
      showNotif('Create a Test Case first.', 'error');
      return;
    }
    if (recordedActions.length === 0) {
      showNotif('Record at least one action.', 'error');
      return;
    }

    const script: Script = editingScript
      ? {
          ...editingScript,
          testCase: currentTestCase,
          actions: recordedActions,
          generatedCode: generatePlaywrightScript({
            ...editingScript,
            testCase: currentTestCase,
            actions: recordedActions,
          }),
          updatedAt: new Date().toISOString(),
        }
      : {
          id: `script-${Date.now()}`,
          testCase: currentTestCase,
          actions: recordedActions,
          generatedCode: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          runCount: 0,
          passCount: 0,
          failCount: 0,
        };

    if (!editingScript) {
      script.generatedCode = generatePlaywrightScript(script);
    }

    await saveScript(script);
    setRefreshKey((k) => k + 1);
    setEditingScript(null);
    showNotif(`Script "${currentTestCase.number}" saved successfully!`);
    setTimeout(() => setActiveTab('library'), 500);
  };

  const handleEditScript = (script: Script) => {
    setEditingScript(script);
    setCurrentTestCase(script.testCase);
    setRecordedActions(script.actions);
    setActiveTab('testcase');
    showNotif(`Editing script: ${script.testCase.number}`);
  };

  const handleRunScript = async (script: Script) => {
    const settings = appSettings || (await getSettings());
    const serverUrl = `${settings.companionServerUrl}:${settings.companionServerPort}`;

    try {
      const resp = await fetch(`${serverUrl}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptId: script.id,
          testCaseNumber: script.testCase.number,
          scriptName: script.testCase.name,
          code: script.generatedCode,
          baseUrl: script.testCase.baseUrl || settings.baseUrl,
        }),
      });

      if (!resp.ok) throw new Error(`Server error: ${resp.status}`);

      const result: {
        status: 'pass' | 'fail' | 'error';
        duration: number;
        error?: string;
      } = await resp.json();

      const testResult: TestResult = {
        id: `result-${Date.now()}`,
        scriptId: script.id,
        scriptName: script.testCase.name,
        testCaseNumber: script.testCase.number,
        status: result.status,
        duration: result.duration,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        error: result.error,
        source: 'local',
        screenshots: [],
        retries: 0,
      };

      await saveResult(testResult);

      const updated: Script = {
        ...script,
        lastRunAt: new Date().toISOString(),
        lastRunStatus: result.status,
        runCount: script.runCount + 1,
        passCount: script.passCount + (result.status === 'pass' ? 1 : 0),
        failCount: script.failCount + (result.status !== 'pass' ? 1 : 0),
        avgDuration: script.avgDuration
          ? (script.avgDuration + result.duration) / 2
          : result.duration,
      };
      await saveScript(updated);

      setRefreshKey((k) => k + 1);
      showNotif(
        `Run complete: ${result.status.toUpperCase()}${result.error ? ` - ${result.error}` : ''}`,
        result.status === 'pass' ? 'success' : 'error'
      );
    } catch (err) {
      showNotif(`Failed to run script: ${err}`, 'error');
    }
  };

  const handleSettingsSave = (settings: AppSettings) => {
    setAppSettings(settings);
    showNotif('Settings saved successfully!');
  };

  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'testcase', icon: '📋', label: 'Test Case' },
    { id: 'recorder', icon: '⏺', label: 'Recorder' },
    { id: 'library', icon: '📚', label: 'Library' },
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'settings', icon: '⚙️', label: 'Settings' },
  ];

  const companionUrl = appSettings
    ? `${appSettings.companionServerUrl}:${appSettings.companionServerPort}`
    : 'http://localhost:3001';

  return (
    <div className="app">
      <div className="app-header">
        <div className="app-logo">
          <span className="logo-icon">🎭</span>
          <span className="logo-text">PlaywrightPro</span>
        </div>
        {currentTestCase && (
          <div className="current-tc">
            <span className="tc-badge">{currentTestCase.number}</span>
          </div>
        )}
      </div>

      <nav className="tab-nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {notification && (
        <div className={`notification notification-${notification.type}`}>
          {notification.msg}
        </div>
      )}

      <div className="tab-content">
        {activeTab === 'testcase' && (
          <TestCaseForm
            onSave={handleTestCaseSave}
            initial={currentTestCase || undefined}
          />
        )}

        {activeTab === 'recorder' && (
          <div>
            <Recorder
              testCase={currentTestCase}
              onActionsChange={handleActionsChange}
            />
            {currentTestCase && recordedActions.length > 0 && (
              <div className="save-bar">
                <span>{recordedActions.length} actions recorded</span>
                <button className="btn btn-primary" onClick={handleSaveScript}>
                  💾 Save Script
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'library' && (
          <ScriptLibrary
            onEditScript={handleEditScript}
            onRunScript={handleRunScript}
            companionUrl={companionUrl}
            refreshKey={refreshKey}
          />
        )}

        {activeTab === 'dashboard' && <Dashboard refreshKey={refreshKey} />}

        {activeTab === 'settings' && <Settings onSave={handleSettingsSave} />}
      </div>
    </div>
  );
}
