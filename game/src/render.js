// Drawing only: the world's state and the current screen in, pixels out. The 1280x480
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. A night sky with a moon and twinkling stars, an ember-lit ridge, a hooded warden
// with a glowing lantern, and moths drawn from arcs and ellipses — no image files at all.
// Text that holds a number is rebuilt only when the number changes, so a frame allocates
// nothing.
import { BOSS, FIELD, FONT, LIVES, PALETTE } from './config.js';
import { BLESS_RAPID, BLESS_SHIELD, BLESS_SPREAD, KIND_BOSS, KIND_DARTER, KIND_MOTH, KIND_WEAVER } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 620, top: 128, line: 32, bottom: 64 };
const HEART = 18;

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const waveLabel = cachedLabel('WAVE ');
  const finalLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function font(size, bold) {
    const key = `${bold ? 'b' : ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? 'bold ' : ''}${size}px ${FONT}`);
    return fonts.get(key);
  }

  function text(value, x, y, size, color, align, bold, baseline) {
    context.font = font(size, bold);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline ?? 'alphabetic';
    context.fillText(value, x, y);
  }

  function glowCircle(x, y, radius, color, alpha) {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.globalAlpha = alpha;
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
  }

  function drawSky(state, now) {
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.skyTop);
    gradient.addColorStop(1, PALETTE.skyBottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    glowCircle(1120, 74, 110, PALETTE.moonGlow, 0.25);
    context.fillStyle = PALETTE.moon;
    context.beginPath();
    context.arc(1120, 74, 34, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.skyTop;
    context.beginPath();
    context.arc(1108, 66, 30, 0, Math.PI * 2);
    context.fill();
    for (let index = 0; index < state.stars.length; index += 1) {
      const star = state.stars[index];
      const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(now * star.speed + star.phase));
      context.globalAlpha = twinkle;
      context.fillStyle = '#e8ecff';
      context.fillRect(star.x, star.y, star.r, star.r);
    }
    context.globalAlpha = 1;
    context.fillStyle = PALETTE.ridge;
    context.beginPath();
    context.moveTo(0, FIELD.ridgeY);
    for (let x = 0; x <= FIELD.width; x += 80) {
      context.lineTo(x, FIELD.ridgeY - 14 - 10 * Math.sin(x * 0.011));
    }
    context.lineTo(FIELD.width, FIELD.height);
    context.lineTo(0, FIELD.height);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.ridgeGlow;
    context.fillRect(0, FIELD.ridgeY - 2, FIELD.width, 2);
  }

  function drawMoth(enemy, color, wing) {
    const cx = enemy.x + enemy.w / 2;
    const cy = enemy.y + enemy.h / 2;
    const flap = Math.sin(enemy.phase * 6 + performance.now() / 240) * 0.5 + 0.5;
    context.fillStyle = wing;
    context.beginPath();
    context.ellipse(cx - enemy.w * 0.28, cy, enemy.w * 0.3, enemy.h * (0.2 + flap * 0.3), -0.5, 0, Math.PI * 2);
    context.ellipse(cx + enemy.w * 0.28, cy, enemy.w * 0.3, enemy.h * (0.2 + flap * 0.3), 0.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = color;
    context.beginPath();
    context.ellipse(cx, cy, enemy.w * 0.13, enemy.h * 0.42, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#1a1030';
    context.beginPath();
    context.arc(cx - 4, cy - enemy.h * 0.3, 2.2, 0, Math.PI * 2);
    context.arc(cx + 4, cy - enemy.h * 0.3, 2.2, 0, Math.PI * 2);
    context.fill();
  }

  function drawEnemy(enemy) {
    const cx = enemy.x + enemy.w / 2;
    const cy = enemy.y + enemy.h / 2;
    if (enemy.kind === KIND_MOTH) {
      drawMoth(enemy, PALETTE.moth, PALETTE.mothWing);
    } else if (enemy.kind === KIND_DARTER) {
      glowCircle(cx, cy, enemy.w * 0.7, PALETTE.darter, 0.35);
      context.fillStyle = PALETTE.darter;
      context.beginPath();
      context.moveTo(cx, cy + enemy.h * 0.55);
      context.lineTo(cx - enemy.w * 0.5, cy - enemy.h * 0.35);
      context.lineTo(cx + enemy.w * 0.5, cy - enemy.h * 0.35);
      context.closePath();
      context.fill();
      context.fillStyle = '#fff';
      context.beginPath();
      context.arc(cx, cy - 2, 3, 0, Math.PI * 2);
      context.fill();
    } else if (enemy.kind === KIND_WEAVER) {
      glowCircle(cx, cy, enemy.w * 0.6, PALETTE.weaver, 0.3);
      context.strokeStyle = PALETTE.weaver;
      context.lineWidth = 3;
      context.beginPath();
      for (let side = 0; side < 6; side += 1) {
        const angle = (Math.PI / 3) * side + enemy.phase;
        const px = cx + Math.cos(angle) * enemy.w * 0.42;
        const py = cy + Math.sin(angle) * enemy.h * 0.42;
        if (side === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.stroke();
      context.fillStyle = PALETTE.weaver;
      context.beginPath();
      context.arc(cx, cy, 5, 0, Math.PI * 2);
      context.fill();
      if (enemy.hp > 1) {
        context.fillStyle = PALETTE.weaver;
        context.fillRect(enemy.x, enemy.y - 8, enemy.w, 3);
      }
    } else if (enemy.kind === KIND_BOSS) {
      glowCircle(cx, cy, enemy.w * 0.9, PALETTE.boss, 0.4);
      drawMoth({ ...enemy, w: enemy.w * 1.1, h: enemy.h * 1.1, x: enemy.x - enemy.w * 0.05, y: enemy.y - enemy.h * 0.05, phase: enemy.phase }, PALETTE.boss, '#5b3a8e');
      context.fillStyle = PALETTE.bossCore;
      context.beginPath();
      context.arc(cx, cy, 10, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.boss;
      for (let spike = -2; spike <= 2; spike += 1) {
        context.beginPath();
        context.moveTo(cx + spike * 12 - 5, cy - enemy.h * 0.5);
        context.lineTo(cx + spike * 12, cy - enemy.h * 0.5 - 16);
        context.lineTo(cx + spike * 12 + 5, cy - enemy.h * 0.5);
        context.closePath();
        context.fill();
      }
    }
  }

  function drawPlayer(state, now) {
    const player = state.player;
    const cx = player.x + player.w / 2;
    const cy = player.y + player.h / 2;
    if (player.invulnerable > 0 && Math.floor(now * 10) % 2 === 0) return;
    glowCircle(cx + 16, cy - 4, 64, PALETTE.lanternGlow, 0.35);
    if (player.shield) {
      context.strokeStyle = PALETTE.shield;
      context.lineWidth = 3;
      context.globalAlpha = 0.7 + 0.3 * Math.sin(now * 6);
      context.beginPath();
      context.arc(cx, cy, 40, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = 1;
    }
    context.fillStyle = PALETTE.playerCloak;
    context.beginPath();
    context.moveTo(cx - 20, player.y + player.h);
    context.lineTo(cx - 12, player.y + 8);
    context.lineTo(cx + 12, player.y + 8);
    context.lineTo(cx + 20, player.y + player.h);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.playerHood;
    context.beginPath();
    context.arc(cx, player.y + 12, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#0a0d1a';
    context.beginPath();
    context.arc(cx, player.y + 13, 6, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.lantern;
    context.fillRect(cx + 12, player.y + 16, 10, 14);
    context.fillStyle = '#7a4d16';
    context.fillRect(cx + 11, player.y + 14, 12, 3);
    context.fillRect(cx + 11, player.y + 30, 12, 3);
  }

  function drawHud(state) {
    text(scoreLabel(state.score), 24, 16, 26, PALETTE.text, 'left', true, 'top');
    const combo = state.combo;
    if (combo >= 2) {
      const mult = 1 + Math.floor(combo / 10);
      text(`COMBO x${combo}  (x${mult})`, 24, 48, 18, PALETTE.lantern, 'left', true, 'top');
    }
    text(waveLabel(Math.max(1, state.wave)), FIELD.width / 2, 16, 26, PALETTE.text, 'center', true, 'top');
    const firstHeart = FIELD.width - 24 - LIVES * (HEART + 8) + 8;
    text('LIVES', firstHeart - 14, 16, 26, PALETTE.text, 'right', true, 'top');
    for (let life = 0; life < LIVES; life += 1) {
      const hx = firstHeart + life * (HEART + 8);
      const hy = 20;
      context.fillStyle = life < state.lives ? PALETTE.danger : '#2a3040';
      context.beginPath();
      context.moveTo(hx + HEART / 2, hy + HEART * 0.9);
      context.bezierCurveTo(hx - 4, hy + HEART * 0.45, hx, hy, hx + HEART * 0.3, hy);
      context.bezierCurveTo(hx + HEART * 0.42, hy - 2, hx + HEART * 0.58, hy - 2, hx + HEART * 0.7, hy);
      context.bezierCurveTo(hx + HEART, hy, hx + HEART + 4, hy + HEART * 0.45, hx + HEART / 2, hy + HEART * 0.9);
      context.fill();
    }
    let timerX = FIELD.width - 24;
    const player = state.player;
    if (player.spreadT > 0) {
      text('TRIPLE', timerX, 52, 16, PALETTE.spread, 'right', true, 'top');
      timerX -= 90;
    }
    if (player.rapidT > 0) {
      text('SWIFT', timerX, 52, 16, PALETTE.rapid, 'right', true, 'top');
      timerX -= 70;
    }
    if (player.shield) text('WARD', timerX, 52, 16, PALETTE.shield, 'right', true, 'top');
    const boss = state.boss;
    if (boss !== null && boss.active) {
      const barW = 420;
      const bx = (FIELD.width - barW) / 2;
      const by = 52;
      context.fillStyle = '#241a3a';
      context.fillRect(bx, by, barW, 12);
      context.fillStyle = PALETTE.boss;
      context.fillRect(bx, by, barW * Math.max(0, boss.hp / boss.maxHp), 12);
      text('GLOOM QUEEN', FIELD.width / 2, by + 18, 15, PALETTE.boss, 'center', true);
    }
  }

  function drawBanner(state) {
    if (state.bannerT <= 0 || state.banner === '') return;
    const alpha = Math.min(1, state.bannerT);
    context.globalAlpha = alpha;
    text(state.banner, FIELD.width / 2, 190, 44, PALETTE.lantern, 'center', true);
    context.globalAlpha = 1;
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 74, 46, accent ?? PALETTE.text, 'center', true);
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center', false);
    }
    text(prompt, FIELD.width / 2, y + height - 34, 22, PALETTE.lantern, 'center', true);
  }

  const TITLE_LINES = [
    'Five waves of gloom-moths are coming down the dark.',
    'Burn them with ember bolts before they reach your lantern.',
    'Catch falling blessings: triple embers, swift hands, ward shields.',
    'Move with ← → or A D, or glide with the mouse. Fire with Space or click.',
    'Clear all five waves — and the Gloom Queen — to bring back the dawn.',
    '',
  ];
  const PAUSED_LINES = ['The moths will wait for you.'];
  const OVER_LINES = ['', ''];
  const WIN_LINES = ['', ''];

  /** Paint one frame: the sky, the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, now) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake > 0 ? (Math.random() * 2 - 1) * state.shake * 14 : 0;
    const shakeY = state.shake > 0 ? (Math.random() * 2 - 1) * state.shake * 10 : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    drawSky(state, now);
    for (let index = 0; index < state.enemies.length; index += 1) {
      const enemy = state.enemies[index];
      if (enemy.active) drawEnemy(enemy);
    }
    for (let index = 0; index < state.blessings.length; index += 1) {
      const blessing = state.blessings[index];
      if (!blessing.active) continue;
      const color = blessing.kind === BLESS_SPREAD ? PALETTE.spread : blessing.kind === BLESS_RAPID ? PALETTE.rapid : PALETTE.shield;
      const letter = blessing.kind === BLESS_SPREAD ? 'S' : blessing.kind === BLESS_RAPID ? 'R' : 'H';
      glowCircle(blessing.x + 13, blessing.y + 13, 22, color, 0.5);
      context.fillStyle = color;
      context.fillRect(blessing.x, blessing.y, blessing.w, blessing.h);
      text(letter, blessing.x + 13, blessing.y + 19, 16, '#10131f', 'center', true);
    }
    for (let index = 0; index < state.bullets.length; index += 1) {
      const bullet = state.bullets[index];
      if (!bullet.active) continue;
      glowCircle(bullet.x + 3, bullet.y + 7, 12, PALETTE.bolt, 0.6);
      context.fillStyle = PALETTE.bolt;
      context.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
    }
    for (let index = 0; index < state.orbs.length; index += 1) {
      const orb = state.orbs[index];
      if (!orb.active) continue;
      glowCircle(orb.x + 7, orb.y + 7, 16, PALETTE.orb, 0.6);
      context.fillStyle = PALETTE.orb;
      context.beginPath();
      context.arc(orb.x + 7, orb.y + 7, 6, 0, Math.PI * 2);
      context.fill();
    }
    for (let index = 0; index < state.particles.length; index += 1) {
      const particle = state.particles[index];
      if (particle.life <= 0) continue;
      context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      context.fillStyle = particle.color;
      context.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
    context.globalAlpha = 1;
    drawPlayer(state, now);
    for (let index = 0; index < state.popups.length; index += 1) {
      const item = state.popups[index];
      if (item.life <= 0) continue;
      context.globalAlpha = Math.min(1, item.life);
      text(item.text, item.x, item.y, 20, item.color, 'center', true);
    }
    context.globalAlpha = 1;
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[5] = bestLabel(best);
      drawPanel('EMBER WARDEN', TITLE_LINES, 'Press Space or click to light the lantern');
      return;
    }
    drawHud(state);
    drawBanner(state);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to return to the night');
    else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = bestLabel(best);
      drawPanel('The light fades', OVER_LINES, 'Press Space or click to try again', PALETTE.danger);
    } else if (screen === SCREEN_WIN) {
      WIN_LINES[0] = finalLabel(state.score);
      WIN_LINES[1] = bestLabel(best);
      drawPanel('Dawn returns', WIN_LINES, 'Press Space or click to play again', PALETTE.lantern);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
