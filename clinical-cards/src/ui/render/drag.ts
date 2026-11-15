/**
 * Drag-and-drop for hand cards (Milestone M5, U10; decision U-7).
 *
 * Dragging is only another way to give the SAME commands as tap-to-play:
 *   drag starts  -> select(card)          (all open problems and Discard light up,
 *                                          exactly as when the card is tapped)
 *   drop on a problem -> playOn(problem)  (the engine judges, as always)
 *   drop on Discard   -> discard()
 *   drop anywhere else, Escape, or a cancelled pointer -> nothing is played; the
 *                                          selection is cleared again if the drag
 *                                          created it
 * No drag rule exists here: validation, penalties, scoring, and endings all stay in
 * the engine behind the session.
 *
 * Avoiding accidents: a drag starts only after the pointer moves
 * `DRAG_THRESHOLD_PX` with the primary button; a shorter press is an ordinary tap
 * (the existing click handler runs). A card only lands on a lit-up target.
 *
 * Two parts:
 *   - `createDragController(actions)`: DOM-free logic, tested in Node.
 *   - `installDragAndDrop(root, actions)`: pointer-event wiring for the browser.
 *     Listeners sit on the window, not on the card, because the board is redrawn
 *     when the drag selects the card. Pointer events cover mouse, pen, and touch.
 */

/** Pixels the pointer must move before a press becomes a drag. */
export const DRAG_THRESHOLD_PX = 10;

export type DropTarget = { readonly kind: 'play'; readonly challengeId: string } | { readonly kind: 'discard' };

/** Read a `data-drop` value ("challenge:<id>" or "discard"). */
export function parseDropTarget(value: string | null | undefined): DropTarget | undefined {
  if (value === 'discard') return { kind: 'discard' };
  if (typeof value === 'string' && value.startsWith('challenge:') && value.length > 'challenge:'.length) {
    return { kind: 'play', challengeId: value.slice('challenge:'.length) };
  }
  return undefined;
}

/** The session commands a drag may give (the same ones tapping uses). */
export interface DragActions {
  readonly select: (handle: string) => void;
  readonly cancel: () => void;
  readonly playOn: (challengeId: string) => void;
  readonly discard: () => void;
  readonly isSelected: (handle: string) => boolean;
  /** True when the human may act now. */
  readonly canDrag: () => boolean;
}

export type ReleaseResult = 'none' | 'tap' | 'dropped' | 'cancelled';

type DragState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'pressed'; readonly handle: string; readonly x: number; readonly y: number }
  | { readonly phase: 'dragging'; readonly handle: string; readonly wasSelected: boolean };

export interface DragController {
  /** Primary-button press on a hand card. Returns false if no drag may start. */
  press(handle: string, x: number, y: number): boolean;
  /** Pointer moved. 'started' when this move turned the press into a drag. */
  move(x: number, y: number): 'none' | 'started' | 'moving';
  /** Pointer released over `target` (undefined: not over a target). */
  release(target: DropTarget | undefined): ReleaseResult;
  /** Escape or pointer cancelled. */
  abort(): void;
  isDragging(): boolean;
  draggedHandle(): string | undefined;
}

export function createDragController(actions: DragActions): DragController {
  let state: DragState = { phase: 'idle' };

  const undoSelection = (handle: string, wasSelected: boolean): void => {
    if (!wasSelected && actions.isSelected(handle)) actions.cancel();
  };

  return {
    press(handle, x, y) {
      if (!actions.canDrag()) return false;
      state = { phase: 'pressed', handle, x, y };
      return true;
    },
    move(x, y) {
      if (state.phase === 'dragging') return 'moving';
      if (state.phase !== 'pressed') return 'none';
      if (Math.hypot(x - state.x, y - state.y) < DRAG_THRESHOLD_PX) return 'none';
      if (!actions.canDrag()) {
        state = { phase: 'idle' };
        return 'none';
      }
      const wasSelected = actions.isSelected(state.handle);
      if (!wasSelected) actions.select(state.handle);
      state = { phase: 'dragging', handle: state.handle, wasSelected };
      return 'started';
    },
    release(target) {
      const current = state;
      state = { phase: 'idle' };
      if (current.phase === 'pressed') return 'tap';
      if (current.phase !== 'dragging') return 'none';
      if (target === undefined || !actions.isSelected(current.handle)) {
        undoSelection(current.handle, current.wasSelected);
        return 'cancelled';
      }
      if (target.kind === 'play') actions.playOn(target.challengeId);
      else actions.discard();
      return 'dropped';
    },
    abort() {
      const current = state;
      state = { phase: 'idle' };
      if (current.phase === 'dragging') undoSelection(current.handle, current.wasSelected);
    },
    isDragging: () => state.phase === 'dragging',
    draggedHandle: () => (state.phase === 'idle' ? undefined : state.handle),
  };
}

// ---------------------------------------------------------------------------
// Browser wiring

const HOVER_CLASS = 'drop-hover';

function dropElementAt(x: number, y: number): HTMLElement | undefined {
  const hit = document.elementFromPoint(x, y);
  const target = hit instanceof Element ? hit.closest<HTMLElement>('[data-drop]') : null;
  return target ?? undefined;
}

/** Wire pointer-event drag-and-drop on hand cards inside `root`. Returns an uninstall function. */
export function installDragAndDrop(root: HTMLElement, actions: DragActions): () => void {
  const controller = createDragController(actions);
  let pointerId: number | undefined;
  let ghost: HTMLElement | undefined;
  let hovered: HTMLElement | undefined;
  let suppressClick = false;

  const setHovered = (next: HTMLElement | undefined): void => {
    if (hovered === next) return;
    hovered?.classList.remove(HOVER_CLASS);
    hovered = next;
    hovered?.classList.add(HOVER_CLASS);
  };

  const placeGhost = (x: number, y: number): void => {
    if (ghost !== undefined) ghost.style.transform = `translate(${x}px, ${y}px) translate(-50%, -60%) rotate(-3deg)`;
  };

  const cleanup = (): void => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('keydown', onKey, true);
    pointerId = undefined;
    ghost?.remove();
    ghost = undefined;
    setHovered(undefined);
    root.classList.remove('is-dragging');
  };

  function onMove(event: PointerEvent): void {
    if (event.pointerId !== pointerId) return;
    const step = controller.move(event.clientX, event.clientY);
    if (step === 'none') return;
    event.preventDefault();
    if (step === 'started') {
      const handle = controller.draggedHandle() ?? '';
      const card = root.querySelector<HTMLElement>(`[data-handle="${CSS.escape(handle)}"]`);
      ghost = document.createElement('div');
      ghost.className = `drag-ghost${card?.classList.contains('card--wide') === true ? ' drag-ghost--wide' : ''}`;
      ghost.setAttribute('aria-hidden', 'true');
      ghost.textContent = card?.querySelector('.card__face')?.textContent ?? '';
      document.body.append(ghost);
      root.classList.add('is-dragging');
    }
    placeGhost(event.clientX, event.clientY);
    setHovered(dropElementAt(event.clientX, event.clientY));
  }

  function onUp(event: PointerEvent): void {
    if (event.pointerId !== pointerId) return;
    const target = parseDropTarget(dropElementAt(event.clientX, event.clientY)?.dataset['drop']);
    cleanup();
    const result = controller.release(target);
    if (result === 'dropped' || result === 'cancelled') {
      // The click that follows a drag must not also select or play anything.
      suppressClick = true;
      window.setTimeout(() => {
        suppressClick = false;
      }, 0);
    }
  }

  function onCancel(event: PointerEvent): void {
    if (event.pointerId !== pointerId) return;
    cleanup();
    controller.abort();
  }

  function onKey(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || !controller.isDragging()) return;
    event.stopPropagation();
    cleanup();
    controller.abort();
  }

  const onDown = (event: PointerEvent): void => {
    if (!event.isPrimary || event.button !== 0 || pointerId !== undefined) return;
    const card = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button.card[data-handle]') : null;
    if (card === null || card.disabled) return;
    const handle = card.dataset['handle'];
    if (handle === undefined || !controller.press(handle, event.clientX, event.clientY)) return;
    pointerId = event.pointerId;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey, true);
  };

  const onClickCapture = (event: MouseEvent): void => {
    if (!suppressClick) return;
    suppressClick = false;
    event.stopPropagation();
    event.preventDefault();
  };

  // Stop the browser's own image/text drag from starting on a card.
  const onNativeDrag = (event: DragEvent): void => {
    if (event.target instanceof Element && event.target.closest('button.card') !== null) event.preventDefault();
  };

  root.addEventListener('pointerdown', onDown);
  root.addEventListener('click', onClickCapture, true);
  root.addEventListener('dragstart', onNativeDrag);
  return () => {
    cleanup();
    root.removeEventListener('pointerdown', onDown);
    root.removeEventListener('click', onClickCapture, true);
    root.removeEventListener('dragstart', onNativeDrag);
  };
}
