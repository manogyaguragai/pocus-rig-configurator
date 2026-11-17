# State

| File | Purpose |
|---|---|
| `configStore.ts` | Zustand store holding the current `Params`; every write is clamped |
| `persistence.ts` | URL hash encode and decode, localStorage save and load |
| `app.ts` | `startApp`: connects config, worker client, hash and autosave |
| `selectors.ts` | Derived values for the UI (active parts, build status) |

## Hash format

`#t=0.25&p=custom&w=62&d=44&h=100&g=125&gl=tube&m=tape&v=1`

| Key | Field | Values |
|---|---|---|
| `t` | tolerance | 0.15 to 0.4 |
| `p` | probePreset | `custom`, `butterflyIQ3`, `vscanAirCL`, `clariusHD3` |
| `w` | cradleW | 30 to 80 |
| `d` | cradleD | 20 to 60 |
| `h` | holsterH | 100 to 160 |
| `g` | gelH | 85 to 200 |
| `gl` | gloveMode | `tube`, `box` |
| `m` | mount | `tape`, `vesa`, `amps`, `magnets`, `ivpole` |
| `v` | version | `1` |

Decoding keeps valid fields only. Numbers are clamped to range and unknown enum
values are dropped. A hash with a different `v`, or with no usable field, is
ignored. Decoding never throws.

## Load order

1. URL hash, if it decodes.
2. The localStorage autosave (key `pocus-rig-config`, stored as
   `{ v, params }`).
3. Defaults.

## Autosave

About 400 ms after the last change, the params are written to localStorage and
the hash is updated with `history.replaceState`, so edits do not add history
entries. A `hashchange` event (for example, pasting a new link) loads the hash
over the defaults. Blocked or full storage is ignored silently.
