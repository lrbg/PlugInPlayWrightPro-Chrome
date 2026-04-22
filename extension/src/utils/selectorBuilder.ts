export interface ElementInfo {
  tag: string;
  id?: string;
  name?: string;
  testId?: string;
  ariaLabel?: string;
  role?: string;
  text?: string;
  placeholder?: string;
  type?: string;
  classes?: string[];
  href?: string;
  value?: string;
  xpath?: string;
  cssPath?: string;
}

/**
 * Sanitize any string before embedding it inside generated TypeScript code.
 * Handles: backslashes, quotes, newlines, tabs, carriage returns, null bytes.
 */
export function sanitizeForCode(raw: string, maxLen = 80): string {
  return raw
    .replace(/\\/g, '\\\\')   // backslash first — must be first
    .replace(/'/g, "\\'")      // single quotes
    .replace(/"/g, '\\"')      // double quotes
    .replace(/`/g, '\\`')      // backticks
    .replace(/\r\n/g, ' ')     // CRLF
    .replace(/\n/g, ' ')       // LF
    .replace(/\r/g, ' ')       // CR
    .replace(/\t/g, ' ')       // tabs
    .replace(/\0/g, '')        // null bytes
    .replace(/\s{2,}/g, ' ')   // collapse repeated spaces
    .trim()
    .slice(0, maxLen);
}

export function buildBestSelector(info: ElementInfo): string {
  if (info.testId) return `[data-testid="${sanitizeForCode(info.testId)}"]`;
  if (info.id && /^[a-zA-Z][\w-]*$/.test(info.id)) return `#${info.id}`;
  if (info.ariaLabel) return `[aria-label="${sanitizeForCode(info.ariaLabel)}"]`;
  if (info.name && ['input', 'select', 'textarea'].includes(info.tag)) {
    return `${info.tag}[name="${sanitizeForCode(info.name)}"]`;
  }
  if (info.role && info.text) {
    return `[role="${info.role}"]:has-text("${sanitizeForCode(info.text, 50)}")`;
  }
  if (info.placeholder) return `[placeholder="${sanitizeForCode(info.placeholder)}"]`;
  if (info.text && ['button', 'a', 'label'].includes(info.tag)) {
    return `${info.tag}:has-text("${sanitizeForCode(info.text, 60)}")`;
  }
  if (info.cssPath) return info.cssPath;
  return info.xpath || info.tag;
}

export function buildLocatorCode(selector: string, tag: string, text?: string): string {
  if (selector.startsWith('#')) {
    return `page.locator('${selector}')`;
  }
  if (selector.startsWith('[data-testid=')) {
    const id = selector.match(/\[data-testid="(.+?)"\]/)?.[1] ?? '';
    return `page.getByTestId('${id}')`;
  }
  if (selector.startsWith('[aria-label=')) {
    const label = selector.match(/\[aria-label="(.+?)"\]/)?.[1] ?? '';
    return `page.getByLabel('${label}')`;
  }
  if (selector.startsWith('[placeholder=')) {
    const ph = selector.match(/\[placeholder="(.+?)"\]/)?.[1] ?? '';
    return `page.getByPlaceholder('${ph}')`;
  }
  if (tag === 'button' || selector.includes(':has-text')) {
    const safeName = text ? sanitizeForCode(text, 60) : '';
    if (safeName) {
      return `page.getByRole('${getRoleForTag(tag)}', { name: '${safeName}' })`;
    }
    return `page.locator('${selector}')`;
  }
  return `page.locator('${selector}')`;
}

function getRoleForTag(tag: string): string {
  const roles: Record<string, string> = {
    button: 'button',
    a: 'link',
    input: 'textbox',
    select: 'combobox',
    textarea: 'textbox',
    h1: 'heading',
    h2: 'heading',
    h3: 'heading',
  };
  return roles[tag] || 'generic';
}
