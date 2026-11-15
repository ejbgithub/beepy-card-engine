/**
 * Tiny DOM helpers (copied unchanged from Math Cards M5 U5, decision C-1 A). No framework.
 *
 * Text is always set with `textContent` and attributes with `setAttribute`, never
 * `innerHTML`, so card faces and prompts can never inject markup.
 */

export type Child = Node | string | number | null | undefined | false;

export interface Props {
  readonly class?: string;
  /** Attributes such as `aria-label`, `data-focus`, `type`, `role`. */
  readonly attrs?: Readonly<Record<string, string | number | boolean | undefined>>;
  readonly on?: Readonly<Partial<Record<keyof HTMLElementEventMap, (event: Event) => void>>>;
  readonly disabled?: boolean;
}

/** Create an element with props and children. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (props.class !== undefined) element.className = props.class;
  for (const [name, value] of Object.entries(props.attrs ?? {})) {
    if (value === undefined || value === false) continue;
    element.setAttribute(name, value === true ? '' : String(value));
  }
  if (props.disabled === true) element.setAttribute('disabled', '');
  for (const [type, handler] of Object.entries(props.on ?? {})) {
    if (handler !== undefined) element.addEventListener(type, handler);
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    element.append(typeof child === 'number' ? String(child) : child);
  }
  return element;
}

/** Replace all children of `parent`. */
export function replaceChildren(parent: Element, ...children: Node[]): void {
  parent.replaceChildren(...children);
}

/** The `data-focus` key of the focused element inside `root`, if any. */
export function focusedKey(root: Element): string | undefined {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !root.contains(active)) return undefined;
  return active.dataset['focus'];
}

/** Focus the first element with one of the given `data-focus` keys (in order). */
export function restoreFocus(root: Element, keys: readonly (string | undefined)[]): void {
  for (const key of keys) {
    if (key === undefined) continue;
    const target = root.querySelector<HTMLElement>(`[data-focus="${CSS.escape(key)}"]`);
    if (target !== null && !target.hasAttribute('disabled')) {
      target.focus();
      return;
    }
  }
}
