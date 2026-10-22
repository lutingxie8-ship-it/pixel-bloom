'use strict';

const EMPTY = 0;
const SAND = 1;
const WATER = 2;
const WORLD_SCALE = 2;

self.onmessage = ({ data }) => {
  if (data.type !== 'step') return;
  const cells = new Uint8Array(data.cells);
  const { width, height, tick, revision } = data;
  const moved = new Uint8Array(cells.length);
  const touched = new Uint8Array(cells.length);
  const changed = [];

  const density = (kind) => kind === SAND ? 5 : kind === WATER ? 2 : kind === EMPTY ? -1 : 100;
  const mark = (i) => {
    if (!touched[i]) {
      touched[i] = 1;
      changed.push(i);
    }
  };
  const displace = (x, y, nx, ny, kind) => {
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) return false;
    const from = y * width + x;
    const to = ny * width + nx;
    const target = cells[to];
    if (target !== EMPTY && density(target) >= density(kind)) return false;
    cells[from] = target;
    cells[to] = kind;
    moved[from] = 1;
    moved[to] = 1;
    mark(from);
    mark(to);
    return true;
  };

  for (let y = height - 2; y >= 0; y--) {
    const reverse = ((y + tick) & 1) === 0;
    for (let step = 0; step < width; step++) {
      let x = reverse ? width - 1 - step : step;
      let i = y * width + x;
      const kind = cells[i];
      if (moved[i] || (kind !== SAND && kind !== WATER)) continue;
      let currentX = x;
      let currentY = y;
      for (let move = 0; move < WORLD_SCALE; move++) {
        const direction = Math.random() < 0.5 ? -1 : 1;
        let nextX = currentX;
        let nextY = currentY + 1;
        let success = displace(currentX, currentY, nextX, nextY, kind);
        if (!success) {
          nextX = currentX + direction;
          success = displace(currentX, currentY, nextX, nextY, kind);
        }
        if (!success) {
          nextX = currentX - direction;
          success = displace(currentX, currentY, nextX, nextY, kind);
        }
        if (!success && kind === WATER) {
          nextY = currentY;
          for (let distance = 1; distance <= WORLD_SCALE + 1; distance++) {
            nextX = currentX + direction * distance;
            success = displace(currentX, currentY, nextX, nextY, kind);
            if (success) break;
            nextX = currentX - direction * distance;
            success = displace(currentX, currentY, nextX, nextY, kind);
            if (success) break;
          }
        }
        if (!success) break;
        currentX = nextX;
        currentY = nextY;
      }
    }
  }

  const indices = new Uint32Array(changed.length);
  const kinds = new Uint8Array(changed.length);
  for (let at = 0; at < changed.length; at++) {
    indices[at] = changed[at];
    kinds[at] = cells[changed[at]];
  }
  self.postMessage({ type: 'step-result', revision, indices, kinds }, [indices.buffer, kinds.buffer]);
};
