import { zipSync, strToU8, type Zippable } from 'fflate';
import { clampParams, type Params } from '../geometry/params';
import { activeParts, CALIB_PARTS, type PartId } from '../geometry/types';
import { buildAssemblyText } from './assembly';
import { ASSEMBLY_FILE_NAME, calibrationThreeMfName, rigThreeMfName, stlFileName } from './names';
import { toPrintMesh, type PrintMesh, type RawMesh } from './print';
import { encodeBinaryStl } from './stl';
import { build3mf } from './threemf';

export type MeshSet = Readonly<Partial<Record<PartId, RawMesh>>>;

function printMeshes(ids: readonly PartId[], meshes: MeshSet): PrintMesh[] {
  return ids.map((id) => {
    const m = meshes[id];
    if (!m) throw new Error(`Missing mesh for ${id}`);
    return toPrintMesh(id, m);
  });
}

function packZip(params: Params, parts: PrintMesh[], threeMfName: string, extra: Zippable = {}): Uint8Array {
  const files: Zippable = {};
  for (const p of parts) files[stlFileName(p.id, params.tolerance)] = encodeBinaryStl(p.positions, p.indices, p.id);
  // The 3MF is already deflated; store it.
  files[threeMfName] = [build3mf(parts, params), { level: 0 }];
  return zipSync({ ...files, ...extra });
}

/** Zip: every active part's print-oriented STL, one .3mf of all of them, ASSEMBLY.txt. Meshes are Blender-frame. */
export function buildPrintKit(paramsIn: Partial<Params>, meshes: MeshSet): Uint8Array {
  const params = clampParams(paramsIn);
  const ids = activeParts(params);
  const parts = printMeshes(ids, meshes);
  return packZip(params, parts, rigThreeMfName(params.tolerance), { [ASSEMBLY_FILE_NAME]: strToU8(buildAssemblyText(params, ids)) });
}

/**
 * Zip: calibration male + three slot blocks (STLs, each print-oriented and centred on its own)
 * and one .3mf with the four spaced out on the bed (they share one pose in the geometry).
 */
export function buildCalibrationKit(paramsIn: Partial<Params>, calibMeshes: MeshSet): Uint8Array {
  const params = clampParams(paramsIn);
  return packZip(params, printMeshes(CALIB_PARTS, calibMeshes), calibrationThreeMfName(params.tolerance));
}
