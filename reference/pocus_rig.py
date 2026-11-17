"""
POCUS Collective challenge - Modular POCUS Rig & Stand
Procedural, parametric master assembly for Blender 4.2+ / 5.x (bpy).

Run inside Blender: Scripting tab -> Open -> Run Script.
Or headless:      blender -b -P pocus_rig.py   (or python with the `bpy` wheel)

Units: 1 Blender unit = 1 mm (scene scale_length 0.001). Z is up.
All modules slide on one vertical dovetail standard (rail along Z),
printed upright so the dovetail flanks need no supports.
"""
import bpy, bmesh, math
from mathutils import Matrix, Vector

# ---------------------------------------------------------------- PARAMETERS
TOL = 0.25            # printer clearance per mating surface (mm)
RAIL_BASE = 10.0      # dovetail width at parent face
RAIL_TIP = 16.0       # dovetail width at tip (undercut)
RAIL_H = 5.0          # dovetail height
RAIL_Z0, RAIL_Z1 = 10.0, 80.0   # rail span on every parent (holster-local z)
BLOCK_HALF = 12.5     # half-width of the female slot block
BLOCK_T = 8.6         # slot block thickness (incl. 0.6 embed into module body)
PIN_R = 1.7           # M3 / 3 mm pin anti-lift hole radius
PIN_Z = 40.0

# Probe cradle (inner cavity). Measure your probe: widest width x thickness + ~4 mm.
PROBE = dict(top_w=62.0, top_d=44.0, bot_w=54.0, bot_d=36.0)
HOLSTER = dict(w=70.0, d=52.0, h=100.0, floor=6.0)
GEL = dict(w=55.0, h=125.0, d=35.0, wall=3.0)            # US single-use packets
GLOVE_TUBE = dict(r_in=25.0, wall=3.0, h=110.0, gap=34.0)  # Mode A, 3-5 rolled pairs
GLOVE_BOX = dict(w=130.0 + 2, d=85.0 + 2, wall_h=73.0)    # Mode B, box stands on its 245 end
PLATE = dict(w=124.0, h=170.0, t=8.0, z0=-35.0)

OUT_DIR = bpy.path.abspath("//") or "/tmp/"

# ---------------------------------------------------------------- SCENE SETUP
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    us = sc.unit_settings
    us.system = 'METRIC'
    us.scale_length = 0.001
    us.length_unit = 'MILLIMETERS'
    sc.frame_start, sc.frame_end = 1, 60
    return sc

def collection(name, parent=None):
    col = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(col)
    return col

# ---------------------------------------------------------------- MESH HELPERS
WORK = None

def to_obj(name, bm, col=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    (col or WORK).objects.link(ob)
    return ob

def box(name, x0, x1, y0, y1, z0, z1, bevel=0.0, segs=3):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((x0 if v.co.x < 0 else x1,
                       y0 if v.co.y < 0 else y1,
                       z0 if v.co.z < 0 else z1))
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=segs,
                        profile=0.5, affect='EDGES', clamp_overlap=True)
    return to_obj(name, bm)

def frustum(name, cx, cy, z0, z1, bw, bd, tw, td):
    """Tapered box: bottom bw x bd at z0, top tw x td at z1."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        top = v.co.z > 0
        w, d = (tw, td) if top else (bw, bd)
        v.co = Vector((cx + math.copysign(w / 2, v.co.x),
                       cy + math.copysign(d / 2, v.co.y),
                       z1 if top else z0))
    return to_obj(name, bm)

def cyl(name, r, axis, c, a0, a1, segs=64):
    """Cylinder along axis 'x'|'y'|'z'; c = centre in the other two axes."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs,
                          radius1=r, radius2=r, depth=abs(a1 - a0))
    mid = (a0 + a1) / 2
    if axis == 'z':
        M = Matrix.Translation((c[0], c[1], mid))
    elif axis == 'y':
        M = Matrix.Translation((c[0], mid, c[1])) @ Matrix.Rotation(math.radians(90), 4, 'X')
    else:
        M = Matrix.Translation((mid, c[0], c[1])) @ Matrix.Rotation(math.radians(90), 4, 'Y')
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    return to_obj(name, bm)

def prism_z(name, pts, z0, z1):
    """Extrude a simple XY polygon along Z."""
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, z0)) for x, y in pts]
    hi = [bm.verts.new((x, y, z1)) for x, y in pts]
    bm.faces.new(lo); bm.faces.new(hi)
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return to_obj(name, bm)

def boolean(target, cutter, op='DIFFERENCE'):
    m = target.modifiers.new("bool", 'BOOLEAN')
    m.operation = op
    m.object = cutter
    try:
        m.solver = 'MANIFOLD'
    except TypeError:
        m.solver = 'EXACT'
    dg = bpy.context.evaluated_depsgraph_get()
    new_me = bpy.data.meshes.new_from_object(target.evaluated_get(dg))
    old = target.data
    target.modifiers.remove(m)
    target.data = new_me
    bpy.data.meshes.remove(old)
    bpy.data.objects.remove(cutter, do_unlink=True)
    return target

def cut(t, c):   return boolean(t, c, 'DIFFERENCE')
def union(t, c): return boolean(t, c, 'UNION')

# ---------------------------------------------------------------- DOVETAIL STANDARD
class RailFrame:
    """Frame on a parent face: P = rail centre on face (x,y), N = outward normal,
    S = across-rail direction. Local (s,t) -> world (x,y)."""
    def __init__(self, P, N, S):
        self.P, self.N, self.S = Vector(P), Vector(N), Vector(S)
    def xy(self, s, t):
        p = self.P + self.S * s + self.N * t
        return (p.x, p.y)
    def bounds(self, s0, s1, t0, t1):
        pts = [self.xy(s, t) for s in (s0, s1) for t in (t0, t1)]
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        return min(xs), max(xs), min(ys), max(ys)

def male_profile():
    b, t = RAIL_BASE / 2, RAIL_TIP / 2
    return [(-b, -0.6), (b, -0.6), (b, 0), (t, RAIL_H), (-t, RAIL_H), (-b, 0)]

def female_profile():
    # male flank offset perpendicular by TOL, tip clearance TOL
    b, t, h = RAIL_BASE / 2, RAIL_TIP / 2, RAIL_H
    slope = (t - b) / h
    off = TOL * math.sqrt(1 + slope ** 2)
    hd = h + TOL
    s0 = b + off
    s1 = b + slope * hd + off
    return [(-s0, -1.0), (s0, -1.0), (s0, 0), (s1, hd), (-s1, hd), (-s0, 0)]

def add_male_rail(parent, fr, name):
    rail = prism_z(name, [fr.xy(s, t) for s, t in male_profile()], RAIL_Z0, RAIL_Z1)
    union(parent, rail)
    pin_hole(parent, fr)

def pin_hole(obj, fr):
    p = fr.xy(0, RAIL_H / 2)
    axis = 'x' if abs(fr.S.x) > 0.5 else 'y'
    span = BLOCK_HALF + 2
    if axis == 'x':
        c = cyl("pin", PIN_R, 'x', (p[1], PIN_Z), p[0] - span, p[0] + span, 32)
    else:
        c = cyl("pin", PIN_R, 'y', (p[0], PIN_Z), p[1] - span, p[1] + span, 32)
    cut(obj, c)

def add_female_block(module, fr, z_top=84.0):
    """Slot block on module, gap TOL to the parent face, slot open at bottom,
    closed cap on top that rests on the rail top (gravity stop)."""
    x0, x1, y0, y1 = fr.bounds(-BLOCK_HALF, BLOCK_HALF, TOL, BLOCK_T)
    union(module, box("blk", x0, x1, y0, y1, 0, z_top, bevel=0.8, segs=2))
    slot = prism_z("slot", [fr.xy(s, t) for s, t in female_profile()], -1.0, RAIL_Z1 + TOL)
    cut(module, slot)
    pin_hole(module, fr)

# ---------------------------------------------------------------- MODULES
H = HOLSTER
HC_Y = -8.0 - H['d'] / 2            # holster body centre y (-34)
FR_PLATE = RailFrame((0, 0), (0, -1), (1, 0))                 # plate front -> holster back
FR_RIGHT = RailFrame((H['w'] / 2, HC_Y), (1, 0), (0, 1))      # holster +X -> gel caddy
FR_LEFT = RailFrame((-H['w'] / 2, HC_Y), (-1, 0), (0, -1))    # holster -X -> glove module

def make_holster():
    w, d, h = H['w'], H['d'], H['h']
    ob = box("POCUS_Holster", -w / 2, w / 2, -8 - d, -8, 0, h, bevel=3)
    # tapered probe cradle, open top
    cut(ob, frustum("cav", 0, HC_Y, H['floor'], h + 5,
                    PROBE['bot_w'], PROBE['bot_d'], PROBE['top_w'] + 0.2, PROBE['top_d'] + 0.2))
    # acoustic-lens bumper ribs on the floor (print in TPU-lined or wrap with 1 mm TPU pad)
    for cx in (-21, -12, 12, 21):
        union(ob, box("rib", cx - 1.25, cx + 1.25, HC_Y - 16, HC_Y + 16, H['floor'] - 0.5, H['floor'] + 3))
    # bottom cord-relief / charging pass-through slot
    cut(ob, box("cord", -7, 7, -8 - d - 1, HC_Y + 6, -1, 30, bevel=1))
    # front viewing / grab window
    cut(ob, box("win", -15, 15, -8 - d - 5, HC_Y - 11, 38, 80, bevel=3))
    # high-G retention strap loop: 27 mm slots front + back above the slot block
    cut(ob, box("strapF", -13.5, 13.5, -8 - d - 2, HC_Y - 12, 88, 92))
    cut(ob, box("strapB", -13.5, 13.5, HC_Y + 12, -6, 88, 92))
    # female slot to wall plate + male rails both sides
    add_female_block(ob, FR_PLATE)
    add_male_rail(ob, FR_RIGHT, "railR")
    add_male_rail(ob, FR_LEFT, "railL")
    return ob

def make_gel_caddy():
    g = GEL; wl = g['wall']
    x0 = H['w'] / 2 + BLOCK_T - 0.6           # 43
    x1 = x0 + g['w'] + 2 * wl                 # 104
    y1 = -8.0; y0 = y1 - (g['d'] + 2 * wl)    # back aligned with holster body
    ob = box("Gel_Packet_Caddy", x0, x1, y0, y1, 0, g['h'] + wl, bevel=2)
    cut(ob, box("cav", x0 + wl, x1 - wl, y0 + wl, y1 - wl, wl, g['h'] + 10))
    cx = (x0 + x1) / 2
    cut(ob, box("view", cx - 7.5, cx + 7.5, y0 - 3, y0 + 5, 35, g['h'] - 13, bevel=2))
    cut(ob, box("disp", x0 + 8, x1 - 8, y0 - 3, y0 + 5, wl, 15))
    cut(ob, cyl("thumb", 15, 'y', (cx, 15), y0 - 3, y0 + 5))
    add_female_block(ob, FR_RIGHT)
    return ob

def make_glove_tube():
    g = GLOVE_TUBE
    ro = g['r_in'] + g['wall']
    cx = -(H['w'] / 2 + BLOCK_T - 0.6) - ro    # -71
    ob = cyl("Glove_Side_Module", ro, 'z', (cx, HC_Y), 0, g['h'], 96)
    union(ob, box("web", cx + 15, -H['w'] / 2 - BLOCK_T + 0.4, HC_Y - 12, HC_Y + 12, 0, g['h']))
    cut(ob, cyl("bore", g['r_in'], 'z', (cx, HC_Y), g['wall'], g['h'] + 5, 96))
    # C-clip grab gap (34 mm < 50 mm bore -> sprung retention)
    cut(ob, box("gap", cx - g['gap'] / 2, cx + g['gap'] / 2, HC_Y - ro - 8, HC_Y - 16, 12, g['h'] + 5))
    cut(ob, cyl("push", 10, 'z', (cx, HC_Y), -1, g['wall'] + 1))
    add_female_block(ob, FR_LEFT)
    return ob

def make_glove_box():
    g = GLOVE_BOX; wl = 3.0
    x1 = -(H['w'] / 2 + BLOCK_T - 0.6)        # -43
    x0 = x1 - (g['w'] + 2 * wl)
    y1 = -8.0; y0 = y1 - (g['d'] + 2 * wl)
    ob = box("Glove_Side_Module_BoxBracket", x0, x1, y0, y1, 0, g['wall_h'], bevel=2)
    cut(ob, box("cav", x0 + wl, x1 - wl, y0 + wl, y1 - wl, wl, g['wall_h'] + 10))
    cut(ob, box("win", x0 + 16, x1 - 16, y0 - 3, y0 + 6, 18, g['wall_h'] + 10, bevel=3))
    # strap slots in side walls for a band over the upright 245 mm box
    for zc in (55,):
        cut(ob, box("bandL", x0 - 1, x0 + wl + 1, y0 + 20, y1 - 20, zc, zc + 4))
    add_female_block(ob, FR_LEFT)
    return ob

def make_plate():
    p = PLATE
    z0, z1 = p['z0'], p['z0'] + p['h']
    ob = box("Universal_Mount_Plate", -p['w'] / 2, p['w'] / 2, 0, p['t'], z0, z1, bevel=3)
    add_male_rail(ob, FR_PLATE, "railP")
    t = p['t']
    holes = []
    holes += [(sx * 37.5, 50 + sz * 37.5) for sx in (-1, 1) for sz in (-1, 1)]   # VESA 75
    holes += [(sx * 50.0, 50 + sz * 50.0) for sx in (-1, 1) for sz in (-1, 1)]   # VESA 100
    holes += [(sx * 15.0, 50 + sz * 19.0) for sx in (-1, 1) for sz in (-1, 1)]   # AMPS 30x38
    for x, z in holes:
        cut(ob, cyl("h", 2.25, 'y', (x, z), -1, t + 1, 32))          # M4 clearance
        cut(ob, cyl("cb", 4.25, 'y', (x, z), -1, 3.0, 32))           # head counterbore (front)
    # drywall / bulkhead keyholes (M4/M5 pan head)
    for zc in (z0 + 15, z1 - 25):
        cut(ob, cyl("kh", 5.2, 'y', (0, zc), -1, t + 1, 48))
        cut(ob, box("ks", -2.6, 2.6, -1, t + 1, zc, zc + 10))
        cut(ob, box("kp", -5.2, 5.2, t - 4, t + 1, zc, zc + 10))
    # magnetic puck recesses on back: 20 mm x 4 mm neodymium discs (glue in)
    for x in (-40, 40):
        for zc in (z0 + 15, z1 - 15):
            cut(ob, cyl("mag", 10.2, 'y', (x, zc), t - 4, t + 1, 64))
    return ob

def make_vclamp():
    t = PLATE['t']; y0, y1 = t, t + 25
    ob = box("Mount_IV_Pole_VClamp", -30, 30, y0, y1, 15, 85, bevel=2)
    cut(ob, prism_z("v", [(-13, y1 + 1), (13, y1 + 1), (0, y1 - 13)], 14, 86))   # 90 deg V, 20-40 mm tubes
    for sx in (-1, 1):
        for sz in (-1, 1):
            cut(ob, cyl("ins", 2.8, 'y', (sx * 15, 50 + sz * 19), y0 - 1, y0 + 6, 32))  # M4 heat-set
    cut(ob, box("hose", -31, 31, y0 + 7.5, y0 + 11.5, 44, 56))      # hose clamp / Velcro
    for zc in (21, 74):
        cut(ob, box("zip", -31, 31, y0 + 7.5, y0 + 11.5, zc, zc + 5))  # zip ties
    return ob

def make_calibration():
    """10 mm tall dovetail test: male rail block + female slot block at TOL."""
    fr = RailFrame((0, 0), (0, -1), (1, 0))
    male = box("Calib_Male", -15, 15, 0, 8, 0, 10, bevel=0.6, segs=2)
    union(male, prism_z("r", [fr.xy(s, t) for s, t in male_profile()], 0, 10))
    fem = box("Calib_Female", -BLOCK_HALF, BLOCK_HALF, -BLOCK_T + 0.6, -TOL, 0, 10, bevel=0.6, segs=2)
    cut(fem, prism_z("s", [fr.xy(s, t) for s, t in female_profile()], -1, 11))
    for o in (male, fem):
        o.location.x += 170
    return male, fem

# ---------------------------------------------------------------- MATERIALS
def material(name, rgb, rough):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    m.diffuse_color = (*rgb, 1)
    return m

# ---------------------------------------------------------------- BUILD
def build():
    global WORK
    sc = reset_scene()
    root = collection("POCUS_Rig")
    WORK = collection("_work", root)
    variants = collection("Variants", root)
    ref = collection("Reference")
    calib_col = collection("Calibration", root)

    slate = material("Medical_Slate_Grey", (0.13, 0.16, 0.19), 0.55)
    teal = material("EMS_HiVis_Teal", (0.0, 0.55, 0.45), 0.35)

    parts = dict(
        plate=make_plate(), holster=make_holster(), gel=make_gel_caddy(),
        glove=make_glove_tube(), glovebox=make_glove_box(), vclamp=make_vclamp())
    cm, cf = make_calibration()

    for k, o in list(parts.items()) + [('plate', cm), ('holster', cf)]:
        o.data.materials.clear()
        o.data.materials.append(slate if k in ('plate', 'vclamp') else teal)
        for poly in o.data.polygons:
            poly.material_index = 0

    # move into final collections; lift so plate bottom sits on z=0
    lift = -PLATE['z0']
    for o in list(WORK.objects):
        WORK.objects.unlink(o)
        tgt = variants if o.name in ("Glove_Side_Module_BoxBracket", "Mount_IV_Pole_VClamp") else (
            calib_col if o.name.startswith("Calib") else root)
        tgt.objects.link(o)
        o.location.z += lift
        bpy.context.view_layer.objects.active = o
    bpy.data.collections.remove(WORK)
    for o in (parts['glovebox'],):
        o.hide_viewport = o.hide_render = True

    # 256^3 build volume reference
    WORK = ref
    bv = box("Build_Volume_256", -128, 128, -168, 88, 0, 256)
    bv.display_type = 'WIRE'; bv.hide_render = True; bv.hide_select = True

    # assembled (frame 1) -> exploded (frame 48)
    explode = {
        "POCUS_Holster": (0, -60, 25), "Gel_Packet_Caddy": (45, -60, 25),
        "Glove_Side_Module": (-45, -60, 25), "Glove_Side_Module_BoxBracket": (-45, -60, 25),
        "Universal_Mount_Plate": (0, 0, 0), "Mount_IV_Pole_VClamp": (0, 45, 0)}
    for name, d in explode.items():
        o = bpy.data.objects[name]
        base = o.location.copy()
        o.keyframe_insert("location", frame=1)
        o.location = base + Vector(d)
        o.keyframe_insert("location", frame=48)
        o.location = base
    sc.frame_set(1)
    return parts, (cm, cf)

if __name__ == "__main__":
    build()
