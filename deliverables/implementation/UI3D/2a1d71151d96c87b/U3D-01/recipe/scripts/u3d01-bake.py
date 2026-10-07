"""Headless Blender only. Never touches a user's open Blender scene or source files."""
import bpy, sys, os, json, math, bmesh

args = sys.argv[sys.argv.index('--') + 1:]
assert bpy.app.version[:3] == (5, 2, 0), 'Pinned recipe requires Blender 5.2.0; review changes before upgrading'
reference, geometry, output, size = args[0], args[1], args[2], int(args[3])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=reference)
source = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
source.name = 'BAKE_SOURCE'
bpy.ops.import_scene.gltf(filepath=geometry)
target = next(o for o in bpy.context.scene.objects if o.type == 'MESH' and o != source)
target.name = 'BAKE_TARGET'
bpy.ops.object.select_all(action='DESELECT')
target.select_set(True)
bpy.context.view_layer.objects.active = target
# Reconnect coincident seam vertices and replace source charts. New charts avoid
# triangles crossing unrelated source UV islands after aggressive simplification.
bm = bmesh.new(); bm.from_mesh(target.data)
bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000001)
bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
bm.to_mesh(target.data); bm.free()
if target.data.has_custom_normals:
    target.data.normals_split_custom_set([(0, 0, 0)] * len(target.data.loops))
for face in target.data.polygons: face.use_smooth = True
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0035, area_weight=0.25)
bpy.ops.object.mode_set(mode='OBJECT')

material = bpy.data.materials.new('baked-ceramic-graphite'); material.use_nodes = True
target.data.materials.clear(); target.data.materials.append(material)
for face in target.data.polygons: face.material_index = 0
nodes, links = material.node_tree.nodes, material.node_tree.links
bsdf = nodes.get('Principled BSDF')
scene = bpy.context.scene
scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 1
scene.render.threads_mode = 'FIXED'; scene.render.threads = 12
scene.render.bake.use_selected_to_active = True
scene.render.bake.use_clear = True
scene.render.bake.cage_extrusion = 0.06
scene.render.bake.max_ray_distance = 0.16
scene.render.bake.margin = 4
scene.render.bake.use_pass_direct = False
scene.render.bake.use_pass_indirect = False
scene.render.bake.use_pass_color = True
source.select_set(True); target.select_set(True)
bpy.context.view_layer.objects.active = target
images = {}
os.makedirs(os.path.dirname(output), exist_ok=True)
for name, kind in [('baseColor', 'EMIT'), ('normal', 'NORMAL'), ('roughness', 'EMIT'), ('metallic', 'EMIT')]:
    image = bpy.data.images.new(name, width=size, height=size, alpha=False)
    image.colorspace_settings.name = 'sRGB' if name == 'baseColor' else 'Non-Color'
    tex = nodes.new('ShaderNodeTexImage'); tex.image = image
    nodes.active = tex
    restore = []
    if name in ('baseColor', 'roughness', 'metallic'):
        for mat in source.data.materials:
            nt = mat.node_tree
            surf = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
            original = surf.inputs['Surface'].links[0].from_socket
            principal = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
            socket = principal.inputs['Base Color' if name == 'baseColor' else name.capitalize()]
            emission = nt.nodes.new('ShaderNodeEmission')
            if socket.is_linked: nt.links.new(socket.links[0].from_socket, emission.inputs['Color'])
            else: emission.inputs['Color'].default_value = socket.default_value if name == 'baseColor' else [socket.default_value] * 3 + [1]
            nt.links.new(emission.outputs[0], surf.inputs['Surface'])
            restore.append((nt, emission, surf, original))
    bpy.ops.object.bake(type=kind)
    for nt, emission, surf, original in restore:
        nt.links.new(original, surf.inputs['Surface']); nt.nodes.remove(emission)
    image.filepath_raw = output + '-' + name + '.png'; image.file_format = 'PNG'; image.save()
    images[name] = (image, tex)
    print('BAKED', name, image.filepath_raw, flush=True)
links.new(images['baseColor'][1].outputs['Color'], bsdf.inputs['Base Color'])
normal = nodes.new('ShaderNodeNormalMap'); links.new(images['normal'][1].outputs['Color'], normal.inputs['Color']); links.new(normal.outputs['Normal'], bsdf.inputs['Normal'])
links.new(images['roughness'][1].outputs['Color'], bsdf.inputs['Roughness'])
links.new(images['metallic'][1].outputs['Color'], bsdf.inputs['Metallic'])
bpy.ops.object.select_all(action='DESELECT'); target.select_set(True)
bpy.context.view_layer.objects.active = target
bpy.ops.export_scene.gltf(filepath=output, export_format='GLB', use_selection=True, export_animations=False, export_yup=True, export_texcoords=True, export_normals=True, export_tangents=True, export_materials='EXPORT')
with open(output + '.json', 'w', encoding='utf-8') as stream:
    json.dump({'blender': bpy.app.version_string, 'triangles': len(target.data.polygons), 'textureResolution': size, 'reference': reference, 'geometry': geometry, 'cageExtrusion': .06, 'maxRayDistance': .16, 'margin': 4, 'newUV': 'smart project 66 degrees, margin .0035'}, stream, indent=2)
