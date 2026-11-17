# Exports

Turn the worker's meshes into files. Everything here is pure data in, bytes out,
so it runs in Node for tests.

| File | Purpose |
|---|---|
| `print.ts` | Puts a Blender-frame mesh into print orientation: rotate per part, centre in XY, lowest point at z = 0 |
| `stl.ts` | Binary STL writer; the 80-byte header holds only the project and part name |
| `threemf.ts` | One 3MF with every part laid out on the 256 mm bed (shelf packing, parts are not rotated); throws if they do not fit |
| `kit.ts` | `buildPrintKit` and `buildCalibrationKit`: zip the files with fflate |
| `assembly.ts` | Text of `ASSEMBLY.txt`: settings, per-part print orientation, mount steps, credit line |
| `names.ts` | File names, for example `POCUS_Holster_tol0p25.stl` |

## Contents

Print kit (`POCUS_PrintKit_tol<t>.zip`): one STL per active part, one
`POCUS_Rig_tol<t>.3mf` with all of them, and `ASSEMBLY.txt`.

Calibration (`POCUS_Calibration_tol<t>.zip`): the male block and three female
blocks as STLs, plus `POCUS_Calibration_tol<t>.3mf` with the four on one bed.

`<t>` is the clearance with two decimals and `p` for the point, so 0.25 becomes
`0p25`.
