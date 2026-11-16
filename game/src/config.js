// Every tuning number and colour of Ember Warden in one place. The playfield is a fixed
// 1280x480 logical area; the renderer scales it to fit the window, so no rule below depends
// on the screen size. A night scene: a warden on a ridge at the bottom, gloom-moths drifting
// down out of the dark, ember bolts flying up to meet them.
export const FIELD = { width: 1280, height: 480, ridgeY: 436 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  width: 54,
  height: 38,
  speed: 520,
  fireInterval: 0.2,
  rapidFireInterval: 0.11,
  invulnerable: 1.6,
  boltSpeed: 640,
};

export const LIVES = 3;

/** How many waves the night lasts; the last one brings the Gloom Queen. */
export const WAVES = 5;

/** Seconds the wave banner shows between waves. */
export const BETWEEN_WAVES = 2.5;

/** Moths are the common enemy: slow, drifting, one ember to burn. */
export const MOTH = { hp: 1, speed: 52, speedJitter: 26, points: 50, size: 30 };

/** Darters wait, then dive at the warden's lantern. */
export const DARTER = { hp: 1, speed: 118, diveSpeed: 260, points: 100, size: 26 };

/** Weavers take two embers and sweep side to side as they fall. */
export const WEAVER = { hp: 2, speed: 58, sweep: 130, points: 150, size: 34 };

/** The Gloom Queen, wave five: many embers to burn, and she throws dark orbs back. */
export const BOSS = { hp: 40, speed: 62, points: 2000, size: 96, orbInterval: 1.5, orbSpeed: 205 };

/** What a kill is worth grows with the combo: every 10 kills without a hit adds a multiplier. */
export const COMBO_PER_MULTIPLIER = 10;

/** A slain enemy drops a blessing this often. */
export const DROP_CHANCE = 0.12;

/** Blessings fall slowly and are caught by flying into them. */
export const BLESSING = { speed: 92, spreadSeconds: 12, rapidSeconds: 12 };

/** Pool sizes: allocated once, at boot, so a frame never allocates. */
export const POOLS = { bullets: 48, orbs: 32, enemies: 40, blessings: 8, particles: 160, popups: 16, stars: 70 };

export const PALETTE = {
  backdrop: '#0a0d1a',
  skyTop: '#131a33',
  skyBottom: '#2b1d3d',
  ridge: '#1a2138',
  ridgeGlow: '#ff9a3c',
  moon: '#f2ead2',
  moonGlow: '#d8c690',
  playerCloak: '#2ec4b6',
  playerHood: '#1f8f86',
  lantern: '#ffc46b',
  lanternGlow: '#ff9a3c',
  bolt: '#ffd166',
  moth: '#c9b8ff',
  mothWing: '#6b5b95',
  darter: '#ff5d73',
  weaver: '#7ef0c1',
  boss: '#b388ff',
  bossCore: '#ff5da2',
  orb: '#a06bff',
  spread: '#ff8c42',
  rapid: '#4fc3f7',
  shield: '#8affc1',
  panel: '#171d33',
  panelEdge: '#3a4470',
  text: '#f4ead8',
  muted: '#9aa3b2',
  danger: '#ff5d73',
};

export const FONT = '"Trebuchet MS", system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'ember-warden.best';
