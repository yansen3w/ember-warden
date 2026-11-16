// The screenshot scenes behind ?shot=start|play|win|end. Each one plays the real rules
// forward from a fresh world for a fixed stretch, steered by an autopilot, so the frame is
// what a real game looks like and the same seed always gives the same frame. The strong
// pilot aims at the lowest moth, fires whenever anything is above, and sidesteps the dark
// orbs; the weak one chases the moths without ever firing, the way a careless player does,
// so it is caught out and the night takes it.
import { BOSS, FIELD, STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN, KIND_BOSS } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 38;
const END_LIMIT_SECONDS = 420;
const SAMPLE = 1 / 30;

/** How far ahead, in seconds, the strong pilot checks for an orb on a collision course. */
const DODGE_AHEAD = 0.55;
/** How close, in pixels, an orb must come to count as a threat. */
const DODGE_RANGE = 52;

function nearestThreat(state) {
  const player = state.player;
  for (let index = 0; index < state.orbs.length; index += 1) {
    const orb = state.orbs[index];
    if (!orb.active) continue;
    const dy = player.y - orb.y;
    if (dy < 0 || dy > 170) continue;
    const time = dy / BOSS.orbSpeed;
    if (time > DODGE_AHEAD) continue;
    const futureX = orb.x + orb.vx * time;
    if (Math.abs(futureX + 7 - (player.x + player.w / 2)) < DODGE_RANGE) return futureX + 7;
  }
  // Any moth low over the ridge and near the warden's line is a threat: never stand
  // under it. The window is wide on purpose — a low moth is already too close to chase.
  for (let index = 0; index < state.enemies.length; index += 1) {
    const enemy = state.enemies[index];
    if (!enemy.active || enemy.kind === KIND_BOSS) continue;
    const dy = player.y - enemy.y;
    const reach = enemy.diving ? 260 : 240;
    if (dy < 0 || dy > reach) continue;
    if (Math.abs(enemy.x + enemy.w / 2 - (player.x + player.w / 2)) < 100) return enemy.x + enemy.w / 2;
  }
  return null;
}

/** Steer toward a target x, with a small dead band so the warden does not jitter. */
function steerToward(player, target) {
  const centre = player.x + player.w / 2;
  if (target > centre + 8) return 1;
  if (target < centre - 8) return -1;
  return 0;
}

function strongPilot(state) {
  const player = state.player;
  const threat = nearestThreat(state);
  if (threat !== null) {
    const away = threat > player.x + player.w / 2 ? -1 : 1;
    if ((away === -1 && player.x > 10) || (away === 1 && player.x < FIELD.width - player.w - 10)) return { move: away, firing: true };
  }
  const boss = state.boss;
  if (boss !== null && boss.active) return { move: steerToward(player, boss.x + boss.w / 2), firing: true };
  // Aim at the lowest enemy that is still high up: burn moths while they are far away,
  // and let the low ones fall past the ridge instead of standing under them to shoot.
  // A diving darter is a threat to dodge, not a target to chase under.
  let target = null;
  let lowest = -1;
  for (let index = 0; index < state.enemies.length; index += 1) {
    const enemy = state.enemies[index];
    const dy = player.y - enemy.y;
    if (enemy.active && !enemy.diving && dy > 240 && enemy.y > lowest) {
      lowest = enemy.y;
      target = enemy.x + enemy.w / 2;
    }
  }
  if (target === null) {
    // Nothing high to aim at: hold near the centre and keep firing upward.
    const centre = FIELD.width / 2;
    const here = player.x + player.w / 2;
    return { move: here > centre + 40 ? -1 : here < centre - 40 ? 1 : 0, firing: true };
  }
  return { move: steerToward(player, target), firing: true };
}

function weakPilot(state) {
  let target = null;
  let lowest = -1;
  for (let index = 0; index < state.enemies.length; index += 1) {
    const enemy = state.enemies[index];
    if (enemy.active && enemy.y > lowest) {
      lowest = enemy.y;
      target = enemy.x + enemy.w / 2;
    }
  }
  if (target === null) return { move: 0, firing: false };
  return { move: steerToward(state.player, target), firing: false };
}

/**
 * Set `world` to the named scene (start, play, win or end; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'win' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, 0, false, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
      const pilot = strongPilot(world.state);
      world.step(STEP, pilot.move, pilot.firing, false);
      if (world.state.over || world.state.won) break;
    }
    return { screen: world.state.over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  const limit = END_LIMIT_SECONDS;
  const pilot = name === 'win' ? strongPilot : weakPilot;
  for (let index = 0; index < limit / STEP; index += 1) {
    const move = pilot(world.state);
    const events = world.step(STEP, move.move, move.firing, false);
    if (events & EVENT_WIN) return { screen: SCREEN_WIN, best: world.state.score };
    if (events & EVENT_OVER) return { screen: SCREEN_OVER, best: world.state.score };
  }
  return { screen: name === 'win' ? SCREEN_PLAY : SCREEN_OVER, best: world.state.score };
}
