import { describe, expect, it } from 'vitest';
import type { BBox } from '../../geometry/types';
import { dimensionLayout, heightEdge } from '../layout';

const box = (x0: number, y0: number, x1: number, y1: number, z1 = 100): BBox => ({ min: [x0, y0, 0], max: [x1, y1, z1] });

describe('heightEdge', () => {
  it('prefers the front-right edge, facing the camera, when nothing is near', () => {
    expect(heightEdge(box(0, 0, 80, 60), [])).toEqual({ sx: 1, sy: -1 });
  });
  it('moves off an edge blocked by a neighbour', () => {
    expect(heightEdge(box(0, 0, 80, 60), [box(82, -10, 150, 70)]).sx).toBe(-1);
  });
  it('ignores neighbours that are entirely above', () => {
    const above: BBox = { min: [82, -10, 200], max: [150, 70, 260] };
    expect(heightEdge(box(0, 0, 80, 60), [above])).toEqual({ sx: 1, sy: -1 });
  });
  it('places the height line on the chosen edge, outside the part', () => {
    const z = dimensionLayout(box(0, 0, 80, 60), [box(82, -10, 150, 70)]).find((d) => d.axis === 'z')!;
    expect(z.a[0]).toBeLessThan(0);
    expect(z.label).toMatch(/100/);
  });
});
