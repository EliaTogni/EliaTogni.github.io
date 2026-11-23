// Parses CSS transform strings into 3×3 rotation/scale matrices (CSS Transforms conventions,
// y axis pointing down) so tests can compare what the browser would render.

const rad = deg => deg * Math.PI / 180;

export const IDENTITY = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

export function rotX(deg) {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return [[1, 0, 0], [0, c, -s], [0, s, c]];
}

export function rotY(deg) {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
}

export function rotZ(deg) {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
}

export function rot3d(x, y, z, deg) {
  const n = Math.hypot(x, y, z);
  if (n === 0) return IDENTITY;
  [x, y, z] = [x / n, y / n, z / n];
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg)), t = 1 - c;
  return [
    [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
    [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
    [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
  ];
}

function mul2(a, b) {
  return a.map((row, i) => b[0].map((_, j) => row.reduce((sum, _, k) => sum + a[i][k] * b[k][j], 0)));
}

export const mul = (...m) => m.reduce(mul2, IDENTITY);

export const transpose = m => m[0].map((_, j) => m.map(row => row[j]));

export const apply = (m, v) => m.map(row => row.reduce((sum, x, k) => sum + x * v[k], 0));

export const maxDiff = (a, b) => Math.max(...a.flatMap((row, i) => row.map((x, j) => Math.abs(x - b[i][j]))));

export function cssToMatrix(css) {
  const parts = [...css.matchAll(/(\w+)\(([^)]*)\)/g)];
  return mul(...parts.map(([, fn, args]) => {
    const n = args.split(',').map(a => parseFloat(a));
    switch (fn) {
      case 'rotateX': return rotX(n[0]);
      case 'rotateY': return rotY(n[0]);
      case 'rotateZ': case 'rotate': return rotZ(n[0]);
      case 'rotate3d': return rot3d(n[0], n[1], n[2], n[3]);
      case 'scale': return [[n[0], 0, 0], [0, n[0], 0], [0, 0, 1]];
      default: throw new Error(`unsupported transform function: ${fn}`);
    }
  }));
}
