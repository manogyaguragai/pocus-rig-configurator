import { Html, Line } from '@react-three/drei';
import type { BBox } from '../geometry/types';
import { formatLength, type Vec3 } from './pose';
import '@fontsource/ibm-plex-mono/latin-400.css';

const COLOR = '#171717';
const GAP = 8;
const TICK = 3;

type Dim = { a: Vec3; b: Vec3; tick: Vec3; label: string };

function lengthDim(a: Vec3, b: Vec3, tick: Vec3, len: number): Dim {
  return { a, b, tick, label: formatLength(len) };
}

/**
 * Caliper dimension lines (end ticks + mono label) for one part's bbox, drawn in the part's
 * local (Blender) frame so they travel with it during the exploded transition.
 */
export function Dimensions({ bbox }: { bbox: BBox }) {
  const { min, max } = bbox;
  const w = max[0] - min[0];
  const d = max[1] - min[1];
  const h = max[2] - min[2];
  const fy = min[1] - GAP;
  const dims: Dim[] = [
    lengthDim([min[0], fy, min[2]], [max[0], fy, min[2]], [0, 0, 1], w),
    lengthDim([max[0] + GAP, min[1], min[2]], [max[0] + GAP, max[1], min[2]], [1, 0, 0], d),
    lengthDim([min[0] - GAP, fy, min[2]], [min[0] - GAP, fy, max[2]], [1, 0, 0], h),
  ];
  return (
    <group renderOrder={10}>
      {dims.map((m, i) => {
        const t = m.tick;
        const mid: Vec3 = [(m.a[0] + m.b[0]) / 2, (m.a[1] + m.b[1]) / 2, (m.a[2] + m.b[2]) / 2];
        const q = (v: Vec3, s: number): Vec3 => [v[0] + t[0] * s * TICK, v[1] + t[1] * s * TICK, v[2] + t[2] * s * TICK];
        const lineProps = { color: COLOR, lineWidth: 1, depthTest: false, transparent: true } as const;
        return (
          <group key={i}>
            <Line points={[m.a, m.b]} {...lineProps} />
            <Line points={[q(m.a, -1), q(m.a, 1)]} {...lineProps} />
            <Line points={[q(m.b, -1), q(m.b, 1)]} {...lineProps} />
            <Html position={mid} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
              <span
                style={{
                  font: '400 12px/1 "IBM Plex Mono", ui-monospace, monospace',
                  color: COLOR,
                  background: '#fff',
                  border: '1px solid rgba(23,23,23,.14)',
                  borderRadius: 4,
                  padding: '3px 6px',
                  whiteSpace: 'nowrap',
                }}
              >
                {m.label}
              </span>
            </Html>
          </group>
        );
      })}
    </group>
  );
}
