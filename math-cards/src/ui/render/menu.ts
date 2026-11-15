/**
 * Main menu and setup screens (Milestone M5, U5).
 *
 * The menu lists the two approved modes. A mode not yet available in this build is
 * shown as "Coming soon" and cannot be started (vs Beepy arrives in U7).
 * The setup screen offers every approved level and both question styles as large
 * radio cards, with the U-8 defaults selected.
 */

import type { GenerationDirection } from '@beepy/shared-engine';
import type { MathLevel } from '../../levels.js';
import type { MathMode } from '../../math-generator.js';
import { MENU_LEVELS, MENU_MODES, MENU_STYLES } from '../app-state.js';
import { APP_TITLE, LEVEL_LABELS, MODE_LABELS, STYLE_LABELS, type ChoiceLabel } from '../labels.js';
import { createBeepyAvatar } from './beepy-avatar.js';
import { h } from './dom.js';

export interface MenuProps {
  readonly availableModes: readonly MathMode[];
  readonly onChoose: (mode: MathMode) => void;
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
    h('div', { class: 'hero' },
      h('div', { class: 'hero__beepy' }, createBeepyAvatar('idle', 132)),
      h('h1', { class: 'hero__title', attrs: { id: 'menu-title' } }, APP_TITLE),
      h('p', { class: 'hero__subtitle' }, 'Match the cards to the addition problems!'),
    ),
    h('div', { class: 'mode-grid' }, ...cards),
  );
}

export interface SetupProps {
  readonly mode: MathMode;
  readonly level: MathLevel;
  readonly direction: GenerationDirection;
  readonly error?: string;
  readonly onLevel: (level: MathLevel) => void;
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
          h('span', { class: 'choice__body' },
            h('span', { class: 'choice__title' }, labels[value].title),
            h('span', { class: 'choice__hint' }, labels[value].hint),
          ),
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
    choiceGroup('level', 'Choose your numbers', MENU_LEVELS, LEVEL_LABELS, props.level, props.onLevel),
    choiceGroup('style', 'Choose a question style', MENU_STYLES, STYLE_LABELS, props.direction, props.onDirection),
    props.error === undefined ? null : h('p', { class: 'setup__error', attrs: { role: 'alert' } }, props.error),
    h(
      'div',
      { class: 'setup__actions' },
      h('button', { class: 'btn btn--ghost', attrs: { type: 'button', 'data-focus': 'back' }, on: { click: props.onBack } }, '← Back'),
      h('button', { class: 'btn btn--primary btn--big', attrs: { type: 'button', 'data-focus': 'start' }, on: { click: props.onStart } }, "Let's play!"),
    ),
  );
}
