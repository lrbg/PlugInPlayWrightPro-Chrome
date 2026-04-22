import { RecordedAction, TestResult } from '../types';

interface RecordingSession {
  isRecording: boolean;
  actions: RecordedAction[];
  tabId?: number;
  startedAt?: number;
}

const session: RecordingSession = {
  isRecording: false,
  actions: [],
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'START_RECORDING':
      session.isRecording = true;
      session.actions = [];
      session.tabId = sender.tab?.id;
      session.startedAt = Date.now();
      sendResponse({ success: true });
      break;

    case 'STOP_RECORDING':
      session.isRecording = false;
      sendResponse({ success: true, actions: session.actions });
      break;

    case 'ACTION_RECORDED':
      if (session.isRecording) {
        session.actions.push(message.payload as RecordedAction);
      }
      sendResponse({ success: true });
      break;

    case 'GET_RECORDING_STATUS':
      sendResponse({
        isRecording: session.isRecording,
        actionCount: session.actions.length,
        actions: session.actions,
      });
      break;

    case 'GET_ACTIONS':
      sendResponse({ actions: session.actions });
      break;

    case 'CLEAR_ACTIONS':
      session.actions = [];
      sendResponse({ success: true });
      break;

    case 'TAKE_SCREENSHOT':
      chrome.tabs.captureVisibleTab({ format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true, screenshot: dataUrl });
        }
      });
      return true;

    case 'INJECT_RECORDER':
      if (sender.tab?.id) {
        chrome.scripting.executeScript({
          target: { tabId: sender.tab.id },
          files: ['content/recorder.js'],
        });
      }
      sendResponse({ success: true });
      break;

    case 'SAVE_RESULT':
      saveResultToStorage(message.payload as TestResult);
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
  return true;
});

async function saveResultToStorage(result: TestResult): Promise<void> {
  const data = await chrome.storage.local.get('ppp_results');
  const results: TestResult[] = data['ppp_results'] || [];
  results.unshift(result);
  await chrome.storage.local.set({ ppp_results: results.slice(0, 500) });
}

// Listen for tab URL changes during recording
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (session.isRecording && session.tabId === tabId && changeInfo.url) {
    session.actions.push({
      id: `action-${Date.now()}`,
      type: 'navigate',
      selector: '',
      url: changeInfo.url,
      description: `Navigate to ${changeInfo.url}`,
      timestamp: Date.now(),
    });
  }
});

export {};
