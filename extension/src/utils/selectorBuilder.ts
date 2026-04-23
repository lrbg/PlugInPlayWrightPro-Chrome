export interface ElementInfo {
  tag: string;
  id?: string;
  name?: string;
  testId?: string;
  ariaLabel?: string;
  role?: string;
  ariaRole?: string;     // effective ARIA role (from attribute OR tag semantics)
  text?: string;
  placeholder?: string;
  type?: string;
  classes?: string[];
  href?: string;
  value?: string;
  xpath?: string;
  cssPath?: string;
  labelText?: string;    // text of an associated <label>
}

/**
 * Selector spec format stored in action.selector:
 *   testid::VALUE           → page.getByTestId('VALUE')
 *   arialabel::VALUE        → page.getByLabel('VALUE')
 *   label::VALUE            → page.getByLabel('VALUE')
 *   role::ROLE::NAME        → page.getByRole('ROLE', { name: 'NAME' })
 *   placeholder::VALUE      → page.getByPlaceholder('VALUE')
 *   text::VALUE             → page.getByText('VALUE', { exact: false })
 *   css::SELECTOR           → page.locator('SELECTOR')
 *
 * Legacy CSS selectors (old saved scripts) are handled as fallback.
 */

export function buildLocatorCode(selector: string, _tag: string, _text?: string): string {
  if (!selector) return `page.locator('body')`;

  // ── New spec format ──────────────────────────────────────────────────────
  if (selector.startsWith('testid::')) {
    return `page.getByTestId('${s(selector.slice(8))}')`;
  }
  if (selector.startsWith('arialabel::')) {
    return `page.getByLabel('${s(selector.slice(11))}')`;
  }
  if (selector.startsWith('label::')) {
    return `page.getByLabel('${s(selector.slice(7))}')`;
  }
  if (selector.startsWith('placeholder::')) {
    return `page.getByPlaceholder('${s(selector.slice(13))}')`;
  }
  if (selector.startsWith('text::')) {
    return `page.getByText('${s(selector.slice(6))}', { exact: false })`;
  }
  if (selector.startsWith('role::')) {
    const rest = selector.slice(6);
    const sep = rest.indexOf('::');
    if (sep !== -1) {
      const role = rest.slice(0, sep);
      const name = s(rest.slice(sep + 2), 100);
      return `page.getByRole('${role}', { name: '${name}', exact: false })`;
    }
    return `page.getByRole('${rest}')`;
  }
  if (selector.startsWith('css::')) {
    return `page.locator('${q(selector.slice(5))}')`;
  }

  // ── Legacy format fallback ───────────────────────────────────────────────
  if (selector.startsWith('[data-testid=')) {
    const id = s(selector.match(/\[data-testid="(.+?)"\]/)?.[1] ?? '', 120);
    return `page.getByTestId('${id}')`;
  }
  if (selector.startsWith('[aria-label=')) {
    const label = s(selector.match(/\[aria-label="(.+?)"\]/)?.[1] ?? '', 120);
    return `page.getByLabel('${label}')`;
  }
  if (selector.startsWith('[placeholder=')) {
    const ph = s(selector.match(/\[placeholder="(.+?)"\]/)?.[1] ?? '', 120);
    return `page.getByPlaceholder('${ph}')`;
  }
  if (selector.includes(':has-text(')) {
    const tagM = selector.match(/^(\w+):has-text/);
    const nameM = selector.match(/:has-text\("(.+?)"\)/);
    const htTag = tagM?.[1] ?? '';
    const htName = nameM?.[1] ?? '';
    if (htName && htTag === 'button') return `page.getByRole('button', { name: '${s(htName)}', exact: false })`;
    if (htName && htTag === 'a')      return `page.getByRole('link',   { name: '${s(htName)}', exact: false })`;
    if (htName) return `page.getByText('${s(htName)}', { exact: false })`;
  }

  // Bare hyphenated class name without dot (e.g. "bg-success" → ".bg-success").
  // Standard HTML tags never contain a hyphen, so this pattern is unambiguous.
  if (/^[a-zA-Z][a-zA-Z0-9]*(-[a-zA-Z0-9]+)+$/.test(selector)) {
    return `page.locator('.${q(selector)}')`;
  }

  return `page.locator('${q(selector)}')`;
}

/** sanitizeForCode — embed safely in any JS string literal */
export function sanitizeForCode(raw: string, maxLen = 80): string {
  return raw
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/`/g, '\\`')
    .replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ')
    .replace(/\t/g, ' ').replace(/\0/g, '')
    .replace(/\u2028/g, ' ').replace(/\u2029/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/** Short alias used inside this file */
function s(v: string, max = 80): string { return sanitizeForCode(v, max); }

/** Escape for embedding in single-quoted JS string (CSS selectors, paths) */
function q(sel: string): string {
  return sel
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/[\n\r\t\0]/g, ' ')
    .replace(/\u2028/g, ' ').replace(/\u2029/g, ' ');
}

export function buildBestSelector(info: ElementInfo): string {
  if (info.testId)    return `testid::${info.testId}`;
  if (info.ariaLabel) return `arialabel::${info.ariaLabel}`;
  if (info.placeholder) return `placeholder::${info.placeholder}`;
  const role = info.ariaRole || info.role;
  if (role && info.text) return `role::${role}::${info.text.slice(0, 60)}`;
  if (info.labelText) return `label::${info.labelText}`;
  if (info.cssPath) return `css::${info.cssPath}`;
  return `css::${info.tag}`;
}
