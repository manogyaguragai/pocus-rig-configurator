# POCUS Rig Configurator

A browser tool for sizing a modular, 3D-printable wall rig for a handheld
ultrasound probe: probe holster, gel packet caddy, glove holder and wall plate.
You set a few measurements, the 3D model rebuilds in the page, and you download
files to print. It runs entirely in your browser.

Made by [Dr. Mandeep Guragai](https://www.linkedin.com/in/mandeep-guragai-280589117/) and [Manogya Guragai](https://www.linkedin.com/in/manogya-guragai/).

## What you can download

- Part STL: one STL for the selected part, in print orientation.
- Print kit: a zip with an STL for every part in the current setup, one 3MF with
  all of them laid out on the bed, and `ASSEMBLY.txt` with the settings and
  assembly notes.
- Calibration piece: a zip with one male block and three female blocks (STL and
  3MF) at your clearance and 0.05 mm either side, to find the fit your printer
  needs.

Every part fits a 256 x 256 mm bed. The dovetail flanks are designed to print upright without supports; check overhangs in your slicer for the other features. Units are
millimetres.

## Using it

1. Print the calibration piece first. Try the male block in the three females,
   pick the one that slides with light hand pressure, and set Fit clearance to
   that value. Tolerance ranges from 0.15 to 0.40 mm in 0.05 mm steps.
2. Choose a probe preset or Custom size. With Custom, set cradle width (30 to
   80 mm) and cradle depth (20 to 60 mm) to the probe measured with calipers.
3. Set holster height (100 to 160 mm) and gel packet height (85 to 200 mm).
4. Choose the glove holder (rolled pairs or glove box) and the mount: adhesive
   tape, screws or VESA, RAM AMPS, magnets, or IV pole clamp.
5. Download the print kit, or select one part in the viewport and download its
   STL.

Viewport controls: drag to orbit, scroll to zoom, click a part to select it and
see its print dimensions. Assembled and Exploded switch the pose. X-ray makes the
parts transparent so the internal cuts show. None of these start a rebuild.

All modules slide onto the same vertical dovetail rail, so a part printed now
still fits one printed later at a different size.

## Run locally

Requires Node 20 or newer.

```sh
npm install
npm run dev
```

## Test

```sh
npm test            # about 30 s; includes all 320 parameter corner cases
npm run typecheck
```

## Build

```sh
npm run build       # regenerates public/default-assembly.bin, typechecks, bundles to dist/
npm run preview
```

The build uses relative asset paths (`base: './'`), so `dist/` works from the
site root or from a sub-path. To check a sub-path locally:

```sh
npx vite preview --base=/pocus-rig/ --port 4181
```

## Deploy to GitHub Pages

1. In the repository settings, open Pages and set the source to GitHub Actions.
2. Push to `main` (or run the workflow by hand from the Actions tab).
   `.github/workflows/deploy.yml` runs `npm ci`, `npm test` and `npm run build`,
   then publishes `dist/`.
3. The site appears at `https://<user>.github.io/<repo>/`.

Check that the WebAssembly file is served with the right type. The file name
carries a hash, so look it up in `dist/assets/` after a build (it is
`manifold-<hash>.wasm`):

```sh
curl -I https://<user>.github.io/<repo>/assets/manifold-<hash>.wasm
```

The response should be `200` with `content-type: application/wasm`.

## Embed in another page

```html
<iframe
  src="https://<user>.github.io/<repo>/"
  title="POCUS rig configurator"
  width="100%"
  height="720"
  style="border: 0"
  loading="lazy"
></iframe>
```

The configuration is stored in the URL hash, so a link or an iframe `src` can
open with a given setup:

```
https://<user>.github.io/<repo>/#t=0.3&p=custom&w=60&d=42&h=110&g=125&gl=box&m=vesa&v=1
```

Keys are `t` tolerance, `p` probe preset, `w` cradle width, `d` cradle depth,
`h` holster height, `g` gel packet height, `gl` glove holder (`tube` or `box`),
`m` mount (`tape`, `vesa`, `amps`, `magnets`, `ivpole`) and `v` format version
(currently `1`). Numbers outside the allowed range are clamped. The full table is in
[`src/state/README.md`](src/state/README.md).

## Privacy

Everything runs in the browser. There are no accounts, no analytics and no
requests to other servers; nothing you enter leaves the page. Your settings are
saved in the browser's localStorage and mirrored in the URL hash.

## Browser requirements

WebAssembly and WebGL, in a recent Chrome, Edge, Firefox or Safari.

## Limits

- Butterfly iQ3, Vscan Air CL and Clarius HD3 use the manufacturer's published
  body width and thickness plus 4 mm clearance in each. None of the presets
  are caliper-verified, so check your probe and use Custom size if it does not
  fit.
- Fit depends on your printer, material and slicer settings. Print the
  calibration piece before the full kit.
- This is not a medical device and has not been validated for clinical use.

## Project layout

| Path | Contents |
|---|---|
| `src/geometry/` | Parameters and the solid-model builders (Manifold, WebAssembly) |
| `src/worker/` | Web worker that runs builds, and the client that talks to it |
| `src/viewport/` | Three.js scene: poses, X-ray, dimension labels |
| `src/state/` | Configuration store, URL hash, autosave |
| `src/store/` | View and geometry stores |
| `src/exports/` | STL, 3MF, print kit zip and calibration piece |
| `src/ui/` | Panel, toolbar and layout |
| `scripts/` | Generates the prebuilt first-view mesh |
| `reference/` | Original Blender script and volume report used by the tests |

The geometry is a port of `reference/pocus_rig.py`; see
[`src/geometry/README.md`](src/geometry/README.md) for the differences.

## License

MIT for the code, see [LICENSE](LICENSE). The models follow the POCUS Collective
library terms.
