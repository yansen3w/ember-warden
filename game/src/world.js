// The game's rules and state, with no drawing and no browser in it: the warden, the ember
// bolts, the gloom-moths and their kinds, the waves, the boss, blessings, score, combo and
// lives. step() advances one fixed step and returns what happened as bit flags, so the
// caller can react (sounds, announcements) without the world knowing about screens or
// sound. Nothing here allocates after createWorld returns: every pool is filled at boot.
import {
  BETWEEN_WAVES,
  BLESSING,
  BOSS,
  COMBO_PER_MULTIPLIER,
  DARTER,
  DROP_CHANCE,
  FIELD,
  LIVES,
  MOTH,
  PLAYER,
  POOLS,
  WAVES,
  WEAVER,
} from './config.js';

export const KIND_MOTH = 0;
export const KIND_DARTER = 1;
export const KIND_WEAVER = 2;
export const KIND_BOSS = 3;

export const BLESS_SPREAD = 0;
export const BLESS_RAPID = 1;
export const BLESS_SHIELD = 2;

export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_WAVE = 4;
export const EVENT_WIN = 8;
export const EVENT_OVER = 16;
export const EVENT_BLESSING = 32;

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function burst(particles, x, y, color, count, random, speed) {
  let made = 0;
  for (let index = 0; index < particles.length && made < count; index += 1) {
    const particle = particles[index];
    if (particle.life > 0) continue;
    const angle = random() * Math.PI * 2;
    const power = speed * (0.4 + random() * 0.8);
    particle.x = x;
    particle.y = y;
    particle.vx = Math.cos(angle) * power;
    particle.vy = Math.sin(angle) * power - 40;
    particle.life = 0.5 + random() * 0.4;
    particle.maxLife = particle.life;
    particle.color = color;
    particle.size = 2 + random() * 3;
    made += 1;
  }
}

function popup(popups, x, y, text, color) {
  for (let index = 0; index < popups.length; index += 1) {
    const item = popups[index];
    if (item.life > 0) continue;
    item.x = x;
    item.y = y;
    item.text = text;
    item.color = color;
    item.life = 1.1;
    return;
  }
}

export function createWorld(random) {
  const player = {
    x: 0,
    y: FIELD.ridgeY - PLAYER.height - 6,
    w: PLAYER.width,
    h: PLAYER.height,
    invulnerable: 0,
    fireTimer: 0,
    spreadT: 0,
    rapidT: 0,
    shield: false,
  };
  const bullets = [];
  for (let index = 0; index < POOLS.bullets; index += 1) {
    bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, w: 6, h: 14 });
  }
  const orbs = [];
  for (let index = 0; index < POOLS.orbs; index += 1) {
    orbs.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, w: 14, h: 14 });
  }
  const enemies = [];
  for (let index = 0; index < POOLS.enemies; index += 1) {
    enemies.push({ active: false, kind: KIND_MOTH, x: 0, y: 0, w: 0, h: 0, hp: 1, maxHp: 1, speed: 0, phase: 0, baseX: 0, diving: false });
  }
  const blessings = [];
  for (let index = 0; index < POOLS.blessings; index += 1) {
    blessings.push({ active: false, kind: BLESS_SPREAD, x: 0, y: 0, w: 26, h: 26 });
  }
  const particles = [];
  for (let index = 0; index < POOLS.particles; index += 1) {
    particles.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, color: '#fff', size: 2 });
  }
  const popups = [];
  for (let index = 0; index < POOLS.popups; index += 1) {
    popups.push({ x: 0, y: 0, text: '', color: '#fff', life: 0 });
  }
  const stars = [];
  for (let index = 0; index < POOLS.stars; index += 1) {
    stars.push({ x: random() * FIELD.width, y: random() * FIELD.ridgeY * 0.8, r: 0.6 + random() * 1.6, phase: random() * Math.PI * 2, speed: 0.6 + random() * 1.8 });
  }

  const state = {
    player,
    bullets,
    orbs,
    enemies,
    blessings,
    particles,
    popups,
    stars,
    score: 0,
    combo: 0,
    lives: LIVES,
    wave: 0,
    elapsed: 0,
    shake: 0,
    banner: '',
    bannerT: 0,
    betweenTimer: 0,
    pendingWave: 1,
    spawnQueue: [],
    spawnTimer: 0,
    boss: null,
    bossOrbTimer: 0,
    bossSpawnTimer: 0,
    ambientTimer: 0,
    won: false,
    over: false,
  };

  /** The wave's roster, shuffled: moths always, darters from wave two, weavers from wave three. */
  function buildWave(wave) {
    const queue = [];
    const moths = 5 + 2 * wave;
    const darters = wave >= 2 ? wave : 0;
    const weavers = wave >= 3 ? wave - 1 : 0;
    for (let index = 0; index < moths; index += 1) queue.push(KIND_MOTH);
    for (let index = 0; index < darters; index += 1) queue.push(KIND_DARTER);
    for (let index = 0; index < weavers; index += 1) queue.push(KIND_WEAVER);
    for (let index = queue.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      const held = queue[index];
      queue[index] = queue[swap];
      queue[swap] = held;
    }
    return queue;
  }

  function freeEnemy() {
    for (let index = 0; index < enemies.length; index += 1) if (!enemies[index].active) return enemies[index];
    return null;
  }

  function spawnEnemy(kind, x) {
    const enemy = freeEnemy();
    if (enemy === null) return null;
    const size = kind === KIND_MOTH ? MOTH.size : kind === KIND_DARTER ? DARTER.size : kind === KIND_WEAVER ? WEAVER.size : BOSS.size;
    enemy.active = true;
    enemy.kind = kind;
    enemy.w = size;
    enemy.h = size * 0.8;
    enemy.x = x === undefined ? random() * (FIELD.width - size) : x;
    enemy.baseX = enemy.x;
    enemy.y = kind === KIND_BOSS ? 56 : -enemy.h;
    enemy.hp = kind === KIND_MOTH ? MOTH.hp : kind === KIND_DARTER ? DARTER.hp : kind === KIND_WEAVER ? WEAVER.hp : BOSS.hp;
    enemy.maxHp = enemy.hp;
    enemy.speed = kind === KIND_MOTH ? MOTH.speed + random() * MOTH.speedJitter : kind === KIND_DARTER ? DARTER.speed : kind === KIND_WEAVER ? WEAVER.speed : BOSS.speed;
    enemy.phase = random() * Math.PI * 2;
    enemy.diving = false;
    if (kind === KIND_BOSS) state.boss = enemy;
    return enemy;
  }

  function startWave(wave) {
    state.wave = wave;
    state.banner = wave === WAVES ? 'THE GLOOM QUEEN' : `WAVE ${wave}`;
    state.bannerT = 2;
    state.spawnQueue = wave === WAVES ? [KIND_BOSS] : buildWave(wave);
    state.spawnTimer = 0.8;
    state.bossOrbTimer = 1.6;
    state.bossSpawnTimer = 4;
  }

  function reset() {
    player.x = (FIELD.width - player.w) / 2;
    player.invulnerable = 0;
    player.fireTimer = 0;
    player.spreadT = 0;
    player.rapidT = 0;
    player.shield = false;
    for (const bullet of bullets) bullet.active = false;
    for (const orb of orbs) orb.active = false;
    for (const enemy of enemies) enemy.active = false;
    for (const blessing of blessings) blessing.active = false;
    for (const particle of particles) particle.life = 0;
    for (const item of popups) item.life = 0;
    state.score = 0;
    state.combo = 0;
    state.lives = LIVES;
    state.wave = 0;
    state.elapsed = 0;
    state.shake = 0;
    state.banner = '';
    state.bannerT = 0;
    state.betweenTimer = 1.2;
    state.pendingWave = 1;
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.boss = null;
    state.bossOrbTimer = 0;
    state.bossSpawnTimer = 0;
    state.ambientTimer = 0;
    state.won = false;
    state.over = false;
  }

  function fireBolt() {
    const centre = player.x + player.w / 2;
    const top = player.y - 8;
    let made = 0;
    for (let index = 0; index < bullets.length && made < (player.spreadT > 0 ? 3 : 1); index += 1) {
      const bullet = bullets[index];
      if (bullet.active) continue;
      bullet.active = true;
      bullet.x = centre - 3 + (made - (player.spreadT > 0 ? 1 : 0)) * 14;
      bullet.y = top;
      bullet.vx = (made - (player.spreadT > 0 ? 1 : 0)) * 130;
      bullet.vy = -PLAYER.boltSpeed;
      made += 1;
    }
  }

  function dropBlessing(x, y) {
    if (random() > DROP_CHANCE) return;
    for (let index = 0; index < blessings.length; index += 1) {
      const blessing = blessings[index];
      if (blessing.active) continue;
      blessing.active = true;
      blessing.kind = Math.floor(random() * 3);
      blessing.x = Math.min(FIELD.width - blessing.w, Math.max(0, x));
      blessing.y = y;
      return;
    }
  }

  function multiplier() {
    return 1 + Math.floor(state.combo / COMBO_PER_MULTIPLIER);
  }

  function playerHit(events) {
    if (player.shield) {
      player.shield = false;
      player.invulnerable = 1;
      burst(particles, player.x + player.w / 2, player.y + player.h / 2, '#8affc1', 14, random, 180);
      return events | EVENT_HIT;
    }
    state.lives -= 1;
    state.combo = 0;
    player.invulnerable = PLAYER.invulnerable;
    state.shake = 0.45;
    burst(particles, player.x + player.w / 2, player.y + player.h / 2, '#ff5d73', 18, random, 220);
    if (state.lives <= 0) {
      state.over = true;
      return events | EVENT_HIT | EVENT_OVER;
    }
    return events | EVENT_HIT;
  }

  function killEnemy(enemy, events) {
    enemy.active = false;
    const points = (enemy.kind === KIND_MOTH ? MOTH.points : enemy.kind === KIND_DARTER ? DARTER.points : enemy.kind === KIND_WEAVER ? WEAVER.points : BOSS.points) * multiplier();
    state.score += points;
    state.combo += 1;
    const colour = enemy.kind === KIND_BOSS ? '#b388ff' : '#ffd166';
    burst(particles, enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, colour, enemy.kind === KIND_BOSS ? 60 : 12, random, enemy.kind === KIND_BOSS ? 320 : 200);
    popup(popups, enemy.x + enemy.w / 2, enemy.y, `+${points}`, colour);
    if (enemy.kind === KIND_BOSS) {
      state.boss = null;
      state.won = true;
      return events | EVENT_KILL | EVENT_WIN;
    }
    dropBlessing(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2);
    return events | EVENT_KILL;
  }

  /**
   * One fixed step. `move` is -1, 0 or 1 (left, still, right); `firing` holds the trigger.
   * With `harmless` set (the title screen's backdrop) moths drift down but nothing touches
   * the player and nothing scores.
   */
  function step(dt, move, firing, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);
    if (state.bannerT > 0) state.bannerT = Math.max(0, state.bannerT - dt);
    for (let index = 0; index < particles.length; index += 1) {
      const particle = particles[index];
      if (particle.life <= 0) continue;
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 60 * dt;
    }
    for (let index = 0; index < popups.length; index += 1) {
      const item = popups[index];
      if (item.life <= 0) continue;
      item.life -= dt;
      item.y -= 34 * dt;
    }

    if (harmless) {
      state.ambientTimer -= dt;
      if (state.ambientTimer <= 0) {
        spawnEnemy(KIND_MOTH);
        state.ambientTimer = 1.1 + random() * 0.9;
      }
      for (let index = 0; index < enemies.length; index += 1) {
        const enemy = enemies[index];
        if (!enemy.active) continue;
        enemy.y += enemy.speed * 0.6 * dt;
        enemy.x = enemy.baseX + Math.sin(state.elapsed * 1.4 + enemy.phase) * 16;
        if (enemy.y > FIELD.height) enemy.active = false;
      }
      return events;
    }

    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (player.spreadT > 0) player.spreadT = Math.max(0, player.spreadT - dt);
    if (player.rapidT > 0) player.rapidT = Math.max(0, player.rapidT - dt);

    player.x = Math.min(FIELD.width - player.w, Math.max(0, player.x + move * PLAYER.speed * dt));

    player.fireTimer -= dt;
    if (firing && player.fireTimer <= 0) {
      fireBolt();
      player.fireTimer = player.rapidT > 0 ? PLAYER.rapidFireInterval : PLAYER.fireInterval;
    }

    if (state.betweenTimer > 0) {
      state.betweenTimer -= dt;
      if (state.betweenTimer <= 0) startWave(state.pendingWave);
    } else if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnEnemy(state.spawnQueue.shift());
        state.spawnTimer += Math.max(0.45, 0.85 - 0.06 * state.wave);
      }
    }

    const boss = state.boss;
    if (boss !== null && boss.active) {
      boss.x = FIELD.width / 2 - boss.w / 2 + Math.sin(state.elapsed * 0.5) * 380;
      state.bossOrbTimer -= dt;
      if (state.bossOrbTimer <= 0) {
        state.bossOrbTimer = BOSS.orbInterval;
        for (let index = 0; index < orbs.length; index += 1) {
          const orb = orbs[index];
          if (orb.active) continue;
          orb.active = true;
          orb.x = boss.x + boss.w / 2 - orb.w / 2;
          orb.y = boss.y + boss.h - 6;
          const dx = player.x + player.w / 2 - (orb.x + orb.w / 2);
          orb.vx = Math.max(-90, Math.min(90, dx * 0.9));
          orb.vy = BOSS.orbSpeed;
          break;
        }
      }
      state.bossSpawnTimer -= dt;
      if (state.bossSpawnTimer <= 0) {
        state.bossSpawnTimer = 4.5;
        let minions = 0;
        for (let index = 0; index < enemies.length; index += 1) {
          if (enemies[index].active && enemies[index].kind === KIND_MOTH) minions += 1;
        }
        if (minions < 3) spawnEnemy(KIND_MOTH);
      }
    }

    for (let index = 0; index < bullets.length; index += 1) {
      const bullet = bullets[index];
      if (!bullet.active) continue;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.y < -20 || bullet.x < -20 || bullet.x > FIELD.width + 20) {
        bullet.active = false;
        continue;
      }
      for (let other = 0; other < enemies.length; other += 1) {
        const enemy = enemies[other];
        if (!enemy.active || !overlaps(bullet, enemy)) continue;
        bullet.active = false;
        enemy.hp -= 1;
        burst(particles, bullet.x, bullet.y, '#ffd166', 4, random, 120);
        if (enemy.hp <= 0) events = killEnemy(enemy, events);
        break;
      }
      if (events & EVENT_WIN) return events;
    }

    for (let index = 0; index < orbs.length; index += 1) {
      const orb = orbs[index];
      if (!orb.active) continue;
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
      if (orb.y > FIELD.height) {
        orb.active = false;
        continue;
      }
      if (player.invulnerable === 0 && overlaps(orb, player)) {
        orb.active = false;
        events = playerHit(events);
        if (events & EVENT_OVER) return events;
      }
    }

    for (let index = 0; index < enemies.length; index += 1) {
      const enemy = enemies[index];
      if (!enemy.active) continue;
      if (enemy.kind === KIND_MOTH) {
        enemy.y += enemy.speed * dt;
        enemy.x = enemy.baseX + Math.sin(state.elapsed * 1.5 + enemy.phase) * 18;
      } else if (enemy.kind === KIND_DARTER) {
        if (enemy.y > 140 && !enemy.diving) enemy.diving = true;
        if (enemy.diving) {
          const target = player.x + player.w / 2 - enemy.w / 2;
          const stepX = Math.max(-DARTER.diveSpeed * dt, Math.min(DARTER.diveSpeed * dt, target - enemy.x));
          enemy.x += stepX;
          enemy.y += DARTER.diveSpeed * 0.85 * dt;
        } else {
          enemy.y += enemy.speed * dt;
        }
      } else if (enemy.kind === KIND_WEAVER) {
        enemy.y += enemy.speed * dt;
        enemy.x = enemy.baseX + Math.sin(state.elapsed * 2 + enemy.phase) * WEAVER.sweep;
        enemy.x = Math.min(FIELD.width - enemy.w, Math.max(0, enemy.x));
      }
      if (enemy.kind !== KIND_BOSS && enemy.y > FIELD.ridgeY + 8) {
        enemy.active = false;
        state.combo = 0;
        continue;
      }
      if (player.invulnerable === 0 && overlaps(enemy, player)) {
        events = killEnemy(enemy, events);
        events = playerHit(events);
        if (events & (EVENT_OVER | EVENT_WIN)) return events;
      }
    }

    for (let index = 0; index < blessings.length; index += 1) {
      const blessing = blessings[index];
      if (!blessing.active) continue;
      blessing.y += BLESSING.speed * dt;
      if (blessing.y > FIELD.height) {
        blessing.active = false;
        continue;
      }
      if (overlaps(blessing, player)) {
        blessing.active = false;
        if (blessing.kind === BLESS_SPREAD) {
          player.spreadT = BLESSING.spreadSeconds;
          popup(popups, player.x + player.w / 2, player.y - 12, 'TRIPLE EMBERS!', '#ff8c42');
        } else if (blessing.kind === BLESS_RAPID) {
          player.rapidT = BLESSING.rapidSeconds;
          popup(popups, player.x + player.w / 2, player.y - 12, 'SWIFT HAND!', '#4fc3f7');
        } else {
          player.shield = true;
          popup(popups, player.x + player.w / 2, player.y - 12, 'WARD SHIELD!', '#8affc1');
        }
        events |= EVENT_BLESSING;
      }
    }

    if (!state.won && !state.over && state.betweenTimer <= 0 && state.spawnQueue.length === 0 && state.boss === null) {
      let remaining = false;
      for (let index = 0; index < enemies.length; index += 1) {
        if (enemies[index].active) {
          remaining = true;
          break;
        }
      }
      if (!remaining && state.wave >= 1 && state.wave < WAVES) {
        const bonus = 150 * state.wave;
        state.score += bonus;
        state.lives = Math.min(LIVES, state.lives + 1);
        state.banner = `WAVE CLEAR  +${bonus}`;
        state.bannerT = 2;
        state.betweenTimer = BETWEEN_WAVES;
        state.pendingWave = state.wave + 1;
        events |= EVENT_WAVE;
      }
    }
    return events;
  }

  reset();
  return { state, reset, step };
}
