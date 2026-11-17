import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const geometryCalls = vi.hoisted(() => ({ n: 0 }));
vi.mock('../geometry/index', () => ({
  buildPart: () => { geometryCalls.n++; },
  buildAll: () => { geometryCalls.n++; },
  buildPartIn: () => { geometryCalls.n++; },
}));

import { useViewStore } from './viewStore';

beforeEach(() => useViewStore.setState({ viewMode: 'assembled', xray: false, selectedPart: null }));

describe('viewStore', () => {
  it('module does not reference the geometry client or worker', () => {
    const src = readFileSync(new URL('./viewStore.ts', import.meta.url), 'utf8');
    const imports = src.split('\n').filter((l) => /^\s*import\b/.test(l)).join('\n');
    expect(imports).not.toMatch(/worker|geometryStore|client|geometry\/index|manifold/i);
  });

  it('toggling 20 times invokes no geometry work', () => {
    const s = useViewStore.getState;
    for (let i = 0; i < 20; i++) {
      s().toggleViewMode();
      s().toggleXray();
    }
    expect(s().viewMode).toBe('assembled');
    expect(s().xray).toBe(false);
    s().setViewMode('exploded');
    expect(s().viewMode).toBe('exploded');
    expect(geometryCalls.n).toBe(0);
  });

  it('selection', () => {
    const s = useViewStore.getState;
    expect(s().selectedPart).toBeNull();
    s().selectPart('holster');
    expect(s().selectedPart).toBe('holster');
    s().selectPart('plate');
    expect(s().selectedPart).toBe('plate');
    s().clearSelection();
    expect(s().selectedPart).toBeNull();
    s().selectPart('caddy');
    s().selectPart(null);
    expect(s().selectedPart).toBeNull();
  });
});
