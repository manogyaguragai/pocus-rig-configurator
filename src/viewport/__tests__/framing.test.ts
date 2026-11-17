import { describe, expect, it } from 'vitest';
import { blendBBox, frameBBox, frameRig, projectedHeightFill } from '../framing';
import type { BBox } from '../../geometry/types';
import { dimOffset, dimensionLayout } from '../layout';

const box = { min: [-40, -60, 0] as [number, number, number], max: [40, 0, 100] as [number, number, number] };

describe('framing', () => {
  it('targets the bbox centre and sits on the view direction', () => {
    const f = frameBBox(box, 1.6);
    expect(f.target).toEqual([0, -30, 50]);
    const d = Math.hypot(f.position[0] - f.target[0], f.position[1] - f.target[1], f.position[2] - f.target[2]);
    expect(d).toBeCloseTo(f.distance, 5);
    expect(f.position[1]).toBeLessThan(f.target[1]);
    expect(f.position[2]).toBeGreaterThan(f.target[2]);
  });
  it('narrow viewports need a larger distance, bigger parts too', () => {
    expect(frameBBox(box, 0.45).distance).toBeGreaterThan(frameBBox(box, 1.6).distance);
    const big = { min: box.min, max: [80, 0, 200] as [number, number, number] };
    expect(frameBBox(big, 1.6).distance).toBeGreaterThan(frameBBox(box, 1.6).distance);
  });
  it('survives degenerate input', () => {
    const z = { min: [0, 0, 0] as [number, number, number], max: [0, 0, 0] as [number, number, number] };
    expect(Number.isFinite(frameBBox(z, 0).distance)).toBe(true);
  });
  it('blends bounds', () => {
    const e = { min: [-40, -120, 0] as [number, number, number], max: [40, 0, 160] as [number, number, number] };
    expect(blendBBox(box, e, 0.5).min[1]).toBe(-90);
    expect(blendBBox(box, e, 0).max[2]).toBe(100);
  });
});

describe('dimension layout', () => {
  const dims = dimensionLayout(box);
  it('labels match the extents with one decimal', () => {
    expect(dims.map((d) => d.label)).toEqual(['80.0 mm', '60.0 mm', '100.0 mm']);
  });
  it('lies outside the bbox, with two extension lines and two ticks each', () => {
    const off = dimOffset(box);
    expect(dims[0]!.a[1]).toBeCloseTo(-60 - off);
    expect(dims[1]!.a[0]).toBeCloseTo(40 + off);
    expect(dims[2]!.a[0]).toBeCloseTo(40 + off); // no neighbours: front-right edge, facing the camera
    for (const d of dims) {
      expect(d.ext).toHaveLength(2);
      expect(d.ticks).toHaveLength(2);
    }
  });
  it('offset is clamped', () => {
    expect(dimOffset({ min: [0, 0, 0], max: [5, 5, 5] })).toBe(7);
    expect(dimOffset({ min: [0, 0, 0], max: [500, 5, 5] })).toBe(16);
  });
});

describe('frameRig', () => {
  const asm: BBox = { min: [-45, -70, 0], max: [45, 20, 160] };
  const exp: BBox = { min: [-90, -130, 0], max: [90, 65, 185] }; // offsets of up to 45, 60 and 25 mm, as in EXPLODE_OFFSETS
  const extremeA: BBox = { min: [-60, -110, 0], max: [60, 40, 330] };
  const extremeE: BBox = { min: [-105, -170, 0], max: [105, 85, 355] };
  for (const [w, h] of [[1440, 800], [1920, 900]] as const) {
    it(`bounds fill most of the height at ${w}x${h}`, () => {
      const f = frameRig(asm, exp, w / h);
      const fill = projectedHeightFill(asm, f);
      expect(fill).toBeGreaterThan(0.6);
      expect(fill).toBeLessThan(0.82);
    });
    it(`keeps exploded and extreme configs in frame at ${w}x${h}`, () => {
      for (const [a, e] of [[asm, exp], [extremeA, extremeE]] as const) {
        const f = frameRig(a, e, w / h);
        expect(projectedHeightFill(e, f)).toBeLessThanOrEqual(1.1);
        expect(projectedHeightFill(a, f)).toBeLessThanOrEqual(1.1);
      }
    });
  }
  it('backs off for portrait viewports', () => {
    expect(frameRig(asm, exp, 0.46).distance).toBeGreaterThan(frameRig(asm, exp, 1.8).distance);
  });
  it('survives degenerate input', () => {
    const z: BBox = { min: [0, 0, 0], max: [0, 0, 0] };
    expect(Number.isFinite(frameRig(z, z, 0).distance)).toBe(true);
  });
});
