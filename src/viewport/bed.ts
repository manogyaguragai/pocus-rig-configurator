import * as THREE from 'three';

/** Pixels across the bed texture; 1024 gives 4 px per mm on a 256 mm bed (a quarter of the GPU memory of 2048). */
const SIZE = 1024;

function makeCanvas(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

/** Small deterministic noise tile so the matte surface has a faint grain. */
function noiseTile(): HTMLCanvasElement {
  const n = 128;
  const c = makeCanvas(n);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(n, n);
  let s = 1234567;
  for (let i = 0; i < n * n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const v = (s >>> 24) & 255;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * Procedural printer-bed texture: warm grey matte sheet, fine grain, 10 mm grid, stronger 50 mm
 * lines through the centre, and a thin frame. `bed` is the bed edge in mm.
 */
export function makeBedTexture(bed: number): THREE.CanvasTexture {
  const c = makeCanvas(SIZE);
  const ctx = c.getContext('2d')!;
  const ppm = SIZE / bed;
  ctx.fillStyle = '#c9c8c3';
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.globalAlpha = 0.07;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(noiseTile(), 'repeat')!;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  const lines = (step: number, color: string, w: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    for (let k = 0; ; k++) {
      const off = k * step * ppm;
      if (off > SIZE / 2) break;
      for (const sgn of k === 0 ? [1] : [1, -1]) {
        const p = Math.round(SIZE / 2 + sgn * off) + 0.5;
        ctx.moveTo(p, 0);
        ctx.lineTo(p, SIZE);
        ctx.moveTo(0, p);
        ctx.lineTo(SIZE, p);
      }
    }
    ctx.stroke();
  };
  lines(10, 'rgba(60,62,66,0.30)', 1);
  lines(50, 'rgba(45,47,52,0.52)', 1.6);

  // thin frame, a little inside the edge
  ctx.strokeStyle = 'rgba(45,48,54,0.70)';
  ctx.lineWidth = 2.2;
  ctx.strokeRect(5, 5, SIZE - 10, SIZE - 10);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/** Soft falloff mask (green channel): solid near the middle, fading towards the edges and corners. */
export function makeBedFalloff(): THREE.CanvasTexture {
  const n = 256;
  const c = makeCanvas(n);
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(n / 2, n / 2, n * 0.18, n / 2, n / 2, n * 0.72);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.55, '#e6e6e6');
  g.addColorStop(1, '#262626');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, n, n);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}
