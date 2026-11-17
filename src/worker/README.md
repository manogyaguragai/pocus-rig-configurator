# Worker

Runs geometry builds off the main thread.

| File | Purpose |
|---|---|
| `protocol.ts` | Message types: `build` request; `result`, `error` and `ready` responses |
| `geometry.worker.ts` | Worker entry. Loads the WebAssembly module, posts `ready`, answers build requests |
| `buildJob.ts` | Builds the requested parts and collects the meshes. Also runs in Node for tests |
| `client.ts` | `GeometryClient`: debounce, scoped rebuilds, stale job handling |
| `defaultMesh.ts`, `defaultMeshFormat.ts` | Load and decode `default-assembly.bin`, the prebuilt first view |

## Protocol

A `build` request carries a `jobId`, the full clamped `Params` and the list of
parts to rebuild. The result returns, per part, positions, indices, the print
bounding box and the volume. Meshes are in the Blender frame (no assembly lift,
exploded offset or print rotation); the viewport applies the pose itself. Typed
arrays are transferred, not copied.

## Scoped rebuilds

`partsToBuild(prev, next)` compares the last applied params with the new ones and
returns only the active parts that are new or whose entries in `PART_DEPS` changed.
Untouched parts keep their previous meshes. Requests are debounced (200 ms by
default).

## Stale jobs

Each flush increments `jobId`. A response whose id is not the current in-flight
job is ignored. The next diff is made against the last applied params, so the
parts of a superseded job are rebuilt in the next one.

## First view

`seed()` shows the prebuilt default assembly before the worker is ready. When the
seed carries the params it was built from, the first edit rebuilds only the
parts that depend on it.
