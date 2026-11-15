/**
 * Main menu, setup, and data error screens (M6 C6; adapted from Math Cards M5 U5).
 *
 * The menu lists both approved modes. A mode not yet available in this build is
 * shown as "Coming soon" and cannot be started (Player vs. Beepy arrives in C7).
 * Setup offers only the two question styles (no difficulty levels, Requirement 8.3).
 * The disclaimer (decision C-13) is shown on the menu and the setup screen.
 * The error screen is shown instead of the menu when the shipped clinical content
 * is missing or fails validation; it never offers a game and never shows file
 * contents or validator details.
 */

import type { GenerationDirection } from '@beepy/shared-engine';
import type { ClinicalMode } from '../../clinical-generator.js';
import { MENU_MODES, MENU_STYLES } from '../app-state.js';
import { APP_SUBTITLE, APP_TITLE, DISCLAIMER, MODE_LABELS, STYLE_LABELS, type ChoiceLabel } from '../labels.js';
import { createBeepyAvatar } from './beepy-avatar.js';
import { h } from './dom.js';

const disclaimer = (): HTMLElement => h('p', { class: 'disclaimer', attrs: { role: 'note' } }, DISCLAIMER);

export interface MenuProps {
  readonly availableModes: readonly ClinicalMode[];
  readonly onChoose: (mode: ClinicalMode) => void;
}

export function renderMenu(props: MenuProps): HTMLElement {
  const cards = MENU_MODES.map((mode) => {
    const label = MODE_LABELS[mode];
    const available = props.availableModes.includes(mode);
    return h(
      'button',
      {
        class: `mode-card mode-card--${mode}`,
        attrs: { type: 'button', 'data-focus': `mode:${mode}`, 'aria-describedby': `mode-hint-${mode}` },
        disabled: !available,
        on: { click: () => props.onChoose(mode) },
      },
      h('span', { class: 'mode-card__icon', attrs: { 'aria-hidden': 'true' } }, mode === 'solitaire' ? '★' : '⚡'),
      h('span', { class: 'mode-card__title' }, label.title),
      h('span', { class: 'mode-card__hint', attrs: { id: `mode-hint-${mode}` } }, available ? label.hint : 'Coming soon!'),
    );
  });
  return h(
    'section',
    { class: 'screen screen--menu', attrs: { 'aria-labelledby': 'menu-title' } },
    h(
      'div',
      { class: 'hero' },
      h('div', { class: 'hero__beepy' }, createBeepyAvatar('idle', 132)),
      h('h1', { class: 'hero__title', attrs: { id: 'menu-title' } }, APP_TITLE),
      h('p', { class: 'hero__subtitle' }, APP_SUBTITLE),
    ),
    h('div', { class: 'mode-grid' }, ...cards),
    disclaimer(),
  );
}

export interface SetupProps {
  readonly mode: ClinicalMode;
  readonly direction: GenerationDirection;
  readonly error?: string;
  readonly onDirection: (direction: GenerationDirection) => void;
  readonly onStart: () => void;
  readonly onBack: () => void;
}

function choiceGroup<T extends string>(
  name: string,
  legend: string,
  options: readonly T[],
  labels: Readonly<Record<T, ChoiceLabel>>,
  selected: T,
  onPick: (value: T) => void,
): HTMLElement {
  return h(
    'fieldset',
    { class: `choice-group choice-group--${name}` },
    h('legend', { class: 'choice-group__legend' }, legend),
    h(
      'div',
      { class: 'choice-grid' },
      ...options.map((value) =>
        h(
          'label',
          { class: 'choice' },
          h('input', {
            class: 'choice__input',
            attrs: { type: 'radio', name, value, checked: value === selected, 'data-focus': `${name}:${value}` },
            on: { change: () => onPick(value) },
          }),
          h('span', { class: 'choice__body' }, h('span', { class: 'choice__title' }, labels[value].title), h('span', { class: 'choice__hint' }, labels[value].hint)),
        ),
      ),
    ),
  );
}

export function renderSetup(props: SetupProps): HTMLElement {
  return h(
    'section',
    { class: 'screen screen--setup', attrs: { 'aria-labelledby': 'setup-title' } },
    h('h1', { class: 'setup__title', attrs: { id: 'setup-title' } }, MODE_LABELS[props.mode].title),
    h('p', { class: 'setup__hint' }, MODE_LABELS[props.mode].hint),
    choiceGroup('style', 'Choose a question style', MENU_STYLES, STYLE_LABELS, props.direction, props.onDirection),
    props.error === undefined ? null : h('p', { class: 'setup__error', attrs: { role: 'alert' } }, props.error),
    h(
      'div',
      { class: 'setup__actions' },
      h('button', { class: 'btn btn--ghost', attrs: { type: 'button', 'data-focus': 'back' }, on: { click: props.onBack } }, '← Back'),
      h('button', { class: 'btn btn--primary btn--big', attrs: { type: 'button', 'data-focus': 'start' }, on: { click: props.onStart } }, 'Start'),
    ),
    disclaimer(),
  );
}

/** Shown instead of the menu when the shipped content cannot be used. */
export function renderDataError(message: string): HTMLElement {
  return h(
    'section',
    { class: 'screen screen--data-error', attrs: { 'aria-labelledby': 'data-error-title' } },
    h('div', { class: 'hero' }, h('div', { class: 'hero__beepy' }, createBeepyAvatar('thinking', 112)), h('h1', { class: 'hero__title', attrs: { id: 'data-error-title' } }, APP_TITLE)),
    h(
      'div',
      { class: 'data-error', attrs: { role: 'alert' } },
      h('h2', { class: 'data-error__title' }, 'The game cannot start'),
      h('p', { class: 'data-error__message' }, message),
      h('p', { class: 'data-error__hint' }, 'No example or unreviewed content is used in its place.'),
    ),
    disclaimer(),
  );
}
