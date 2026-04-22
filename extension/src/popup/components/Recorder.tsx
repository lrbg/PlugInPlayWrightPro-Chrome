import React, { useState, useEffect, useCallback } from 'react';
import { RecordedAction, AssertionType, TestCase } from '../../types';

interface Props {
  testCase: TestCase | null;
  onActionsChange: (actions: RecordedAction[]) => void;
}

const ASSERTION_TYPES: { value: AssertionType; label: string }[] = [
  { value: 'toBeVisible', label: 'Is Visible' },
  { value: 'toBeHidden', label: 'Is Hidden' },
  { value: 'toHaveText', label: 'Has Text' },
  { value: 'toContainText', label: 'Contains Text' },
  { value: 'toHaveValue', label: 'Has Value' },
  { value: 'toHaveURL', label: 'URL Equals' },
  { value: 'toHaveTitle', label: 'Title Equals' },
  { value: 'toBeEnabled', label: 'Is Enabled' },
  { value: 'toBeDisabled', label: 'Is Disabled' },
  { value: 'toBeChecked', label: 'Is Checked' },
  { value: 'toHaveCount', label: 'Has Count' },
];

export function Recorder({ testCase, onActionsChange }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [actions, setActions] = useState<RecordedAction[]>([]);
  const [showAssertionForm, setShowAssertionForm] = useState(false);
  const [assertionData, setAssertionData] = useState({
    selector: '',
    type: 'toBeVisible' as AssertionType,
    value: '',
    description: '',
  });
  const [screenshotDesc, setScreenshotDesc] = useState('');
  const [showScreenshotForm, setShowScreenshotForm] = useState(false);
  const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  const syncActionsFromBackground = useCallback(async () => {
    const response = await chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATUS' });
    if (response?.actions) {
      setActions(response.actions);
      onActionsChange(response.actions);
    }
  }, [onActionsChange]);

  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(syncActionsFromBackground, 1000);
      setPollInterval(interval);
      return () => clearInterval(interval);
    } else {
      if (pollInterval) clearInterval(pollInterval);
      setPollInterval(null);
    }
  }, [isRecording]);

  const toggleRecording = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    if (!isRecording) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/recorder.js'],
      });
      await chrome.tabs.sendMessage(tab.id, { type: 'START_RECORDING' });
      await chrome.runtime.sendMessage({ type: 'START_RECORDING' });
      setIsRecording(true);
    } else {
      await chrome.tabs.sendMessage(tab.id, { type: 'STOP_RECORDING' });
      const response = await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
      setIsRecording(false);
      if (response?.actions) {
        setActions(response.actions);
        onActionsChange(response.actions);
      }
    }
  };

  const takeScreenshot = async () => {
    const response = await chrome.runtime.sendMessage({ type: 'TAKE_SCREENSHOT' });
    if (response?.screenshot) {
      const newAction: RecordedAction = {
        id: `action-${Date.now()}`,
        type: 'screenshot',
        selector: '',
        screenshot: response.screenshot,
        screenshotDescription: screenshotDesc,
        description: screenshotDesc || 'Screenshot captured',
        timestamp: Date.now(),
      };
      const updated = [...actions, newAction];
      setActions(updated);
      onActionsChange(updated);
      await chrome.runtime.sendMessage({ type: 'ACTION_RECORDED', payload: newAction });
      setShowScreenshotForm(false);
      setScreenshotDesc('');
    }
  };

  const addAssertion = () => {
    if (!assertionData.selector.trim()) {
      alert('Selector is required for assertion');
      return;
    }
    const newAction: RecordedAction = {
      id: `action-${Date.now()}`,
      type: 'assertion',
      selector: assertionData.selector,
      isAssertion: true,
      assertionType: assertionData.type,
      assertionValue: assertionData.value,
      assertionDescription: assertionData.description,
      description: `Assert ${assertionData.type} on ${assertionData.selector}`,
      timestamp: Date.now(),
    };
    const updated = [...actions, newAction];
    setActions(updated);
    onActionsChange(updated);
    chrome.runtime.sendMessage({ type: 'ACTION_RECORDED', payload: newAction });
    setShowAssertionForm(false);
    setAssertionData({ selector: '', type: 'toBeVisible', value: '', description: '' });
  };

  const addWait = () => {
    const newAction: RecordedAction = {
      id: `action-${Date.now()}`,
      type: 'wait',
      selector: '',
      value: '1000',
      description: 'Wait 1000ms',
      timestamp: Date.now(),
    };
    const updated = [...actions, newAction];
    setActions(updated);
    onActionsChange(updated);
    chrome.runtime.sendMessage({ type: 'ACTION_RECORDED', payload: newAction });
  };

  const removeAction = (id: string) => {
    const updated = actions.filter((a) => a.id !== id);
    setActions(updated);
    onActionsChange(updated);
  };

  const clearAll = async () => {
    if (!confirm('Clear all recorded actions?')) return;
    setActions([]);
    onActionsChange([]);
    await chrome.runtime.sendMessage({ type: 'CLEAR_ACTIONS' });
  };

  const actionIcon = (type: string) => {
    const icons: Record<string, string> = {
      navigate: '🌐', click: '👆', fill: '⌨️', select: '📋',
      check: '☑️', uncheck: '⬜', hover: '🖱️', screenshot: '📸',
      assertion: '✅', wait: '⏳', press: '⌨️',
    };
    return icons[type] || '▶️';
  };

  const needsValue = (type: AssertionType) =>
    ['toHaveText', 'toContainText', 'toHaveValue', 'toHaveURL', 'toHaveTitle', 'toHaveCount'].includes(type);

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-icon">⏺</span>
        <h2>Recorder</h2>
        {testCase && <span className="badge-small">{testCase.number}</span>}
      </div>

      {!testCase && (
        <div className="info-banner">
          ℹ️ Create and save a Test Case first to start recording.
        </div>
      )}

      <div className="recorder-controls">
        <button
          className={`btn btn-record ${isRecording ? 'btn-stop' : 'btn-start'}`}
          onClick={toggleRecording}
          disabled={!testCase}
        >
          {isRecording ? '⏹ Stop Recording' : '⏺ Start Recording'}
        </button>

        <div className="recorder-actions">
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => setShowAssertionForm(true)}
            disabled={!testCase}
            title="Add Assertion"
          >
            ✅ Assert
          </button>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => setShowScreenshotForm(true)}
            disabled={!testCase}
            title="Take Screenshot"
          >
            📸 Screenshot
          </button>
          <button
            className="btn btn-sm btn-secondary"
            onClick={addWait}
            disabled={!testCase}
            title="Add Wait"
          >
            ⏳ Wait
          </button>
        </div>
      </div>

      {isRecording && (
        <div className="recording-indicator">
          <span className="pulse-dot" /> Recording… {actions.length} actions
        </div>
      )}

      {showAssertionForm && (
        <div className="modal-overlay" onClick={() => setShowAssertionForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>➕ Add Assertion</h3>
            <div className="field">
              <label>Selector *</label>
              <input
                type="text"
                value={assertionData.selector}
                onChange={(e) => setAssertionData({ ...assertionData, selector: e.target.value })}
                placeholder="#submit-btn or [data-testid='login']"
              />
            </div>
            <div className="field">
              <label>Assertion Type</label>
              <select
                value={assertionData.type}
                onChange={(e) => setAssertionData({ ...assertionData, type: e.target.value as AssertionType })}
              >
                {ASSERTION_TYPES.map((at) => (
                  <option key={at.value} value={at.value}>{at.label}</option>
                ))}
              </select>
            </div>
            {needsValue(assertionData.type) && (
              <div className="field">
                <label>Expected Value</label>
                <input
                  type="text"
                  value={assertionData.value}
                  onChange={(e) => setAssertionData({ ...assertionData, value: e.target.value })}
                  placeholder="Expected value..."
                />
              </div>
            )}
            <div className="field">
              <label>Description (optional)</label>
              <input
                type="text"
                value={assertionData.description}
                onChange={(e) => setAssertionData({ ...assertionData, description: e.target.value })}
                placeholder="Verify login button is visible"
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowAssertionForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addAssertion}>Add Assertion</button>
            </div>
          </div>
        </div>
      )}

      {showScreenshotForm && (
        <div className="modal-overlay" onClick={() => setShowScreenshotForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>📸 Take Screenshot</h3>
            <div className="field">
              <label>Evidence Description</label>
              <input
                type="text"
                value={screenshotDesc}
                onChange={(e) => setScreenshotDesc(e.target.value)}
                placeholder="Login page after entering credentials"
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowScreenshotForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={takeScreenshot}>Capture</button>
            </div>
          </div>
        </div>
      )}

      <div className="actions-header">
        <span>Actions ({actions.length})</span>
        {actions.length > 0 && (
          <button className="btn btn-xs btn-danger" onClick={clearAll}>Clear All</button>
        )}
      </div>

      <div className="actions-list">
        {actions.length === 0 ? (
          <div className="empty-state">No actions recorded yet. Start recording to capture interactions.</div>
        ) : (
          actions.map((action, index) => (
            <div key={action.id} className={`action-item ${action.isAssertion ? 'action-assertion' : ''}`}>
              <span className="action-num">{index + 1}</span>
              <span className="action-icon">{actionIcon(action.type)}</span>
              <div className="action-info">
                <span className="action-type">{action.type}</span>
                <span className="action-desc">{action.description || action.selector}</span>
                {action.screenshot && (
                  <img src={action.screenshot} alt="screenshot" className="action-screenshot" />
                )}
              </div>
              <button className="btn-remove" onClick={() => removeAction(action.id)}>×</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
