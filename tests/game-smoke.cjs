const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

class Element {
  constructor() {
    this.hidden = false;
    this.textContent = "";
    this.value = "55";
    this.children = [];
    this.listeners = {};
    this.classList = { add() {}, remove() {}, toggle() {} };
  }

  addEventListener(type, listener) {
    this.listeners[type] = listener;
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = [...children];
  }

  setAttribute() {}
}

const elements = new Map();
const canvas = new Element();
canvas.getContext = () => new Proxy({}, { get: () => () => {} });
elements.set("#gameCanvas", canvas);

const document = {
  hidden: false,
  querySelector(selector) {
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector);
  },
  querySelectorAll() {
    return [];
  },
  createElement() {
    return new Element();
  },
};

const storage = new Map();
const localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
};

class Image {
  constructor() {
    this.complete = true;
    this.naturalWidth = 96;
    this.src = "";
  }
}

const context = vm.createContext({
  console,
  document,
  localStorage,
  Image,
  crypto: { randomUUID: () => `id-${Math.random()}` },
  performance: { now: () => 1000 },
  requestAnimationFrame: () => 0,
  setTimeout: () => 0,
  setInterval: () => 0,
  window: { setTimeout: () => 0, setInterval: () => 0, addEventListener() {}, AudioContext: null },
  Math,
});

const gamePath = path.join(__dirname, "..", "game.js");
const source = fs.readFileSync(gamePath, "utf8");
const probes = `
  globalThis.testApi = {
    state: () => state,
    meta: () => meta,
    gainExp,
    expToNext,
    chooseFirst: () => upgradeChoices.children[0].listeners.click(),
    makeEnemy,
    enemyAct,
    showGameOver,
    setState: (next) => { state = next; },
  };
`;
vm.runInContext(source + probes, context);

const api = context.testApi;
let state = api.state();
state.player.exp = api.expToNext();
api.gainExp(0);
assert.equal(state.choosingUpgrade, true);
assert.equal(elements.get("#upgradeChoices").children.length, 3);
api.chooseFirst();
assert.equal(state.choosingUpgrade, false);
assert.equal(elements.get("#upgradePanel").hidden, true);

state.floor = 3;
state.walls = new Set();
state.enemies = [];
state.player.x = 4;
state.player.y = 7;
state.player.hp = 18;
const boss = api.makeEnemy("boss", 4, 2);
state.enemies.push(boss);
boss.specialCooldown = 0;
api.enemyAct(boss);
assert.equal(boss.intent.type, "blast");
assert.equal(boss.intent.tiles.length, 9);
state.player.x = 0;
state.player.y = 11;
api.enemyAct(boss);
assert.equal(boss.intent, null);
assert.equal(state.player.hp, 18);

state.floor = 5;
state.ended = true;
api.showGameOver();
assert.equal(api.meta().runs, 1);
assert.equal(api.meta().bestFloor, 5);
assert.match(storage.get("owlRogueMeta"), /"bestFloor":5/);

console.log("game smoke tests passed");
