const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const hpText = document.querySelector("#hpText");
const levelText = document.querySelector("#levelText");
const attackText = document.querySelector("#attackText");
const expText = document.querySelector("#expText");
const lootText = document.querySelector("#lootText");
const gearText = document.querySelector("#gearText");
const statusText = document.querySelector("#statusText");
const logList = document.querySelector("#logList");
const skillButton = document.querySelector("#skillButton");
const potionButton = document.querySelector("#potionButton");
const gameOverPanel = document.querySelector("#gameOverPanel");
const gameOverFloor = document.querySelector("#gameOverFloor");
const gameOverLoot = document.querySelector("#gameOverLoot");
const gameOverLevel = document.querySelector("#gameOverLevel");
const gameOverRetry = document.querySelector("#gameOverRetry");

const W = 9;
const H = 12;
const TILE = 60;
const DIRS = {
  up: { x: 0, y: -1, face: "back" },
  down: { x: 0, y: 1, face: "front" },
  left: { x: -1, y: 0, face: "left" },
  right: { x: 1, y: 0, face: "right" },
};

const heroSprites = {};
for (const name of ["front", "back", "left", "right"]) {
  heroSprites[name] = new Image();
  heroSprites[name].src = `./assets/hero/${name}.jpg`;
}

const enemyTypes = {
  sprout: { label: "草むらスライム", hp: 4, damage: 2, speed: 1, exp: 2, color: "#67b06b", mark: "S" },
  dart: { label: "早足カラス", hp: 3, damage: 1, speed: 2, exp: 3, color: "#75a8d8", mark: "F" },
  shell: { label: "石殻ムシ", hp: 8, damage: 3, speed: 0.5, exp: 4, color: "#c65b7c", mark: "H" },
  thorn: { label: "トゲの花", hp: 5, damage: 4, speed: 0.75, exp: 5, color: "#b0c85f", mark: "T" },
  boss: { label: "迷宮の番鳥", hp: 20, damage: 5, speed: 1, exp: 12, color: "#d8904b", mark: "B" },
};

const gearDrops = [
  { name: "疾風の羽", attack: 1, maxHp: 0, color: "#75a8d8" },
  { name: "木守りの鈴", attack: 0, maxHp: 4, color: "#67b06b" },
  { name: "星くずの爪", attack: 2, maxHp: 0, color: "#f3c64b" },
  { name: "ふかふか外套", attack: 0, maxHp: 6, color: "#c65b7c" },
];

let state;
let lastFrame = performance.now();
let frameHandle = 0;

function newGame() {
  state = {
    floor: 1,
    turn: 0,
    ended: false,
    busyUntil: 0,
    shake: 0,
    player: makeActor({ x: 4, y: 10, hp: 18, maxHp: 18, baseAttack: 3, face: "front", level: 1, exp: 0 }),
    walls: new Set(),
    enemies: [],
    items: [],
    loot: [],
    gear: [],
    effects: [],
    skillCooldown: 0,
    potions: 1,
    stairs: null,
    log: ["小さな迷宮へ入った。"],
  };
  gameOverPanel.hidden = true;
  buildFloor();
  updateUi();
}

function makeActor(data) {
  return {
    ...data,
    drawX: data.x,
    drawY: data.y,
    bumpX: 0,
    bumpY: 0,
    bumpTime: 0,
    bumpDuration: 1,
    hitFlash: 0,
    pop: 0,
  };
}

function makeEnemy(type, x, y) {
  const base = enemyTypes[type];
  const bonus = Math.floor(state.floor / 2);
  return makeActor({
    id: crypto.randomUUID ? crypto.randomUUID() : `${type}-${x}-${y}-${Math.random()}`,
    type,
    x,
    y,
    hp: base.hp + bonus * 2,
    maxHp: base.hp + bonus * 2,
    damage: base.damage + Math.floor(state.floor / 3),
    energy: 0,
  });
}

function buildFloor() {
  state.walls = new Set();
  state.enemies = [];
  state.items = [];
  state.stairs = null;
  state.player.x = 4;
  state.player.y = 10;
  state.player.drawX = 4;
  state.player.drawY = 10;
  state.player.face = "front";

  const wallCount = 7 + Math.min(8, state.floor);
  for (let i = 0; i < wallCount; i += 1) {
    const pos = openRandomCell(1, 9);
    if (pos && !(pos.x === 4 && pos.y === 10)) state.walls.add(keyAt(pos.x, pos.y));
  }

  const pool = state.floor >= 4 ? ["sprout", "dart", "shell", "thorn"] : ["sprout", "dart", "shell"];
  const enemyCount = 3 + Math.min(4, Math.floor(state.floor / 2));
  for (let i = 0; i < enemyCount; i += 1) {
    const pos = openRandomCell(0, 6);
    if (pos) state.enemies.push(makeEnemy(pool[Math.floor(Math.random() * pool.length)], pos.x, pos.y));
  }

  if (state.floor % 3 === 0) {
    const pos = openRandomCell(0, 3);
    if (pos) state.enemies.push(makeEnemy("boss", pos.x, pos.y));
  }

  const chest = openRandomCell(2, 8);
  if (chest) state.items.push({ kind: "chest", x: chest.x, y: chest.y, name: "宝箱", color: "#d8904b", born: performance.now() });
  addLog(`第${state.floor}層に降りた。`);
}

function openRandomCell(yMin = 0, yMax = H - 1) {
  for (let tries = 0; tries < 80; tries += 1) {
    const x = Math.floor(Math.random() * W);
    const y = yMin + Math.floor(Math.random() * (yMax - yMin + 1));
    if (inBounds(x, y) && !state.walls.has(keyAt(x, y)) && !enemyAt(x, y) && !(state.player.x === x && state.player.y === y)) {
      return { x, y };
    }
  }
  return null;
}

function keyAt(x, y) {
  return `${x},${y}`;
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < W && y < H;
}

function enemyAt(x, y) {
  return state.enemies.find((enemy) => enemy.x === x && enemy.y === y);
}

function itemAt(x, y) {
  return state.items.find((item) => item.x === x && item.y === y);
}

function playerAttack() {
  return state.player.baseAttack + state.gear.reduce((sum, item) => sum + item.attack, 0);
}

function playerMaxHp() {
  return state.player.maxHp + state.gear.reduce((sum, item) => sum + item.maxHp, 0);
}

function isBlocked(x, y, ignoreEnemy = false) {
  if (!inBounds(x, y) || state.walls.has(keyAt(x, y))) return true;
  if (state.player.x === x && state.player.y === y) return true;
  return !ignoreEnemy && Boolean(enemyAt(x, y));
}

function playerAction(dirName) {
  if (state.ended || state.busyUntil > performance.now()) return;
  const dir = DIRS[dirName];
  state.player.face = dir.face;
  const nx = state.player.x + dir.x;
  const ny = state.player.y + dir.y;
  const target = enemyAt(nx, ny);

  if (target) {
    bumpActor(state.player, dir.x, dir.y, 170);
    hitEnemy(target, playerAttack(), dir.x, dir.y);
    lockInput(210);
    endTurn();
    return;
  }

  if (isBlocked(nx, ny, true)) {
    bumpActor(state.player, dir.x, dir.y, 120);
    addEffect("ring", nx, ny, "#c9bd91");
    addLog("そこには進めない。");
    lockInput(120);
    updateUi();
    return;
  }

  moveActor(state.player, nx, ny);
  state.player.pop = 1;
  addEffect("dust", state.player.x, state.player.y, "#f3c64b");
  pickUp();
  checkStairs();
  lockInput(210);
  endTurn();
}

function waitTurn() {
  if (state.ended || state.busyUntil > performance.now()) return;
  state.player.hp = Math.min(playerMaxHp(), state.player.hp + 1);
  addLog("息を整えた。");
  addEffect("ring", state.player.x, state.player.y, "#75a8d8");
  lockInput(160);
  endTurn();
}

function useSkill() {
  if (state.ended || state.busyUntil > performance.now()) return;
  if (state.skillCooldown > 0) {
    addLog("羽根斬りはまだ使えない。");
    updateUi();
    return;
  }
  const dir = DIRS[state.player.face] || DIRS.down;
  for (let range = 1; range <= 3; range += 1) {
    const x = state.player.x + dir.x * range;
    const y = state.player.y + dir.y * range;
    if (!inBounds(x, y) || state.walls.has(keyAt(x, y))) break;
    addEffect("slash", x, y, "#75a8d8");
    const enemy = enemyAt(x, y);
    if (enemy) {
      hitEnemy(enemy, playerAttack() + 2, dir.x, dir.y);
      state.skillCooldown = 5;
      lockInput(250);
      endTurn();
      return;
    }
  }
  addLog("羽根斬りは空を切った。");
  state.skillCooldown = 3;
  lockInput(180);
  endTurn();
}

function usePotion() {
  if (state.ended || state.busyUntil > performance.now()) return;
  if (state.potions <= 0) {
    addLog("薬草がない。");
    updateUi();
    return;
  }
  state.potions -= 1;
  state.player.hp = Math.min(playerMaxHp(), state.player.hp + 8);
  addEffect("text", state.player.x, state.player.y, "#67b06b", "+8");
  addEffect("ring", state.player.x, state.player.y, "#67b06b");
  addLog("薬草で回復した。");
  lockInput(160);
  endTurn();
}

function moveActor(actor, x, y) {
  actor.x = x;
  actor.y = y;
}

function bumpActor(actor, dx, dy, duration) {
  actor.bumpX = dx;
  actor.bumpY = dy;
  actor.bumpTime = duration;
  actor.bumpDuration = duration;
}

function lockInput(ms) {
  state.busyUntil = Math.max(state.busyUntil, performance.now() + ms);
}

function hitEnemy(enemy, damage, dx = 0, dy = 0) {
  enemy.hp -= damage;
  enemy.hitFlash = 220;
  enemy.pop = 1.2;
  state.shake = Math.max(state.shake, 5);
  addEffect("slash", enemy.x, enemy.y, "#fff6dc");
  addEffect("text", enemy.x, enemy.y, "#ef6b57", `-${damage}`);
  const name = enemyTypes[enemy.type].label;

  if (enemy.hp <= 0) {
    addLog(`${name}を倒した。`);
    gainExp(enemyTypes[enemy.type].exp + Math.floor(state.floor / 2));
    maybeDrop(enemy.x, enemy.y);
    state.enemies = state.enemies.filter((next) => next.id !== enemy.id);
    addEffect("burst", enemy.x, enemy.y, "#f3c64b");
    if (state.enemies.length === 0) spawnStairs();
  } else {
    bumpActor(enemy, dx || Math.sign(enemy.x - state.player.x), dy || Math.sign(enemy.y - state.player.y), 150);
    addLog(`${name}に${damage}ダメージ。`);
  }
}

function gainExp(amount) {
  state.player.exp += amount;
  const need = expToNext();
  if (state.player.exp >= need) {
    state.player.exp -= need;
    state.player.level += 1;
    state.player.maxHp += 3;
    state.player.baseAttack += state.player.level % 2 === 0 ? 1 : 0;
    state.player.hp = playerMaxHp();
    addEffect("burst", state.player.x, state.player.y, "#75a8d8");
    addLog(`レベル${state.player.level}になった。`);
  }
}

function expToNext() {
  return 5 + state.player.level * 4;
}

function maybeDrop(x, y) {
  if (Math.random() < 0.35) {
    dropGear(x, y);
    return;
  }
  if (Math.random() < 0.45) {
    state.items.push({ kind: "potion", x, y, name: "薬草", color: "#67b06b", born: performance.now() });
  } else {
    state.items.push({ kind: "coin", x, y, name: "きらめく羽", color: "#f3c64b", born: performance.now() });
  }
}

function dropGear(x, y) {
  const base = gearDrops[Math.floor(Math.random() * gearDrops.length)];
  const rank = Math.random() < 0.18 ? "上質な" : Math.random() < 0.45 ? "磨かれた" : "古い";
  const bonus = rank === "上質な" ? 2 : rank === "磨かれた" ? 1 : 0;
  state.items.push({
    kind: "gear",
    x,
    y,
    name: `${rank}${base.name}`,
    attack: base.attack + bonus,
    maxHp: base.maxHp + bonus * 2,
    color: base.color,
    born: performance.now(),
  });
}

function pickUp() {
  const item = itemAt(state.player.x, state.player.y);
  if (!item) return;
  state.items = state.items.filter((next) => next !== item);

  if (item.kind === "chest") {
    addLog("宝箱を開けた。");
    Math.random() < 0.7 ? dropGear(item.x, item.y) : state.items.push({ kind: "potion", x: item.x, y: item.y, name: "薬草", color: "#67b06b", born: performance.now() });
    addEffect("burst", item.x, item.y, "#f3c64b");
    return;
  }

  if (item.kind === "potion") {
    state.potions += 1;
    addLog("薬草を拾った。");
  } else if (item.kind === "gear") {
    equipGear(item);
  } else {
    state.loot.push(item.name);
    addLog(`${item.name}を拾った。`);
  }
  addEffect("text", item.x, item.y, "#f3c64b", "GET");
}

function equipGear(item) {
  state.gear.unshift(item);
  state.gear = state.gear.slice(0, 3);
  state.player.hp = Math.min(playerMaxHp(), state.player.hp + Math.max(1, item.maxHp));
  state.loot.push(item.name);
  addLog(`${item.name}を装備した。`);
}

function spawnStairs() {
  if (state.stairs) return;
  const pos = openRandomCell(0, 4) || { x: 4, y: 1 };
  state.stairs = pos;
  addEffect("burst", pos.x, pos.y, "#75a8d8");
  addLog("奥へ続く階段が現れた。");
}

function checkStairs() {
  if (!state.stairs) return;
  if (state.player.x !== state.stairs.x || state.player.y !== state.stairs.y) return;
  state.floor += 1;
  state.player.hp = Math.min(playerMaxHp(), state.player.hp + 4);
  state.skillCooldown = Math.max(0, state.skillCooldown - 2);
  buildFloor();
}

function endTurn() {
  state.turn += 1;
  state.skillCooldown = Math.max(0, state.skillCooldown - 1);
  runEnemies();
  updateUi();
}

function runEnemies() {
  for (const enemy of [...state.enemies]) {
    if (state.ended) break;
    const base = enemyTypes[enemy.type];
    enemy.energy += base.speed;
    while (enemy.energy >= 1 && !state.ended && state.enemies.includes(enemy)) {
      enemy.energy -= 1;
      enemyAct(enemy);
    }
  }
}

function enemyAct(enemy) {
  const dx = state.player.x - enemy.x;
  const dy = state.player.y - enemy.y;
  const distance = Math.abs(dx) + Math.abs(dy);
  const base = enemyTypes[enemy.type];

  if (distance === 1) {
    state.player.hp -= enemy.damage;
    state.player.hitFlash = 260;
    state.shake = Math.max(state.shake, 4);
    bumpActor(enemy, Math.sign(dx), Math.sign(dy), 130);
    addEffect("slash", state.player.x, state.player.y, base.color);
    addEffect("text", state.player.x, state.player.y, "#ef6b57", `-${enemy.damage}`);
    addLog(`${base.label}の攻撃。`);
    if (state.player.hp <= 0) {
      state.player.hp = 0;
      state.ended = true;
      addLog("力尽きた。");
      statusText.textContent = "探索失敗";
      showGameOver();
    }
    return;
  }

  const choices = Math.abs(dx) > Math.abs(dy)
    ? [{ x: Math.sign(dx), y: 0 }, { x: 0, y: Math.sign(dy) }]
    : [{ x: 0, y: Math.sign(dy) }, { x: Math.sign(dx), y: 0 }];

  for (const step of choices) {
    const nx = enemy.x + step.x;
    const ny = enemy.y + step.y;
    if (!isBlocked(nx, ny)) {
      moveActor(enemy, nx, ny);
      enemy.pop = Math.max(enemy.pop, 0.55);
      return;
    }
  }
}

function updateUi() {
  hpText.textContent = `${state.player.hp}/${playerMaxHp()}`;
  levelText.textContent = state.player.level;
  attackText.textContent = playerAttack();
  expText.textContent = `${state.player.exp}/${expToNext()}`;
  lootText.textContent = `戦利品 ${state.loot.length}`;
  gearText.textContent = state.gear.length ? state.gear.map((item) => item.name).join(" / ") : "装備なし";
  if (!state.ended) statusText.textContent = `第${state.floor}層  ターン${state.turn}`;
  skillButton.textContent = state.skillCooldown > 0 ? `羽根斬り ${state.skillCooldown}` : "羽根斬り";
  potionButton.textContent = `薬草 ${state.potions}`;

  logList.replaceChildren();
  for (const entry of state.log.slice(0, 3)) {
    const li = document.createElement("li");
    li.textContent = entry;
    logList.append(li);
  }
}

function showGameOver() {
  gameOverFloor.textContent = `第${state.floor}層`;
  gameOverLoot.textContent = state.loot.length;
  gameOverLevel.textContent = state.player.level;
  gameOverPanel.hidden = false;
}

function addLog(text) {
  state.log.unshift(text);
}

function addEffect(type, x, y, color, text = "") {
  const ttl = type === "text" ? 780 : 420;
  state.effects.push({ type, x, y, color, text, ttl, maxTtl: ttl });
}

function frame(now) {
  const dt = Math.min(40, now - lastFrame);
  lastFrame = now;
  updateAnimation(dt);
  draw(now);
  frameHandle = window.setTimeout(() => requestAnimationFrame(frame), 1000 / 30);
}

function updateAnimation(dt) {
  if (!state) return;
  const actors = [state.player, ...state.enemies];
  for (const actor of actors) {
    actor.drawX += (actor.x - actor.drawX) * 0.34;
    actor.drawY += (actor.y - actor.drawY) * 0.34;
    if (Math.abs(actor.x - actor.drawX) < 0.002) actor.drawX = actor.x;
    if (Math.abs(actor.y - actor.drawY) < 0.002) actor.drawY = actor.y;
    actor.bumpTime = Math.max(0, actor.bumpTime - dt);
    actor.hitFlash = Math.max(0, actor.hitFlash - dt);
    actor.pop = Math.max(0, actor.pop - dt / 260);
  }
  state.effects = state.effects
    .map((effect) => ({ ...effect, ttl: effect.ttl - dt }))
    .filter((effect) => effect.ttl > 0);
  state.shake = Math.max(0, state.shake - dt / 45);
}

function draw(now = performance.now()) {
  if (!state) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  if (state.shake > 0) ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  drawMap(now);
  if (state.stairs) drawStairs(state.stairs, now);
  for (const item of state.items) drawItem(item, now);
  for (const enemy of state.enemies) drawEnemy(enemy, now);
  drawHero(now);
  drawEffects();
  ctx.restore();
}

function drawMap(now) {
  ctx.fillStyle = "#171611";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const px = x * TILE;
      const py = y * TILE;
      const dark = (x + y + state.floor) % 2 === 0;
      ctx.fillStyle = dark ? "#2d3429" : "#343b2d";
      ctx.fillRect(px, py, TILE, TILE);
      const glow = 0.04 + Math.sin(now / 700 + x * 0.6 + y * 0.4) * 0.018;
      ctx.fillStyle = `rgba(243, 198, 75, ${Math.max(0, glow)})`;
      ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
      ctx.strokeStyle = "rgba(255, 246, 220, 0.06)";
      ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
      if (state.walls.has(keyAt(x, y))) {
        ctx.fillStyle = "#514839";
        ctx.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
        ctx.fillStyle = "#6c654f";
        ctx.fillRect(px + 10, py + 9, TILE - 20, 9);
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(px + 10, py + 10, TILE - 22, 4);
      }
    }
  }
}

function actorPixel(actor) {
  const bumpProgress = actor.bumpDuration > 0 ? actor.bumpTime / actor.bumpDuration : 0;
  const bump = Math.sin(bumpProgress * Math.PI) * 10;
  const pop = Math.sin(actor.pop * Math.PI) * 3;
  return { x: actor.drawX * TILE + actor.bumpX * bump, y: actor.drawY * TILE + actor.bumpY * bump - pop };
}

function drawHero(now) {
  const player = state.player;
  const img = heroSprites[player.face] || heroSprites.front;
  const pos = actorPixel(player);
  const idle = Math.sin(now / 240) * 1.6;
  const px = pos.x;
  const py = pos.y + idle;
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(px + 30, py + 51, 22, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(243, 198, 75, 0.12)";
  ctx.beginPath();
  ctx.arc(px + 30, py + 27, 29, 0, Math.PI * 2);
  ctx.fill();
  if (img.complete) ctx.drawImage(img, px + 1, py - 8, 58, 58);
  else {
    ctx.fillStyle = "#f3c64b";
    ctx.fillRect(px + 8, py - 2, 44, 44);
  }
  if (player.hitFlash > 0) {
    ctx.fillStyle = `rgba(239, 107, 87, ${player.hitFlash / 420})`;
    ctx.fillRect(px + 1, py - 8, 58, 58);
  }
}

function drawEnemy(enemy, now) {
  const base = enemyTypes[enemy.type];
  const pos = actorPixel(enemy);
  const wiggle = Math.sin(now / 190 + enemy.x + enemy.y) * 1.6;
  const px = pos.x;
  const py = pos.y + wiggle;
  ctx.fillStyle = "rgba(0,0,0,0.24)";
  ctx.beginPath();
  ctx.ellipse(px + 30, py + 47, 17, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = enemy.hitFlash > 0 ? "#fff6dc" : base.color;
  ctx.fillRect(px + 15, py + 14, 30, 28);
  ctx.fillStyle = "#171611";
  ctx.fillRect(px + 22, py + 21, 5, 5);
  ctx.fillRect(px + 34, py + 21, 5, 5);
  ctx.fillStyle = "#100f0c";
  ctx.fillRect(px + 12, py + 8, 36, 5);
  ctx.fillStyle = "#ef6b57";
  ctx.fillRect(px + 13, py + 9, Math.max(0, 34 * (enemy.hp / enemy.maxHp)), 3);
  ctx.fillStyle = "#fff6dc";
  ctx.font = "bold 10px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(base.mark, px + 30, py + 35);
}

function drawStairs(stairs, now) {
  const px = stairs.x * TILE;
  const py = stairs.y * TILE;
  const pulse = Math.sin(now / 220) * 3;
  ctx.fillStyle = "rgba(117, 168, 216, 0.22)";
  ctx.fillRect(px + 8 - pulse, py + 8 - pulse, TILE - 16 + pulse * 2, TILE - 16 + pulse * 2);
  ctx.fillStyle = "#75a8d8";
  for (let i = 0; i < 4; i += 1) ctx.fillRect(px + 16 + i * 5, py + 18 + i * 7, 28, 5);
}

function drawItem(item, now) {
  const px = item.x * TILE;
  const py = item.y * TILE;
  const pulse = Math.sin(now / 180 + item.x) * 3;
  if (item.kind === "chest") {
    ctx.fillStyle = "#6c3f2c";
    ctx.fillRect(px + 14, py + 22 + pulse, 32, 24);
    ctx.fillStyle = "#f3c64b";
    ctx.fillRect(px + 27, py + 26 + pulse, 7, 9);
    return;
  }
  ctx.fillStyle = item.kind === "potion" ? "rgba(103, 176, 107, 0.18)" : "rgba(243, 198, 75, 0.18)";
  ctx.beginPath();
  ctx.arc(px + 30, py + 32, 18 + pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = item.color;
  ctx.beginPath();
  ctx.moveTo(px + 30, py + 14 + pulse);
  ctx.lineTo(px + 42, py + 30);
  ctx.lineTo(px + 30, py + 46 - pulse);
  ctx.lineTo(px + 18, py + 30);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#fff6dc";
  ctx.stroke();
}

function drawEffects() {
  for (const effect of state.effects) {
    const progress = 1 - effect.ttl / effect.maxTtl;
    const alpha = Math.max(0, effect.ttl / effect.maxTtl);
    const cx = effect.x * TILE + 30;
    const cy = effect.y * TILE + 30;
    if (effect.type === "text") {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = effect.color;
      ctx.font = "bold 18px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(effect.text, cx, cy - 18 - progress * 22);
      ctx.globalAlpha = 1;
      continue;
    }
    if (effect.type === "slash") {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx - 18 + progress * 8, cy + 15);
      ctx.lineTo(cx + 18, cy - 16 + progress * 8);
      ctx.stroke();
      ctx.globalAlpha = 1;
      continue;
    }
    if (effect.type === "dust") {
      ctx.globalAlpha = alpha * 0.75;
      ctx.fillStyle = effect.color;
      for (let i = 0; i < 4; i += 1) {
        const angle = i * Math.PI * 0.5 + progress;
        ctx.fillRect(cx + Math.cos(angle) * 18, cy + 20 + Math.sin(angle) * 6, 4, 4);
      }
      ctx.globalAlpha = 1;
      continue;
    }
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = effect.type === "burst" ? 5 : 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 8 + progress * 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

let touchStart = null;
canvas.addEventListener("pointerdown", (event) => {
  touchStart = { x: event.clientX, y: event.clientY };
});
canvas.addEventListener("pointerup", (event) => {
  if (!touchStart) return;
  const dx = event.clientX - touchStart.x;
  const dy = event.clientY - touchStart.y;
  touchStart = null;
  if (Math.hypot(dx, dy) < 24) return;
  playerAction(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
});

document.querySelectorAll("[data-dir]").forEach((button) => {
  button.addEventListener("click", () => playerAction(button.dataset.dir));
});
document.querySelector("#waitButton").addEventListener("click", waitTurn);
document.querySelector("#resetButton").addEventListener("click", newGame);
gameOverRetry.addEventListener("click", newGame);
skillButton.addEventListener("click", useSkill);
potionButton.addEventListener("click", usePotion);

window.addEventListener("keydown", (event) => {
  const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };
  if (map[event.key]) {
    event.preventDefault();
    playerAction(map[event.key]);
  }
  if (event.key === " ") {
    event.preventDefault();
    waitTurn();
  }
  if (event.key === "f") useSkill();
  if (event.key === "q") usePotion();
});

newGame();
if (!frameHandle) requestAnimationFrame(frame);
