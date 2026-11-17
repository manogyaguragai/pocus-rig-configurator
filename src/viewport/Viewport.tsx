import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Focus } from 'lucide-react';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { PART_META, type BBox, type PartId } from '../geometry/types';
import { BED } from '../geometry/constants';
import { useViewStore } from '../store/viewStore';
import { Dimensions } from './Dimensions';
import { makeBedFalloff, makeBedTexture } from './bed';
import { FOV_DEG, blendBBox, frameRig } from './framing';
import { EASE, TRANSITION_S, poseOffset, positionsBBox, sceneBBox, type PartMesh, type PartMeshes } from './pose';

const ICON = { size: 16, strokeWidth: 1.5, 'aria-hidden': true } as const;

export type { PartMeshes, PartMesh } from './pose';
export { formatDims } from './pose';

/** Page tone behind the scene. Keep `--viewport` in src/styles/tokens.css equal to this. */
export const VIEWPORT_BG = '#ebeae7';
const COLORS = { teal: '#0b8a73', slate: '#2a3038' } as const;
const EDGE_ANGLE_DEG = 28;
const CREASE_RAD = (34 * Math.PI) / 180;

const BG_COLOR = new THREE.Color(VIEWPORT_BG);

/** Matte PLA (teal) and satin slate. A cheap fresnel rim is added through onBeforeCompile; its strength is a uniform. */
function useMaterial(kind: 'teal' | 'slate') {
  return useMemo(() => {
    const uniforms = { uRim: { value: 0 }, uRimColor: { value: new THREE.Color(kind === 'teal' ? '#9ff0dc' : '#a9b8c8') } };
    const m =
      kind === 'teal'
        ? new THREE.MeshPhysicalMaterial({
            color: COLORS.teal,
            roughness: 0.6,
            metalness: 0,
            sheen: 0.5,
            sheenRoughness: 0.55,
            sheenColor: new THREE.Color('#7fd6c2'),
            envMapIntensity: 0.6,
          })
        : new THREE.MeshStandardMaterial({ color: COLORS.slate, roughness: 0.46, metalness: 0.18, envMapIntensity: 1.1 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uRim = uniforms.uRim;
      sh.uniforms.uRimColor = uniforms.uRimColor;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uRim;\nuniform vec3 uRimColor;')
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          float rimF = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
          totalEmissiveRadiance += uRimColor * uRim * pow(rimF, 2.6);`,
        );
    };
    m.customProgramCacheKey = () => 'pocus-rim-' + kind;
    return { m, uniforms };
  }, [kind]);
}

function PartObject({ id, mesh, selected, dimmed, xray, others }: { id: PartId; mesh: PartMesh; selected: boolean; dimmed: boolean; xray: boolean; others: BBox[] }) {
  const select = useViewStore((s) => s.selectPart);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const [hover, setHover] = useState(false);
  const kind = PART_META[id].material;
  const { m: material, uniforms } = useMaterial(kind);

  const raw = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    return g;
  }, [mesh]);
  // Smooth shading with a crease angle: curves are round, rails, slots and the dovetail stay crisp.
  const geometry = useMemo(() => {
    const g = toCreasedNormals(raw, CREASE_RAD);
    g.computeBoundingSphere();
    return g;
  }, [raw]);
  const edges = useMemo(() => new THREE.EdgesGeometry(raw, EDGE_ANGLE_DEG), [raw]);
  useEffect(() => () => raw.dispose(), [raw]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => edges.dispose(), [edges]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(
    () => () => {
      gl.domElement.style.cursor = '';
    },
    [gl],
  );

  const bbox: BBox = useMemo(() => positionsBBox(mesh.positions), [mesh]);
  const teal = kind === 'teal';
  const edgeColor = teal ? '#054d3f' : '#12161b';

  useEffect(() => {
    const base = teal ? COLORS.teal : COLORS.slate;
    material.color.set(base);
    if (dimmed) material.color.lerp(BG_COLOR, 0.16);
    uniforms.uRim.value = selected ? 0.85 : hover && !xray ? 0.4 : teal ? 0.05 : 0.2;
    material.transparent = xray;
    material.opacity = xray ? 0.2 : 1;
    material.depthWrite = !xray;
    material.side = xray ? THREE.DoubleSide : THREE.FrontSide;
    material.needsUpdate = true;
    invalidate();
  }, [material, uniforms, selected, dimmed, hover, xray, teal, invalidate]);

  return (
    <>
      <mesh
        geometry={geometry}
        material={material}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          select(id);
        }}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHover(true);
          gl.domElement.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHover(false);
          gl.domElement.style.cursor = '';
        }}
        renderOrder={xray ? 1 : 0}
        castShadow={!xray}
        receiveShadow={!xray}
      />
      {(xray || selected) && (
        <lineSegments geometry={edges} renderOrder={2}>
          <lineBasicMaterial color={edgeColor} transparent opacity={xray ? 0.9 : 0.55} depthWrite={false} />
        </lineSegments>
      )}
      {selected && <Dimensions bbox={bbox} others={others} />}
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
  const boxes = useMemo(() => {
    const out = new Map<PartId, BBox>();
    for (const id of Object.keys(meshes) as PartId[]) {
      const m = meshes[id];
      if (m) out.set(id, positionsBBox(m.positions));
    }
    return out;
  }, [meshes]);
  const othersOf = useMemo(() => {
    const out = new Map<PartId, BBox[]>();
    for (const id of boxes.keys()) out.set(id, [...boxes].filter(([k]) => k !== id).map(([, b]) => b));
    return out;
  }, [boxes]);
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
            <PartObject id={id} mesh={m} selected={selected === id} dimmed={selected !== null && selected !== id} xray={xray} others={othersOf.get(id) ?? []} />
          </group>
        );
      })}
    </>
  );
}

function Bed({ cx, cy }: { cx: number; cy: number }) {
  const map = useMemo(() => makeBedTexture(BED), []);
  const falloff = useMemo(() => makeBedFalloff(), []);
  useEffect(() => () => map.dispose(), [map]);
  useEffect(() => () => falloff.dispose(), [falloff]);
  return (
    <mesh position={[cx, cy, 0]} receiveShadow renderOrder={-2}>
      <planeGeometry args={[BED, BED]} />
      <meshStandardMaterial map={map} alphaMap={falloff} transparent depthWrite={false} roughness={0.95} metalness={0} envMapIntensity={0.3} />
    </mesh>
  );
}

/** Procedural studio reflections (no network): a small room lit by soft boxes, blurred into a PMREM. */
function Env() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const rt = pmrem.fromScene(room, 0.04);
    scene.environment = rt.texture;
    scene.environmentIntensity = 0.35;
    // RoomEnvironment is Y up; the scene is Z up.
    scene.environmentRotation.set(Math.PI / 2, 0, 0);
    invalidate();
    return () => {
      scene.environment = null;
      rt.dispose();
      room.dispose();
      pmrem.dispose();
    };
  }, [gl, scene, invalidate]);
  return null;
}

type FramePair = { assembled: BBox; exploded: BBox };

/** Positions the camera once, from the first bounds that arrive, and again only when `nonce` changes (Reset view). */
function FrameOnce({ bbox, nonce, controls }: { bbox: FramePair | null; nonce: number; controls: React.RefObject<OrbitControlsImpl | null> }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const done = useRef(-1);
  useLayoutEffect(() => {
    if (done.current === nonce || !bbox || size.height < 1) return;
    done.current = nonce;
    const f = frameRig(bbox.assembled, bbox.exploded, size.width / size.height, FOV_DEG);
    camera.up.set(0, 0, 1);
    camera.position.set(...f.position);
    camera.lookAt(...f.target);
    camera.updateProjectionMatrix();
    const c = controls.current;
    if (c) {
      c.target.set(...f.target);
      c.minDistance = f.distance * 0.3;
      c.maxDistance = f.distance * 2.6;
      c.update();
    }
    invalidate();
  }, [bbox, nonce, size, camera, controls, invalidate]);
  return null;
}

export type ViewportProps = { meshes: PartMeshes; className?: string };

export function Viewport({ meshes, className }: ViewportProps) {
  const clear = useViewStore((s) => s.clearSelection);
  const controls = useRef<OrbitControlsImpl | null>(null);
  // Frame once, on the first meshes that arrive. Later part-set changes (mount or glove switches)
  // must not move the camera, or they would discard the user's orbit.
  const framed = useRef<FramePair | null>(null);
  if (!framed.current) {
    const a = sceneBBox(meshes, 0);
    const e = sceneBBox(meshes, 1);
    if (a && e) {
      a.min[2] = Math.min(a.min[2], 0);
      e.min[2] = Math.min(e.min[2], 0);
      framed.current = { assembled: a, exploded: e };
    }
  }
  const [reframe, setReframe] = useState<{ bbox: FramePair | null; nonce: number }>({ bbox: null, nonce: 0 });
  // Reset view fits the union of the assembled and exploded bounds of the parts present now, so
  // both view modes fit afterwards.
  const resetView = () => {
    const a = sceneBBox(meshes, 0);
    const e = sceneBBox(meshes, 1);
    if (!a || !e) return;
    a.min[2] = Math.min(a.min[2], 0);
    e.min[2] = Math.min(e.min[2], 0);
    setReframe((r) => ({ bbox: { assembled: a, exploded: e }, nonce: r.nonce + 1 }));
  };
  const fb = framed.current;
  const fbb = fb ? blendBBox(fb.assembled, fb.exploded, 0.55) : null;
  const cx = fbb ? (fbb.min[0] + fbb.max[0]) / 2 : 0;
  const cy = fbb ? (fbb.min[1] + fbb.max[1]) / 2 : -30;

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: `radial-gradient(ellipse 80% 70% at 50% 46%, #f3f2ef 0%, ${VIEWPORT_BG} 72%)`,
      }}
    >
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ up: [0, 0, 1], fov: FOV_DEG, near: 5, far: 4000, position: [230, -420, 300] }}
        onPointerMissed={clear}
        shadows={{ type: THREE.PCFShadowMap }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }}
      >
        <Env />
        <hemisphereLight args={['#ffffff', '#cfd0cf', 0.5]} up={[0, 0, 1]} />
        {/* key: soft, warm, from front right above */}
        <directionalLight
          position={[260, -340, 520]}
          color="#fff4e6"
          intensity={2.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0003}
          shadow-normalBias={0.5}
          shadow-radius={6}
          shadow-camera-left={-300}
          shadow-camera-right={300}
          shadow-camera-top={300}
          shadow-camera-bottom={-300}
          shadow-camera-near={50}
          shadow-camera-far={1600}
        />
        {/* overhead: tight shadow, crisp at contact */}
        <directionalLight
          position={[30, -20, 700]}
          intensity={0.55}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.4}
          shadow-camera-left={-220}
          shadow-camera-right={220}
          shadow-camera-top={220}
          shadow-camera-bottom={-220}
          shadow-camera-near={100}
          shadow-camera-far={1400}
        />
        {/* fill: cool, from the left, no shadow */}
        <directionalLight position={[-380, -220, 200]} color="#dbe6f2" intensity={0.6} />
        {/* rim: from behind to separate the rig from the bed */}
        <directionalLight position={[-120, 420, 260]} color="#ffffff" intensity={0.9} />
        <Bed cx={cx} cy={cy} />
        <Rig meshes={meshes} />
        <OrbitControls
          ref={controls}
          makeDefault
          enableDamping
          dampingFactor={0.1}
          rotateSpeed={0.75}
          maxPolarAngle={Math.PI * 0.49}
          minDistance={80}
          maxDistance={1400}
        />
        <FrameOnce bbox={reframe.bbox ?? fb} nonce={reframe.nonce} controls={controls} />
      </Canvas>
      <button type="button" className="btn secondary reset-view" aria-label="Reset view" title="Reset view" onClick={resetView}>
        <Focus {...ICON} />
      </button>
    </div>
  );
}
