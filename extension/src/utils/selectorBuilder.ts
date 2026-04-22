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

export function buildBestSelector(info: ElementInfo): string {
  if (info.testId) return `[data-testid="${info.testId}"]`;
  if (info.id && /^[a-zA-Z][\w-]*$/.test(info.id)) return `#${info.id}`;
  if (info.ariaLabel) return `[aria-label="${info.ariaLabel}"]`;
  if (info.name && (info.tag === 'input' || info.tag === 'select' || info.tag === 'textarea')) {
    return `${info.tag}[name="${info.name}"]`;
  }
  if (info.role && info.text) return `[role="${info.role}"]:has-text("${info.text.slice(0, 50)}")`;
  if (info.placeholder) return `[placeholder="${info.placeholder}"]`;
  if (info.text && ['button', 'a', 'label'].includes(info.tag)) {
    const t = info.text.trim().slice(0, 60);
    return `${info.tag}:has-text("${t}")`;
  }
  if (info.cssPath) return info.cssPath;
  return info.xpath || info.tag;
}

export function buildLocatorCode(selector: string, tag: string, text?: string): string {
  if (selector.startsWith('#')) {
    return `page.locator('${selector}')`;
  }
  if (selector.startsWith('[data-testid=')) {
    return `page.getByTestId('${selector.match(/\[data-testid="(.+?)"\]/)?.[1]}')`;
  }
  if (selector.startsWith('[aria-label=')) {
    const label = selector.match(/\[aria-label="(.+?)"\]/)?.[1];
    return `page.getByLabel('${label}')`;
  }
  if (tag === 'button' || selector.includes(':has-text')) {
    return `page.getByRole('${getRoleForTag(tag)}', { name: '${text?.slice(0, 60) || ''}' })`;
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
