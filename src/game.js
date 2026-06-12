const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const ui = {
  time: document.getElementById('time'),
  loot: document.getElementById('loot'),
  bag: document.getElementById('bag'),
  heat: document.getElementById('heat'),
  overlay: document.getElementById('overlay'),
  message: document.getElementById('message'),
  start: document.getElementById('start')
};

const W = canvas.width;
const H = canvas.height;
const keys = new Set();
const mouse = { x: W / 2, y: H / 2 };

let state;
let lastTime = 0;

const itemTypes = [
  { name: 'Soda', value: 18, weight: 1, color: '#6ec6ff', stun: 1.4 },
  { name: 'Baguette', value: 22, weight: 1, color: '#f79d65', stun: 1.6 },
  { name: 'Soap', value: 35, weight: 2, color: '#b493ff', stun: 1.8 },
  { name: 'Toy', value: 48, weight: 2, color: '#ffd166', stun: 1.6 },
  { name: 'Headphones', value: 90, weight: 3, color: '#a7f3d0', stun: 2.0 }
];

const rareType = { name: 'Golden Console', value: 260, weight: 4, color: '#ffe66d', stun: 2.4, rare: true };

const shelves = [
  { x: 92, y: 92, w: 82, h: 304 },
  { x: 246, y: 92, w: 82, h: 304 },
  { x: 400, y: 92, w: 82, h: 304 },
  { x: 554, y: 92, w: 82, h: 304 },
  { x: 712, y: 92, w: 82, h: 214 },
  { x: 704, y: 356, w: 118, h: 72 }
];

const slippery = [
  { x: 180, y: 455, r: 40 },
  { x: 505, y: 465, r: 34 }
];

function resetGame() {
  const rareSpots = [
    { x: 752, y: 338 },
    { x: 454, y: 72 },
    { x: 762, y: 462 },
    { x: 604, y: 432 }
  ];
  const rareSpot = rareSpots[Math.floor(Math.random() * rareSpots.length)];
  state = {
    running: true,
    won: false,
    time: 60,
    heat: 0,
    score: 0,
    combo: 0,
    thrownValue: 0,
    player: {
      x: 84,
      y: 560,
      r: 13,
      speed: 170,
      dash: 0,
      dashCooldown: 0,
      invuln: 0,
      facingX: 1,
      facingY: 0,
      bag: [],
      capacity: 10
    },
    items: [
      ...spawnShelfItems(),
      { x: rareSpot.x, y: rareSpot.y, type: rareType, taken: false, pulse: 0 }
    ],
    guards: [
      makeGuard(842, 140, [{ x: 842, y: 140 }, { x: 842, y: 450 }, { x: 642, y: 450 }, { x: 642, y: 140 }]),
      makeGuard(360, 520, [{ x: 360, y: 520 }, { x: 520, y: 520 }, { x: 520, y: 78 }, { x: 360, y: 78 }])
    ],
    projectiles: [],
    floaters: []
  };
  ui.overlay.classList.add('hidden');
}

function spawnShelfItems() {
  const spots = [
    [126, 70], [126, 424], [280, 70], [280, 424], [434, 70], [434, 424],
    [588, 70], [588, 424], [744, 70], [840, 344], [666, 506], [218, 506],
    [356, 272], [512, 262], [672, 254], [838, 220]
  ];
  return spots.map((spot, i) => ({
    x: spot[0],
    y: spot[1],
    type: itemTypes[i % itemTypes.length],
    taken: false,
    pulse: Math.random() * 10
  }));
}

function makeGuard(x, y, route) {
  return {
    x, y, r: 14, route, target: 1, speed: 88, mode: 'patrol',
    stunned: 0, alert: 0, facingX: 0, facingY: 1
  };
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.033) || 0;
  lastTime = now;
  if (state?.running) update(dt);
  render();
  requestAnimationFrame(loop);
}

function update(dt) {
  state.time -= dt;
  if (state.time <= 0) finish(false, '时间耗尽，警卫封锁了出口。你只保住了一点点尊严。');

  updatePlayer(dt);
  updateGuards(dt);
  updateProjectiles(dt);
  updateFloaters(dt);
  state.heat = Math.max(0, state.heat - dt * 4);

  const exit = { x: 28, y: 586, w: 242, h: 42 };
  if (rectCircle(exit, state.player) && state.player.bag.length > 0) {
    finish(true, '你带着战利品冲出便利店。漂亮，贪心这次站在你这边。');
  }
  updateUi();
}

function updatePlayer(dt) {
  const p = state.player;
  let ax = 0, ay = 0;
  if (keys.has('arrowleft') || keys.has('a')) ax -= 1;
  if (keys.has('arrowright') || keys.has('d')) ax += 1;
  if (keys.has('arrowup') || keys.has('w')) ay -= 1;
  if (keys.has('arrowdown') || keys.has('s')) ay += 1;
  const len = Math.hypot(ax, ay) || 1;
  ax /= len; ay /= len;
  if (ax || ay) {
    p.facingX = ax;
    p.facingY = ay;
  }
  p.dash = Math.max(0, p.dash - dt);
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  const onSlip = slippery.some(s => dist(p, s) < s.r);
  const speed = p.speed * (p.dash > 0 ? 2.4 : 1) * (onSlip ? 1.25 : 1);
  moveCircle(p, ax * speed * dt, ay * speed * dt);
  if (onSlip && (ax || ay)) {
    moveCircle(p, ax * 42 * dt, ay * 42 * dt);
  }
}

function updateGuards(dt) {
  const p = state.player;
  for (const g of state.guards) {
    if (g.stunned > 0) {
      g.stunned -= dt;
      continue;
    }
    const sees = canSeePlayer(g, p);
    if (sees) {
      g.mode = 'chase';
      g.alert = 3.2;
      state.heat = Math.min(100, state.heat + dt * 28);
    } else {
      g.alert -= dt;
      if (g.alert <= 0) g.mode = 'patrol';
    }
    const target = g.mode === 'chase' ? p : g.route[g.target];
    const dx = target.x - g.x;
    const dy = target.y - g.y;
    const len = Math.hypot(dx, dy) || 1;
    g.facingX = dx / len;
    g.facingY = dy / len;
    const speed = g.speed * (g.mode === 'chase' ? 1.55 : 1);
    moveGuard(g, g.facingX * speed * dt, g.facingY * speed * dt);
    if (g.mode === 'patrol' && len < 18) g.target = (g.target + 1) % g.route.length;
    if (dist(g, p) < g.r + p.r + 3 && p.invuln <= 0) catchPlayer(g);
  }
}

function updateProjectiles(dt) {
  for (const pr of state.projectiles) {
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.life -= dt;
    for (const g of state.guards) {
      if (g.stunned <= 0 && dist(pr, g) < g.r + 8) {
        g.stunned = pr.stun;
        pr.life = 0;
        state.heat = Math.max(0, state.heat - 16);
        addFloater(g.x, g.y - 18, 'STUN!', '#ffd166');
      }
    }
  }
  state.projectiles = state.projectiles.filter(pr => pr.life > 0 && pr.x > 0 && pr.y > 0 && pr.x < W && pr.y < H);
}

function updateFloaters(dt) {
  for (const f of state.floaters) {
    f.y -= 28 * dt;
    f.life -= dt;
  }
  state.floaters = state.floaters.filter(f => f.life > 0);
}

function pickUp() {
  if (!state?.running) return;
  const p = state.player;
  let best = null;
  let bestDist = Infinity;
  for (const item of state.items) {
    if (item.taken) continue;
    const d = dist(p, item);
    if (d < 34 && d < bestDist) {
      best = item;
      bestDist = d;
    }
  }
  if (!best) return addFloater(p.x, p.y - 22, 'TOO FAR', '#aeb8c3');
  const load = bagWeight();
  if (load + best.type.weight > p.capacity) {
    addFloater(p.x, p.y - 22, 'BAG FULL', '#f45b69');
    return;
  }
  best.taken = true;
  p.bag.push(best.type);
  state.combo += 1;
  const bonus = best.type.rare ? 80 : Math.min(state.combo * 3, 24);
  state.score += best.type.value + bonus;
  addFloater(best.x, best.y - 18, `+$${best.type.value + bonus}`, best.type.rare ? '#ffe66d' : '#76e39a');
}

function throwItem(tx = mouse.x, ty = mouse.y) {
  if (!state?.running) return;
  const p = state.player;
  const item = p.bag.pop();
  if (!item) {
    addFloater(p.x, p.y - 22, 'EMPTY', '#aeb8c3');
    return;
  }
  state.thrownValue += item.value;
  state.score = Math.max(0, state.score - Math.floor(item.value * 0.6));
  const dx = tx - p.x;
  const dy = ty - p.y;
  const len = Math.hypot(dx, dy) || 1;
  state.projectiles.push({
    x: p.x + dx / len * 18,
    y: p.y + dy / len * 18,
    vx: dx / len * 420,
    vy: dy / len * 420,
    life: 0.85,
    color: item.color,
    stun: item.stun
  });
}

function dash() {
  if (!state?.running) return;
  const p = state.player;
  if (p.dashCooldown <= 0) {
    p.dash = 0.18;
    p.dashCooldown = 1.0;
  }
}

function catchPlayer(g) {
  const p = state.player;
  p.invuln = 1.3;
  state.time = Math.max(0, state.time - 4);
  state.heat = Math.min(100, state.heat + 24);
  state.combo = 0;
  const lost = p.bag.splice(-2);
  const loss = lost.reduce((sum, item) => sum + item.value, 0);
  state.score = Math.max(0, state.score - loss);
  addFloater(p.x, p.y - 24, loss ? `DROP -$${loss}` : 'CAUGHT', '#f45b69');
  const dx = p.x - g.x;
  const dy = p.y - g.y;
  const len = Math.hypot(dx, dy) || 1;
  moveCircle(p, dx / len * 42, dy / len * 42);
}

function finish(won, message) {
  state.running = false;
  state.won = won;
  if (won) state.score += Math.floor(state.time * 4) + bagWeight() * 8;
  ui.overlay.classList.remove('hidden');
  ui.message.textContent = `${message} 最终得分：$${state.score}`;
  ui.start.textContent = '再来一局';
  updateUi();
}

function moveCircle(obj, dx, dy) {
  obj.x = clamp(obj.x + dx, obj.r, W - obj.r);
  obj.y = clamp(obj.y + dy, obj.r, H - obj.r);
  for (const wall of shelves) {
    if (rectCircle(wall, obj)) {
      if (dx > 0) obj.x = wall.x - obj.r;
      if (dx < 0) obj.x = wall.x + wall.w + obj.r;
      if (dy > 0) obj.y = wall.y - obj.r;
      if (dy < 0) obj.y = wall.y + wall.h + obj.r;
    }
  }
}

function moveGuard(obj, dx, dy) {
  obj.x = clamp(obj.x + dx, obj.r, W - obj.r);
  obj.y = clamp(obj.y + dy, obj.r, H - obj.r);
}

function canSeePlayer(g, p) {
  const dx = p.x - g.x;
  const dy = p.y - g.y;
  const d = Math.hypot(dx, dy);
  if (d > 185) return false;
  const dot = (dx / d) * g.facingX + (dy / d) * g.facingY;
  return dot > 0.62 && !lineBlocked(g.x, g.y, p.x, p.y);
}

function lineBlocked(x1, y1, x2, y2) {
  for (const s of shelves) {
    for (let i = 0; i <= 1; i += 0.1) {
      const x = x1 + (x2 - x1) * i;
      const y = y1 + (y2 - y1) * i;
      if (x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h) return true;
    }
  }
  return false;
}

function render() {
  drawStore();
  if (!state) return;
  drawVision();
  drawItems();
  drawProjectiles();
  drawPlayer();
  drawGuards();
  drawFloaters();
}

function drawStore() {
  ctx.fillStyle = '#202832';
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 32) {
    for (let x = 0; x < W; x += 32) {
      ctx.fillStyle = (x / 32 + y / 32) % 2 ? '#242d37' : '#2b333d';
      ctx.fillRect(x, y, 30, 30);
    }
  }
  for (const s of shelves) drawShelf(s);
  for (const spill of slippery) {
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = '#6ec6ff';
    pixelCircle(spill.x, spill.y, spill.r);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = '#254c3a';
  ctx.fillRect(28, 586, 242, 42);
  ctx.fillStyle = '#76e39a';
  ctx.fillRect(54, 596, 190, 22);
  ctx.fillStyle = '#101820';
  ctx.font = '20px monospace';
  ctx.fillText('EXIT', 122, 614);
  ctx.fillStyle = '#3b3140';
  ctx.fillRect(784, 516, 132, 72);
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(806, 538, 86, 22);
}

function drawShelf(s) {
  ctx.fillStyle = '#3f5f7a';
  ctx.fillRect(s.x, s.y, s.w, s.h);
  ctx.fillStyle = '#6f91ad';
  ctx.fillRect(s.x + 6, s.y + 10, s.w - 12, 8);
  ctx.fillRect(s.x + 6, s.y + s.h / 2, s.w - 12, 8);
  ctx.fillRect(s.x + 6, s.y + s.h - 18, s.w - 12, 8);
  for (let y = s.y + 28; y < s.y + s.h - 18; y += 34) {
    ctx.fillStyle = y % 68 ? '#ffd166' : '#f79d65';
    ctx.fillRect(s.x + 14, y, 16, 12);
    ctx.fillStyle = '#6ec6ff';
    ctx.fillRect(s.x + s.w - 30, y + 4, 14, 14);
  }
}

function drawVision() {
  for (const g of state.guards) {
    if (g.stunned > 0) continue;
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(Math.atan2(g.facingY, g.facingX));
    ctx.globalAlpha = g.mode === 'chase' ? 0.3 : 0.18;
    ctx.fillStyle = '#f45b69';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(170, -72);
    ctx.lineTo(170, 72);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

function drawItems() {
  for (const item of state.items) {
    if (item.taken) continue;
    item.pulse += 0.06;
    const bob = Math.sin(item.pulse) * 2;
    if (item.type.rare) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(item.x - 2, item.y - 23 + bob, 4, 4);
      ctx.fillRect(item.x - 18, item.y - 7 + bob, 4, 4);
      ctx.fillRect(item.x + 14, item.y + 11 + bob, 4, 4);
    }
    ctx.fillStyle = item.type.color;
    ctx.fillRect(item.x - 10, item.y - 8 + bob, 20, 16);
    ctx.fillStyle = item.type.rare ? '#f4b942' : '#101820';
    ctx.fillRect(item.x - 5, item.y - 3 + bob, 10, 6);
  }
}

function drawPlayer() {
  const p = state.player;
  const blink = p.invuln > 0 && Math.floor(performance.now() / 80) % 2 === 0;
  if (blink) return;
  drawPixelPerson(p.x, p.y, '#65e0a3', '#2e7b55');
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(p.x + 8, p.y + 3, 10, 8);
}

function drawGuards() {
  for (const g of state.guards) {
    drawPixelPerson(g.x, g.y, g.stunned > 0 ? '#aeb8c3' : '#f45b69', '#8a2634');
    if (g.stunned > 0) {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(g.x - 12, g.y - 28, 6, 6);
      ctx.fillRect(g.x + 4, g.y - 34, 6, 6);
    }
  }
}

function drawPixelPerson(x, y, body, legs) {
  const px = Math.round(x);
  const py = Math.round(y);
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(px - 7, py - 18, 14, 8);
  ctx.fillStyle = body;
  ctx.fillRect(px - 10, py - 10, 20, 18);
  ctx.fillStyle = '#101820';
  ctx.fillRect(px - 5, py - 15, 3, 3);
  ctx.fillRect(px + 3, py - 15, 3, 3);
  ctx.fillStyle = legs;
  ctx.fillRect(px - 8, py + 8, 6, 10);
  ctx.fillRect(px + 2, py + 8, 6, 10);
}

function drawProjectiles() {
  for (const pr of state.projectiles) {
    ctx.fillStyle = pr.color;
    ctx.fillRect(pr.x - 7, pr.y - 5, 14, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(pr.x + 3, pr.y - 7, 4, 4);
  }
}

function drawFloaters() {
  ctx.font = '16px monospace';
  ctx.textAlign = 'center';
  for (const f of state.floaters) {
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

function updateUi() {
  ui.time.textContent = Math.max(0, state.time).toFixed(1);
  ui.loot.textContent = `$${state.score}`;
  ui.bag.textContent = `${bagWeight()}/${state.player.capacity}`;
  ui.heat.textContent = state.heat > 70 ? 'HIGH' : state.heat > 30 ? 'MID' : 'LOW';
  ui.heat.style.color = state.heat > 70 ? '#f45b69' : state.heat > 30 ? '#ffd166' : '#76e39a';
}

function bagWeight() {
  return state.player.bag.reduce((sum, item) => sum + item.weight, 0);
}

function addFloater(x, y, text, color) {
  state.floaters.push({ x, y, text, color, life: 1.1 });
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function rectCircle(rect, circle) {
  const x = clamp(circle.x, rect.x, rect.x + rect.w);
  const y = clamp(circle.y, rect.y, rect.y + rect.h);
  return Math.hypot(circle.x - x, circle.y - y) < circle.r;
}

function pixelCircle(x, y, r) {
  for (let yy = -r; yy <= r; yy += 4) {
    for (let xx = -r; xx <= r; xx += 4) {
      if (xx * xx + yy * yy <= r * r) ctx.fillRect(x + xx, y + yy, 4, 4);
    }
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

window.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  keys.add(key);
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
  if (key === ' ') dash();
  if (key === 'e') pickUp();
  if (key === 'f') throwItem();
});

window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));

canvas.addEventListener('mousemove', event => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = (event.clientX - rect.left) / rect.width * W;
  mouse.y = (event.clientY - rect.top) / rect.height * H;
});

canvas.addEventListener('click', event => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = (event.clientX - rect.left) / rect.width * W;
  mouse.y = (event.clientY - rect.top) / rect.height * H;
  throwItem(mouse.x, mouse.y);
});

ui.start.addEventListener('click', resetGame);

drawStore();
requestAnimationFrame(loop);

