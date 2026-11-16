// Keyboard, mouse and touch input. Held keys give a steering direction and a held fire
// button; one-shot presses (start or restart, pause, mute) are queued as bit flags and taken
// once by the loop, so a press between two frames is never lost and never counted twice.
// The mouse steers too: the warden glides toward the pointer's x while it moves.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const FIRE = new Set(['Space', 'KeyJ', 'KeyZ']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  let left = false;
  let right = false;
  let fireKey = false;
  let pointerFire = false;
  let pointerX = null;
  let pointerFresh = 0;
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (FIRE.has(event.code)) fireKey = true;
    else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
      return;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
      return;
    } else return;
    if (CONFIRM.has(event.code) && !event.repeat) actions |= ACTION_CONFIRM;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (FIRE.has(event.code)) fireKey = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    left = false;
    right = false;
    fireKey = false;
    pointerFire = false;
  });
  target.addEventListener('pointermove', (event) => {
    const rect = target.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / rect.width) * 1280;
    pointerFresh = 0.6;
  });
  target.addEventListener('pointerdown', (event) => {
    const rect = target.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / rect.width) * 1280;
    pointerFresh = 0.6;
    pointerFire = true;
    actions |= ACTION_CONFIRM;
  });
  target.addEventListener('pointerup', () => {
    pointerFire = false;
  });
  target.addEventListener('pointerleave', () => {
    pointerFire = false;
  });

  return {
    /** -1 for left, 1 for right, 0 for neither or both. */
    direction() {
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    /** Where the pointer last pointed, in field pixels, or null when it has gone stale. */
    pointerTarget(dt) {
      if (pointerFresh > 0) pointerFresh = Math.max(0, pointerFresh - dt);
      return pointerFresh > 0 ? pointerX : null;
    },
    /** True while a fire key or the pointer is held down. */
    firing() {
      return fireKey || pointerFire;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
