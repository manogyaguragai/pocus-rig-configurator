import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { PART_META, type BBox, type PartId } from '../geometry/types';
import { BED } from '../geometry/constants';
import { useViewStore } from '../store/viewStore';
import { Dimensions } from './Dimensions';
import { EASE, TRANSITION_S, poseOffset, positionsBBox, sceneBBox, type PartMesh, type PartMeshes } from './pose';

export type { PartMeshes, PartMesh } from './pose';
export { formatDims } from './pose';

export const VIEWPORT_BG = '#f0f0f1';
const COLORS = { teal: '#0b8a73', slate: '#2a3038' } as const;
const EDGE_ANGLE_DEG = 28;

function PartObject({ id, mesh, selected, xray }: { id: PartId; mesh: PartMesh; selected: boolean; xray: boolean }) {
  const select = useViewStore((s) => s.selectPart);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }, [mesh]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry, EDGE_ANGLE_DEG), [geometry]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => edges.dispose(), [edges]);

  const base = COLORS[PART_META[id].material];
  const bbox: BBox = useMemo(() => positionsBBox(mesh.positions), [mesh]);
  const edgeColor = selected ? '#00735f' : PART_META[id].material === 'teal' ? '#065c4d' : '#11151a';

  return (
    <>
      <mesh
        geometry={geometry}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          select(id);
        }}
        renderOrder={xray ? 1 : 0}
      >
        <meshStandardMaterial
          color={base}
          flatShading
          roughness={0.72}
          metalness={0}
          emissive={selected ? '#7fe3cf' : '#000000'}
          emissiveIntensity={selected ? 0.18 : 0}
          transparent={xray}
          opacity={xray ? 0.22 : 1}
          depthWrite={!xray}
          side={xray ? THREE.DoubleSide : THREE.FrontSide}
        />
      </mesh>
      {(xray || selected) && (
        <lineSegments geometry={edges} renderOrder={2}>
          <lineBasicMaterial color={edgeColor} transparent opacity={xray ? 0.85 : 0.5} />
        </lineSegments>
      )}
      {selected && <Dimensions bbox={bbox} />}
    </>
  );
}

function Rig({ meshes }: { meshes: PartMeshes }) {
  const groups = useRef(new Map<PartId, THREE.Group>());
  const progress = useRef(useViewStore.getState().viewMode === 'exploded' ? 1 : 0);
  const invalidate = useThree((s) => s.invalidate);
  const viewMode = useViewStore((s) => s.viewMode);
  const xray = useViewStore((s) => s.xray);
  const selected = useViewStore((s) => s.selectedPart);

  const apply = (p: number) => {
    const t = EASE(p);
    groups.current.forEach((g, id) => {
      const o = poseOffset(id, t);
      g.position.set(o[0], o[1], o[2]);
    });
  };

  useFrame((_, dt) => {
    const target = useViewStore.getState().viewMode === 'exploded' ? 1 : 0;
    const p = progress.current;
    if (p !== target) {
      const step = Math.min(dt, 0.05) / TRANSITION_S;
      progress.current = target > p ? Math.min(target, p + step) : Math.max(target, p - step);
      apply(progress.current);
      invalidate();
    }
  });

  useLayoutEffect(() => {
    apply(progress.current);
    invalidate();
  });
  useEffect(() => invalidate(), [viewMode, xray, selected, invalidate]);

  const ids = Object.keys(meshes) as PartId[];
  return (
    <>
      {ids.map((id) => {
        const m = meshes[id];
        if (!m) return null;
        return (
          <group
            key={id}
            ref={(g) => {
              if (g) groups.current.set(id, g);
              else groups.current.delete(id);
            }}
          >
            <PartObject id={id} mesh={m} selected={selected === id} xray={xray} />
          </group>
        );
      })}
    </>
  );
}

function Bed({ cx, cy }: { cx: number; cy: number }) {
  const h = BED / 2;
  const outline: [number, number, number][] = [
    [cx - h, cy - h, 0.05],
    [cx + h, cy - h, 0.05],
    [cx + h, cy + h, 0.05],
    [cx - h, cy + h, 0.05],
    [cx - h, cy - h, 0.05],
  ];
  const grid = useMemo(() => {
    const g = new THREE.GridHelper(BED, 16, '#c9c9cc', '#d9d9dc');
    g.rotation.x = Math.PI / 2;
    (g.material as THREE.Material).depthWrite = false;
    return g;
  }, []);
  return (
    <group>
      <mesh position={[cx, cy, -0.1]}>
        <planeGeometry args={[BED, BED]} />
        <meshBasicMaterial color="#e9e9eb" />
      </mesh>
      <primitive object={grid} position={[cx, cy, 0]} />
      <Line points={outline} color="#a3a3a8" lineWidth={1.5} />
    </group>
  );
}

function CameraSetup({ target }: { target: THREE.Vector3 }) {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    camera.up.set(0, 0, 1);
    camera.position.set(target.x + 230, target.y - 420, target.z + 300);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [camera, target]);
  return null;
}

export type ViewportProps = { meshes: PartMeshes; className?: string };

export function Viewport({ meshes, className }: ViewportProps) {
  const clear = useViewStore((s) => s.clearSelection);
  const framing = useMemo(() => {
    const b = sceneBBox(meshes, 0);
    const c = b
      ? new THREE.Vector3((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2)
      : new THREE.Vector3(0, -30, 60);
    return c;
    // frame once per set of parts present, not on every mesh swap
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Object.keys(meshes).sort().join(',')]);

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%', background: VIEWPORT_BG }}>
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ up: [0, 0, 1], fov: 32, near: 5, far: 4000, position: [230, -420, 300] }}
        onPointerMissed={clear}
        gl={{ antialias: true }}
      >
        <color attach="background" args={[VIEWPORT_BG]} />
        <CameraSetup target={framing} />
        <hemisphereLight args={['#ffffff', '#c8ccd0', 1.1]} up={[0, 0, 1]} />
        <directionalLight position={[300, -400, 600]} intensity={1.6} />
        <directionalLight position={[-400, -100, 250]} intensity={0.5} />
        <Bed cx={framing.x} cy={framing.y} />
        <Rig meshes={meshes} />
        <OrbitControls makeDefault target={framing} enableDamping dampingFactor={0.12} maxPolarAngle={Math.PI * 0.49} />
      </Canvas>
    </div>
  );
}
