import { describe, expect, it } from 'vitest';
import { formatBBoxDims, formatClearance, formatLength, partCountText, printNote, statusView } from './format';

describe('number formats', () => {
  it('lengths use one decimal', () => {
    expect(formatLength(62)).toBe('62.0 mm');
    expect(formatLength(44.5)).toBe('44.5 mm');
  });
  it('clearance uses two decimals', () => {
    expect(formatClearance(0.25)).toBe('0.25 mm');
    expect(formatClearance(0.4)).toBe('0.40 mm');
  });
  it('bbox dims', () => {
    expect(formatBBoxDims({ min: [0, 0, 0], max: [80, 59.75, 100] })).toBe('80.0 × 59.8 × 100.0 mm');
  });
  it('part count', () => {
    expect(partCountText(1)).toBe('1 part');
    expect(partCountText(4)).toBe('4 parts');
  });
});

describe('status', () => {
  it('fits', () => {
    const v = statusView({ fits: true, partCount: 4, oversize: [] });
    expect(v).toEqual({ warning: false, text: 'Fits a 256 mm bed', count: '4 parts', details: [] });
  });
  it('warns and lists oversize parts', () => {
    const v = statusView({ fits: false, partCount: 5, oversize: [{ id: 'plate', dims: [124, 260, 13] }] });
    expect(v.warning).toBe(true);
    expect(v.text).toBe('1 part is over 250 mm');
    expect(v.details).toEqual(['Wall plate: 124.0 × 260.0 × 13.0 mm']);
  });
});

describe('print notes', () => {
  it('orientation per part', () => {
    expect(printNote('plate')).toContain('back face down');
    expect(printNote('vclamp')).toContain('plate face down');
    expect(printNote('holster')).toContain('upright');
  });
});
