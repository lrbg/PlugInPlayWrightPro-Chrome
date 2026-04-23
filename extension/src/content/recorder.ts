import { RecordedAction } from '../types';
import { ElementInfo } from '../utils/selectorBuilder';

let isRecording = false;

const IGNORED_TAGS = new Set(['html', 'body', 'head', 'script', 'style', 'meta', 'link', 'noscript']);
const SVG_TAGS = new Set([
  'svg', 'path', 'g', 'circle', 'rect', 'use', 'symbol', 'polygon',
  'polyline', 'line', 'ellipse', 'defs', 'clippath', 'mask', 'filter',
  'lineargradient', 'radialgradient', 'stop', 'feblend', 'title', 'desc',
]);

// ─── Interactive element finder ──────────────────────────────────────────────

/**
 * Walk up from a clicked element to find the best interactive target.
 * Skips SVG icons, decorative wrappers; prefers buttons/links/inputs.
 */
function findBestTarget(el: Element): Element {
  let cur: Element | null = el;

  // Walk up past pure SVG nodes (icon clicks)
  while (cur && (cur instanceof SVGElement || SVG_TAGS.has(cur.tagName.toLowerCase()))) {
    cur = cur.parentElement;
  }
  if (!cur) return el;

  // Check if we're inside a known interactive element
  const interactive = cur.closest(
    'button, a[href], [role="button"], [role="link"], [role="menuitem"], ' +
    '[role="tab"], [role="option"], [role="checkbox"], [role="radio"], ' +
    '[role="switch"], input, select, textarea, label, summary'
  );
  if (interactive && interactive !== document.documentElement && interactive !== document.body) {
    return interactive;
  }
  return cur;
}

// ─── Element info extraction ─────────────────────────────────────────────────

/** Get element text the same way Playwright's accessibility tree sees it. */
function cleanText(element: Element): string {
  const clone = element.cloneNode(true) as Element;
  // aria-hidden elements are excluded from accessible name computation by Playwright
  clone.querySelectorAll('[aria-hidden="true"]').forEach(n => n.remove());
  clone.querySelectorAll(
    'svg, [data-icon], .icon, i.fa, i.material-icons, ' +
    'i[class*="icon"], i[class*="fi-"], span[class*="icon"], [class*="-icon"]'
  ).forEach(n => n.remove());
  return (clone.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

/** Find the text of an associated <label>. */
function findLabelText(element: Element): string | undefined {
  const id = (element as HTMLElement).id;
  if (id) {
    try {
      const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (label) {
        const t = (label.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
        return t || undefined;
      }
    } catch { /* CSS.escape not supported */ }
  }
  const parentLabel = element.closest('label');
  if (parentLabel) {
    const t = cleanText(parentLabel);
    return t || undefined;
  }
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const parts = labelledBy.split(/\s+/)
      .map(refId => document.getElementById(refId)?.textContent?.replace(/\s+/g, ' ').trim())
      .filter(Boolean) as string[];
    if (parts.length) return parts.join(' ').slice(0, 80);
  }
  return undefined;
}

/** Compute the effective ARIA role (explicit attribute OR tag-implied). */
function getAriaRole(element: Element): string {
  const explicit = element.getAttribute('role');
  if (explicit) return explicit;

  const tag = element.tagName.toLowerCase();
  const type = (element.getAttribute('type') || '').toLowerCase();

  if (tag === 'input') {
    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio')    return 'radio';
    if (type === 'submit' || type === 'button') return 'button';
    if (type === 'range')    return 'slider';
    if (type === 'number')   return 'spinbutton';
    if (type === 'search')   return 'searchbox';
    return 'textbox';
  }

  // <a> only has role "link" when it has a non-empty href — Playwright enforces this
  if (tag === 'a') {
    const href = element.getAttribute('href');
    return (href !== null && href.trim() !== '' && href !== '#') ? 'link' : '';
  }

  const tagRoles: Record<string, string> = {
    button: 'button', select: 'combobox', textarea: 'textbox',
    nav: 'navigation', main: 'main', header: 'banner', footer: 'contentinfo',
    h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading', h5: 'heading', h6: 'heading',
    li: 'listitem', ul: 'list', ol: 'list', table: 'table', form: 'form',
    img: 'img', dialog: 'dialog', summary: 'button',
  };
  return tagRoles[tag] || '';
}

function getElementInfo(element: Element): ElementInfo {
  const tag = element.tagName.toLowerCase();
  const id = (element as HTMLElement).id || undefined;
  const name = element.getAttribute('name') || undefined;
  const testId =
    element.getAttribute('data-testid') ||
    element.getAttribute('data-test-id') ||
    element.getAttribute('data-cy') ||
    element.getAttribute('data-e2e') ||
    element.getAttribute('data-qa') ||
    undefined;
  const ariaLabel  = element.getAttribute('aria-label') || undefined;
  const role       = element.getAttribute('role') || undefined;
  const ariaRole   = getAriaRole(element);
  const placeholder = element.getAttribute('placeholder') || undefined;
  const type       = element.getAttribute('type') || undefined;
  const text       = cleanText(element) || undefined;
  const labelText  = findLabelText(element);
  const classes    = Array.from(element.classList).filter(
    c => !c.startsWith('hover:') && !c.startsWith('focus:') && !c.startsWith('active:')
  );

  return { tag, id, name, testId, ariaLabel, role, ariaRole, text, placeholder, type, classes, labelText };
}

// ─── Selector building ───────────────────────────────────────────────────────

/**
 * Build a selector SPEC string that carries full locator info.
 * Consumed by buildLocatorCode() in selectorBuilder.ts.
 * Priority order follows Playwright testing best practices.
 */
function buildSelector(info: ElementInfo, element: Element): string {
  // P1: test-ID attributes (most stable for React/Angular/Vue)
  if (info.testId) return `testid::${info.testId}`;

  // P2: aria-label (common in SPA icon-buttons)
  if (info.ariaLabel) return `arialabel::${info.ariaLabel}`;

  // P3: semantic role + accessible name — only when text is unique in live DOM
  const INTERACTIVE_ROLES = new Set([
    'button', 'link', 'tab', 'menuitem', 'option',
    'checkbox', 'radio', 'switch', 'combobox', 'treeitem',
  ]);
  const effectiveRole = info.ariaRole || info.role || '';
  if (effectiveRole && INTERACTIVE_ROLES.has(effectiveRole) && info.text) {
    if (isUniqueByText(element, info.text)) {
      return `role::${effectiveRole}::${info.text.slice(0, 60)}`;
    }
    // Ambiguous — fall through to more specific selectors
  }

  // P4: tag-implied role for button / link (only <a> with href qualifies as link)
  if (info.tag === 'button' && info.text && isUniqueByText(element, info.text)) {
    return `role::button::${info.text.slice(0, 60)}`;
  }
  if (info.tag === 'a' && info.ariaRole === 'link' && info.text && isUniqueByText(element, info.text)) {
    return `role::link::${info.text.slice(0, 60)}`;
  }

  // P5: stable ID (avoid auto-generated ids like ":r0:")
  if (info.id && /^[a-zA-Z][\w-]*$/.test(info.id) && !/^:[a-z]/.test(info.id)) {
    return `css::#${info.id}`;
  }

  // P5b: meaningful CSS class as disambiguator (e.g. btn-primary vs btn-warning)
  const cls = pickClass(info.classes || []);
  if (cls) {
    return `css::${info.tag}.${cls}`;
  }

  // P6: placeholder (inputs without labels)
  if (info.placeholder) return `placeholder::${info.placeholder}`;

  // P7: associated label (best for accessible form elements)
  if (info.labelText && ['input', 'select', 'textarea'].includes(info.tag)) {
    return `label::${info.labelText}`;
  }

  // P8: name attribute (stable for form elements)
  if (info.name && ['input', 'select', 'textarea'].includes(info.tag)) {
    return `css::${info.tag}[name="${info.name}"]`;
  }

  // P9: meaningful text for list items / menu entries / custom components
  if (info.text && info.text.length >= 2 && info.text.length <= 60) {
    return `text::${info.text}`;
  }

  // Fallback: CSS path anchored to nearest ID ancestor
  return `css::${buildCssPath(element)}`;
}

/**
 * Return true if no other element on the page shares the same tag + visible text.
 * Used to avoid generating role/text selectors that cause strict-mode violations.
 */
function isUniqueByText(element: Element, text: string): boolean {
  const tag = element.tagName.toLowerCase();
  const candidates = Array.from(
    document.querySelectorAll(
      `${tag}, [role="${element.getAttribute('role') || ''}"]`
    )
  ).filter(el => el !== element &&
    (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) === text
  );
  return candidates.length === 0;
}

/**
 * Pick the first CSS class that is semantically meaningful (not generic utility).
 * Used as a disambiguation qualifier when role+text would match multiple elements.
 */
const GENERIC_CSS = new Set([
  'btn', 'button', 'link', 'nav', 'item', 'list', 'menu', 'icon', 'text',
  'label', 'badge', 'tag', 'active', 'disabled', 'selected', 'visible',
  'hidden', 'show', 'hide', 'open', 'closed', 'expanded', 'collapsed',
  'container', 'wrapper', 'inner', 'outer', 'content', 'header', 'footer',
  'row', 'col', 'flex', 'grid', 'd-flex', 'justify', 'align', 'mt', 'mb',
  'mx', 'my', 'pt', 'pb', 'px', 'py', 'p', 'm',
]);
function pickClass(classes: string[]): string | undefined {
  return classes.find(c =>
    c.length > 2 &&
    !GENERIC_CSS.has(c) &&
    !/^\d/.test(c) &&
    !/^(hover|focus|active|disabled|sm|md|lg|xl):/.test(c)
  );
}

function buildCssPath(element: Element | null): string {
  if (!element) return 'unknown';
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    const tag = current.tagName.toLowerCase();
    if (current.id && /^[a-zA-Z][\w-]*$/.test(current.id)) {
      parts.unshift(`#${current.id}`);
      break;
    }
    const siblings = Array.from(current.parentElement?.children || []).filter(
      el => el.tagName === current!.tagName
    );
    let part = tag;
    if (siblings.length > 1) {
      const index = siblings.indexOf(current) + 1;
      part += `:nth-of-type(${index})`;
    }
    parts.unshift(part);
    current = current.parentElement;
  }

  return parts.join(' > ') || 'unknown';
}

// ─── Message sending ─────────────────────────────────────────────────────────

function cleanStr(s?: string): string | undefined {
  if (!s) return undefined;
  return s.replace(/[\n\r\t\0\u2028\u2029]/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 300) || undefined;
}

function sendAction(action: Omit<RecordedAction, 'id' | 'timestamp'>) {
  chrome.runtime.sendMessage({
    type: 'ACTION_RECORDED',
    payload: {
      ...action,
      value:       cleanStr(action.value),
      description: cleanStr(action.description),
      selector:    cleanStr(action.selector) || '',
      id:          `action-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp:   Date.now(),
    },
  });
}

// ─── Event handlers ───────────────────────────────────────────────────────────

const clickHandler = (event: MouseEvent) => {
  if (!isRecording) return;
  const raw = event.target as Element;
  if (!raw) return;

  const target = findBestTarget(raw);
  if (IGNORED_TAGS.has(target.tagName.toLowerCase())) return;

  const info = getElementInfo(target);

  // skip bare select (handled by changeHandler)
  if (info.tag === 'select') return;
  // skip clicks that are just focusing an input (handled by fill)
  if (['input', 'textarea'].includes(info.tag) && info.type !== 'checkbox' && info.type !== 'radio') return;

  const sel = buildSelector(info, target);
  const label = info.text || info.ariaLabel || info.placeholder || info.tag;

  sendAction({
    type: 'click',
    selector: sel,
    value: info.text,
    description: `Click on ${label.slice(0, 50)}`,
  });
};

const changeHandler = (event: Event) => {
  if (!isRecording) return;
  const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  if (!target) return;

  const info = getElementInfo(target);
  const sel  = buildSelector(info, target);

  if (target.tagName.toLowerCase() === 'select') {
    const select = target as HTMLSelectElement;
    const optionText = select.options[select.selectedIndex]?.text || select.value;
    sendAction({
      type: 'select',
      selector: sel,
      value: select.value,
      description: `Select "${optionText}" in ${info.labelText || info.placeholder || sel}`,
    });
  } else if (target.type === 'checkbox' || target.type === 'radio') {
    const checked = (target as HTMLInputElement).checked;
    sendAction({
      type: checked ? 'check' : 'uncheck',
      selector: sel,
      description: `${checked ? 'Check' : 'Uncheck'} ${info.labelText || info.ariaLabel || sel}`,
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
      const sel  = buildSelector(info, target);
      const displayVal = target.value.slice(0, 50);
      const fieldLabel = info.labelText || info.placeholder || info.ariaLabel || info.name || sel;
      sendAction({
        type: 'fill',
        selector: sel,
        value: target.value,
        description: `Fill "${displayVal}" in ${fieldLabel}`,
      });
      timers.delete(target);
    }, 600);

    timers.set(target, timer);
  };
})();

// ─── Recording lifecycle ──────────────────────────────────────────────────────

function startRecording() {
  isRecording = true;
  document.addEventListener('click', clickHandler, true);
  document.addEventListener('change', changeHandler, true);
  document.addEventListener('input',  inputHandler,  true);
  // Navigate actions are owned by the background service-worker (onUpdated).
}

function stopRecording() {
  isRecording = false;
  document.removeEventListener('click', clickHandler, true);
  document.removeEventListener('change', changeHandler, true);
  document.removeEventListener('input',  inputHandler,  true);
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
