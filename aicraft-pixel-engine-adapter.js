// aicraft-pixel-engine 兼容层。
// 当前开发环境无法下载 npm 包时，先用同一套数据驱动规则接管现有网格；
// 官方包可用后，只需替换 create() 的实现，不需要改动 app.js 的调用方。
(function registerAicraftPixelEngine(root) {
  const EMPTY = 0;
  const SAND = 1;
  const WATER = 2;
  const STONE = 3;
  const WOOD = 4;
  const PLANT = 7;
  const METAL = 9;
  const SALT = 10;
  const ACID = 11;
  const FLOWER = 13;
  const SEED = 14;
  const TREE_SEED = 15;
  const GIANT_SEED = 16;
  const LEAF = 17;
  const FRUIT = 18;
  const FALLEN_FRUIT = 19;
  const MUSHROOM_SEED = 20;
  const CACTUS_SEED = 21;
  const WILLOW_SEED = 22;
  const MANGROVE_SEED = 23;

  // 规则字段对齐引擎常见的 MaterialDef：type、density、dispersion。
  // density 越大越容易向下 / 挤开更轻的邻居；空格密度最低。
  const MATERIALS = Object.freeze({
    [EMPTY]: { name: 'empty', type: 'empty', density: -1, dispersion: 0 },
    [SAND]: { name: 'sand', type: 'powder', density: 5, dispersion: 0 },
    [WATER]: { name: 'water', type: 'liquid', density: 2, dispersion: 8 },
    [STONE]: { name: 'stone', type: 'solid', density: 100, dispersion: 0 },
    [WOOD]: { name: 'wood', type: 'solid', density: 80, dispersion: 0 },
    [PLANT]: { name: 'plant', type: 'solid', density: 40, dispersion: 0 },
    [METAL]: { name: 'metal', type: 'solid', density: 120, dispersion: 0 },
    [SALT]: { name: 'salt', type: 'powder', density: 5, dispersion: 0 },
    [ACID]: { name: 'acid', type: 'liquid', density: 3, dispersion: 5 },
    [FLOWER]: { name: 'flower', type: 'solid', density: 35, dispersion: 0 },
    [SEED]: { name: 'seed', type: 'powder', density: 4, dispersion: 0 },
    [TREE_SEED]: { name: 'tree-seed', type: 'powder', density: 4, dispersion: 0 },
    [GIANT_SEED]: { name: 'giant-flower-seed', type: 'powder', density: 4, dispersion: 0 },
    [LEAF]: { name: 'leaf', type: 'solid', density: 35, dispersion: 0 },
    [FRUIT]: { name: 'fruit', type: 'solid', density: 35, dispersion: 0 },
    [FALLEN_FRUIT]: { name: 'fallen-fruit', type: 'powder', density: 4, dispersion: 0 },
    [MUSHROOM_SEED]: { name: 'mushroom-spore', type: 'powder', density: 4, dispersion: 0 },
    [CACTUS_SEED]: { name: 'cactus-seed', type: 'powder', density: 4, dispersion: 0 },
    [WILLOW_SEED]: { name: 'willow-seed', type: 'powder', density: 4, dispersion: 0 },
    [MANGROVE_SEED]: { name: 'mangrove-seed', type: 'powder', density: 4, dispersion: 0 },
  });
  const DENSITIES = new Int16Array(MANGROVE_SEED + 1);
  for (const [id, material] of Object.entries(MATERIALS)) DENSITIES[id] = material.density;

  function create(options) {
    const {
      width,
      height,
      worldScale = 1,
      getCell,
      swapCells,
    } = options;

    const inBounds = (x, y) => x >= 0 && x < width && y >= 0 && y < height;
    const densityOf = (kind) => DENSITIES[kind] ?? 0;

    function tryDisplace(x, y, nx, ny, kind) {
      if (!inBounds(nx, ny)) return false;
      const from = y * width + x;
      const to = ny * width + nx;
      const targetKind = getCell(to);
      if (targetKind !== EMPTY && densityOf(targetKind) >= densityOf(kind)) return false;
      swapCells(from, to);
      return true;
    }

    function stepPowder(x, y, kind) {
      let currentX = x;
      let currentY = y;
      for (let step = 0; step < worldScale; step++) {
        const direction = Math.random() < 0.5 ? -1 : 1;
        let nextX = currentX;
        const nextY = currentY + 1;
        let displaced = tryDisplace(currentX, currentY, nextX, nextY, kind);
        if (!displaced) {
          nextX = currentX + direction;
          displaced = tryDisplace(currentX, currentY, nextX, nextY, kind);
        }
        if (!displaced) {
          nextX = currentX - direction;
          displaced = tryDisplace(currentX, currentY, nextX, nextY, kind);
        }
        if (!displaced) break;
        currentX = nextX;
        currentY = nextY;
      }
      return currentX !== x || currentY !== y;
    }

    function stepLiquid(x, y, kind) {
      let currentX = x;
      let currentY = y;
      const dispersion = MATERIALS[kind]?.dispersion ?? 1;
      for (let step = 0; step < worldScale; step++) {
        const direction = Math.random() < 0.5 ? -1 : 1;
        let nextX = currentX;
        let nextY = currentY + 1;
        let displaced = tryDisplace(currentX, currentY, nextX, nextY, kind);
        if (!displaced) {
          nextX = currentX + direction;
          displaced = tryDisplace(currentX, currentY, nextX, nextY, kind);
        }
        if (!displaced) {
          nextX = currentX - direction;
          displaced = tryDisplace(currentX, currentY, nextX, nextY, kind);
        }
        if (!displaced && dispersion > 0) {
          nextY = currentY;
          for (let distance = 1; distance <= Math.min(worldScale + 1, dispersion); distance++) {
            nextX = currentX + direction * distance;
            displaced = tryDisplace(currentX, currentY, nextX, nextY, kind);
            if (displaced) break;
            nextX = currentX - direction * distance;
            displaced = tryDisplace(currentX, currentY, nextX, nextY, kind);
            if (displaced) break;
          }
        }
        if (!displaced) break;
        currentX = nextX;
        currentY = nextY;
      }
      return currentX !== x || currentY !== y;
    }

    function stepParticle(x, y, kind) {
      switch (kind) {
        case SAND:
        case SALT:
        case SEED:
        case TREE_SEED:
        case GIANT_SEED:
        case FALLEN_FRUIT:
        case MUSHROOM_SEED:
        case CACTUS_SEED:
        case WILLOW_SEED:
        case MANGROVE_SEED:
          return stepPowder(x, y, kind);
        case WATER:
        case ACID:
          return stepLiquid(x, y, kind);
        default:
          return false;
      }
    }

    return Object.freeze({
      materials: MATERIALS,
      densityOf,
      stepParticle,
    });
  }

  root.AicraftPixelEngine = Object.freeze({
    version: 'compat-0.1',
    materials: MATERIALS,
    create,
  });
}(typeof globalThis !== 'undefined' ? globalThis : window));
