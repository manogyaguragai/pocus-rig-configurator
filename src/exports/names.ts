import type { PartId } from '../geometry/types';

/** Name used in every export filename: POCUS_<name>_tol0p25.stl */
export const PART_FILE_NAMES: Readonly<Record<PartId, string>> = {
  holster: 'Holster',
  caddy: 'GelCaddy',
  gloveTube: 'GloveTube',
  gloveBox: 'GloveBox',
  plate: 'WallPlate',
  vclamp: 'VClamp',
  calibMale: 'CalibMale',
  calibFemaleLo: 'CalibSlotLo',
  calibFemale: 'CalibSlot',
  calibFemaleHi: 'CalibSlotHi',
};

/** 0.25 -> "0p25" (two decimals, '.' replaced by 'p'). */
export function tolToken(tolerance: number): string {
  return tolerance.toFixed(2).replace('.', 'p');
}

export const stlFileName = (id: PartId, tolerance: number): string => `POCUS_${PART_FILE_NAMES[id]}_tol${tolToken(tolerance)}.stl`;
export const kitZipName = (tolerance: number): string => `POCUS_PrintKit_tol${tolToken(tolerance)}.zip`;
export const calibrationZipName = (tolerance: number): string => `POCUS_Calibration_tol${tolToken(tolerance)}.zip`;
export const rigThreeMfName = (tolerance: number): string => `POCUS_Rig_tol${tolToken(tolerance)}.3mf`;
export const calibrationThreeMfName = (tolerance: number): string => `POCUS_Calibration_tol${tolToken(tolerance)}.3mf`;
export const ASSEMBLY_FILE_NAME = 'ASSEMBLY.txt';
