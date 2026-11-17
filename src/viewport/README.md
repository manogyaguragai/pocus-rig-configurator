# Viewport

A React Three Fiber scene that draws the meshes the worker returns.

| File | Purpose |
|---|---|
| `Viewport.tsx` | Canvas, lighting, procedural environment, orbit controls, per-part meshes |
| `framing.ts` | Camera framing maths (`frameRig` for the initial and Reset view) |
| `layout.ts` | Caliper dimension line layout |
| `bed.ts` | Procedural bed textures |
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
that arrive with `frameRig`: the assembled rig fills about 60-70% of the viewport
height, and the camera backs off only as far as needed to keep the exploded pose
in frame (corner projection, not a bounding sphere). Reset view reframes the
same way for the parts present now. Later mount or glove changes do not reset the user's orbit.
