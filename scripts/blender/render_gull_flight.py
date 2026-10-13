import bpy
import math
import os
from pathlib import Path
from mathutils import Vector

REPO_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_ROOT = str(REPO_ROOT / "artwork" / "blender" / "renders" / "gull-flight")
BLEND_PATH = str(REPO_ROOT / "artwork" / "blender" / "marinecast-gull.blend")
FRAME_COUNT = 16


def material(name, color, roughness=0.82):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def smooth(obj):
    for polygon in getattr(obj.data, "polygons", []):
        polygon.use_smooth = True


def uv_part(name, location, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=18, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    smooth(obj)
    return obj


def cone_part(name, location, radius, depth, rotation, mat):
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=radius, radius2=radius * 0.12, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    smooth(obj)
    return obj


def wing_surface(name, side, mat):
    sy = side
    verts = [
        (0.00, 0.00, 0.00),
        (0.05, 0.78 * sy, 0.02),
        (-0.28, 1.52 * sy, -0.02),
        (-0.60, 2.22 * sy, -0.05),
        (-1.16, 2.86 * sy, -0.08),
        (-0.62, 2.42 * sy, -0.18),
        (-0.10, 1.56 * sy, -0.20),
        (0.42, 0.45 * sy, -0.13),
    ]
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(verts, [], [tuple(range(len(verts)))])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(mat)
    solidify = obj.modifiers.new("Feather thickness", "SOLIDIFY")
    solidify.thickness = 0.035
    bevel = obj.modifiers.new("Soft feather edge", "BEVEL")
    bevel.width = 0.025
    bevel.segments = 2
    return obj


def feather(name, side, index, parent, mat):
    sy = side
    length = 0.82 + index * 0.09
    y = sy * (2.25 + index * 0.13)
    x = -0.42 - index * 0.13
    z = -0.12 - index * 0.015
    obj = uv_part(name, (x, y, z), (length, 0.105, 0.035), mat)
    obj.rotation_euler[2] = sy * (0.17 + index * 0.035)
    obj.parent = parent
    return obj


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def key(obj, frame, rotation=None, location=None, scale=None):
    if rotation is not None:
        obj.rotation_euler = rotation
        obj.keyframe_insert("rotation_euler", frame=frame)
    if location is not None:
        obj.location = location
        obj.keyframe_insert("location", frame=frame)
    if scale is not None:
        obj.scale = scale
        obj.keyframe_insert("scale", frame=frame)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        pass


clear_scene()
os.makedirs(OUTPUT_ROOT, exist_ok=True)

white = material("Warm white feathers", (0.83, 0.86, 0.84))
underside = material("Cool feather shadow", (0.50, 0.58, 0.60))
dark = material("Primary tips", (0.11, 0.16, 0.18))
beak_mat = material("Beak", (0.77, 0.52, 0.18))
eye_mat = material("Eye", (0.008, 0.012, 0.014), 0.4)

root = bpy.data.objects.new("Gull flight root", None)
bpy.context.collection.objects.link(root)

body = uv_part("Body", (0.0, 0.0, 0.0), (1.12, 0.46, 0.50), white)
body.rotation_euler[1] = math.radians(-4)
body.parent = root
chest = uv_part("Chest", (0.58, 0.0, 0.05), (0.58, 0.39, 0.44), white)
chest.parent = root
head = uv_part("Head", (1.05, 0.0, 0.26), (0.39, 0.35, 0.38), white)
head.parent = root
beak = cone_part("Beak", (1.47, 0.0, 0.22), 0.17, 0.58, (0.0, math.radians(90), 0.0), beak_mat)
beak.parent = root
for side in (-1, 1):
    eye = uv_part(f"Eye {side}", (1.28, 0.24 * side, 0.36), (0.052, 0.028, 0.052), eye_mat)
    eye.parent = root

tail_center = cone_part("Tail center", (-1.18, 0.0, 0.02), 0.31, 1.28, (0.0, math.radians(-90), 0.0), white)
tail_center.parent = root
for side in (-1, 1):
    tail = cone_part(f"Tail feather {side}", (-1.22, 0.22 * side, 0.0), 0.19, 1.18, (0.0, math.radians(-90), math.radians(7 * side)), underside)
    tail.parent = root

wings = []
for side in (-1, 1):
    shoulder = bpy.data.objects.new(f"Shoulder {side}", None)
    shoulder.location = (0.16, 0.29 * side, 0.20)
    bpy.context.collection.objects.link(shoulder)
    shoulder.parent = root
    wing = wing_surface(f"Wing {side}", side, underside)
    wing.parent = shoulder
    for index in range(5):
        feather(f"Primary {side} {index}", side, index, shoulder, dark if index > 1 else underside)
    wings.append(shoulder)

# Broad, asymmetric downstroke and a quicker folded upstroke.
poses = [
    (1, 8, 0),
    (3, -12, 4),
    (5, -38, 9),
    (7, -58, 13),
    (9, -34, 8),
    (11, 7, -2),
    (13, 42, -11),
    (15, 24, -6),
    (17, 8, 0),
]
for frame, flap_deg, sweep_deg in poses:
    for side, shoulder in zip((-1, 1), wings):
        key(shoulder, frame, (
            math.radians(flap_deg * side),
            math.radians(sweep_deg),
            math.radians(2 * side),
        ))
    bob = -0.035 if flap_deg < -20 else 0.018
    pitch = math.radians(2.2 if flap_deg < -20 else -1.2)
    key(root, frame, (0.0, pitch, 0.0), (0.0, 0.0, bob))

bpy.ops.object.light_add(type="AREA", location=(2.5, -4.0, 6.0))
key_light = bpy.context.object
key_light.name = "Sky key"
key_light.data.energy = 900
key_light.data.shape = "DISK"
key_light.data.size = 5.0
look_at(key_light, (0, 0, 0))
bpy.ops.object.light_add(type="AREA", location=(-4.0, 3.5, 2.5))
fill_light = bpy.context.object
fill_light.name = "Ocean fill"
fill_light.data.energy = 480
fill_light.data.color = (0.48, 0.78, 0.88)
fill_light.data.size = 4.0
look_at(fill_light, (0, 0, 0))

bpy.ops.object.camera_add(location=(8.6, -10.5, 6.8))
camera = bpy.context.object
camera.name = "MarineCast gull camera"
camera.data.type = "ORTHO"
camera.data.ortho_scale = 7.4
look_at(camera, (0.0, 0.0, 0.0))
bpy.context.scene.camera = camera

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 320
scene.render.resolution_y = 240
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.color_depth = "8"
scene.render.resolution_percentage = 100
scene.render.image_settings.compression = 12
scene.view_settings.look = "AgX - Medium High Contrast"
scene.render.filepath = os.path.join(OUTPUT_ROOT, "gull-")
scene.frame_start = 1
scene.frame_end = 16
scene.render.fps = 24

world = scene.world
world.color = (0.02, 0.03, 0.04)
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.18

bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

for output_index in range(FRAME_COUNT):
    scene.frame_set(output_index + 1)
    scene.render.filepath = os.path.join(OUTPUT_ROOT, f"gull-{output_index:02d}.png")
    bpy.ops.render.render(write_still=True)

print(f"Rendered {FRAME_COUNT} gull frames to {OUTPUT_ROOT}")
