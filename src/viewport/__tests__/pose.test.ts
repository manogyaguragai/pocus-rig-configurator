import { describe, expect, it } from 'vitest';
import { poseOffset, formatDims, positionsBBox, cubicBezier, EASE } from '../pose';
import { assemblyOffset, ASSEMBLY_LIFT_Z } from '../../geometry/placement';

describe('pose', () => {
  it('assembled lift (t=0)', () => {
    expect(ASSEMBLY_LIFT_Z).toBe(35);
    for (const id of ['holster', 'caddy', 'gloveTube', 'gloveBox', 'plate', 'vclamp'] as const)
      expect(poseOffset(id, 0)).toEqual([0, 0, 35]);
    expect(poseOffset('calibMale', 0)).toEqual([0, 0, 0]);
  });
  it('exploded offsets per SPEC 6 (t=1)', () => {
    expect(poseOffset('holster', 1)).toEqual([0, -60, 60]);
    expect(poseOffset('caddy', 1)).toEqual([45, -60, 60]);
    expect(poseOffset('gloveTube', 1)).toEqual([-45, -60, 60]);
    expect(poseOffset('gloveBox', 1)).toEqual([-45, -60, 60]);
    expect(poseOffset('vclamp', 1)).toEqual([0, 45, 35]);
    expect(poseOffset('plate', 1)).toEqual([0, 0, 35]);
    expect(poseOffset('calibFemale', 1)).toEqual([0, 0, 0]);
    expect(poseOffset('holster', 1)).toEqual(assemblyOffset('holster', true));
  });
  it('midpoint interpolates, plate stays fixed', () => {
    expect(poseOffset('holster', 0.5)).toEqual([0, -30, 47.5]);
    expect(poseOffset('plate', 0.37)).toEqual([0, 0, 35]);
  });
});

describe('formatDims', () => {
  it('one decimal, x by y by z', () => {
    expect(formatDims({ min: [-40, -59.8, 0], max: [40, 0, 100] })).toBe('80.0 × 59.8 × 100.0 mm');
    expect(formatDims({ min: [0, 0, 0], max: [1.04, 2.06, 3] })).toBe('1.0 × 2.1 × 3.0 mm');
  });
  it('positionsBBox', () => {
    const b = positionsBBox(new Float32Array([1, 2, 3, -1, 5, 0]));
    expect(b).toEqual({ min: [-1, 2, 0], max: [1, 5, 3] });
  });
});

describe('easing', () => {
  it('bezier is monotone from 0 to 1, front-loaded', () => {
    expect(EASE(0)).toBe(0);
    expect(EASE(1)).toBe(1);
    expect(EASE(0.2)).toBeGreaterThan(0.2);
    let prev = 0;
    for (let i = 1; i <= 20; i++) {
      const v = EASE(i / 20);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(cubicBezier(0, 0, 1, 1)(0.5)).toBeCloseTo(0.5, 3);
  });
});
