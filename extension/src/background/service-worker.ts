import { RecordedAction, TestResult } from '../types';

interface RecordingSession {
  isRecording: boolean;
  actions: RecordedAction[];
  tabId?: number;
  startedAt?: number;
  // Track last injected URL to avoid duplicate navigate entries
  lastNavigatedUrl?: string;
}

const session: RecordingSession = {
  isRecording: false,
  actions: [],
};

async function reinjectAndResume(tabId: number): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/recorder.js'],
    });
    // Small delay to let the content script initialize before sending the message
    await new Promise((r) => setTimeout(r, 150));
    await chrome.tabs.sendMessage(tabId, { type: 'START_RECORDING' });
  } catch {
    // Page may have restricted CSP — recording will be unavailable for that page
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'START_RECORDING': {
      const tabId = message.tabId ?? sender.tab?.id;
      session.isRecording = true;
      session.actions = [];
      session.tabId = tabId;
      session.startedAt = Date.now();
      session.lastNavigatedUrl = undefined;
      // Capture the real starting URL from the tab — must happen after clearing actions
      if (tabId) {
        chrome.tabs.get(tabId, (tab) => {
          if (tab?.url && tab.url.startsWith('http')) {
            session.lastNavigatedUrl = tab.url;
            session.actions.unshift({
              id: `action-nav-start-${Date.now()}`,
              type: 'navigate',
              selector: '',
              url: tab.url,
              description: `Navigate to ${tab.url}`,
              timestamp: Date.now(),
            });
          }
        });
      }
      sendResponse({ success: true });
      break;
    }

    case 'STOP_RECORDING':
      session.isRecording = false;
      sendResponse({ success: true, actions: session.actions });
      break;

    case 'ACTION_RECORDED': {
      if (session.isRecording) {
        const incoming = message.payload as RecordedAction;
        // Deduplicate navigate actions — SPA re-injection fires many with the same URL
        if (incoming.type === 'navigate' && incoming.url) {
          if (incoming.url === session.lastNavigatedUrl) break; // skip duplicate
          session.lastNavigatedUrl = incoming.url;
        }
        session.actions.push(incoming);
      }
      sendResponse({ success: true });
      break;
    }

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

// Re-inject recorder after every navigation on the recorded tab
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!session.isRecording || session.tabId !== tabId) return;

  // Capture the new URL as soon as it's known (before page finishes loading)
  if (changeInfo.url && changeInfo.url !== session.lastNavigatedUrl) {
    session.lastNavigatedUrl = changeInfo.url;
    session.actions.push({
      id: `action-nav-${Date.now()}`,
      type: 'navigate',
      selector: '',
      url: changeInfo.url,
      description: `Navigate to ${changeInfo.url}`,
      timestamp: Date.now(),
    });
  }

  // Re-inject and restart the content script once the page is fully loaded
  if (changeInfo.status === 'complete') {
    reinjectAndResume(tabId);
  }
});

export {};
