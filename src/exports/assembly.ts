import {
  AMPS_HALF_X, AMPS_HALF_Z, BED, CBORE_DEPTH, CBORE_R, KEY_HEAD_R, KEY_SLOT_HALF, M4_R, MAGNET_DEPTH, MAGNET_R, PIN_R, PIN_Z,
  VESA100_HALF, VESA75_HALF, VCLAMP_HOSE_Z, VCLAMP_INSERT_DEPTH, VCLAMP_INSERT_R, VCLAMP_ZIP_H,
} from '../geometry/constants';
import { clampParams, type MountType, type Params } from '../geometry/params';
import { PART_META, type PartId } from '../geometry/types';
import { tolToken } from './names';

export const CREDIT_LINE = 'Dr. Mandeep Guragai and Manogya Guragai';
export const LINKEDIN_MANDEEP = 'https://www.linkedin.com/in/mandeep-guragai-280589117/';
export const LINKEDIN_MANOGYA = 'https://www.linkedin.com/in/manogya-guragai/';

const mm = (v: number) => `${parseFloat(v.toFixed(2))} mm`;

const PRINT_ORIENTATION: Partial<Record<PartId, string>> = {
  plate: 'back face down, rail pointing up',
  vclamp: 'plate face down, V groove pointing up',
  holster: 'upright',
  caddy: 'upright',
  gloveTube: 'upright',
  gloveBox: 'upright',
};

const PART_ROLE: Partial<Record<PartId, string>> = {
  plate: 'carries the rail the holster slides onto',
  holster: 'probe cradle; has a slot at the back and a rail on each side',
  caddy: 'gel packet caddy; slot on the face towards the holster',
  gloveTube: 'rolled glove pairs; slot on the face towards the holster',
  gloveBox: 'glove box bracket; slot on the face towards the holster',
  vclamp: 'clamps the plate to a vertical pole',
};

function mountSteps(mount: MountType): string[] {
  switch (mount) {
    case 'tape':
      return [
        'The plate has a flat back with no holes.',
        'Clean and dry the wall surface, stick double-sided tape or adhesive strips across the back of the plate, press it onto the wall and hold it.',
        'Hang the rest of the rig on the plate only after the plate is fixed.',
      ];
    case 'vesa':
      return [
        `The plate has two M4 hole patterns on its centreline: ${mm(VESA75_HALF * 2)} and ${mm(VESA100_HALF * 2)} spacing.`,
        `Each hole is dia ${mm(M4_R * 2)} with a counterbore dia ${mm(CBORE_R * 2)} x ${mm(CBORE_DEPTH)} on the front face, so the screw head sits flush with the front.`,
        `There are also two keyholes (head dia ${mm(KEY_HEAD_R * 2)}, slot ${mm(KEY_SLOT_HALF * 2)} wide) to hang the plate on two screw heads already fixed in the wall.`,
        'Fix the plate with screws that suit your wall and the M4 holes, or hang it on the keyholes and then drive screws through the holes.',
      ];
    case 'amps':
      return [
        `The plate has an AMPS pattern of four M4 holes, ${mm(AMPS_HALF_X * 2)} x ${mm(AMPS_HALF_Z * 2)}, with the counterbore (dia ${mm(CBORE_R * 2)} x ${mm(CBORE_DEPTH)}) on the front face.`,
        'Bolt the plate to your RAM AMPS plate through these four holes, screw heads on the front.',
      ];
    case 'magnets':
      return [
        `The back of the plate has four round recesses, dia ${mm(MAGNET_R * 2)} x ${mm(MAGNET_DEPTH)} deep, for magnets.`,
        'Glue a magnet into each recess, all with the same pole facing out, and use matching steel or magnets on the mounting surface.',
        'Check the recess fit with a magnet before gluing; the magnet size is not defined beyond the recess.',
      ];
    case 'ivpole':
      return [
        `The plate has the AMPS pattern of four M4 holes (${mm(AMPS_HALF_X * 2)} x ${mm(AMPS_HALF_Z * 2)}) and the V-clamp is a separate printed part.`,
        `Join the plate to the plate face of the V-clamp. That face has four blind holes (dia ${mm(VCLAMP_INSERT_R * 2)}, ${mm(VCLAMP_INSERT_DEPTH)} deep) at the AMPS positions; the screw or insert type is your choice, it is not defined here.`,
        `Put the V groove against the pole. Pass a hose clamp through the wide tunnel (${mm(VCLAMP_HOSE_Z[1] - VCLAMP_HOSE_Z[0])} tall) in the middle of the clamp, and zip ties through the two narrow tunnels (${mm(VCLAMP_ZIP_H)} tall) near its top and bottom, then tighten around the pole.`,
        'The tunnels run through the clamp body between the plate face and the V groove.',
      ];
  }
}

/** Slot/rail pairs. The female part always carries the slot; the male rail is on the parent. */
function joints(active: readonly PartId[]): string[] {
  const out: string[] = [];
  out.push('Plate rail -> holster back slot (the slot in the block on the back of the holster)');
  out.push('Holster right rail -> gel caddy slot');
  const glove = active.includes('gloveBox') ? 'gloveBox' : 'gloveTube';
  out.push(`Holster left rail -> ${PART_META[glove].label.toLowerCase()} slot`);
  return out;
}

export function buildAssemblyText(paramsIn: Partial<Params>, activeParts: readonly PartId[]): string {
  const params = clampParams(paramsIn);
  const tol = params.tolerance;
  const L: string[] = [];
  const h = (t: string) => L.push('', t, '-'.repeat(t.length));

  L.push(
    'POCUS Rig assembly notes',
    `Built by ${CREDIT_LINE}`,
    `Dr. Mandeep Guragai: ${LINKEDIN_MANDEEP}`,
    `Manogya Guragai: ${LINKEDIN_MANOGYA}`,
  );

  h('Before you print');
  L.push('Print the calibration piece first.');
  L.push(
    `This kit uses a fit clearance of ${tol.toFixed(2)} mm. The calibration piece has one male rail and three slot blocks at ` +
      `${(tol - 0.05).toFixed(2)}, ${tol.toFixed(2)} and ${(tol + 0.05).toFixed(2)} mm (marked with 1, 2 and 3 notches). ` +
      'Pick the slot that slides on the rail snugly by hand, then regenerate the kit with that clearance if it is not the middle one.',
  );
  L.push('Preset probe sizes come from published manufacturer dimensions plus 4 mm clearance and have not been measured. Check your probe in the holster cradle with calipers before relying on a preset.');
  L.push(`All parts are sized to print on a ${BED} mm bed in the orientation given below. The dovetail flanks are designed to print without supports; check other overhangs in your slicer.`);

  h('Parameters (JSON)');
  L.push(JSON.stringify(params, null, 2));

  h('Parts and print orientation');
  for (const id of activeParts) {
    L.push(`- ${PART_META[id].label} (file name: POCUS_${PART_META[id].fileName}_tol${tolToken(tol)}.stl)`);
    L.push(`    print: ${PRINT_ORIENTATION[id] ?? 'upright'}`);
    if (PART_ROLE[id]) L.push(`    role: ${PART_ROLE[id]}`);
  }
  L.push('Print each part on its own, one file at a time. Every part above has its own STL file in this kit, so slice and print them individually in the orientation listed.');
  L.push('The .3mf file holds all of these parts laid out on one bed for printers with enough room, slate for the plate and V-clamp, teal for the rest. It is optional.');

  h('What drops onto what');
  L.push(...joints(activeParts).map((j) => `- ${j}`));
  L.push(
    'Each slot is open at the bottom and closed at the top. Start with the slot opening at the lower end of the rail, push the part up along the rail until the closed end of the slot stops on the rail, then fit the pin.',
  );
  L.push('Do not force a part that will not slide. Check the fit against the calibration piece first.');

  h('M3 pin positions');
  L.push(
    `Every rail and slot block pair has a pin hole of dia ${mm(PIN_R * 2)} through it at z = ${mm(PIN_Z)} along the rail (the rail spans 10 to 80 mm, the slot block 0 to 84 mm in the same frame).`,
  );
  L.push('Push a 3 mm pin or M3 screw through the hole in each pair after the parts are seated. This stops the part lifting off the rail. Use one pin per rail and slot pair.');

  h(`Mount: ${mountName(params.mount)}`);
  L.push(...mountSteps(params.mount).map((s, i) => `${i + 1}. ${s}`));

  h('Assembly order');
  L.push('1. Fix the plate to its mount.');
  L.push('2. Slide the holster onto the plate rail and fit the pin.');
  L.push('3. Slide the gel caddy onto the holster right rail and fit the pin.');
  L.push(`4. Slide the ${activeParts.includes('gloveBox') ? 'glove box bracket' : 'glove tube'} onto the holster left rail and fit the pin.`);

  return L.join('\n') + '\n';
}

export function mountName(m: MountType): string {
  return { tape: 'adhesive tape', vesa: 'screws or VESA', amps: 'RAM AMPS', magnets: 'magnets', ivpole: 'IV pole clamp' }[m];
}
