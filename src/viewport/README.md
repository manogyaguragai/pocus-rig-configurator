# Viewport

A React Three Fiber scene that draws the meshes the worker returns.

| File | Purpose |
|---|---|
| `Viewport.tsx` | Canvas, lighting, bed outline, orbit controls, per-part meshes |
| `pose.ts` | Pose offsets, scene bounds, length formatting, easing |
| `Dimensions.tsx` | Dimension lines and labels for the selected part |

## Poses

Meshes arrive in the Blender frame. `poseOffset(id, t)` interpolates between
`assemblyOffset(id, false)` and `assemblyOffset(id, true)` from
`src/geometry/placement.ts`, with t from 0 (assembled) to 1 (exploded). The move
takes 0.22 s with an ease-out curve. Switching pose only moves groups; it never
asks the worker for a build.

## X-ray

X-ray makes the parts transparent (opacity 0.22, double sided) and draws their
edges. A selected part also shows its edges and a slight highlight.

## Dimensions

Selecting a part draws its bounding box with length labels, from the mesh
positions. The status bar shows the print-orientation size from the worker's
`printBbox`.

## Camera

The canvas renders on demand. The camera is framed once, on the first meshes
that arrive, so later mount or glove changes do not reset the user's orbit.
