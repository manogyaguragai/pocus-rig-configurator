import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import type { BBox } from '../geometry/types';
import { dimensionLayout } from './layout';
import '@fontsource/ibm-plex-mono/latin-400.css';

const INK = '#1b1f24';
const BACKING = 'rgba(236,235,232,0.94)';

/**
 * Caliper dimension lines for one part's bbox, in the part's local frame so they travel with it
 * during the exploded transition. Lines are 1 px, drawn over the part; labels keep a constant
 * on-screen size and sit on a small backing so they read over any surface.
 */
export function Dimensions({ bbox, others }: { bbox: BBox; others?: BBox[] }) {
  const dims = useMemo(() => dimensionLayout(bbox, others), [bbox, others]);
  const main = { color: INK, lineWidth: 1, depthTest: false, transparent: true, opacity: 0.9 } as const;
  const thin = { color: INK, lineWidth: 1, depthTest: false, transparent: true, opacity: 0.45 } as const;
  return (
    <group renderOrder={10}>
      {dims.map((m) => (
        <group key={m.axis}>
          <Line points={[m.a, m.b]} {...main} renderOrder={10} />
          {m.ext.map((e, i) => (
            <Line key={`e${i}`} points={e} {...thin} renderOrder={10} />
          ))}
          {m.ticks.map((t, i) => (
            <Line key={`t${i}`} points={t} {...main} lineWidth={1.5} renderOrder={10} />
          ))}
          <Html position={m.mid} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
            <span
              style={{
                font: '400 11px/1 "IBM Plex Mono", ui-monospace, monospace',
                letterSpacing: '0.01em',
                color: INK,
                background: BACKING,
                borderRadius: 3,
                padding: '3px 5px',
                whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
                boxShadow: '0 0 0 1px rgba(27,31,36,0.12)',
              }}
            >
              {m.label}
            </span>
          </Html>
        </group>
      ))}
    </group>
  );
}
