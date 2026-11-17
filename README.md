# POCUS Rig Configurator

A browser tool for sizing a modular, 3D-printable wall rig for a handheld
ultrasound probe: probe holster, gel-packet caddy, glove holder and wall plate.
You set a few measurements, the 3D model rebuilds in the page, and you download
files ready to print. Everything runs on your machine. There is no server, no
account and no tracking.

Credits: Dr. Mandeep Guragai and Manogya Guragai.

## Status

The geometry engine, the web worker that runs it and the 3D viewport are built
and tested. The settings panel, share links, and STL / 3MF downloads are still
to come, so the page currently shows a temporary set of developer controls.

## What it models

| Part | Notes |
|---|---|
| Probe holster | Tapered cradle sized from cradle width and depth, with a drain slot, front window and strap slots |
| Gel packet caddy | Height follows the packet height |
| Glove holder | Rolled-pair tube or glove box bracket, one at a time |
| Wall plate | Flat for tape, or VESA, RAM AMPS, magnet recesses |
| IV pole V-clamp | Built only for the IV pole mount |
| Calibration piece | A male block and three female blocks at the chosen clearance and 0.05 mm either side |

All modules slide onto the same vertical dovetail rail, so a part printed now
still fits one printed later at a different size. Units are millimetres and Z
is up.

Preset probe sizes are not measured yet. Check yours with calipers.

## Run it

Requires Node 20 or newer.

```sh
npm install
npm run dev
```

```sh
npm test            # geometry and worker tests
npm run typecheck
npm run build       # also regenerates public/default-assembly.bin
npm run preview
```

To check a build under a sub-path:

```sh
npx vite preview --base=/pocus-rig/ --port 4180
```

## How it is built

- Vite, React and strict TypeScript.
- `manifold-3d` (WebAssembly) does all solid geometry and boolean operations.
- Geometry runs in a web worker, so the page stays responsive. Changing one
  setting rebuilds only the parts that depend on it.
- `@react-three/fiber` draws the model. Switching between assembled and
  exploded views, X-ray and selection never start a rebuild.
- The first view uses a small prebuilt mesh, so the model appears before the
  WebAssembly module has loaded.

The geometry is a port of the Blender script in `reference/pocus_rig.py`. Where
the two differ the script wins, apart from two intentional changes: the strap
tunnels in the V-clamp sit 4 mm closer to the plate so the wall under the V is
4.5 mm, and the holster's bottom slot is called a drain. More detail is in
[`src/geometry/README.md`](src/geometry/README.md).

## Licence

MIT for the code, see [LICENSE](LICENSE). The models follow the POCUS Collective
library terms.
