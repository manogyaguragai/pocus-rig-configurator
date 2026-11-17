# Geometry

Pure functions that turn a set of parameters into solid parts. They run in Node
for tests and in a web worker in the app.

## Layout

| File | Purpose |
|---|---|
| `constants.ts` | Every fixed number, defined once, plus the slider ranges |
| `params.ts` | `Params`, defaults, `clampParams`, probe presets |
| `layout.ts` | Derived sizes and rail positions for the current parameters |
| `dovetail.ts` | The shared rail and slot profile |
| `manifold.ts` | WebAssembly loader and the `Scope` helper that owns every solid it creates |
| `placement.ts` | Assembly lift, exploded offsets, print orientation |
| `meshCheck.ts` | Watertightness check on triangle data |
| `parts/` | One builder per part |

## Rules the code follows

- A builder takes clamped parameters and returns a solid in the Blender frame
  (before the assembly lift). Placement and print rotation are applied later.
- Rails and slots are computed last, from the current face of the parent part.
  No part stores an absolute rail position.
- Solids are created through a `Scope`. Builders never call `delete()`; the
  scope frees everything when the build ends.
- Only the chosen mount and glove holder are built.

## Where the output differs from the reference script

- Ribs, window and strap slots scale with the cradle size so they stay valid at
  the smallest and largest cradles.
- The glove tube centre is limited so it never reaches the plate face at small
  cradle depths.
- The plate holds only the holes for the selected mount. The volume check uses a
  separate build with every pattern cut, to compare with `report.json`.
- The V-clamp strap tunnels are 4 mm closer to the plate. The wall under the V
  is 4.5 mm and the wall behind the tunnels is 3.5 mm.
- Calibration females carry one, two or three notches, so the volume is about
  3% under the single reference female.
- At cradle depth 60 the caddy and glove slot blocks extend about 5.5 mm past
  the module body. The parts stay valid and do not touch.

## Tests

`npm test` checks volumes against `reference/report.json`, mesh watertightness,
mating-pair overlap in the assembled pose, and all 320 combinations of the
extreme parameter values.
