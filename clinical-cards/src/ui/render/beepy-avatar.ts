/**
 * Beepy, the friendly robot (copied unchanged from Math Cards M5 U9, decision C-1 A;
 * decision U-9).
 *
 * Original artwork drawn for this project as inline SVG: smooth shapes and soft
 * gradients, a modern friendly look, with no retro, pixel-art, or 8-bit styling and
 * no reuse of earlier artwork. One drawing serves every pose; CSS classes on the
 * root change the pose:
 *   beepy--idle      gentle float
 *   beepy--thinking  eyes look up, antenna light pulses, thought dots appear
 * The drawing is decorative (`aria-hidden`); nearby text says what Beepy is doing.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

type Attrs = Readonly<Record<string, string | number>>;

function el(tag: string, attrs: Attrs, ...children: SVGElement[]): SVGElement {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  node.append(...children);
  return node;
}

export type BeepyPose = 'idle' | 'thinking';

let instance = 0;

/** Create a Beepy drawing at the given CSS pixel size. */
export function createBeepyAvatar(pose: BeepyPose, size: number): SVGElement {
  instance += 1;
  const id = (name: string): string => `beepy-${name}-${instance}`;
  const svg = el('svg', {
    viewBox: '0 0 120 120',
    width: size,
    height: size,
    class: `beepy beepy--${pose}`,
    'aria-hidden': 'true',
    focusable: 'false',
  });

  const defs = el(
    'defs',
    {},
    el(
      'linearGradient',
      { id: id('body'), x1: '0', y1: '0', x2: '0', y2: '1' },
      el('stop', { offset: '0', 'stop-color': '#8b80ff' }),
      el('stop', { offset: '1', 'stop-color': '#4b3fd9' }),
    ),
    el(
      'linearGradient',
      { id: id('visor'), x1: '0', y1: '0', x2: '0', y2: '1' },
      el('stop', { offset: '0', 'stop-color': '#21305a' }),
      el('stop', { offset: '1', 'stop-color': '#141c38' }),
    ),
    el(
      'radialGradient',
      { id: id('glow'), cx: '0.5', cy: '0.5', r: '0.5' },
      el('stop', { offset: '0', 'stop-color': '#ffd08f' }),
      el('stop', { offset: '1', 'stop-color': '#ff8a3d' }),
    ),
  );

  const figure = el(
    'g',
    { class: 'beepy__figure' },
    // Soft ground shadow.
    el('ellipse', { cx: 60, cy: 112, rx: 30, ry: 5, fill: 'rgba(29,39,66,0.15)', class: 'beepy__shadow' }),
    // Antenna.
    el('rect', { x: 57, y: 10, width: 6, height: 18, rx: 3, fill: '#4b3fd9' }),
    el('circle', { cx: 60, cy: 10, r: 8, fill: `url(#${id('glow')})`, class: 'beepy__light' }),
    // Ears.
    el('rect', { x: 8, y: 46, width: 14, height: 26, rx: 7, fill: '#ff8a3d' }),
    el('rect', { x: 98, y: 46, width: 14, height: 26, rx: 7, fill: '#ff8a3d' }),
    // Head.
    el('rect', { x: 16, y: 26, width: 88, height: 70, rx: 30, fill: `url(#${id('body')})` }),
    el('rect', { x: 24, y: 30, width: 72, height: 10, rx: 5, fill: '#ffffff', opacity: 0.18 }),
    // Face screen.
    el('rect', { x: 26, y: 44, width: 68, height: 40, rx: 18, fill: `url(#${id('visor')})` }),
    // Eyes.
    el(
      'g',
      { class: 'beepy__eyes' },
      el('ellipse', { cx: 46, cy: 61, rx: 7, ry: 8, fill: '#7ff2e0' }),
      el('ellipse', { cx: 74, cy: 61, rx: 7, ry: 8, fill: '#7ff2e0' }),
      el('circle', { cx: 48, cy: 58, r: 2.2, fill: '#ffffff' }),
      el('circle', { cx: 76, cy: 58, r: 2.2, fill: '#ffffff' }),
    ),
    // Smile.
    el('path', { d: 'M50 74 Q60 81 70 74', fill: 'none', stroke: '#7ff2e0', 'stroke-width': 3.5, 'stroke-linecap': 'round' }),
    // Cheeks.
    el('circle', { cx: 34, cy: 76, r: 3.5, fill: '#ff9fbf', opacity: 0.8 }),
    el('circle', { cx: 86, cy: 76, r: 3.5, fill: '#ff9fbf', opacity: 0.8 }),
    // Thought dots (visible only while thinking).
    el(
      'g',
      { class: 'beepy__thoughts' },
      el('circle', { cx: 96, cy: 18, r: 3, fill: '#4b3fd9' }),
      el('circle', { cx: 105, cy: 10, r: 4, fill: '#4b3fd9' }),
      el('circle', { cx: 114, cy: 3, r: 3, fill: '#4b3fd9' }),
    ),
  );

  svg.append(defs, figure);
  return svg;
}
