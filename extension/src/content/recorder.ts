import { RecordedAction } from '../types';
import { ElementInfo } from '../utils/selectorBuilder';

let isRecording = false;
const IGNORED_TAGS = ['html', 'body', 'head', 'script', 'style', 'meta', 'link'];

function getElementInfo(element: Element): ElementInfo {
  const tag = element.tagName.toLowerCase();
  const id = element.id || undefined;
  const name = element.getAttribute('name') || undefined;
  const testId =
    element.getAttribute('data-testid') ||
    element.getAttribute('data-test-id') ||
    element.getAttribute('data-cy') ||
    element.getAttribute('data-e2e') ||
    undefined;
  const ariaLabel = element.getAttribute('aria-label') || undefined;
  const role = element.getAttribute('role') || undefined;
  const placeholder = element.getAttribute('placeholder') || undefined;
  const type = element.getAttribute('type') || undefined;
  // Collapse whitespace/newlines from DOM text so it doesn't break generated code
  const rawText = element.textContent || '';
  const text = rawText.replace(/\s+/g, ' ').trim().slice(0, 80) || undefined;
  const classes = Array.from(element.classList).filter(
    (c) => !c.startsWith('hover:') && !c.startsWith('focus:')
  );

  return { tag, id, name, testId, ariaLabel, role, text, placeholder, type, classes };
}

function buildSelector(info: ElementInfo): string {
  if (info.testId) return `[data-testid="${info.testId}"]`;
  if (info.id && /^[a-zA-Z][\w-]*$/.test(info.id)) return `#${info.id}`;
  if (info.ariaLabel) return `[aria-label="${info.ariaLabel}"]`;
  if (info.name && ['input', 'select', 'textarea'].includes(info.tag)) {
    return `${info.tag}[name="${info.name}"]`;
  }
  if (info.placeholder) return `[placeholder="${info.placeholder}"]`;

  if (['button', 'a'].includes(info.tag) && info.text) {
    return `${info.tag}:has-text("${info.text.slice(0, 50)}")`;
  }

  return buildCssPath(document.querySelector(`[id="${info.id}"]`) as Element);
}

function buildCssPath(element: Element | null): string {
  if (!element) return 'unknown';
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    let part = current.tagName.toLowerCase();
    if (current.id) {
      parts.unshift(`#${current.id}`);
      break;
    }
    const siblings = Array.from(current.parentElement?.children || []).filter(
      (el) => el.tagName === current!.tagName
    );
    if (siblings.length > 1) {
      const index = siblings.indexOf(current) + 1;
      part += `:nth-of-type(${index})`;
    }
    parts.unshift(part);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

/** Collapse all whitespace variants so no field can contain raw newlines. */
function cleanStr(s?: string): string | undefined {
  if (!s) return undefined;
  return s.replace(/\s+/g, ' ').trim().slice(0, 200) || undefined;
}

function sendAction(action: Omit<RecordedAction, 'id' | 'timestamp'>) {
  chrome.runtime.sendMessage({
    type: 'ACTION_RECORDED',
    payload: {
      ...action,
      value: cleanStr(action.value),
      description: cleanStr(action.description),
      selector: cleanStr(action.selector) || '',
      id: `action-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
    },
  });
}

const clickHandler = (event: MouseEvent) => {
  if (!isRecording) return;
  const target = event.target as Element;
  if (!target || IGNORED_TAGS.includes(target.tagName.toLowerCase())) return;

  const info = getElementInfo(target);
  const tag = info.tag;

  if (['select'].includes(tag)) return;

  sendAction({
    type: 'click',
    selector: buildSelector(info),
    value: info.text,
    description: `Click on ${tag}${info.text ? ` "${info.text.slice(0, 40)}"` : ''}`,
  });
};

const changeHandler = (event: Event) => {
  if (!isRecording) return;
  const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  if (!target) return;

  const info = getElementInfo(target);
  const selector = buildSelector(info);

  if (target.tagName.toLowerCase() === 'select') {
    const select = target as HTMLSelectElement;
    sendAction({
      type: 'select',
      selector,
      value: select.value,
      description: `Select "${select.options[select.selectedIndex]?.text}" in ${selector}`,
    });
  } else if (
    target.type === 'checkbox' ||
    target.type === 'radio'
  ) {
    sendAction({
      type: (target as HTMLInputElement).checked ? 'check' : 'uncheck',
      selector,
      description: `${(target as HTMLInputElement).checked ? 'Check' : 'Uncheck'} ${selector}`,
    });
  }
};

const inputHandler = (() => {
  const timers: Map<Element, ReturnType<typeof setTimeout>> = new Map();

  return (event: Event) => {
    if (!isRecording) return;
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    if (!target || ['checkbox', 'radio', 'file'].includes(target.type)) return;

    const existing = timers.get(target);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      const info = getElementInfo(target);
      sendAction({
        type: 'fill',
        selector: buildSelector(info),
        value: target.value,
        description: `Fill "${target.value.slice(0, 40)}" in ${buildSelector(info)}`,
      });
      timers.delete(target);
    }, 600);

    timers.set(target, timer);
  };
})();

function startRecording() {
  isRecording = true;
  document.addEventListener('click', clickHandler, true);
  document.addEventListener('change', changeHandler, true);
  document.addEventListener('input', inputHandler, true);

  sendAction({
    type: 'navigate',
    selector: '',
    url: window.location.href,
    description: `Navigate to ${window.location.href}`,
  });
}

function stopRecording() {
  isRecording = false;
  document.removeEventListener('click', clickHandler, true);
  document.removeEventListener('change', changeHandler, true);
  document.removeEventListener('input', inputHandler, true);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'START_RECORDING') {
    startRecording();
    sendResponse({ success: true });
  } else if (message.type === 'STOP_RECORDING') {
    stopRecording();
    sendResponse({ success: true });
  } else if (message.type === 'GET_STATUS') {
    sendResponse({ isRecording });
  } else if (message.type === 'TAKE_SCREENSHOT') {
    sendResponse({ success: true });
  }
  return true;
});
