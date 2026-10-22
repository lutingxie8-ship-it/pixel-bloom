// V0.15: Sandspiel 启发式教学复刻，没有复制原项目实现。
// cells 保存材料种类，energy 保存火焰/气体寿命、木头燃烧进度、植物生长能量和电流强度。

const canvas = document.querySelector('#world');
const ctx = canvas.getContext('2d');
const effectsCanvas = document.querySelector('#effects');
const effectsCtx = effectsCanvas.getContext('2d');
const palette = document.querySelector('#palette');
const brushInput = document.querySelector('#brush');
const speedSelect = document.querySelector('#speed');
const sprayButton = document.querySelector('#spray');
const harvestButton = document.querySelector('#harvest');
const undoButton = document.querySelector('#undo');
const pauseButton = document.querySelector('#pause');
const clearButton = document.querySelector('#clear');
const resetButton = document.querySelector('#reset');
const saveButton = document.querySelector('#save');
const loadButton = document.querySelector('#load');
const statsLabel = document.querySelector('#stats');
const harvestStatsLabel = document.querySelector('#harvest-stats');
const performanceLabel = document.querySelector('#performance');
const selectedLabel = document.querySelector('#selected-label');
const messageLabel = document.querySelector('#message');
const drainagePopup = document.querySelector('#drainage-popup');
const drainagePopupText = document.querySelector('#drainage-popup-text');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const WORLD_SCALE = 2;
const SCENE_WIDTH = Math.floor(WIDTH / WORLD_SCALE);
const SCENE_HEIGHT = Math.floor(HEIGHT / WORLD_SCALE);
const EMPTY = 0, SAND = 1, WATER = 2, STONE = 3, WOOD = 4;
const FIRE = 5, SMOKE = 6, PLANT = 7, STEAM = 8;
const METAL = 9, SALT = 10, ACID = 11, ELECTRICITY = 12, FLOWER = 13, SEED = 14;
const TREE_SEED = 15, GIANT_SEED = 16, LEAF = 17;
const FRUIT = 18, FALLEN_FRUIT = 19;
const MUSHROOM_SEED = 20, CACTUS_SEED = 21;
const WILLOW_SEED = 22, MANGROVE_SEED = 23;

const MATERIALS = [
  { id: EMPTY, name: '擦除', icon: '⌫', color: [16, 31, 43] },
  { id: SAND, name: '沙子', icon: '🟡', color: [232, 193, 111] },
  { id: WATER, name: '水', icon: '🔵', color: [76, 155, 220] },
  { id: STONE, name: '石头', icon: '⬜', color: [126, 142, 149] },
  { id: WOOD, name: '木头', icon: '🟫', color: [137, 88, 52] },
  { id: FIRE, name: '火焰', icon: '🔥', color: [255, 112, 35] },
  { id: SMOKE, name: '烟雾', icon: '🌫', color: [99, 111, 116], hidden: true },
  { id: PLANT, name: '草', icon: '🌿', color: [76, 177, 91], hidden: true },
  { id: STEAM, name: '蒸汽', icon: '☁', color: [184, 211, 218], hidden: true },
  { id: METAL, name: '金属', icon: '🔩', color: [117, 130, 141] },
  { id: SALT, name: '盐', icon: '🧂', color: [226, 229, 216] },
  { id: ACID, name: '酸', icon: '🟣', color: [174, 122, 203] },
  { id: ELECTRICITY, name: '电流', icon: '⚡', color: [255, 226, 79] },
  { id: FLOWER, name: '花', icon: '🌼', color: [255, 180, 104], hidden: true },
  { id: SEED, name: '种子', icon: '🌰', color: [190, 150, 70] },
  { id: TREE_SEED, name: '小树种子', icon: '🌳', color: [128, 96, 64] },
  { id: GIANT_SEED, name: '霸王花种子', icon: '🌺', color: [170, 76, 86] },
  { id: LEAF, name: '树叶', icon: '🍃', color: [72, 137, 75], hidden: true },
  { id: FRUIT, name: '树果', icon: '🍎', color: [213, 76, 62], hidden: true },
  { id: FALLEN_FRUIT, name: '落果', icon: '🍎', color: [202, 69, 54], hidden: true },
  { id: MUSHROOM_SEED, name: '蘑菇孢子', icon: '🍄', color: [185, 111, 101] },
  { id: CACTUS_SEED, name: '仙人掌种子', icon: '🌵', color: [93, 145, 90] },
  { id: WILLOW_SEED, name: '柳树种子', icon: '🌿', color: [130, 166, 94] },
  { id: MANGROVE_SEED, name: '红树林种子', icon: '🌳', color: [93, 125, 83] },
];

function isSeedKind(kind) {
  return kind === SEED || kind === TREE_SEED || kind === GIANT_SEED ||
    kind === MUSHROOM_SEED || kind === CACTUS_SEED || kind === WILLOW_SEED || kind === MANGROVE_SEED;
}

// 杏橙、玫粉、奶黄、淡紫、乳白、珊瑚色；减少高亮叠加造成的白色光团。
const FLOWER_COLORS = [[242, 174, 110], [232, 122, 170], [244, 221, 131],
  [179, 143, 222], [241, 229, 212], [237, 146, 137]];
const FLOWER_SHAPES = [
  { petals: 5, length: 1.65, width: 1.25, offset: 2.1, center: 0.85 },
  { petals: 8, length: 1.95, width: 0.65, offset: 2.0, center: 1.0 },
  { petals: 4, length: 1.75, width: 1.45, offset: 1.85, center: 0.7 },
];
const MUSHROOM_COLORS = [[184, 94, 87], [179, 143, 82], [148, 112, 166]];

function flowerSeedAt(i) {
  // 花色、花形与枝条绑定，生长和刷新渲染时不会跳色。
  return Math.imul(plantBranchId[i] || i + 1, 2654435761) >>> 0;
}

function flowerSizeAt(i) {
  // 按花朵位置混合枝条编号，同一枝上的两轮花也能大小不同；渲染时尺寸固定。
  const seed = (Math.imul(i + 1, 2246822519) ^ flowerSeedAt(i)) >>> 0;
  const variation = (seed % 1000) / 1000;
  if (variation < 0.25) return 0.65 + (variation / 0.25) * 0.15;
  if (variation < 0.8) return 0.9 + ((variation - 0.25) / 0.55) * 0.2;
  return 1.25 + ((variation - 0.8) / 0.2) * 0.2;
}
const FLOWER_BLOOM_MAX = 24;
const GIANT_FLOWER_SCALE = 1.5;
const MAX_TREE_GIRTH = 3.8;
const WATERLOG_STRESS_TICKS = 300; // 持续积水约 5 秒后开始黄化（1×）。
const WATERLOG_WILT_TICKS = 240;
const TREE_TRUNK_STEP_TICKS = 3;
const TREE_BRANCH_STEP_TICKS = 5;
const MAX_TREE_SIDE_BRANCHES = 4;
const MAX_FRUIT_PER_CROWN = 3;
const MAX_FRUIT_PER_TREE = 12;
const FRUIT_RIPEN_TICKS = 450;
const FRUIT_DROP_TICKS = 1500;
const FRUIT_DROP_JITTER = 300;
const FALLEN_FRUIT_LIFETIME = [1200, 1800];
const FRUIT_SPAWN_INTERVAL = 75;
// 统一控制根茎生长速度；只提高每次更新成功生长的概率，不会跳过逐节动画。
const PLANT_GROWTH_SPEED = 5;
const MAX_PLANT_BRANCHES = 6;
const MAX_BRANCH_BLOOMS = 2;
const MAX_PLANT_WATER_LEVEL = 10;
const PLANT_HEIGHT_CAP_Y = Math.floor(HEIGHT * 0.25);
const PLANT_WATER_INTERVAL = 90;
const PLANT_WATER_FEEDBACK_DURATION = 65;

const cells = new Uint8Array(WIDTH * HEIGHT);
const energy = new Uint16Array(WIDTH * HEIGHT);
const plantAge = new Uint16Array(WIDTH * HEIGHT);
const plantLean = new Int8Array(WIDTH * HEIGHT);
const plantBranchBudget = new Uint8Array(WIDTH * HEIGHT);
const plantBranchId = new Uint32Array(WIDTH * HEIGHT);
let nextBranchId = 1;
let floweredBranches = new Set();
let nextPlantFamilyId = 1;
let branchFamilies = new Map();
let branchBloomOffsets = new Map();
let plantFamilies = new Map();
const moved = new Uint8Array(WIDTH * HEIGHT);
const image = ctx.createImageData(WIDTH, HEIGHT);

const CHUNK_SIZE = 10;
const CHUNK_COLUMNS = Math.ceil(WIDTH / CHUNK_SIZE);
const CHUNK_ROWS = Math.ceil(HEIGHT / CHUNK_SIZE);
const activeChunks = new Uint8Array(CHUNK_COLUMNS * CHUNK_ROWS);
const currentChunks = new Uint8Array(CHUNK_COLUMNS * CHUNK_ROWS);
const nextActiveChunks = new Uint8Array(CHUNK_COLUMNS * CHUNK_ROWS);

const dirtyRenderChunks = new Uint8Array(CHUNK_COLUMNS * CHUNK_ROWS);
dirtyRenderChunks.fill(1);

let selected = SAND;
let running = true;
let tick = 0;
let paintDown = false;
let lastPoint = null;
let sprayMode = false;
let harvestMode = false;
const AUTO_HARVEST_RADIUS = 5;
let harvestHoverPointer = null;
let autoHarvestGesture = false;
let autoAnimalGesture = null;
let harvestTotals = { picked: 0, fallen: 0 };
let harvestGesture = { picked: 0, fallen: 0, snapshotSaved: false, hintShown: false };
let simulationSpeed = 1;
let currentScene = 'lab';
const SCENE_PRESETS = {
  lab: { name: '材料实验室', description: '沙堆、水池、木屋与电路，适合探索材料反应。' },
  empty: { name: '空白世界', description: '只有底部边界，一切从你亲手搭建开始。' },
  pond: { name: '池塘湿地', description: '有水池、沙岸与耐湿树种，适合观察水生环境。' },
  garden: { name: '花园苗圃', description: '平整沙床与间隔播下的花种，适合练习种植和养护。' },
  orchard: { name: '果园', description: '三处果树播种点，等待树木长成，体验成熟、采摘和落果。' },
};

function syncWorldSetup() {
  document.querySelector('#scene-preset').value = currentScene;
  document.querySelector('#mode-description').textContent = '自由沙盒：全部材料自由使用，自由种植、养护和采果，没有任务要求。';
  document.querySelector('#scene-description').textContent = `场景来源：${SCENE_PRESETS[currentScene].name}。${SCENE_PRESETS[currentScene].description}`;
}

const SAVE_KEY = 'sandspiel-clone-save-v1';
const MAX_UNDO_STEPS = 12;
const undoStack = [];

const indexOf = (x, y) => y * WIDTH + x;
const inBounds = (x, y) => x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT;
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function initialEnergy(kind) {
  if (kind === FIRE) return randomBetween(18, 34);
  if (kind === SMOKE) return randomBetween(45, 90);
  if (kind === STEAM) return randomBetween(80, 140);
  if (kind === ELECTRICITY) return randomBetween(8, 14);
  return 0;
}

function chunkIndex(x, y) {
  return Math.floor(y / CHUNK_SIZE) * CHUNK_COLUMNS + Math.floor(x / CHUNK_SIZE);
}

function wakeCell(i) {
  const x = i % WIDTH;
  const y = Math.floor(i / WIDTH);
  const chunkX = Math.floor(x / CHUNK_SIZE);
  const chunkY = Math.floor(y / CHUNK_SIZE);
  for (let offsetY = -1; offsetY <= 1; offsetY++) {
    for (let offsetX = -1; offsetX <= 1; offsetX++) {
      const nx = chunkX + offsetX;
      const ny = chunkY + offsetY;
      if (nx < 0 || nx >= CHUNK_COLUMNS || ny < 0 || ny >= CHUNK_ROWS) continue;
      const chunk = ny * CHUNK_COLUMNS + nx;
      activeChunks[chunk] = 1;
      nextActiveChunks[chunk] = 1;
    }
  }
}

function markDirty(i) {
  const x = i % WIDTH;
  const y = Math.floor(i / WIDTH);
  dirtyRenderChunks[chunkIndex(x, y)] = 1;
}

function markAllDirty() {
  dirtyRenderChunks.fill(1);
}

function setCell(i, kind, nextEnergy = initialEnergy(kind), nextAge = 0, nextLean = 0, nextBranchBudget = 0, nextBranchId = 0) {
  cells[i] = kind;
  energy[i] = nextEnergy;
  if (kind === PLANT) {
    plantAge[i] = nextAge;
    plantLean[i] = nextLean || (Math.random() < 0.5 ? -1 : 1);
    plantBranchBudget[i] = nextBranchBudget;
    plantBranchId[i] = nextBranchId;
  } else {
    plantAge[i] = kind === FALLEN_FRUIT ? nextAge : 0;
    plantLean[i] = 0;
    plantBranchBudget[i] = 0;
    plantBranchId[i] = kind === FLOWER || kind === LEAF || kind === FRUIT || kind === FALLEN_FRUIT
      ? nextBranchId : 0;
  }
  wakeCell(i);
  markDirty(i);
}

function showMessage(text) {
  messageLabel.textContent = ` · ${text}`;
}

function clonePlantFamily(state) {
  return { ...state, branchTips: { ...state.branchTips },
    treeRetryTick: { ...state.treeRetryTick },
    treeDetours: Object.fromEntries(Object.entries(state.treeDetours || {})
      .map(([id, path]) => [id, path.map((point) => [...point])])),
    branchBlooms: { ...state.branchBlooms }, branchTargets: { ...state.branchTargets },
    branchSpreads: { ...state.branchSpreads }, treeDepths: { ...state.treeDepths },
    treeCanopies: { ...state.treeCanopies },
    treeLayers: (state.treeLayers || []).map((layer) => ({ ...layer })),
    treeBranches: Object.fromEntries(Object.entries(state.treeBranches || {})
      .map(([id, branch]) => [id, { ...branch }])),
    treeFruitStates: Object.fromEntries(Object.entries(state.treeFruitStates || {})
      .map(([id, fruit]) => [id, { ...fruit }])),
    cactusArms: (state.cactusArms || []).map((arm) => ({ ...arm })),
    cactusBranches: Object.fromEntries(Object.entries(state.cactusBranches || {})
      .map(([id, branch]) => [id, { ...branch }])) };
}

function createSnapshot() {
  return {
    animals: globalThis.sandboxAnimals?.snapshot(),
    scenePreset: currentScene,
    fruitTimingVersion: 2,
    cells: cells.slice(),
    energy: energy.slice(),
    plantAge: plantAge.slice(),
    plantLean: plantLean.slice(),
    plantBranchBudget: plantBranchBudget.slice(),
    plantBranchId: plantBranchId.slice(),
    nextBranchId,
    floweredBranches: Array.from(floweredBranches),
    nextPlantFamilyId,
    branchFamilies: Array.from(branchFamilies),
    branchBloomOffsets: Array.from(branchBloomOffsets),
    plantFamilies: Array.from(plantFamilies, ([familyId, state]) => [familyId, clonePlantFamily(state)]),
    harvestTotals: { ...harvestTotals },
    tick,
  };
}

function pushUndoSnapshot() {
  undoStack.push(createSnapshot());
  if (undoStack.length > MAX_UNDO_STEPS) undoStack.shift();
  undoButton.disabled = false;
}

function restoreSnapshot(snapshot) {
  globalThis.sandboxTutorial?.worldChanged();
  clearHarvestFeedback();
  currentScene = Object.hasOwn(SCENE_PRESETS, snapshot.scenePreset) ? snapshot.scenePreset : 'lab';
  syncWorldSetup();
  const storedHarvest = snapshot.harvestTotals || {};
  harvestTotals = {
    picked: Number.isSafeInteger(storedHarvest.picked) && storedHarvest.picked >= 0 ? storedHarvest.picked : 0,
    fallen: Number.isSafeInteger(storedHarvest.fallen) && storedHarvest.fallen >= 0 ? storedHarvest.fallen : 0,
  };
  globalThis.sandboxAnimals?.restore(snapshot.animals);
  cells.set(snapshot.cells);
  energy.set(snapshot.energy);
  plantAge.set(snapshot.plantAge || new Uint16Array(cells.length));
  plantLean.set(snapshot.plantLean || new Int8Array(cells.length));
  plantBranchBudget.set(snapshot.plantBranchBudget || new Uint8Array(cells.length));
  plantBranchId.set(snapshot.plantBranchId || new Uint32Array(cells.length));
  if ((snapshot.fruitTimingVersion || 1) < 2) {
    // 旧熟果仍保持成熟，不因延长时间变回青果；只迁移一次。
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] === FRUIT) energy[i] = energy[i] < 150 ? energy[i] * 3 :
        Math.min(65535, FRUIT_RIPEN_TICKS + Math.floor((energy[i] - 150) * 8.75));
      if (cells[i] === FALLEN_FRUIT) {
        plantAge[i] = Math.min(FRUIT_RIPEN_TICKS, plantAge[i] * 3);
        energy[i] = Math.min(65535, energy[i] * 2);
      }
    }
  }
  nextBranchId = snapshot.nextBranchId || 1;
  floweredBranches = new Set(snapshot.floweredBranches || []);
  nextPlantFamilyId = snapshot.nextPlantFamilyId || 1;
  branchFamilies = new Map(snapshot.branchFamilies || []);
  branchBloomOffsets = new Map(snapshot.branchBloomOffsets || []);
  plantFamilies = new Map((snapshot.plantFamilies || []).map(([familyId, state]) =>
    [familyId, clonePlantFamily(state)]));
  // 旧存档没有明确的枝端位置：按每条枝最高的根茎恢复，之后只允许该枝端推进。
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== PLANT) continue;
    const branchId = plantBranchId[i];
    const family = familyForBranch(branchId);
    if (!family) continue;
    const tip = family.branchTips[branchId];
    if (tip === undefined || cells[tip] !== PLANT || plantBranchId[tip] !== branchId) {
      family.branchTips[branchId] = i;
    }
  }
  tick = snapshot.tick;
  moved.fill(0);
  activeChunks.fill(1);
  nextActiveChunks.fill(1);
  markAllDirty();
  render();
}

function undo() {
  stopPainting();
  const snapshot = undoStack.pop();
  if (!snapshot) {
    showMessage('没有可撤销的操作');
    return;
  }
  restoreSnapshot(snapshot);
  undoButton.disabled = undoStack.length === 0;
  showMessage('已撤销上一步');
}

function createWorldPayload() {
  const payload = {
    animals: globalThis.sandboxAnimals?.snapshot(),
    scenePreset: currentScene,
    version: 1,
    fruitTimingVersion: 2,
    width: WIDTH,
    height: HEIGHT,
    tick,
    cells: Array.from(cells),
    energy: Array.from(energy),
    plantAge: Array.from(plantAge),
    plantLean: Array.from(plantLean),
    plantBranchBudget: Array.from(plantBranchBudget),
    plantBranchId: Array.from(plantBranchId),
    nextBranchId,
    floweredBranches: Array.from(floweredBranches),
    nextPlantFamilyId,
    branchFamilies: Array.from(branchFamilies),
    branchBloomOffsets: Array.from(branchBloomOffsets),
    plantFamilies: Array.from(plantFamilies),
    harvestTotals: { ...harvestTotals },
  };
  return payload;
}

function saveWorld() { globalThis.worldStorage?.open(); }

function loadWorld() {
  globalThis.worldStorage?.open();
}

function moveCell(from, to) {
  const kind = cells[from];
  const storedEnergy = energy[from];
  const storedAge = plantAge[from];
  const storedLean = plantLean[from];
  const storedBranchBudget = plantBranchBudget[from];
  const storedBranchId = plantBranchId[from];
  setCell(to, kind, storedEnergy, storedAge, storedLean, storedBranchBudget, storedBranchId);
  setCell(from, EMPTY);
  moved[from] = 1;
  moved[to] = 1;
}

function swapCells(a, b) {
  const kindA = cells[a];
  const energyA = energy[a];
  const kindB = cells[b];
  const energyB = energy[b];
  const ageA = plantAge[a];
  const leanA = plantLean[a];
  const branchBudgetA = plantBranchBudget[a];
  const branchIdA = plantBranchId[a];
  const ageB = plantAge[b];
  const leanB = plantLean[b];
  const branchBudgetB = plantBranchBudget[b];
  const branchIdB = plantBranchId[b];
  setCell(a, kindB, energyB, ageB, leanB, branchBudgetB, branchIdB);
  setCell(b, kindA, energyA, ageA, leanA, branchBudgetA, branchIdA);
  moved[a] = 1;
  moved[b] = 1;
}

function tryMove(x, y, nx, ny, canSwapWith = EMPTY) {
  if (!inBounds(nx, ny)) return false;
  const from = indexOf(x, y);
  const to = indexOf(nx, ny);
  if (cells[to] === EMPTY) {
    moveCell(from, to);
    return true;
  }
  if (cells[to] === canSwapWith) {
    swapCells(from, to);
    return true;
  }
  return false;
}

function forEachNeighbor(x, y, callback) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (inBounds(nx, ny)) callback(indexOf(nx, ny));
    }
  }
}

function setSceneCell(x, y, kind) {
  if (x < 0 || x >= SCENE_WIDTH || y < 0 || y >= SCENE_HEIGHT) return;
  const startX = x * WORLD_SCALE;
  const startY = y * WORLD_SCALE;
  for (let offsetY = 0; offsetY < WORLD_SCALE; offsetY++) {
    for (let offsetX = 0; offsetX < WORLD_SCALE; offsetX++) {
      const nx = startX + offsetX;
      const ny = startY + offsetY;
      if (inBounds(nx, ny)) setCell(indexOf(nx, ny), kind);
    }
  }
}

function resetWorld() {
  globalThis.sandboxAnimals?.reset();
  globalThis.sandboxTutorial?.worldChanged();
  clearHarvestFeedback();
  harvestTotals = { picked: 0, fallen: 0 };
  cells.fill(EMPTY);
  energy.fill(0);
  plantAge.fill(0);
  plantLean.fill(0);
  plantBranchBudget.fill(0);
  plantBranchId.fill(0);
  nextBranchId = 1;
  floweredBranches.clear();
  nextPlantFamilyId = 1;
  branchFamilies.clear();
  branchBloomOffsets.clear();
  plantFamilies.clear();
  activeChunks.fill(0);
  nextActiveChunks.fill(0);
  markAllDirty();
  for (let y = HEIGHT - WORLD_SCALE; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) setCell(indexOf(x, y), STONE);
  }
  tick = 0;
  moved.fill(0);
  syncWorldSetup();
  if (currentScene !== 'lab') {
    buildScenePreset(currentScene);
    return;
  }
  for (let x = 20; x < 66; x++) setSceneCell(x, 79, STONE);
  for (let x = 112; x < 162; x++) setSceneCell(x, 88, STONE);

  for (let y = 8; y < 20; y++) {
    for (let x = 36; x < 65; x++) if (Math.random() < 0.62) setSceneCell(x, y, SAND);
  }
  for (let y = 8; y < 20; y++) {
    for (let x = 118; x < 150; x++) if (Math.random() < 0.66) setSceneCell(x, y, WATER);
  }

  // 一间可以直接点燃的示例木屋。
  for (let x = 76; x <= 102; x++) setSceneCell(x, 78, WOOD);
  for (let y = 61; y <= 78; y++) {
    setSceneCell(78, y, WOOD);
    setSceneCell(100, y, WOOD);
  }
  for (let offset = 0; offset <= 13; offset++) {
    setSceneCell(89 - offset, 60 + Math.floor(offset * 0.45), WOOD);
    setSceneCell(89 + offset, 60 + Math.floor(offset * 0.45), WOOD);
  }

  // 左下角的水培幼苗用于观察生长规则。
  for (let x = 7; x <= 29; x++) setSceneCell(x, 104, STONE);
  setSceneCell(18, 102, SEED);
  setSceneCell(17, 103, WATER);
  setSceneCell(18, 103, WATER);
  setSceneCell(19, 103, WATER);

  // 右下角的金属导线和一颗电火花用于观察导电。
  for (let x = 130; x <= 151; x++) setSceneCell(x, 87, METAL);
  setSceneCell(140, 86, ELECTRICITY);
}

function buildScenePreset(scene) {
  const fill = (x1, y1, x2, y2, kind) => {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) setSceneCell(x, y, kind);
    }
  };
  const sow = (x, y, kind) => {
    setSceneCell(x, y, kind);
    setSceneCell(x - 1, y, WATER);
    setSceneCell(x + 1, y, WATER);
  };
  if (scene === 'empty') return;
  if (scene === 'garden') {
    fill(8, 104, 171, 108, SAND);
    for (const x of [25, 55, 85, 115, 145]) sow(x, 103, SEED);
    fill(8, 103, 9, 108, STONE);
    fill(170, 103, 171, 108, STONE);
  } else if (scene === 'orchard') {
    fill(5, 105, 174, 108, SAND);
    for (const x of [34, 89, 144]) sow(x, 104, TREE_SEED);
  } else if (scene === 'pond') {
    fill(8, 104, 171, 108, SAND);
    fill(43, 87, 44, 108, STONE);
    fill(135, 87, 136, 108, STONE);
    fill(45, 108, 134, 108, STONE);
    fill(45, 98, 134, 103, WATER);
    sow(64, 103, WILLOW_SEED);
    sow(113, 103, MANGROVE_SEED);
    sow(23, 103, SEED);
    sow(155, 103, SEED);
  }
}

function clearWorld() {
  globalThis.sandboxAnimals?.clear();
  globalThis.sandboxTutorial?.worldChanged();
  cells.fill(EMPTY);
  energy.fill(0);
  plantAge.fill(0);
  plantLean.fill(0);
  plantBranchBudget.fill(0);
  plantBranchId.fill(0);
  nextBranchId = 1;
  floweredBranches.clear();
  nextPlantFamilyId = 1;
  branchFamilies.clear();
  branchBloomOffsets.clear();
  plantFamilies.clear();
  activeChunks.fill(0);
  nextActiveChunks.fill(0);
  markAllDirty();
  for (let y = HEIGHT - WORLD_SCALE; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) setCell(indexOf(x, y), STONE);
  }
  tick = 0;
  moved.fill(0);
}

const aicraftEngine = globalThis.AicraftPixelEngine?.create({
  width: WIDTH,
  height: HEIGHT,
  worldScale: WORLD_SCALE,
  getCell: (i) => cells[i],
  swapCells,
});

function tryMoveAndTrack(x, y, nx, ny, canSwapWith) {
  return tryMove(x, y, nx, ny, canSwapWith) ? [nx, ny] : null;
}

function updatePowderOrLiquid(x, y, kind) {
  if (aicraftEngine) {
    aicraftEngine.stepParticle(x, y, kind);
    return;
  }

  let currentX = x;
  let currentY = y;
  const swapTarget = kind === SAND || kind === SALT || isSeedKind(kind) ? WATER : EMPTY;

  // 网格加密后，一个视觉像素对应两个模拟格；让粉末/液体每帧最多走两格，保持原来的屏幕速度。
  for (let step = 0; step < WORLD_SCALE; step++) {
    const direction = Math.random() < 0.5 ? -1 : 1;
    let destination = tryMoveAndTrack(currentX, currentY, currentX, currentY + 1, swapTarget);
    if (!destination) destination = tryMoveAndTrack(currentX, currentY, currentX + direction, currentY + 1, swapTarget);
    if (!destination) destination = tryMoveAndTrack(currentX, currentY, currentX - direction, currentY + 1, swapTarget);
    if (!destination && kind === WATER) destination = tryMoveAndTrack(currentX, currentY, currentX + direction, currentY, swapTarget);
    if (!destination && kind === WATER) destination = tryMoveAndTrack(currentX, currentY, currentX - direction, currentY, swapTarget);
    if (!destination) break;
    [currentX, currentY] = destination;
  }
}

function updateSalt(x, y, i) {
  let waterNeighbor = -1;
  forEachNeighbor(x, y, (neighbor) => {
    if (waterNeighbor < 0 && cells[neighbor] === WATER) waterNeighbor = neighbor;
  });
  if (waterNeighbor >= 0 && Math.random() < 0.045) {
    setCell(i, EMPTY);
    moved[i] = 1;
    return;
  }
  updatePowderOrLiquid(x, y, SALT);
}

function germinateSeedCluster(x, y, i, waterNeighbor) {
  const seedKind = cells[i];
  const queue = [i];
  const cluster = [];
  const visited = new Set([i]);

  // 用八邻域吸收一整坨相连种子，避免播种后留下明显的种子土堆。
  while (queue.length > 0) {
    const current = queue.pop();
    cluster.push(current);
    const currentX = current % WIDTH;
    const currentY = Math.floor(current / WIDTH);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = currentX + dx;
        const ny = currentY + dy;
        if (!inBounds(nx, ny)) continue;
        const neighbor = indexOf(nx, ny);
        if (cells[neighbor] !== seedKind || visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  // 以整团种子中最低、且下方有实体承托的格子作为根点。
  // 如果种子仍悬在水中，就继续下沉，等接触地面后再清掉种子土并发芽。
  const groundedSeeds = cluster.filter((seed) => {
    const seedX = seed % WIDTH;
    const seedY = Math.floor(seed / WIDTH);
    if (seedY >= HEIGHT - 1) return true;
    const belowKind = cells[indexOf(seedX, seedY + 1)];
    return belowKind === SAND || belowKind === STONE || belowKind === WOOD ||
      belowKind === METAL || belowKind === SALT;
  });
  if (groundedSeeds.length === 0) return false;
  const root = groundedSeeds.reduce((lowest, seed) => {
    const seedY = Math.floor(seed / WIDTH);
    const lowestY = Math.floor(lowest / WIDTH);
    if (seedY !== lowestY) return seedY > lowestY ? seed : lowest;
    const seedX = seed % WIDTH;
    const lowestX = lowest % WIDTH;
    return Math.abs(seedX - x) < Math.abs(lowestX - x) ? seed : lowest;
  }, groundedSeeds[0]);

  if (waterNeighbor >= 0) {
    setCell(waterNeighbor, EMPTY);
    moved[waterNeighbor] = 1;
  }
  // 总枝数集中在 3～4 条，并稍微偏向 4 条，让成花后的轮廓更饱满。
  const species = ({ [TREE_SEED]: 'tree', [WILLOW_SEED]: 'tree', [MANGROVE_SEED]: 'tree', [GIANT_SEED]: 'giant',
    [MUSHROOM_SEED]: 'mushroom', [CACTUS_SEED]: 'cactus' })[seedKind] || 'flower';
  const desiredBranchCount = species === 'flower' ? (Math.random() < 0.35 ? 3 : 4) : 1;
  const rootBranchId = nextBranchId++;
  const familyId = nextPlantFamilyId++;
  branchFamilies.set(rootBranchId, familyId);
  branchBloomOffsets.set(rootBranchId, randomBetween(-5, 7));
  plantFamilies.set(familyId, {
    species,
    treeKind: seedKind === WILLOW_SEED ? 'willow' : seedKind === MANGROVE_SEED ? 'mangrove' : 'normal',
    rootX: root % WIDTH,
    rootY: Math.floor(root / WIDTH),
    baseBranches: desiredBranchCount,
    branchCount: 1,
    waterLevel: 0,
    lastWaterTick: -100,
    branchTips: { [rootBranchId]: root },
    branchBlooms: {},
    branchTargets: {},
    branchSpreads: {},
    growthCredits: 0,
    treeHeight: seedKind === MANGROVE_SEED ? randomBetween(75, 95) : randomBetween(108, 130),
    treeTrunkHeight: seedKind === MANGROVE_SEED ? randomBetween(35, 45) : randomBetween(54, 66),
    treeDepths: { [rootBranchId]: 0 },
    treeCanopies: {},
    treeLayers: [],
    treeBranches: {},
    treeFruitStates: {},
    fruitProduced: 0,
    treeGirth: 1,
    mushroomStyle: randomBetween(0, MUSHROOM_COLORS.length - 1),
    mushroomRadius: randomBetween(7, 10),
    cactusHeight: randomBetween(32, 44),
    cactusWidth: randomBetween(4, 5),
    cactusArms: [],
    cactusBranches: {},
    cactusRootBranchId: rootBranchId,
  });
  setCell(
    root,
    PLANT,
    randomBetween(480, 560),
    0,
    Math.random() < 0.5 ? -1 : 1,
    desiredBranchCount - 1,
    rootBranchId,
  );
  moved[root] = 1;

  for (const seed of cluster) {
    if (seed === root) continue;
    setCell(seed, EMPTY);
    moved[seed] = 1;
  }
  return true;
}

function updateSeed(x, y, i) {
  const seedKind = cells[i];
  // 干种子也保持活动，否则承托面休眠后就再也没有机会触发发芽。
  if (seedKind === CACTUS_SEED) wakeCell(i);
  // 仙人掌种子可以在干燥的承托面上缓慢发芽；其他种子仍先吸水。
  if (seedKind === CACTUS_SEED && energy[i] === 0 && y + 1 < HEIGHT &&
      [SAND, STONE, WOOD, METAL, SALT].includes(cells[indexOf(x, y + 1)]) && Math.random() < 0.02) {
    energy[i] = randomBetween(16, 24);
    wakeCell(i);
    markDirty(i);
  }
  let waterNeighbor = -1;
  forEachNeighbor(x, y, (neighbor) => {
    if (waterNeighbor < 0 && cells[neighbor] === WATER) waterNeighbor = neighbor;
  });

  // energy > 0 表示种子已经吸过水；即使随后水流离开，它仍会继续发芽流程。
  if (waterNeighbor >= 0 && energy[i] === 0) {
    energy[i] = randomBetween(8, 14);
    markDirty(i);
    wakeCell(i);
  }

  if (energy[i] > 0) {
    energy[i]--;
    markDirty(i);
    wakeCell(i);
    if (energy[i] === 0) {
      if (!germinateSeedCluster(x, y, i, waterNeighbor)) {
        energy[i] = 1;
      }
      if (cells[i] !== seedKind) return;
    }
    // 湿种子在等待成熟时继续下沉，直到找到承托面，不会停在水层中悬浮。
    updatePowderOrLiquid(x, y, seedKind);
    return;
  }
  updatePowderOrLiquid(x, y, seedKind);
}

function updateAcid(x, y, i) {
  wakeCell(i);
  forEachNeighbor(x, y, (neighbor) => {
    const target = cells[neighbor];
    const corrosive = target === WOOD || target === PLANT || target === FLOWER ||
      target === LEAF || target === FRUIT || target === FALLEN_FRUIT || isSeedKind(target) || target === SALT;
    const weakMetal = target === METAL && Math.random() < 0.2;
    if ((corrosive || weakMetal) && Math.random() < 0.08) {
      setCell(neighbor, EMPTY);
      moved[neighbor] = 1;
    }
  });
  updatePowderOrLiquid(x, y, ACID);
}

function updateMetal(x, y, i) {
  if (energy[i] === 0) return;
  wakeCell(i);
  energy[i]--;
  markDirty(i);
  forEachNeighbor(x, y, (neighbor) => {
    if (cells[neighbor] === METAL && energy[neighbor] === 0) {
      energy[neighbor] = randomBetween(8, 16);
      wakeCell(neighbor);
      markDirty(neighbor);
    }
    if (cells[neighbor] === ELECTRICITY && energy[neighbor] < 8) {
      energy[neighbor] = 8;
      wakeCell(neighbor);
      markDirty(neighbor);
    }
  });
}

function updateElectricity(x, y, i) {
  wakeCell(i);
  if (energy[i] > 0) {
    energy[i]--;
    markDirty(i);
  }
  let waterNeighbor = -1;
  let emptyNeighbor = -1;
  forEachNeighbor(x, y, (neighbor) => {
    if (cells[neighbor] === METAL) {
      energy[neighbor] = Math.max(energy[neighbor], randomBetween(6, 12));
      wakeCell(neighbor);
      markDirty(neighbor);
    } else if (waterNeighbor < 0 && cells[neighbor] === WATER) waterNeighbor = neighbor;
    else if (emptyNeighbor < 0 && cells[neighbor] === EMPTY) emptyNeighbor = neighbor;
  });

  // 一颗电火花每帧最多复制一次，避免指数式填满整个画布。
  if (waterNeighbor >= 0 && Math.random() < 0.16) {
    setCell(waterNeighbor, ELECTRICITY);
    moved[waterNeighbor] = 1;
  } else if (emptyNeighbor >= 0 && Math.random() < 0.045) {
    setCell(emptyNeighbor, ELECTRICITY, randomBetween(5, 9));
    moved[emptyNeighbor] = 1;
  }
  if (energy[i] === 0) {
    setCell(i, EMPTY);
    moved[i] = 1;
  }
}

function updateWood(x, y, i) {
  if (energy[i] === 0) return;
  wakeCell(i);
  energy[i]--;
  markDirty(i);
  forEachNeighbor(x, y, (neighbor) => {
    if (cells[neighbor] === WOOD && energy[neighbor] === 0 && Math.random() < 0.018) {
      energy[neighbor] = randomBetween(90, 150);
      wakeCell(neighbor);
      markDirty(neighbor);
    }
  });
  const above = y > 0 ? indexOf(x, y - 1) : -1;
  if (above >= 0 && cells[above] === EMPTY && Math.random() < 0.09) {
    setCell(above, FIRE);
    moved[above] = 1;
  }
  if (energy[i] === 0) {
    setCell(i, Math.random() < 0.55 ? SMOKE : EMPTY);
    moved[i] = 1;
  }
}

function plantCrowded(x, y, limit = 4, ownBranchId = 0) {
  let nearby = 0;
  // 用稍大的观察半径给每条细茎留出空气感；只统计草，不统计花。
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny)) continue;
      const neighbor = indexOf(nx, ny);
      if (cells[neighbor] !== PLANT) continue;
      // 只排除本条枝的承托茎；同一株的其他枝也要保持距离。
      if (ownBranchId > 0 && plantBranchId[neighbor] === ownBranchId) continue;
      nearby++;
    }
  }
  return nearby >= limit;
}

function hasPlantAbove(x, y, branchId = 0) {
  return [
    [x - 1, y - 1],
    [x, y - 1],
    [x + 1, y - 1],
  ].some(([nx, ny]) => inBounds(nx, ny) && cells[indexOf(nx, ny)] === PLANT &&
    (branchId === 0 || plantBranchId[indexOf(nx, ny)] === branchId));
}

function flowerCrowded(x, y) {
  // 花冠保持约 3 格间距，让同一株的 3～4 朵花聚成花束。
  const radius = 3;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (inBounds(nx, ny) && cells[indexOf(nx, ny)] === FLOWER) return true;
    }
  }
  return false;
}

function stemHeightAt(x, y, branchId = 0) {
  // 从花端沿着相邻根茎向下追溯，只有连续根茎达到最低高度才允许开花。
  let height = 1;
  let currentX = x;
  let currentY = y;
  for (let step = 0; step < 80; step++) {
    const candidates = [
      [currentX, currentY + 1],
      [currentX - 1, currentY + 1],
      [currentX + 1, currentY + 1],
    ];
    const next = candidates.find(([nx, ny]) =>
      inBounds(nx, ny) && cells[indexOf(nx, ny)] === PLANT &&
      (branchId === 0 || plantBranchId[indexOf(nx, ny)] === branchId),
    );
    if (!next) break;
    [currentX, currentY] = next;
    height++;
  }
  return height;
}

function nearbyFlowerCount(x, y) {
  let count = 0;
  const radius = 24;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (inBounds(nx, ny) && cells[indexOf(nx, ny)] === FLOWER) count++;
    }
  }
  return count;
}

function familyForBranch(branchId) {
  const familyId = branchFamilies.get(branchId);
  return familyId ? plantFamilies.get(familyId) : null;
}

function waterPlantFamily(branchId, waterNeighbor) {
  const family = familyForBranch(branchId);
  if (!family || waterNeighbor < 0) return false;
  if ((family.wilt || 0) >= 0.45) return false;
  if (tick - family.lastWaterTick < PLANT_WATER_INTERVAL) return false;
  family.lastWaterTick = tick;
  family.waterX = waterNeighbor % WIDTH;
  family.waterY = Math.floor(waterNeighbor / WIDTH);
  family.waterFeedbackTick = tick;
  const absorbed = family.waterLevel < MAX_PLANT_WATER_LEVEL;
  if (absorbed) {
    setCell(waterNeighbor, EMPTY);
    moved[waterNeighbor] = 1;
    family.waterLevel++;
  }
  if (family.species === 'tree') {
    showMessage(absorbed ? '小树已吸水，树干和树枝正在逐渐增粗' : '小树水分充足，粗度已达目标上限');
    return absorbed;
  }
  if (family.species === 'mushroom' || family.species === 'cactus') {
    showMessage(!absorbed ? '本株水分充足，生长体型有上限' : family.species === 'mushroom'
      ? '蘑菇已吸水，菌柄与菌盖逐步长成' : '仙人掌已吸水，主干和侧臂按上限生长');
    return absorbed;
  }

  // 水只唤醒已开花的枝端，不再从整条茎上不停挤出新枝。
  // 即使旧版本已把水分等级加满，未完成第二轮开花的枝也仍可被再次浇醒。
  const hasRestingTip = Object.entries(family.branchTips).some(([id, tip]) =>
    cells[tip] === PLANT && plantBranchId[tip] === Number(id) &&
    floweredBranches.has(Number(id)) &&
    (family.branchBlooms[id] ?? 1) < MAX_BRANCH_BLOOMS &&
    Math.floor(tip / WIDTH) >= PLANT_HEIGHT_CAP_Y + 8);
  if (hasRestingTip) {
    family.growthCredits = Math.min(2, (family.growthCredits || 0) + 1);
    showMessage('已吸水，已开花的枝端将继续伸长，再开一轮花');
  } else {
    const allFinished = Object.keys(family.branchTips).every((id) =>
      (family.branchBlooms[id] || 0) >= MAX_BRANCH_BLOOMS);
    showMessage(allFinished ? '本株已完成两轮开花，停止继续生长' :
      '已吸水：正在生长的枝端获得补给');
  }
  return absorbed;
}

function bloomHeightForBranch(branchId) {
  const family = familyForBranch(branchId);
  if (!family) return null;
  const variation = branchBloomOffsets.get(branchId) || 0;
  const naturalHeight = family.species === 'mushroom' ? 9 + Math.round(variation / 4) : family.species === 'giant'
    // 花冠缩为上一版一半后，同步降低承托茎，维持低矮大花的比例。
    ? 19 + Math.round(variation / 3) : 16 + Math.round(variation / 2);
  const targetHeight = family.branchTargets[branchId] ?? naturalHeight;
  const screenHeightLimit = Math.max(8, family.rootY - PLANT_HEIGHT_CAP_Y);
  return Math.min(screenHeightLimit, targetHeight);
}

function regrowWateredBranch(x, y, i, branchId, family) {
  if (!(family.growthCredits > 0) ||
      (family.branchBlooms[branchId] ?? 1) >= MAX_BRANCH_BLOOMS ||
      y < PLANT_HEIGHT_CAP_Y + 8) return false;
  const direction = plantLean[i] || 1;
  // 从旧花下方侧移一格接续原枝，保留旧花，不额外增加一整条根茎。
  for (const [side, dy] of [[direction, 0], [-direction, 0], [direction, -1], [-direction, -1]]) {
    const nx = x + side;
    const ny = y + dy;
    if (!inBounds(nx, ny)) continue;
    const target = indexOf(nx, ny);
    if ((cells[target] !== EMPTY && cells[target] !== WATER) ||
        plantCrowded(nx, ny, 8, branchId)) continue;
    // 先确认幼芽旁边确实有继续伸展的空间，避免消耗额度却生出被夹住的芽点。
    const hasExit = [[nx + side, ny - 1], [nx, ny - 1], [nx + side, ny]].some(([ex, ey]) =>
      inBounds(ex, ey) && ey >= PLANT_HEIGHT_CAP_Y &&
      (cells[indexOf(ex, ey)] === EMPTY || cells[indexOf(ex, ey)] === WATER));
    if (!hasExit) continue;
    const previousBlooms = family.branchBlooms[branchId] ?? 1;
    family.branchBlooms[branchId] = previousBlooms;
    family.branchTargets[branchId] = Math.min(family.rootY - PLANT_HEIGHT_CAP_Y,
      family.rootY - y + randomBetween(10, 16));
    family.branchSpreads[branchId] = ny - 4;
    setCell(target, PLANT, 280, 0, side, 0, branchId);
    family.branchTips[branchId] = target;
    floweredBranches.delete(branchId);
    moved[target] = 1;
    family.growthCredits--;
    showMessage('枝端已重新抽芽，继续向上生长');
    return true;
  }
  return false;
}

function growTreeCrown(x, y, branchId, family) {
  const radius = family.treeCanopies[branchId];
  const branch = family.treeBranches[branchId];
  const maxRadius = branch?.crownRx ?? 9 + branchId % 3;
  const crownHeight = branch?.crownRy ?? 7;
  if (radius >= maxRadius || tick % 4 !== 0) return;
  const nextRadius = radius + 1;
  const progress = nextRadius / maxRadius;
  const verticalRadius = Math.ceil(crownHeight * progress);
  for (let dy = -verticalRadius; dy <= verticalRadius; dy++) {
    for (let dx = -nextRadius; dx <= nextRadius; dx++) {
      // 三个重叠椭圆形成扁圆、不完全对称的叶簇，避免树冠变成整齐的圆球。
      const u = dx / progress, v = dy / progress;
      const willowFringe = family.treeKind === 'willow' && dx % 3 === 0 &&
        Math.abs(u) < maxRadius * 0.9 && v > 0 && v < crownHeight * (0.65 + Math.abs(u) / maxRadius * 0.35);
      const inCrown = willowFringe || (u / (maxRadius * 0.82)) ** 2 + (v / crownHeight) ** 2 <= 1 ||
        ((u + maxRadius * 0.42) / (maxRadius * 0.58)) ** 2 +
          ((v + crownHeight * 0.08) / (crownHeight * 0.76)) ** 2 <= 1 ||
        ((u - maxRadius * 0.42) / (maxRadius * 0.54)) ** 2 +
          ((v - crownHeight * 0.06) / (crownHeight * 0.78)) ** 2 <= 1;
      if (!inCrown) continue;
      const nx = x + dx, ny = y + dy;
      if (!inBounds(nx, ny) || ny < PLANT_HEIGHT_CAP_Y) continue;
      const target = indexOf(nx, ny);
      if (cells[target] !== EMPTY && cells[target] !== WATER) continue;
      const texture = (Math.imul(target + 1, 1597334677) ^ branchId) >>> 0;
      if ((Math.abs(u) > maxRadius * 0.78 || Math.abs(v) > crownHeight * 0.78) && texture % 5 === 0) continue;
      const shade = Math.max(0, Math.min(3,
        Math.floor((crownHeight - dy) / (crownHeight * 2) * 3) + texture % 2));
      setCell(target, LEAF, shade, 0, 0, 0, branchId);
      moved[target] = 1;
    }
  }
  family.treeCanopies[branchId] = nextRadius;
}

function growTreeLayer(x, y, branchId, family, height, heightLimit) {
  if (family.treeLayers.length === 0) {
    const top = Math.min(family.treeHeight, heightLimit);
    const first = Math.min(family.treeTrunkHeight, Math.floor(top * 0.5));
    const firstSide = Math.random() < 0.5 ? -1 : 1;
    family.treeLayers = Array.from({ length: MAX_TREE_SIDE_BRANCHES }, (_, layer) => ({
      height: Math.round(first + (top - first) * [0, 0.25, 0.5, 0.72][layer]) + randomBetween(-2, 2),
      side: layer % 2 === 0 ? firstSide : -firstSide,
      reach: randomBetween(23, 28) - layer * 3,
      rise: randomBetween(24, 29) - layer * 4,
      crownRx: randomBetween(12, 15) - layer + (family.treeKind === 'mangrove' ? 4 : 0),
      crownRy: randomBetween(8, 10) - Math.floor(layer / 2) + (family.treeKind === 'willow' ? 7 : 0),
      spawned: false,
    }));
  }
  for (const layer of family.treeLayers) {
    if (layer.spawned || height < layer.height) continue;
    const nx = x + layer.side, ny = y - 1;
    if (!inBounds(nx, ny) || ny < PLANT_HEIGHT_CAP_Y + 10) continue;
    const target = indexOf(nx, ny);
    if (cells[target] !== EMPTY && cells[target] !== WATER) continue;
    const childId = nextBranchId++;
    branchFamilies.set(childId, branchFamilies.get(branchId));
    family.branchTips[childId] = target;
    family.treeDepths[childId] = 1;
    family.treeBranches[childId] = {
      startX: x, startHeight: height,
      targetX: Math.max(2, Math.min(WIDTH - 3, x + layer.side * layer.reach)),
      targetHeight: Math.min(heightLimit - 1, height + layer.rise),
      crownRx: layer.crownRx, crownRy: layer.crownRy,
    };
    family.branchCount++;
    layer.spawned = true;
    setCell(target, PLANT, 300, 0, layer.side, 0, childId);
    moved[target] = 1;
    return;
  }
}

function growTreeFruit(x, y, branchId, family) {
  // 耐湿树是观赏树，采果仍使用原来的果树。
  if (family.treeKind && family.treeKind !== 'normal') return;
  const branch = family.treeBranches[branchId];
  const radius = branch?.crownRx ?? 9 + branchId % 3;
  if (family.treeCanopies[branchId] < radius || (family.fruitProduced || 0) >= MAX_FRUIT_PER_TREE) return;
  const crownHeight = branch?.crownRy ?? 7;
  let state = family.treeFruitStates[branchId];
  if (!state) {
    state = { produced: 0, nextTick: tick + randomBetween(60, 120) };
    family.treeFruitStates[branchId] = state;
  }
  if (state.produced >= MAX_FRUIT_PER_CROWN || tick < state.nextTick) return;
  // 找树冠下缘的真实叶片来悬挂青果，避免在空中或叶簇中心凭空出现。
  const candidates = [];
  for (let dy = 1; dy <= crownHeight + 1; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = x + dx, ny = y + dy;
      if (!inBounds(nx, ny) || !inBounds(nx, ny - 1)) continue;
      const target = indexOf(nx, ny), support = indexOf(nx, ny - 1);
      if (cells[target] !== EMPTY || cells[support] !== LEAF || plantBranchId[support] !== branchId) continue;
      let crowded = false;
      for (let oy = -4; oy <= 4 && !crowded; oy++) {
        for (let ox = -4; ox <= 4; ox++) {
          if (!inBounds(nx + ox, ny + oy)) continue;
          if (cells[indexOf(nx + ox, ny + oy)] === FRUIT) { crowded = true; break; }
        }
      }
      if (!crowded) candidates.push(target);
    }
  }
  if (candidates.length === 0) {
    state.nextTick = tick + 45;
    return;
  }
  const target = candidates[randomBetween(0, candidates.length - 1)];
  setCell(target, FRUIT, 1, 0, 0, 0, branchId);
  moved[target] = 1;
  state.produced++;
  state.nextTick = tick + FRUIT_SPAWN_INTERVAL + randomBetween(0, 45);
  family.fruitProduced = (family.fruitProduced || 0) + 1;
}

function updateFruit(x, y, i) {
  wakeCell(i);
  const branchId = plantBranchId[i];
  energy[i] = Math.min(65535, energy[i] + 1);
  markDirty(i);
  const support = y > 0 ? indexOf(x, y - 1) : -1;
  const attached = support >= 0 && cells[support] === LEAF && plantBranchId[support] === branchId;
  // 通过位置错开落果时间；树叶被擦掉、烧掉或腐蚀时，果实也会失去承托。
  const dropAge = FRUIT_DROP_TICKS + (Math.imul(i + 1, 31) >>> 0) % FRUIT_DROP_JITTER;
  if (!attached || energy[i] >= dropAge) {
    const maturity = Math.min(FRUIT_RIPEN_TICKS, energy[i]);
    setCell(i, FALLEN_FRUIT, randomBetween(...FALLEN_FRUIT_LIFETIME), maturity, 0, 0, branchId);
    moved[i] = 1;
  }
}

function updateFallenFruit(x, y, i) {
  wakeCell(i);
  if (energy[i] > 0) energy[i]--;
  if (plantAge[i] < FRUIT_RIPEN_TICKS) {
    plantAge[i]++;
    markDirty(i);
  }
  if (energy[i] === 0) {
    setCell(i, EMPTY);
    moved[i] = 1;
    return;
  }
  if (energy[i] < 90) markDirty(i);
  let currentX = x, currentY = y;
  for (let step = 0; step < WORLD_SCALE; step++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    let destination = null;
    for (const nx of [currentX, currentX + side, currentX - side]) {
      const ny = currentY + 1;
      if (!inBounds(nx, ny)) continue;
      const targetKind = cells[indexOf(nx, ny)];
      // 落果可拨开树叶、沉入水里；不会像高密度粉末一样钻进沙土或树干。
      destination = tryMoveAndTrack(currentX, currentY, nx, ny, targetKind === LEAF ? LEAF : WATER);
      if (destination) break;
    }
    if (!destination) break;
    [currentX, currentY] = destination;
  }
}

function fruitColorFor(i, kind) {
  const progress = Math.min(1, (kind === FALLEN_FRUIT ? plantAge[i] : energy[i]) / FRUIT_RIPEN_TICKS);
  const start = progress < 0.55 ? [117, 170, 66] : [237, 183, 65];
  const end = progress < 0.55 ? [237, 183, 65] : [213, 76, 62];
  const blend = progress < 0.55 ? progress / 0.55 : (progress - 0.55) / 0.45;
  const color = start.map((channel, at) => Math.round(channel + (end[at] - channel) * blend));
  if (kind !== FALLEN_FRUIT) return color;
  const fresh = Math.min(1, energy[i] / 90);
  const brown = [137, 78, 43];
  return color.map((channel, at) => Math.round(brown[at] + (channel - brown[at]) * fresh));
}

function treeCanEnter(x, y, branchId) {
  if (!inBounds(x, y) || y < PLANT_HEIGHT_CAP_Y + 10) return false;
  const i = indexOf(x, y);
  return cells[i] === EMPTY || cells[i] === WATER ||
    (cells[i] === LEAF && plantBranchId[i] === branchId);
}

function findTreeDetour(x, y, branchId, direction) {
  // 局部广度搜索：沿实体边缘绕行，只使用真正相连的空格，不穿墙。
  const queue = [{ x, y, parent: -1 }];
  const visited = new Set([indexOf(x, y)]);
  for (let head = 0; head < queue.length && head < 1800; head++) {
    const point = queue[head];
    if (point.y <= y - 4) {
      const path = [];
      let at = head;
      while (queue[at].parent >= 0) {
        path.push([queue[at].x, queue[at].y]);
        at = queue[at].parent;
      }
      return path.reverse();
    }
    for (const [dx, dy] of [[0, -1], [direction, 0], [-direction, 0], [0, 1]]) {
      const nx = point.x + dx, ny = point.y + dy;
      if (Math.abs(nx - x) > 24 || ny > y + 4 || ny < y - 14 ||
          !treeCanEnter(nx, ny, branchId)) continue;
      const key = indexOf(nx, ny);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ x: nx, y: ny, parent: head });
    }
  }
  return [];
}

function updateTree(x, y, i, branchId, family) {
  let waterNeighbor = -1;
  forEachNeighbor(x, y, (neighbor) => {
    if (waterNeighbor < 0 && cells[neighbor] === WATER) waterNeighbor = neighbor;
  });
  waterPlantFamily(branchId, waterNeighbor);
  // 每株每帧只增粗一次；成熟后的树也能吸水变粗，且有明确上限。
  if (family.girthTick !== tick) {
    const targetGirth = Math.min(MAX_TREE_GIRTH, 1 + family.waterLevel * 0.35);
    family.treeGirth = Math.min(targetGirth, (family.treeGirth ?? 1) + 0.025);
    family.girthTick = tick;
    if (family.treeGirth < targetGirth) wakeCell(i);
  }
  if (family.branchTips[branchId] !== i || family.treeDepths[branchId] === -1) return;
  wakeCell(i);
  plantAge[i] = Math.min(65535, plantAge[i] + 1);
  if (family.treeCanopies[branchId] !== undefined) {
    growTreeCrown(x, y, branchId, family);
    growTreeFruit(x, y, branchId, family);
    return;
  }
  const depth = family.treeDepths[branchId] || 0;
  // 长树干和高处树枝都逐节推进；枝冠阶段稍慢，生长时间换来明显更高的树形。
  const stepTicks = depth === 0 ? TREE_TRUNK_STEP_TICKS : TREE_BRANCH_STEP_TICKS;
  if (plantAge[i] < stepTicks) return;
  const detours = family.treeDetours ||= {};
  const detour = detours[branchId];
  if (detour?.length) {
    const [nx, ny] = detour[0];
    if (Math.abs(nx - x) + Math.abs(ny - y) === 1 && treeCanEnter(nx, ny, branchId)) {
      const target = indexOf(nx, ny);
      setCell(target, PLANT, 300, 0, plantLean[i] || 1, 0, branchId);
      family.branchTips[branchId] = target;
      detour.shift();
      moved[target] = 1;
      return;
    }
    delete detours[branchId]; // 绘制的新障碍挡住旧路线时，重新规划。
  }
  const height = family.rootY - y;
  const heightLimit = Math.max(1, family.rootY - PLANT_HEIGHT_CAP_Y - 10);
  const branch = family.treeBranches[branchId];
  const targetHeight = Math.min(heightLimit, branch?.targetHeight ??
    family.treeHeight + Math.min(4, family.waterLevel) * 2);
  if (depth === 0) growTreeLayer(x, y, branchId, family, height, heightLimit);
  const reachedSide = !branch || Math.abs(branch.targetX - x) <= 1;
  if (height >= targetHeight && reachedSide) {
    family.treeCanopies[branchId] = 0;
    return;
  }
  const direction = plantLean[i] || 1;
  const branchProgress = branch ? Math.max(0, Math.min(1,
    (height - branch.startHeight) / Math.max(1, targetHeight - branch.startHeight))) : 0;
  const curve = branchProgress * branchProgress * (3 - 2 * branchProgress);
  const desiredX = branch ? branch.startX + (branch.targetX - branch.startX) * curve :
    family.rootX + Math.sin(height * 0.055 + branchId) * 2;
  const bend = Math.abs(desiredX - x) >= 0.65 ? Math.sign(desiredX - x) : 0;
  const nextY = height >= targetHeight ? y : y - 1;
  const growthTargets = [[x + bend, nextY], [x, y - 1], [x + direction, y - 1], [x - direction, y - 1]];
  for (const [nx, ny] of growthTargets) {
    if ((nx === x && ny === y) || !inBounds(nx, ny) || ny < PLANT_HEIGHT_CAP_Y + 10) continue;
    if (nx !== x && ny !== y && !treeCanEnter(nx, y, branchId) && !treeCanEnter(x, ny, branchId)) continue;
    const target = indexOf(nx, ny);
    const ownLeaves = cells[target] === LEAF && plantBranchId[target] === branchId;
    if (cells[target] !== EMPTY && cells[target] !== WATER && !ownLeaves) continue;
    setCell(target, PLANT, 300, 0, direction, 0, branchId);
    family.branchTips[branchId] = target;
    moved[target] = 1;
    return;
  }
  // 受阻后保留生长顶端；每隔一段时间重试，移除障碍后仍可恢复。
  if (tick >= (family.treeRetryTick?.[branchId] ?? 0)) {
    detours[branchId] = findTreeDetour(x, y, branchId, direction);
    (family.treeRetryTick ||= {})[branchId] = tick + 45;
  }
}

function updateCactus(x, y, i, branchId, family) {
  let waterNeighbor = -1;
  forEachNeighbor(x, y, (neighbor) => {
    if (waterNeighbor < 0 && cells[neighbor] === WATER) waterNeighbor = neighbor;
  });
  waterPlantFamily(branchId, waterNeighbor);
  if (family.branchTips[branchId] !== i) return;
  wakeCell(i);
  plantAge[i] = Math.min(65535, plantAge[i] + 1);
  if (plantAge[i] < Math.max(4, 6 - Math.min(2, family.waterLevel))) return;
  const main = branchId === family.cactusRootBranchId;
  const height = family.rootY - y;
  const limit = Math.max(1, family.rootY - PLANT_HEIGHT_CAP_Y - 3);
  const mainHeight = Math.min(limit, family.cactusHeight + Math.min(3, family.waterLevel) * 2);
  const branch = family.cactusBranches[branchId];
  const targetHeight = branch ? branch.targetHeight : mainHeight;
  if (main && family.cactusArms.length === 0) {
    const firstSide = plantLean[i] || 1;
    family.cactusArms = [0, 1].map((at) => ({
      height: Math.floor(family.cactusHeight * (at === 0 ? 0.4 : 0.66)),
      side: at === 0 ? firstSide : -firstSide,
      reach: randomBetween(7, 10), rise: randomBetween(9, 14), spawned: false,
    }));
  }
  if (main) {
    for (const arm of family.cactusArms) {
      if (arm.spawned || height < arm.height || y < PLANT_HEIGHT_CAP_Y + 6) continue;
      const nx = x + arm.side;
      if (!inBounds(nx, y)) continue;
      const target = indexOf(nx, y);
      if (cells[target] !== EMPTY && cells[target] !== WATER) continue;
      const childId = nextBranchId++;
      branchFamilies.set(childId, branchFamilies.get(branchId));
      family.branchTips[childId] = target;
      family.cactusBranches[childId] = { startX: x, side: arm.side,
        targetX: Math.max(1, Math.min(WIDTH - 2, x + arm.side * arm.reach)),
        targetHeight: Math.min(limit, family.cactusHeight - 3, height + arm.rise) };
      family.branchCount++;
      arm.spawned = true;
      setCell(target, PLANT, 300, 0, arm.side, 0, childId);
      moved[target] = 1;
      break;
    }
  }
  if (height >= targetHeight) return;
  let nx = x, ny = y - 1;
  if (branch && Math.abs(branch.targetX - x) > 0) {
    nx += Math.sign(branch.targetX - x);
    ny = y - ((Math.abs(nx - branch.startX) % 3 === 0) ? 1 : 0);
  }
  for (const [tx, ty] of [[nx, ny], [x, y - 1]]) {
    if ((tx === x && ty === y) || !inBounds(tx, ty) || ty < PLANT_HEIGHT_CAP_Y + 3) continue;
    const target = indexOf(tx, ty);
    if (cells[target] !== EMPTY && cells[target] !== WATER) continue;
    setCell(target, PLANT, 300, 0, plantLean[i], 0, branchId);
    family.branchTips[branchId] = target;
    moved[target] = 1;
    return;
  }
}

function updatePlant(x, y, i) {
  const branchId = plantBranchId[i];
  const family = familyForBranch(branchId);
  if ((family?.wilt || 0) >= 0.45) return;
  if ((family?.wilt || 0) > 0.1 && tick % 3 !== 0) return;
  if (family?.species === 'tree') {
    updateTree(x, y, i, branchId, family);
    return;
  }
  if (family?.species === 'cactus') {
    updateCactus(x, y, i, branchId, family);
    return;
  }
  const branchAlreadyFlowered = branchId > 0 && floweredBranches.has(branchId);

  let waterNeighbor = -1;
  forEachNeighbor(x, y, (neighbor) => {
    if (waterNeighbor < 0 && cells[neighbor] === WATER) waterNeighbor = neighbor;
  });

  // 新植物把吸收的水记录到整株共享状态；旧存档植物沿用原来的局部补能。
  if (waterNeighbor >= 0) wakeCell(i);
  if (family) {
    waterPlantFamily(branchId, waterNeighbor);
  } else if (energy[i] === 0 && waterNeighbor >= 0 && Math.random() < 0.035) {
    setCell(waterNeighbor, EMPTY);
    energy[i] = randomBetween(85, 130);
    markDirty(i);
  }

  // 即使能量耗尽，也继续记录年龄并保持活动，让成熟根茎可以自然开花。
  wakeCell(i);
  plantAge[i] = Math.min(65535, plantAge[i] + 1);
  if (energy[i] > 0) energy[i]--;
  markDirty(i);

  const flowerCount = branchId === 0 ? nearbyFlowerCount(x, y) : 0;
  // 新种子的每条主枝各开一朵；旧存档中没有枝条编号的植物沿用原来的两朵上限。
  if (branchId === 0 && flowerCount >= 2) {
    energy[i] = 0;
    return;
  }

  const direction = plantLean[i] || (Math.random() < 0.5 ? -1 : 1);

  // 每条枝拥有独立目标高度；浇水只在第一轮开花后唤醒下一轮生长。
  const stemHeight = stemHeightAt(x, y, branchId);
  const growthGeneration = Math.floor(stemHeight / 8) + 1;
  const isBranchTip = family ? family.branchTips[branchId] === i : !hasPlantAbove(x, y, branchId);
  let branchBudget = plantBranchBudget[i];
  if (family && isBranchTip && branchAlreadyFlowered) {
    regrowWateredBranch(x, y, i, branchId, family);
    return;
  }

  if (family && isBranchTip && branchBudget > 0 &&
      (family.rootY - y >= bloomHeightForBranch(branchId) || family.branchCount >= MAX_PLANT_BRANCHES)) {
    // 初生分叉被挡住时主茎照常开花，不把剩余额度变成密集的补生枝。
    plantBranchBudget[i] = 0;
    branchBudget = 0;
  }

  // 已开花的老茎保持原样，只有上面明确记录的枝端可以接续生长。
  if (branchAlreadyFlowered) return;
  // 老茎只负责吸水和承托，禁止以同一个枝号反复复制出无法计数的伪侧枝。
  if (family && !isBranchTip) return;

  const targetHeight = bloomHeightForBranch(branchId);
  const currentHeight = family ? Math.max(1, family.rootY - y) : stemHeight;
  const reachedScreenCap = family ? y <= PLANT_HEIGHT_CAP_Y : false;
  const readyToBloom = !branchAlreadyFlowered && isBranchTip && branchBudget === 0 &&
    (family ? currentHeight >= targetHeight : growthGeneration >= 3);
  const bloomChance = family
    ? (reachedScreenCap ? 0.85 : (currentHeight >= targetHeight + 2 ? 0.5 : 0.16))
    : (growthGeneration >= 4 ? 0.5 : 0.12);
  if (readyToBloom && Math.random() < bloomChance) {
    const bloomTargets = family?.species === 'mushroom' ? [[x, y - 1]] : [
      [x, y - 1],
      [x + direction, y - 1],
      [x - direction, y - 1],
      [x, y - 2],
    ];
    const start = (i + plantAge[i]) % bloomTargets.length;
    for (let offset = 0; offset < bloomTargets.length; offset++) {
      const [flowerX, flowerY] = bloomTargets[(start + offset) % bloomTargets.length];
      if (!inBounds(flowerX, flowerY)) continue;
      const flowerCell = indexOf(flowerX, flowerY);
      const canBloomInWater = family && family.waterLevel > 0 && cells[flowerCell] === WATER;
      if ((cells[flowerCell] !== EMPTY && !canBloomInWater) ||
          plantCrowded(flowerX, flowerY, 7, branchId) || flowerCrowded(flowerX, flowerY)) continue;
      // 先放置一个小花苞，后续由 updateFlower 逐帧展开花瓣。
      setCell(flowerCell, FLOWER, 1, 0, 0, 0, branchId);
      if (branchId > 0) floweredBranches.add(branchId);
      if (family) family.branchBlooms[branchId] = (family.branchBlooms[branchId] || 0) + 1;
      moved[flowerCell] = 1;
      energy[i] = Math.max(0, energy[i] - 7);
      return;
    }
  }

  const waitingAtBloomHeight = family
    ? readyToBloom && (reachedScreenCap || family.species === 'mushroom' ||
      (currentHeight >= targetHeight + 3 && !flowerCrowded(x, y)))
    : readyToBloom && growthGeneration >= 4;
  if (waitingAtBloomHeight) return;

  // 没有能量时停止继续长茎，但不影响上面的成熟开花逻辑。
  if (energy[i] === 0) {
    if (family && isBranchTip && family.waterLevel > 0) {
      energy[i] = Math.min(240, 40 + family.waterLevel * 20);
    } else {
      return;
    }
  }

  // 新植物只由明确记录的枝端推进；无整株信息的旧植物仍沿用相邻格判断。
  const hasStemAhead = !isBranchTip;
  // 保留逐节推进和后期减速；新增侧枝统一由有总量限制的分枝额度生成。
  let growthChance = hasStemAhead
    ? 0.035
    : (plantAge[i] < 55 ? 0.24 : (plantAge[i] < 120 ? 0.12 : 0.04));
  growthChance = Math.min(1, growthChance * PLANT_GROWTH_SPEED);
  // 第一朵花出现后继续长，但明显放慢；第二朵花由上面的上限逻辑收束。
  if (flowerCount === 1) growthChance *= 0.45;
  if (Math.random() >= growthChance) return;

  // 枝端多数时候直着向上，隔几节才侧移一格；弯曲会形成缓慢的弧线，
  // 不再每格都斜走，也不会在等待生长时反复随机换向。
  // 分叉或旧花旁接续生长的最初几格略向外舒展，拉开枝间距离后恢复向上。
  const spreading = family && y > (family.branchSpreads[branchId] ?? y);
  const tipTargets = family?.species === 'mushroom' ? [[x, y - 1], [x + direction, y - 1]] : spreading || Math.random() < 0.2
    ? [[x + direction, y - 1], [x, y - 1], [x - direction, y - 1]]
    : [[x, y - 1], [x + direction, y - 1], [x - direction, y - 1]];
  // 侧枝出生时只斜向上分开一格，之后同样使用上面的缓弯节奏继续生长。
  const growthTargets = hasStemAhead
    ? [[x + direction, y - 1], [x, y - 1]]
    : tipTargets;
  for (const [nx, ny] of growthTargets) {
    if (!inBounds(nx, ny)) continue;
    if (family && ny < PLANT_HEIGHT_CAP_Y) continue;
    const target = indexOf(nx, ny);
    // 初生分叉阶段允许根部稍微靠近，分化完成后仍恢复原来的疏枝限制。
    const crowdLimit = spreading ? 8 : (!hasStemAhead && branchBudget > 0 ? 6 : 4);
    const canGrowIntoWater = family && family.waterLevel > 0 && cells[target] === WATER;
    if ((cells[target] !== EMPTY && !canGrowIntoWater) || plantCrowded(nx, ny, crowdLimit, branchId)) continue;
    // 只在真正长出新的一节时才有小概率改变弯曲方向，避免原先按帧翻转造成锯齿。
    const childLean = !spreading && Math.random() < 0.08 ? -direction : direction;
    // 主茎把剩余生长预算向上连续传递，避免每一节都按比例衰减后只能长出
    // 五六格就停止；侧枝仍使用较小预算，保持“高主茎、少分枝”的轮廓。
    const waterEnergyBoost = family ? family.waterLevel * 3 : 0;
    const childEnergy = hasStemAhead
      ? Math.max(18, Math.floor(energy[i] * 0.42))
      : Math.max(24, energy[i] - randomBetween(8, 14) + waterEnergyBoost);
    // 先把额度交给继续向上的主枝；只有另一条幼枝成功落位后才扣除一次。
    const remainingBranchBudget = !hasStemAhead ? branchBudget : 0;
    setCell(target, PLANT, childEnergy, 0, childLean, remainingBranchBudget, branchId);
    if (family) family.branchTips[branchId] = target;
    plantBranchBudget[i] = 0;

    // 只有播种时的初生额度可分叉，浇水不会再追加一整簇根茎。
    if (!hasStemAhead && branchBudget > 0 && (!family || family.branchCount < MAX_PLANT_BRANCHES)) {
      const forkDirection = branchBudget % 2 === 0 ? direction : -direction;
      const forkTargets = [
        [x + forkDirection, y - 1],
        [x - forkDirection, y - 1],
        [x, y - 1],
      ];
      for (const [forkX, forkY] of forkTargets) {
        if (!inBounds(forkX, forkY)) continue;
        const fork = indexOf(forkX, forkY);
        const canForkIntoWater = family && family.waterLevel > 0 && cells[fork] === WATER;
        if (fork === target || (cells[fork] !== EMPTY && !canForkIntoWater) || plantCrowded(forkX, forkY, 7, branchId)) continue;
        const forkEnergy = Math.max(140, Math.floor(childEnergy * 0.72));
        const forkBranchId = nextBranchId++;
        if (family) {
          const familyId = branchFamilies.get(branchId);
          branchFamilies.set(forkBranchId, familyId);
          branchBloomOffsets.set(forkBranchId, randomBetween(-7, 7));
          family.branchCount++;
        }
        setCell(fork, PLANT, forkEnergy, 0, forkDirection, 0, forkBranchId);
        if (family) {
          family.branchTips[forkBranchId] = fork;
          family.branchSpreads[forkBranchId] = forkY - 3;
        }
        plantBranchBudget[target] = branchBudget - 1;
        moved[fork] = 1;
        energy[i] = Math.max(0, energy[i] - randomBetween(8, 12));
        break;
      }
    }
    energy[i] = Math.max(0, energy[i] - randomBetween(8, 16));
    moved[target] = 1;
    return;
  }
}

function updateFire(x, y, i) {
  wakeCell(i);
  let waterNeighbor = -1;
  forEachNeighbor(x, y, (neighbor) => {
    if (waterNeighbor < 0 && cells[neighbor] === WATER) waterNeighbor = neighbor;
    if (cells[neighbor] === WOOD && energy[neighbor] === 0 && Math.random() < 0.13) {
      energy[neighbor] = randomBetween(100, 165);
      wakeCell(neighbor);
      markDirty(neighbor);
    }
    if ((cells[neighbor] === PLANT || cells[neighbor] === FLOWER ||
        cells[neighbor] === LEAF || cells[neighbor] === FRUIT || cells[neighbor] === FALLEN_FRUIT ||
        isSeedKind(cells[neighbor])) && Math.random() < 0.42) {
      setCell(neighbor, FIRE);
      moved[neighbor] = 1;
    }
  });

  // 一格水与一格火反应，产生两格会继续上升的蒸汽。
  if (waterNeighbor >= 0) {
    setCell(waterNeighbor, STEAM);
    setCell(i, STEAM);
    moved[waterNeighbor] = 1;
    moved[i] = 1;
    return;
  }
  if (energy[i] > 0) {
    energy[i]--;
    markDirty(i);
  }
  if (energy[i] === 0) {
    setCell(i, Math.random() < 0.7 ? SMOKE : EMPTY);
    moved[i] = 1;
    return;
  }
  const direction = Math.random() < 0.5 ? -1 : 1;
  if (Math.random() < 0.78) {
    if (tryMove(x, y, x, y - 1)) return;
    if (tryMove(x, y, x + direction, y - 1)) return;
    tryMove(x, y, x - direction, y - 1);
  }
}

function updateSmoke(x, y, i) {
  wakeCell(i);
  if (energy[i] > 0) {
    energy[i]--;
    markDirty(i);
  }
  if (energy[i] === 0 || Math.random() < 0.006) {
    setCell(i, EMPTY);
    moved[i] = 1;
    return;
  }
  const direction = Math.random() < 0.5 ? -1 : 1;
  if (tryMove(x, y, x, y - 1)) return;
  if (tryMove(x, y, x + direction, y - 1)) return;
  if (tryMove(x, y, x - direction, y - 1)) return;
  if (Math.random() < 0.25) tryMove(x, y, x + direction, y);
}

function updateFlower(x, y, i) {
  if ((familyForBranch(plantBranchId[i])?.wilt || 0) >= 0.45) return;
  if (energy[i] >= FLOWER_BLOOM_MAX) return;
  energy[i] = Math.min(FLOWER_BLOOM_MAX, energy[i] + 1);
  wakeCell(i);
  markDirty(i);
}

function updateSteam(x, y, i) {
  wakeCell(i);
  let touchesStone = false;
  forEachNeighbor(x, y, (neighbor) => {
    if (cells[neighbor] === STONE) touchesStone = true;
  });

  if (energy[i] > 0) {
    energy[i]--;
    markDirty(i);
  }
  if (energy[i] === 0 || (touchesStone && Math.random() < 0.012)) {
    setCell(i, WATER);
    moved[i] = 1;
    return;
  }

  const direction = Math.random() < 0.5 ? -1 : 1;
  if (tryMove(x, y, x, y - 1)) return;
  if (tryMove(x, y, x + direction, y - 1)) return;
  if (tryMove(x, y, x - direction, y - 1)) return;
  if (Math.random() < 0.35) tryMove(x, y, x + direction, y);
}

function updatePlantWaterlogging() {
  let changing = false;
  let atRisk = 0, deadCount = 0, newWarning = false;
  for (const family of plantFamilies.values()) {
    if ((family.wilt || 0) >= 1) { deadCount++; continue; }
    const root = indexOf(family.rootX, family.rootY);
    // 被擦掉的根不再作为积水传感器；现有枯萎状态仍保留。
    if (cells[root] !== PLANT || familyForBranch(plantBranchId[root]) !== family) continue;
    let water = 0, wetRows = 0;
    for (let dy = -6; dy <= 0; dy++) {
      let rowWater = 0;
      for (let dx = -3; dx <= 3; dx++) {
        const nx = family.rootX + dx, ny = family.rootY + dy;
        if (inBounds(nx, ny) && cells[indexOf(nx, ny)] === WATER) rowWater++;
      }
      water += rowWater;
      if (rowWater >= 2) wetRows++;
    }
    // 少量浅水不伤植物；仙人掌更怕积水，蘑菇耐湿时间更长。
    const willow = family.treeKind === 'willow', mangrove = family.treeKind === 'mangrove';
    const flooded = water >= (mangrove ? 34 : willow ? 24 : 12) && wetRows >= (mangrove ? 6 : willow ? 5 : 4);
    const tolerance = mangrove ? 8 : willow ? 4 : family.species === 'cactus' ? 0.65 : family.species === 'mushroom' ? 1.5 : 1;
    family.waterlogStress = Math.max(0, (family.waterlogStress || 0) + (flooded ? 1 : -3));
    if (flooded && family.waterlogStress >= WATERLOG_STRESS_TICKS * tolerance * 0.7) {
      atRisk++;
      if (!family.waterlogNotified) {
        newWarning = true;
        family.waterlogNotified = true;
      }
    } else if (!flooded && family.waterlogStress === 0 && (family.wilt || 0) < 0.05) {
      family.waterlogNotified = false;
    }
    const previousWilt = family.wilt || 0;
    if (family.waterlogStress >= WATERLOG_STRESS_TICKS * tolerance && flooded) {
      family.wilt = Math.min(1, previousWilt + 1 / WATERLOG_WILT_TICKS);
    } else if (!flooded) {
      family.wilt = Math.max(0, previousWilt - 1 / (WATERLOG_WILT_TICKS * 1.5));
    }
    if (previousWilt >= 0.45 && family.wilt < 0.45) {
      for (const [id, tip] of Object.entries(family.branchTips || {})) {
        if (cells[tip] === PLANT && plantBranchId[tip] === Number(id)) wakeCell(tip);
      }
      // 花苞停长时所在分块也可能休眠，恢复后一起唤醒。
      for (let i = 0; i < cells.length; i++) {
        if (cells[i] === FLOWER && familyForBranch(plantBranchId[i]) === family) wakeCell(i);
      }
    }
    changing ||= previousWilt !== (family.wilt || 0);
    // 积水变化时保持根部活跃；稳定、干燥的成熟植物不再每帧强制唤醒周围九个分块。
    if (flooded || family.waterlogStress > 0 || tick % 30 === 0) wakeCell(root);
  }
  if (newWarning && !drainagePopup.open) drainagePopup.show();
  if (drainagePopup.open) {
    const text = atRisk > 0
      ? `${atRisk} 株植物根部持续积水，可能黄化枯萎。请停止加水，用橡皮擦清除根部周围多余的水，或擦开挡水石墙让水流走。柳树和红树林更耐湿，但深水久泡仍有上限。`
      : deadCount > 0 ? `当前没有仍处于警报中的存活植物；已有 ${deadCount} 株枯死记录，枯死植物无法恢复。请先排除积水再重新播种。`
        : '当前持续积水警报已解除。若已排水，尚未完全枯死的植物会逐渐恢复，请暂时不要继续加水。';
    if (drainagePopupText.textContent !== text) drainagePopupText.textContent = text;
  }
  if (changing && tick % 8 === 0) markAllDirty();
  // 完全枯死后逐格凋落；仍使用原植物材料，保留火烧和酸蚀反应。
  if (tick % 8 !== 0 || deadCount === 0) return;
  for (let i = 0; i < cells.length; i++) {
    if (![PLANT, FLOWER, LEAF, FRUIT].includes(cells[i])) continue;
    const family = familyForBranch(plantBranchId[i]);
    if ((family?.wilt || 0) < 1) continue;
    const age = (family.decayStartedTick ??= tick);
    const delay = cells[i] === PLANT ? 180 : 0;
    if (tick - age >= delay && (Math.imul(i + 1, 31) + tick / 8) % 43 === 0) {
      setCell(i, EMPTY);
      moved[i] = 1;
    }
  }
}

function update() {
  moved.fill(0);
  currentChunks.set(activeChunks);
  nextActiveChunks.fill(0);
  updatePlantWaterlogging();
  // 重力材料从下往上扫描，避免同一个粒子在一帧内连续下落多格。
  for (let y = HEIGHT - 2; y >= 0; y--) {
    const reverse = (y + tick) % 2 === 0;
    const chunkRow = Math.floor(y / CHUNK_SIZE) * CHUNK_COLUMNS;
    for (let chunkStep = 0; chunkStep < CHUNK_COLUMNS; chunkStep++) {
      const chunkX = reverse ? CHUNK_COLUMNS - 1 - chunkStep : chunkStep;
      if (!currentChunks[chunkRow + chunkX]) continue;
      const minX = chunkX * CHUNK_SIZE;
      const maxX = Math.min(WIDTH, minX + CHUNK_SIZE);
      for (let localStep = 0; localStep < maxX - minX; localStep++) {
        const x = reverse ? maxX - 1 - localStep : minX + localStep;
        const i = indexOf(x, y);
        if (moved[i]) continue;
        if (cells[i] === SAND || cells[i] === WATER) updatePowderOrLiquid(x, y, cells[i]);
        else if (cells[i] === SALT) updateSalt(x, y, i);
        else if (isSeedKind(cells[i])) updateSeed(x, y, i);
        else if (cells[i] === ACID) updateAcid(x, y, i);
        else if (cells[i] === WOOD) updateWood(x, y, i);
        else if (cells[i] === PLANT) updatePlant(x, y, i);
        else if (cells[i] === FLOWER) updateFlower(x, y, i);
        else if (cells[i] === FRUIT) updateFruit(x, y, i);
        else if (cells[i] === FALLEN_FRUIT) updateFallenFruit(x, y, i);
        else if (cells[i] === METAL) updateMetal(x, y, i);
        else if (cells[i] === ELECTRICITY) updateElectricity(x, y, i);
      }
    }
  }
  // 上升材料采用相反扫描方向。
  for (let y = 1; y < HEIGHT; y++) {
    const reverse = (y + tick) % 2 !== 0;
    const chunkRow = Math.floor(y / CHUNK_SIZE) * CHUNK_COLUMNS;
    for (let chunkStep = 0; chunkStep < CHUNK_COLUMNS; chunkStep++) {
      const chunkX = reverse ? CHUNK_COLUMNS - 1 - chunkStep : chunkStep;
      if (!currentChunks[chunkRow + chunkX]) continue;
      const minX = chunkX * CHUNK_SIZE;
      const maxX = Math.min(WIDTH, minX + CHUNK_SIZE);
      for (let localStep = 0; localStep < maxX - minX; localStep++) {
        const x = reverse ? maxX - 1 - localStep : minX + localStep;
        const i = indexOf(x, y);
        if (moved[i]) continue;
        if (cells[i] === FIRE) updateFire(x, y, i);
        else if (cells[i] === SMOKE) updateSmoke(x, y, i);
        else if (cells[i] === STEAM) updateSteam(x, y, i);
      }
    }
  }
  globalThis.sandboxAnimals?.update();
  activeChunks.set(nextActiveChunks);
  tick++;
}

function colorFor(i, kind) {
  const color = healthyColorFor(i, kind);
  if (![PLANT, FLOWER, LEAF, FRUIT].includes(kind)) return color;
  const wilt = familyForBranch(plantBranchId[i])?.wilt || 0;
  const dry = [133, 105, 64];
  return color.map((channel, at) => Math.round(channel * (1 - wilt) + dry[at] * wilt));
}

function healthyColorFor(i, kind) {
  if (kind === FRUIT || kind === FALLEN_FRUIT) return fruitColorFor(i, kind);
  if (kind === LEAF) {
    const treeKind = familyForBranch(plantBranchId[i])?.treeKind;
    const colors = treeKind === 'willow' ? [[80, 131, 72], [104, 155, 79], [133, 177, 96], [153, 189, 112]] :
      treeKind === 'mangrove' ? [[42, 99, 74], [48, 119, 83], [69, 139, 92], [92, 151, 102]] :
        [[53, 110, 62], [68, 133, 71], [89, 153, 76], [119, 171, 89]];
    return colors[energy[i] % 4];
  }
  if (kind === PLANT && familyForBranch(plantBranchId[i])?.species === 'tree') return [132, 94, 63];
  if (kind === PLANT && familyForBranch(plantBranchId[i])?.species === 'cactus') return [73, 151, 91];
  if (kind === PLANT && familyForBranch(plantBranchId[i])?.species === 'mushroom') return [224, 210, 180];
  if (kind === FIRE) return Math.random() < 0.45 ? [255, 197, 59] : [255, 91, 30];
  if (kind === WOOD && energy[i] > 0) return energy[i] % 7 < 3 ? [244, 93, 34] : [113, 58, 39];
  if (kind === PLANT && energy[i] > 0) return energy[i] % 9 < 4 ? [105, 210, 105] : [67, 157, 78];
  if (isSeedKind(kind)) return energy[i] > 0
    ? MATERIALS[kind].color.map((channel) => Math.min(255, channel + 25)) : MATERIALS[kind].color;
  if (kind === FLOWER) {
    const family = familyForBranch(plantBranchId[i]);
    const flowerColor = family?.species === 'mushroom' ? MUSHROOM_COLORS[family.mushroomStyle] :
      family?.species === 'giant' ? [178, 66, 71] : FLOWER_COLORS[flowerSeedAt(i) % FLOWER_COLORS.length];
    const progress = Math.min(1, energy[i] / FLOWER_BLOOM_MAX);
    const budColor = [68, 137, 76];
    return flowerColor.map((channel, index) => Math.round(budColor[index] + (channel - budColor[index]) * progress));
  }
  if (kind === STEAM) return energy[i] % 11 < 5 ? [205, 226, 231] : [161, 191, 199];
  if (kind === METAL && energy[i] > 0) return energy[i] % 5 < 3 ? [255, 230, 105] : [174, 181, 190];
  if (kind === ELECTRICITY) return energy[i] % 4 < 2 ? [255, 247, 135] : [255, 196, 42];
  return MATERIALS[kind].color;
}

let lastStatsRenderTime = -Infinity;
let lastEffectsTick = -1;
let lastEffectsRenderTime = -Infinity;

function render(now = globalThis.performance?.now?.() ?? 0) {
  const pixels = image.data;
  let dirtyChunkCount = 0;
  for (const dirty of dirtyRenderChunks) dirtyChunkCount += dirty;
  const hasDirtyRegion = dirtyChunkCount > 0;
  if (hasDirtyRegion) {
    // 少量变化按 10×10 分块上传；变化遍布大半画布时一次性整图上传，
    // 避免大量 putImageData 调用反而拖慢浏览器。
    const redrawAll = dirtyChunkCount > dirtyRenderChunks.length * 0.35;
    for (let chunk = 0; chunk < dirtyRenderChunks.length; chunk++) {
      if (!redrawAll && !dirtyRenderChunks[chunk]) continue;
      const chunkX = chunk % CHUNK_COLUMNS;
      const chunkY = Math.floor(chunk / CHUNK_COLUMNS);
      const minX = chunkX * CHUNK_SIZE;
      const minY = chunkY * CHUNK_SIZE;
      const maxX = Math.min(WIDTH, minX + CHUNK_SIZE);
      const maxY = Math.min(HEIGHT, minY + CHUNK_SIZE);
      for (let y = minY; y < maxY; y++) {
        for (let x = minX; x < maxX; x++) {
          const i = indexOf(x, y);
          const kind = cells[i];
          const color = colorFor(i, kind);
          const at = i * 4;
          const shade = kind === EMPTY ? 0 : ((i * 17) % 9) - 4;
          pixels[at] = color[0] + shade;
          pixels[at + 1] = color[1] + shade;
          pixels[at + 2] = color[2] + shade;
          pixels[at + 3] = 255;
        }
      }
      if (!redrawAll) ctx.putImageData(image, 0, 0, minX, minY, maxX - minX, maxY - minY);
    }
    if (redrawAll) {
      ctx.putImageData(image, 0, 0);
    }
    dirtyRenderChunks.fill(0);
  }
  // 状态栏不需要跟随 60 FPS 重算。降低全世界扫描和 DOM 更新频率，
  // 但首次渲染、暂停后的手动修改仍会立即更新。
  if (now - lastStatsRenderTime >= 400) {
    const counts = new Uint32Array(MATERIALS.length);
    for (let i = 0; i < cells.length; i++) counts[cells[i]]++;
    const seedCount = MATERIALS.reduce((total, material) => total + (isSeedKind(material.id) ? counts[material.id] : 0), 0);
    statsLabel.textContent = `水：${counts[WATER]} · 种子：${seedCount} · 根茎：${counts[PLANT]} · 树叶：${counts[LEAF]} · 果实：${counts[FRUIT] + counts[FALLEN_FRUIT]} · 花/菌盖：${counts[FLOWER]} · 火：${counts[FIRE]} · 酸：${counts[ACID]} · 盐：${counts[SALT]} · 电：${counts[ELECTRICITY]} · 第 ${tick} 帧`;
    harvestStatsLabel.textContent = `🧺 已收集：${harvestTotals.picked + harvestTotals.fallen} · 树上采摘：${harvestTotals.picked} · 落果拾取：${harvestTotals.fallen}`;
    globalThis.sandboxAnimals?.renderStatus();
    lastStatsRenderTime = now;
  }
  // 暂停且世界未变化时复用上一帧特效层，避免空转扫描全部格子。
  const effectsChanged = hasDirtyRegion || tick !== lastEffectsTick;
  const effectsDue = !running || now - lastEffectsRenderTime >= 32;
  if (lastEffectsTick < 0 || (effectsChanged && effectsDue)) {
    renderEffects();
    lastEffectsTick = tick;
    lastEffectsRenderTime = now;
  }
  refreshHarvestCursor();
}

function activeChunkCount() {
  let count = 0;
  for (const active of activeChunks) count += active;
  return count;
}

function drawGiantFlower(x, y, seed, unfold, scaleX, scaleY) {
  const size = GIANT_FLOWER_SCALE * (1.35 + (seed % 31) / 100) * (0.08 + 0.92 * unfold);
  const rotation = (seed % 360) * Math.PI / 180;
  effectsCtx.save();
  effectsCtx.globalCompositeOperation = 'source-over';
  effectsCtx.shadowBlur = 0;
  for (let petal = 0; petal < 5; petal++) {
    const angle = rotation + petal * Math.PI * 2 / 5;
    const px = x + Math.cos(angle) * 3 * size * scaleX;
    const py = y + Math.sin(angle) * 3 * size * scaleY;
    effectsCtx.fillStyle = petal % 2 ? '#ba4f52' : '#a83d48';
    effectsCtx.strokeStyle = '#82333e';
    effectsCtx.lineWidth = 0.3 * size * scaleX;
    effectsCtx.beginPath();
    effectsCtx.ellipse(px, py, 3.2 * size * scaleX, 2.45 * size * scaleY, angle, 0, Math.PI * 2);
    effectsCtx.fill();
    effectsCtx.stroke();
    // 奶黄色斑点随花瓣一起展开，保持霸王花的辨识度。
    effectsCtx.fillStyle = '#f1c791';
    for (const [along, across] of [[0.9, -0.9], [1.45, 0.65], [-0.2, 0.75], [-0.45, -0.65]]) {
      effectsCtx.beginPath();
      effectsCtx.arc(px + (Math.cos(angle) * along - Math.sin(angle) * across) * size * scaleX,
        py + (Math.sin(angle) * along + Math.cos(angle) * across) * size * scaleY,
        0.3 * size * scaleX, 0, Math.PI * 2);
      effectsCtx.fill();
    }
  }
  effectsCtx.fillStyle = '#d78c66';
  effectsCtx.beginPath();
  effectsCtx.ellipse(x, y, 2.05 * size * scaleX, 1.85 * size * scaleY, rotation, 0, Math.PI * 2);
  effectsCtx.fill();
  effectsCtx.fillStyle = '#542a36';
  effectsCtx.beginPath();
  effectsCtx.ellipse(x, y, 1.45 * size * scaleX, 1.3 * size * scaleY, rotation, 0, Math.PI * 2);
  effectsCtx.fill();
  effectsCtx.fillStyle = '#351e2b';
  effectsCtx.beginPath();
  effectsCtx.arc(x, y, 0.8 * size * scaleX, 0, Math.PI * 2);
  effectsCtx.fill();
  effectsCtx.restore();
}

function drawMushroom(x, y, family, unfold, scaleX, scaleY) {
  const radius = (family.mushroomRadius ?? 8) * (0.12 + 0.88 * unfold);
  const color = MUSHROOM_COLORS[family.mushroomStyle ?? 0];
  effectsCtx.save();
  effectsCtx.globalCompositeOperation = 'source-over';
  effectsCtx.shadowBlur = 0;
  effectsCtx.translate(x, y);
  effectsCtx.scale(scaleX, scaleY);
  // 菌盖由窄小的幼盖逐渐撑成伞形，而不是突然出现整顶帽子。
  effectsCtx.fillStyle = '#e6d3b4';
  effectsCtx.beginPath();
  effectsCtx.ellipse(0, 0, radius, radius * 0.24, 0, 0, Math.PI * 2);
  effectsCtx.fill();
  effectsCtx.strokeStyle = '#bfa889';
  effectsCtx.lineWidth = 0.35;
  for (let rib = -3; rib <= 3; rib++) {
    effectsCtx.beginPath();
    effectsCtx.moveTo(0, radius * 0.08);
    effectsCtx.lineTo(rib * radius / 3.5, radius * 0.12);
    effectsCtx.stroke();
  }
  effectsCtx.fillStyle = `rgb(${color.join(',')})`;
  effectsCtx.beginPath();
  effectsCtx.moveTo(-radius, 0);
  effectsCtx.bezierCurveTo(-radius * 0.85, -radius * 0.85,
    radius * 0.85, -radius * 0.85, radius, 0);
  effectsCtx.quadraticCurveTo(0, -radius * 0.12, -radius, 0);
  effectsCtx.fill();
  effectsCtx.fillStyle = '#f3e6ca';
  for (const [sx, sy, size] of [[-0.48, -0.23, 0.11], [-0.12, -0.48, 0.13],
    [0.33, -0.35, 0.1], [0.65, -0.13, 0.08]]) {
    effectsCtx.beginPath();
    effectsCtx.ellipse(sx * radius, sy * radius, radius * size,
      radius * size * 0.65, 0, 0, Math.PI * 2);
    effectsCtx.fill();
  }
  effectsCtx.restore();
}

function drawCactusSegment(x, y, i, family, scaleX, scaleY) {
  const gx = i % WIDTH, gy = Math.floor(i / WIDTH);
  const arm = plantBranchId[i] !== family.cactusRootBranchId;
  const width = ((family.cactusWidth ?? 4) + Math.min(0.8, family.waterLevel * 0.2)) * (arm ? 0.72 : 1);
  effectsCtx.save();
  effectsCtx.globalCompositeOperation = 'source-over';
  effectsCtx.shadowBlur = 0;
  effectsCtx.lineCap = 'round';
  // 侧臂包含横向格，不能只连接下方；只连接同株，避免邻株粘连。
  const neighbors = [[gx - 1, gy], [gx, gy + 1], [gx - 1, gy + 1], [gx + 1, gy + 1]];
  for (const [nx, ny] of neighbors) {
    if (!inBounds(nx, ny)) continue;
    const neighbor = indexOf(nx, ny);
    if (cells[neighbor] !== PLANT || familyForBranch(plantBranchId[neighbor]) !== family) continue;
    for (const [extra, color] of [[0.6, '#39714c'], [0, '#539b60']]) {
      effectsCtx.strokeStyle = color;
      effectsCtx.lineWidth = (width + extra) * scaleX;
      effectsCtx.beginPath();
      effectsCtx.moveTo(x, y);
      effectsCtx.lineTo((nx + 0.5) * scaleX, (ny + 0.5) * scaleY);
      effectsCtx.stroke();
    }
  }
  effectsCtx.fillStyle = '#539b60';
  effectsCtx.beginPath();
  effectsCtx.arc(x, y, width * 0.5 * scaleX, 0, Math.PI * 2);
  effectsCtx.fill();
  effectsCtx.fillStyle = '#82bc79';
  effectsCtx.fillRect(x - width * 0.2 * scaleX, y - scaleY * 0.5, scaleX * 0.55, scaleY);
  if (gy % 4 === 0) {
    effectsCtx.strokeStyle = '#e1d7a9';
    effectsCtx.lineWidth = 0.45 * scaleX;
    for (const side of [-1, 1]) {
      effectsCtx.beginPath();
      effectsCtx.moveTo(x + side * width * 0.45 * scaleX, y);
      effectsCtx.lineTo(x + side * (width * 0.5 + 1.1) * scaleX, y - 0.7 * scaleY);
      effectsCtx.stroke();
    }
  }
  effectsCtx.restore();
}

function drawTreeFruit(x, y, i, kind, scaleX, scaleY) {
  const ripe = Math.min(1, (kind === FALLEN_FRUIT ? plantAge[i] : energy[i]) / FRUIT_RIPEN_TICKS);
  const size = (1.55 + plantBranchId[i] % 4 * 0.1) * (0.55 + 0.45 * ripe);
  const color = fruitColorFor(i, kind);
  effectsCtx.save();
  effectsCtx.globalCompositeOperation = 'source-over';
  effectsCtx.shadowBlur = 0;
  if (kind === FALLEN_FRUIT) effectsCtx.globalAlpha = Math.min(1, energy[i] / 45);
  if (kind === FRUIT) {
    effectsCtx.strokeStyle = '#77563a';
    effectsCtx.lineWidth = 0.5 * scaleX;
    effectsCtx.beginPath();
    effectsCtx.moveTo(x, y - 0.6 * size * scaleY);
    effectsCtx.lineTo(x + 0.2 * scaleX, y - 2 * scaleY);
    effectsCtx.stroke();
  }
  effectsCtx.fillStyle = `rgb(${color.join(',')})`;
  effectsCtx.beginPath();
  effectsCtx.ellipse(x, y, size * scaleX, size * 0.9 * scaleY, 0, 0, Math.PI * 2);
  effectsCtx.fill();
  effectsCtx.fillStyle = 'rgba(255, 239, 192, 0.55)';
  effectsCtx.beginPath();
  effectsCtx.arc(x - size * 0.35 * scaleX, y - size * 0.35 * scaleY,
    size * 0.25 * scaleX, 0, Math.PI * 2);
  effectsCtx.fill();
  effectsCtx.restore();
}

const STEM_NEIGHBORS = [[0, 1], [-1, 1], [1, 1], [-1, 0], [1, 0]];

function renderEffects() {
  const scaleX = effectsCanvas.width / WIDTH;
  const scaleY = effectsCanvas.height / HEIGHT;
  // 世界网格加密后，特效仍按旧的“材料单元视觉尺寸”计算，避免火焰、电流和烟雾突然变小。
  const effectUnitX = scaleX * WORLD_SCALE;
  effectsCtx.clearRect(0, 0, effectsCanvas.width, effectsCanvas.height);
  effectsCtx.save();
  effectsCtx.globalCompositeOperation = 'lighter';
  effectsCtx.filter = 'none';
  let currentFilter = 'none';

  for (let i = 0; i < cells.length; i++) {
    const kind = cells[i];
    if (kind !== FIRE && kind !== ELECTRICITY && kind !== SMOKE && kind !== FLOWER &&
        kind !== PLANT && kind !== FRUIT && kind !== FALLEN_FRUIT) continue;
    const wilt = [PLANT, FLOWER, FRUIT].includes(kind)
      ? familyForBranch(plantBranchId[i])?.wilt || 0 : 0;
    const nextFilter = wilt > 0
      ? `sepia(${wilt}) saturate(${1 - wilt * 0.8}) brightness(${1 - wilt * 0.3})` : 'none';
    if (nextFilter !== currentFilter) {
      effectsCtx.filter = nextFilter;
      currentFilter = nextFilter;
    }
    const x = (i % WIDTH + 0.5) * scaleX;
    const y = (Math.floor(i / WIDTH) + 0.5) * scaleY;
    const pulse = 0.72 + ((i + tick) % 7) * 0.035;
    if (kind === FRUIT || kind === FALLEN_FRUIT) {
      drawTreeFruit(x, y, i, kind, scaleX, scaleY);
    } else if (kind === FIRE) {
      effectsCtx.fillStyle = `rgba(255, 105, 24, ${0.18 * pulse})`;
      effectsCtx.shadowColor = 'rgba(255, 119, 24, 0.9)';
      effectsCtx.shadowBlur = 4 * effectUnitX;
      effectsCtx.beginPath();
      effectsCtx.arc(x, y, 1.5 * effectUnitX, 0, Math.PI * 2);
      effectsCtx.fill();
    } else if (kind === ELECTRICITY) {
      effectsCtx.fillStyle = `rgba(255, 226, 74, ${0.2 * pulse})`;
      effectsCtx.shadowColor = 'rgba(255, 225, 76, 0.95)';
      effectsCtx.shadowBlur = 9 * effectUnitX;
      effectsCtx.beginPath();
      effectsCtx.arc(x, y, 1.2 * effectUnitX, 0, Math.PI * 2);
      effectsCtx.fill();
    } else if (kind === PLANT) {
      const lean = plantLean[i] || 0;
      const family = familyForBranch(plantBranchId[i]);
      if (family?.species === 'cactus') {
        drawCactusSegment(x, y, i, family, scaleX, scaleY);
        continue;
      }
      const woody = family?.species === 'tree';
      const giant = family?.species === 'giant';
      const mushroom = family?.species === 'mushroom';
      const waterFeedbackAge = family?.waterFeedbackTick === undefined
        ? Infinity : tick - family.waterFeedbackTick;
      const absorbing = waterFeedbackAge >= 0 && waterFeedbackAge < PLANT_WATER_FEEDBACK_DURATION;
      const freshBud = family && family.waterLevel > 0 && plantAge[i] < 35;
      // 底层仍是单格像素，但用一条连续描边把相邻根茎连接起来，
      // 让根茎视觉上更有厚度，同时不额外生成密集的植物格。
      effectsCtx.globalCompositeOperation = 'source-over';
      const gridX = i % WIDTH;
      const gridY = Math.floor(i / WIDTH);
      const trunk = woody && (family.treeDepths[plantBranchId[i]] ?? 0) !== 1;
      const trunkTaper = woody ? Math.max(0.6,
        1 - (family.rootY - gridY) / Math.max(1, family.treeTrunkHeight) * 0.35) : 1;
      const woodyWidth = woody
        ? 2.1 * (family.treeGirth ?? 1) * (trunk ? trunkTaper : 0.5) : 0;
      let stemX = -1;
      let stemY = -1;
      for (let neighbor = 0; neighbor < (woody ? STEM_NEIGHBORS.length : 3); neighbor++) {
        const [dx, dy] = STEM_NEIGHBORS[neighbor];
        const nx = gridX + dx;
        const ny = gridY + dy;
        if (inBounds(nx, ny) && cells[indexOf(nx, ny)] === PLANT) {
          stemX = nx;
          stemY = ny;
          break;
        }
      }
      if (stemX >= 0) {
        effectsCtx.strokeStyle = mushroom ? '#e0d2b7' : woody ? 'rgba(132, 94, 63, 0.95)' : absorbing || freshBud
          ? `rgba(122, 226, 138, ${0.9 * pulse})`
          : `rgba(49, 156, 72, ${0.7 * pulse})`;
        effectsCtx.lineWidth = (mushroom ? 2.8 : woody ? woodyWidth : (giant ? 2.6 : 1.35)) * scaleX;
        effectsCtx.lineCap = 'round';
        effectsCtx.beginPath();
        effectsCtx.moveTo(x, y);
        effectsCtx.lineTo((stemX + 0.5) * scaleX, (stemY + 0.5) * scaleY);
        effectsCtx.stroke();
      }
      effectsCtx.fillStyle = mushroom ? '#e0d2b7' : woody ? 'rgba(132, 94, 63, 0.8)' : absorbing || freshBud
        ? `rgba(145, 235, 151, ${0.65 * pulse})`
        : `rgba(49, 156, 72, ${0.32 * pulse})`;
      effectsCtx.shadowColor = 'rgba(62, 168, 77, 0.28)';
      effectsCtx.shadowBlur = woody || mushroom ? 0 : 1.4 * scaleX;
      effectsCtx.beginPath();
      effectsCtx.arc(x, y, (mushroom ? 1.4 : woody ? woodyWidth / 2 : 0.82) * scaleX, 0, Math.PI * 2);
      effectsCtx.fill();
      if (giant && [2, 5].includes(family.rootY - gridY)) {
        effectsCtx.shadowBlur = 0;
        for (const side of [-1, 1]) {
          effectsCtx.fillStyle = side < 0 ? '#38854d' : '#529f59';
          effectsCtx.beginPath();
          effectsCtx.ellipse(x + side * 3.5 * scaleX, y - scaleY,
            3.8 * scaleX, 1.3 * scaleY, -side * 0.35, 0, Math.PI * 2);
          effectsCtx.fill();
        }
      } else if (!woody && !mushroom && plantAge[i] > 2 && lean !== 0) {
        effectsCtx.fillStyle = `rgba(117, 205, 95, ${0.28 * pulse})`;
        effectsCtx.beginPath();
        effectsCtx.arc(x + lean * 1.8 * scaleX, y - 1.2 * scaleY, 0.5 * scaleX, 0, Math.PI * 2);
        effectsCtx.fill();
      }
      effectsCtx.globalCompositeOperation = 'lighter';
    } else if (kind === FLOWER) {
      const flowerSeed = flowerSeedAt(i);
      const flowerColor = FLOWER_COLORS[flowerSeed % FLOWER_COLORS.length];
      const shape = FLOWER_SHAPES[(flowerSeed >>> 8) % FLOWER_SHAPES.length];
      const flowerSize = flowerSizeAt(i);
      const bloomProgress = Math.min(1, energy[i] / FLOWER_BLOOM_MAX);
      const unfold = bloomProgress * bloomProgress * (3 - 2 * bloomProgress);
      const family = familyForBranch(plantBranchId[i]);
      if (family?.species === 'mushroom') {
        drawMushroom(x, y, family, unfold, scaleX, scaleY);
        continue;
      }
      if (familyForBranch(plantBranchId[i])?.species === 'giant') {
        drawGiantFlower(x, y, flowerSeed, unfold, scaleX, scaleY);
        continue;
      }
      const petalOffset = shape.offset * unfold * flowerSize;
      const petalLength = (0.3 + (shape.length - 0.3) * unfold) * flowerSize;
      const petalWidth = (0.25 + (shape.width - 0.25) * unfold) * flowerSize;
      const rotation = (flowerSeed % 360) * Math.PI / 180 + (1 - unfold) * 0.25;
      effectsCtx.globalCompositeOperation = 'source-over';
      effectsCtx.shadowBlur = 0;
      for (let petal = 0; petal < shape.petals; petal++) {
        const angle = (Math.PI * 2 * petal) / shape.petals + rotation;
        const shade = petal % 2 === 0 ? 1 : 0.94;
        effectsCtx.fillStyle = `rgba(${Math.round(flowerColor[0] * shade)}, ${Math.round(flowerColor[1] * shade)}, ${Math.round(flowerColor[2] * shade)}, ${0.35 + 0.6 * unfold})`;
        effectsCtx.beginPath();
        effectsCtx.ellipse(
          x + Math.cos(angle) * petalOffset * scaleX,
          y + Math.sin(angle) * petalOffset * scaleY,
          petalLength * scaleX,
          petalWidth * scaleY,
          angle,
          0,
          Math.PI * 2,
        );
        effectsCtx.fill();
      }
      effectsCtx.fillStyle = `rgba(204, 150, 57, ${0.4 + 0.6 * unfold})`;
      effectsCtx.beginPath();
      effectsCtx.arc(x, y, (0.3 + shape.center * unfold) * scaleX * flowerSize, 0, Math.PI * 2);
      effectsCtx.fill();
      effectsCtx.fillStyle = `rgba(255, 230, 151, ${unfold})`;
      effectsCtx.beginPath();
      effectsCtx.arc(x - 0.18 * scaleX * flowerSize, y - 0.2 * scaleY * flowerSize,
        0.35 * unfold * scaleX * flowerSize, 0, Math.PI * 2);
      effectsCtx.fill();
      effectsCtx.globalCompositeOperation = 'lighter';
    } else {
      effectsCtx.fillStyle = `rgba(176, 198, 201, ${0.045 * pulse})`;
      effectsCtx.shadowColor = 'rgba(180, 205, 210, 0.3)';
      effectsCtx.shadowBlur = 4 * effectUnitX;
      effectsCtx.beginPath();
      effectsCtx.arc(x, y, 1.4 * effectUnitX, 0, Math.PI * 2);
      effectsCtx.fill();
    }
  }
  // 一株只画一圈吸水涟漪，位置跟随实际接触水的格子。
  if (currentFilter !== 'none') effectsCtx.filter = 'none';
  globalThis.sandboxAnimals?.draw(effectsCtx, scaleX, scaleY);
  effectsCtx.globalCompositeOperation = 'source-over';
  effectsCtx.shadowBlur = 0;
  for (const family of plantFamilies.values()) {
    if (family.waterFeedbackTick === undefined) continue;
    const age = tick - family.waterFeedbackTick;
    if (age < 0 || age >= PLANT_WATER_FEEDBACK_DURATION) continue;
    const progress = age / PLANT_WATER_FEEDBACK_DURATION;
    effectsCtx.strokeStyle = `rgba(112, 215, 245, ${0.8 * (1 - progress)})`;
    effectsCtx.lineWidth = 0.8 * scaleX;
    effectsCtx.beginPath();
    effectsCtx.ellipse((family.waterX + 0.5) * scaleX, (family.waterY + 0.5) * scaleY,
      (2 + progress * 6) * scaleX, (1 + progress * 3) * scaleY, 0, 0, Math.PI * 2);
    effectsCtx.stroke();
  }
  effectsCtx.restore();
}

function pointerPosition(event) {
  const box = canvas.getBoundingClientRect();
  return {
    x: Math.floor(((event.clientX - box.left) / box.width) * WIDTH),
    y: Math.floor(((event.clientY - box.top) / box.height) * HEIGHT),
  };
}

function clearHarvestFeedback() {
  autoHarvestGesture = false;
  autoAnimalGesture = null;
  if (drainagePopup.open) drainagePopup.close();
}

function setHarvestMode(active) {
  globalThis.sandboxAnimals?.cancelTool();
  stopPainting();
  harvestMode = active;
  harvestButton.setAttribute('aria-pressed', String(active));
  harvestButton.classList.toggle('active', active);
  sprayButton.disabled = active;
  canvas.classList.toggle('harvesting', active);
  selectedLabel.textContent = active ? '当前：🧺 采果' : `当前：${MATERIALS[selected].name}`;
  palette.querySelectorAll('[data-type]').forEach((button) => {
    button.classList.toggle('active', !active && Number(button.dataset.type) === selected);
    button.setAttribute('aria-pressed', String(!active && Number(button.dataset.type) === selected));
  });
  showMessage(active ? '点击或拖过红色熟果即可采集；青果暂不采摘' : '已回到材料绘制模式');
}

function ripeFruitNear(x, y) {
  for (let dy = -AUTO_HARVEST_RADIUS; dy <= AUTO_HARVEST_RADIUS; dy++) {
    for (let dx = -AUTO_HARVEST_RADIUS; dx <= AUTO_HARVEST_RADIUS; dx++) {
      if (dx * dx + dy * dy > AUTO_HARVEST_RADIUS ** 2 || !inBounds(x + dx, y + dy)) continue;
      const i = indexOf(x + dx, y + dy), kind = cells[i];
      if ((kind === FRUIT && energy[i] >= FRUIT_RIPEN_TICKS) ||
          (kind === FALLEN_FRUIT && plantAge[i] >= FRUIT_RIPEN_TICKS)) return true;
    }
  }
  return false;
}

function canAutoHarvest() {
  return !harvestMode && selected !== EMPTY && !globalThis.sandboxAnimals?.toolActive;
}

function refreshHarvestCursor() {
  let hovering = false;
  let animal = null;
  if (harvestHoverPointer && !paintDown && canAutoHarvest()) {
    const point = pointerPosition(harvestHoverPointer);
    hovering = inBounds(point.x, point.y) && ripeFruitNear(point.x, point.y);
    if (!hovering && inBounds(point.x, point.y)) animal = globalThis.sandboxAnimals?.interactionNear(point.x, point.y);
  }
  canvas.classList.toggle('harvesting', harvestMode || autoHarvestGesture || hovering);
  canvas.classList.toggle('animal-interaction', Boolean(animal || autoAnimalGesture));
  const interactionHint = document.querySelector('#interaction-hint');
  const text = animal?.label || (hovering ? '点击采摘熟果 · 采到的果子可以喂小鸡' : '靠近熟果／鸡蛋／小鸡，可直接点击互动');
  if (interactionHint && interactionHint.textContent !== text) interactionHint.textContent = text;
}

function collectFruitAt(x, y, radius = Math.max(3, Number(brushInput.value) * WORLD_SCALE)) {
  let picked = 0, fallen = 0, foundUnripe = false;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius || !inBounds(x + dx, y + dy)) continue;
      const i = indexOf(x + dx, y + dy);
      const kind = cells[i];
      if (kind !== FRUIT && kind !== FALLEN_FRUIT) continue;
      const maturity = kind === FRUIT ? energy[i] : plantAge[i];
      if (maturity < FRUIT_RIPEN_TICKS) { foundUnripe = true; continue; }
      // 整次点击/拖动只留一份撤销快照；点空白或青果不占用撤销次数。
      if (!harvestGesture.snapshotSaved) {
        pushUndoSnapshot();
        harvestGesture.snapshotSaved = true;
      }
      if (kind === FRUIT) picked++; else fallen++;
      setCell(i, EMPTY);
      moved[i] = 1;
    }
  }
  if (picked + fallen > 0) {
    harvestTotals.picked += picked;
    harvestTotals.fallen += fallen;
    harvestGesture.picked += picked;
    harvestGesture.fallen += fallen;
    harvestGesture.hintShown = true;
    showMessage(`本次采集 ${harvestGesture.picked + harvestGesture.fallen} 颗 · 累计 ${harvestTotals.picked + harvestTotals.fallen} 颗`);
  } else if (!harvestGesture.hintShown) {
    showMessage(foundUnripe ? '青果尚未成熟，等变红后再采摘' : '附近没有成熟果实，可调大笔刷范围');
    harvestGesture.hintShown = true;
  }
}

function paintAt(x, y) {
  if (autoAnimalGesture) { globalThis.sandboxAnimals?.interact(autoAnimalGesture.id); return; }
  if (globalThis.sandboxAnimals?.handle(x, y)) return;
  if (harvestMode || autoHarvestGesture) {
    collectFruitAt(x, y, autoHarvestGesture ? AUTO_HARVEST_RADIUS : undefined);
    return;
  }
  const radius = Number(brushInput.value) * WORLD_SCALE;
  let paintedCells = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      if (sprayMode && Math.random() > 0.34) continue;
      const nx = x + dx, ny = y + dy;
      if (!inBounds(nx, ny) || ny === HEIGHT - 1) continue;
      const i = indexOf(nx, ny);
      if (selected === ELECTRICITY && cells[i] === METAL) {
        energy[i] = randomBetween(12, 20);
        wakeCell(i);
        markDirty(i);
      } else if (selected === EMPTY || cells[i] === EMPTY) {
        if (cells[i] !== selected) paintedCells++;
        setCell(i, selected);
      }
    }
  }
  if (paintedCells > 0) globalThis.sandboxTutorial?.painted(selected, paintedCells);
}

function paintLine(from, to) {
  const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y), 1);
  for (let step = 0; step <= steps; step++) {
    paintAt(
      Math.round(from.x + ((to.x - from.x) * step) / steps),
      Math.round(from.y + ((to.y - from.y) * step) / steps),
    );
  }
}

function selectMaterial(kind) {
  globalThis.sandboxAnimals?.cancelTool();
  selected = kind;
  if (harvestMode) setHarvestMode(false);
  selectedLabel.textContent = `当前：${MATERIALS[kind].name}`;
  const seedHints = {
    [SEED]: '播种后浇水，长出花草',
    [TREE_SEED]: '播下小树种子，再浇水：长出树干、分枝和树冠',
    [GIANT_SEED]: '播下霸王花种子，再浇水：短茎宽叶、斑点大花',
    [MUSHROOM_SEED]: '孢子落地后浇水：长出奶油色短柄，菌盖渐渐撑开',
    [CACTUS_SEED]: '在沙地或平台上播种即可缓慢发芽，少量浇水可加快仙人掌生长',
    [WILLOW_SEED]: '柳树适合湿润岸边和浅水，落地吸水后发芽；比普通果树更耐积水',
    [MANGROVE_SEED]: '红树林适合水多的地方，种子先沉底再发芽；深水长期浸泡仍会受涝',
  };
  if (isSeedKind(kind)) showMessage(seedHints[kind]);
  palette.querySelectorAll('[data-type]').forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.type) === selected);
    button.setAttribute('aria-pressed', String(Number(button.dataset.type) === selected));
  });
}

function buildPalette() {
  palette.replaceChildren();
  const groups = [
    { name: '地形与水', kinds: [SAND, WATER, STONE, WOOD, METAL] },
    { name: '种植', kinds: [SEED, TREE_SEED, GIANT_SEED, MUSHROOM_SEED, CACTUS_SEED, WILLOW_SEED, MANGROVE_SEED] },
    { name: '反应与工具', kinds: [FIRE, SALT, ACID, ELECTRICITY, EMPTY] },
  ];
  const containers = new Map();
  for (const group of groups) {
    const section = document.createElement('section');
    section.className = 'material-group';
    section.setAttribute('aria-label', group.name);
    const heading = document.createElement('h3'); heading.textContent = group.name;
    const buttons = document.createElement('div'); buttons.className = 'material-grid';
    section.append(heading, buttons); palette.append(section);
    for (const kind of group.kinds) containers.set(kind, buttons);
  }
  MATERIALS.filter((material) => !material.hidden).forEach((material) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.type = String(material.id);
    button.classList.add('material-button');
    button.style.setProperty('--material-color', `rgb(${material.color.join(',')})`);
    button.textContent = `${material.icon} ${material.name}`;
    button.classList.toggle('active', material.id === selected);
    button.setAttribute('aria-pressed', String(material.id === selected));
    button.addEventListener('click', () => selectMaterial(material.id));
    (containers.get(material.id) || palette).append(button);
  });
}

canvas.addEventListener('pointerdown', (event) => {
  globalThis.sandboxAnimals?.beginGesture();
  harvestGesture = { picked: 0, fallen: 0, snapshotSaved: false, hintShown: false };
  const point = pointerPosition(event);
  autoHarvestGesture = canAutoHarvest() && ripeFruitNear(point.x, point.y);
  autoAnimalGesture = canAutoHarvest() && !autoHarvestGesture ? globalThis.sandboxAnimals?.interactionNear(point.x, point.y) : null;
  if (!harvestMode && !autoHarvestGesture && !autoAnimalGesture && !globalThis.sandboxAnimals?.toolActive) pushUndoSnapshot();
  paintDown = true;
  canvas.setPointerCapture(event.pointerId);
  lastPoint = pointerPosition(event);
  paintAt(lastPoint.x, lastPoint.y);
  render();
});
canvas.addEventListener('pointermove', (event) => {
  harvestHoverPointer = { clientX: event.clientX, clientY: event.clientY };
  refreshHarvestCursor();
  if (!paintDown) return;
  const nextPoint = pointerPosition(event);
  paintLine(lastPoint, nextPoint);
  lastPoint = nextPoint;
});
function stopPainting() { paintDown = false; lastPoint = null; autoHarvestGesture = false; autoAnimalGesture = null; refreshHarvestCursor(); }
canvas.addEventListener('pointerenter', (event) => {
  harvestHoverPointer = { clientX: event.clientX, clientY: event.clientY };
  refreshHarvestCursor();
});
canvas.addEventListener('pointerleave', () => { harvestHoverPointer = null; refreshHarvestCursor(); });
canvas.addEventListener('pointerup', stopPainting);
canvas.addEventListener('pointercancel', stopPainting);

pauseButton.addEventListener('click', () => {
  running = !running;
  pauseButton.textContent = running ? '⏸ 暂停' : '▶ 继续';
  pauseButton.setAttribute('aria-pressed', String(!running));
  showMessage(running ? '模拟继续' : '模拟已暂停');
});
sprayButton.addEventListener('click', () => {
  sprayMode = !sprayMode;
  sprayButton.setAttribute('aria-pressed', String(sprayMode));
  showMessage(sprayMode ? '喷洒笔刷' : '标准笔刷');
});
harvestButton.addEventListener('click', () => setHarvestMode(!harvestMode));
speedSelect.addEventListener('change', () => {
  simulationSpeed = Number(speedSelect.value);
  showMessage(`模拟速度 ${simulationSpeed}×`);
});
undoButton.addEventListener('click', undo);
clearButton.addEventListener('click', () => {
  if (!confirm('清空画布？收获统计保留，清空后仍可按 Z 撤销。')) return;
  pushUndoSnapshot();
  clearWorld();
  render();
  showMessage('画布已清空');
});
resetButton.addEventListener('click', () => {
  if (!confirm(`重新创建“${SCENE_PRESETS[currentScene].name}”并清零收获？已有命名存档不会删除，此操作可撤销。`)) return;
  pushUndoSnapshot();
  resetWorld();
  tick = 0;
  render();
  showMessage(`${SCENE_PRESETS[currentScene].name}已重置，收获清零`);
});
saveButton.addEventListener('click', saveWorld);
loadButton.addEventListener('click', loadWorld);

document.addEventListener('keydown', (event) => {
  if (event.target.closest?.('input, textarea, select, [contenteditable="true"]') ||
      document.querySelector('#world-library')?.open) return;
  if (event.key.toLowerCase() === 'c' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.repeat) {
    if (!event.target.closest?.('input, textarea, select, [contenteditable="true"]')) {
      event.preventDefault();
      harvestButton.click();
    }
  }
  if (event.code === 'Space') { event.preventDefault(); pauseButton.click(); }
  if (event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); }
  if (event.key.toLowerCase() === 'r' && !event.ctrlKey && !event.metaKey) sprayButton.click();
  const shortcuts = { 0: EMPTY, 1: SAND, 2: WATER, 3: STONE, 4: WOOD, 5: FIRE, 6: SEED, 7: METAL, 8: SALT, 9: ACID, e: ELECTRICITY };
  const key = event.key.toLowerCase();
  if (Object.hasOwn(shortcuts, key)) selectMaterial(shortcuts[key]);
});

let previousTime = 0;
let accumulatedTime = 0;
let metricsWindowStart = 0;
let metricsFrameCount = 0;
let averageUpdateMs = 0;

function loop(now) {
  if (!previousTime) previousTime = now;
  accumulatedTime += Math.min(80, now - previousTime);
  previousTime = now;
  const updateStart = globalThis.performance?.now?.() ?? now;
  let steps = 0;
  if (running) {
    const stepDuration = 16.67 / simulationSpeed;
    // 帧率下降时只补有限步数，避免一帧连续补算十次造成更严重的停顿。
    const maxCatchUpSteps = Math.max(3, simulationSpeed);
    while (accumulatedTime >= stepDuration && steps < maxCatchUpSteps) {
      update();
      accumulatedTime -= stepDuration;
      steps++;
    }
    if (steps === maxCatchUpSteps) accumulatedTime = 0;
  } else {
    accumulatedTime = 0;
  }
  const updateElapsed = (globalThis.performance?.now?.() ?? now) - updateStart;
  if (steps > 0) averageUpdateMs = averageUpdateMs === 0 ? updateElapsed : averageUpdateMs * 0.85 + updateElapsed * 0.15;
  metricsFrameCount++;
  if (!metricsWindowStart) metricsWindowStart = now;
  if (now - metricsWindowStart >= 500) {
    const fps = (metricsFrameCount * 1000) / (now - metricsWindowStart);
    performanceLabel.textContent = `FPS：${fps.toFixed(0)} · 更新：${averageUpdateMs.toFixed(2)} ms · 活动区：${activeChunkCount()}/${activeChunks.length}`;
    metricsWindowStart = now;
    metricsFrameCount = 0;
  }
  render(now);
  requestAnimationFrame(loop);
}

document.querySelector('#scene-preset').addEventListener('change', (event) => {
  const scene = SCENE_PRESETS[event.target.value];
  document.querySelector('#scene-description').textContent = `待创建：${scene.name}。${scene.description} 点击“创建此场景”后才会替换画布。`;
});
document.querySelector('#start-scene').addEventListener('click', () => {
  const preset = document.querySelector('#scene-preset').value;
  if (!Object.hasOwn(SCENE_PRESETS, preset) ||
      !confirm(`创建“${SCENE_PRESETS[preset].name}”？将替换画布、清零收获，已有命名存档不变，可按 Z 撤销。`)) return;
  stopPainting();
  pushUndoSnapshot();
  currentScene = preset;
  resetWorld();
  render();
  showMessage(`已创建${SCENE_PRESETS[preset].name}，可以自由创作`);
});

document.querySelector('#drainage-dismiss').addEventListener('click', () => drainagePopup.close());
document.querySelector('#drainage-eraser').addEventListener('click', () => {
  selectMaterial(EMPTY);
  drainagePopup.close();
  showMessage('用橡皮擦清除根部周围积水，注意避开根茎；也可以擦开挡水障碍');
});

buildPalette();
resetWorld();
render();
requestAnimationFrame(loop);
