# State

| File | Purpose |
|---|---|
| `configStore.ts` | Zustand store holding the current `Params`; every write is clamped |
| `persistence.ts` | URL hash encode and decode, localStorage save and load |
| `app.ts` | `startApp`: connects config, worker client, hash and autosave |
| `selectors.ts` | Derived values for the UI (active parts, build status) |

## Hash format

`#t=0.25&p=custom&w=62&d=44&h=100&g=125&gw=55&gl=tube&bw=132&bh=73&td=50&th=110&m=tape&pw=124&ph=170&v=1`

| Key | Field | Values |
|---|---|---|
| `t` | tolerance | 0.15 to 0.4 |
| `p` | probePreset | `custom`, `butterflyIQ3`, `vscanAirCL`, `clariusHD3` |
| `w` | cradleW | 30 to 80 |
| `d` | cradleD | 20 to 60 |
| `h` | holsterH | 100 to 160 |
| `g` | gelH | 85 to 200 |
| `gw` | gelW | 40 to 90 |
| `gl` | gloveMode | `tube`, `box` |
| `bw` | gloveBoxW | 90 to 180 |
| `bh` | gloveBoxH | 50 to 150 |
| `td` | tubeD | 40 to 90 |
| `th` | tubeH | 70 to 200 |
| `m` | mount | `tape`, `vesa`, `amps`, `magnets`, `ivpole` |
| `pw` | plateW | 120 to 250 |
| `ph` | plateH | 150 to 250 |
| `v` | version | `1` |

Decoding keeps valid fields only. Numbers are clamped to range and unknown enum
values are dropped. A hash with a different `v`, or with no usable field, is
ignored. Decoding never throws. Links made before a key existed still load; the
missing fields take their defaults.

## Load order

1. URL hash, if it decodes.
2. The localStorage autosave (key `pocus-rig-config`, stored as
   `{ v, params }`).
3. Defaults.

## Autosave

About 400 ms after the last change, the params are written to localStorage and
the hash is updated with `history.replaceState`, so edits do not add history
entries. A pending write is also flushed synchronously on `pagehide`, on
`beforeunload` and when the page becomes hidden (no dialogs), so a reload right
after a change or Reset to defaults keeps it. A `hashchange` event (for example, pasting a new link) loads the hash
over the defaults. Blocked or full storage is ignored silently.
