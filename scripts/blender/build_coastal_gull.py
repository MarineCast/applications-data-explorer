"""Build an original, editable coastal gull, armature, and looping flight action.

Blender 5.2: --background --python build_coastal_gull.py -- --output PATH [--preview]
Coordinates: +X bill, +/-Y wings, +Z back. No external asset dependencies.
"""
import argparse
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector, Quaternion

p = argparse.ArgumentParser()
p.add_argument('--output', required=True)
p.add_argument('--preview', action='store_true')
args = p.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
OUT = Path(args.output).resolve()
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'frames').mkdir(exist_ok=True)
N = 32
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1024
scene.render.resolution_y = 768
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = True
scene.render.fps = 48
scene.frame_start, scene.frame_end = 1, N
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'

def mat(name, rgb, grain=.035, rough=.84):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    nt = m.node_tree
    shader = nt.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = rough
    shader.inputs['Specular IOR Level'].default_value = .18
    tex = nt.nodes.new('ShaderNodeTexNoise')
    tex.inputs['Scale'].default_value = 38
    tex.inputs['Detail'].default_value = 2.4
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*(max(0,c-grain) for c in rgb),1)
    ramp.color_ramp.elements[1].color = (*(min(1,c+grain) for c in rgb),1)
    nt.links.new(tex.outputs['Fac'],ramp.inputs[0])
    nt.links.new(ramp.outputs[0],shader.inputs['Base Color'])
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .10
    bump.inputs['Distance'].default_value = .018
    nt.links.new(tex.outputs['Fac'],bump.inputs['Height'])
    nt.links.new(bump.outputs[0],shader.inputs['Normal'])
    return m

ivory = mat('01 | warm porcelain plumage',(.79,.81,.76),.025)
mantle = mat('02 | marine slate upperwing',(.11,.15,.17),.012)
covert = mat('03 | pearl grey coverts',(.125,.17,.19),.010)
under = mat('04 | shaded feather underside',(.60,.65,.64),.022)
charcoal = mat('05 | charcoal outer primaries',(.014,.02,.027),.006)
yellow = mat('06 | muted ochre bill',(.69,.43,.09),.013)
red = mat('07 | vermilion gonys spot',(.48,.105,.055),.012)
pink = mat('08 | tucked rose feet',(.40,.25,.22),.012)
eye = mat('09 | dark umber eye',(.018,.012,.009),0,.27)
rim = mat('10 | ochre orbital ring',(.47,.29,.10),.008)
seam = mat('11 | bill seam',(.18,.13,.08),0)

def marked_feather(base, mirror=False):
    m=base.copy();m.name=base.name+(' | white mirror' if mirror else ' | ivory edge')
    nt=m.node_tree;nodes=nt.nodes;links=nt.links
    bs=nodes.get('Principled BSDF')
    original=bs.inputs['Base Color'].links[0].from_socket
    uv=nodes.new('ShaderNodeTexCoord');split=nodes.new('ShaderNodeSeparateXYZ');links.new(uv.outputs['UV'],split.inputs[0])
    edge=nodes.new('ShaderNodeMapRange');edge.clamp=True
    edge.inputs['From Min'].default_value=.94;edge.inputs['From Max'].default_value=.99
    links.new(split.outputs['X'],edge.inputs['Value'])
    mask=edge.outputs[0]
    if mirror:
        subtract=nodes.new('ShaderNodeVectorMath');subtract.operation='SUBTRACT';subtract.inputs[1].default_value=(.78,.5,0)
        links.new(uv.outputs['UV'],subtract.inputs[0])
        stretch=nodes.new('ShaderNodeVectorMath');stretch.operation='MULTIPLY';stretch.inputs[1].default_value=(8,3,1)
        links.new(subtract.outputs[0],stretch.inputs[0])
        length=nodes.new('ShaderNodeVectorMath');length.operation='LENGTH';links.new(stretch.outputs[0],length.inputs[0])
        spot=nodes.new('ShaderNodeMapRange');spot.inputs['From Min'].default_value=.8;spot.inputs['From Max'].default_value=.98
        spot.inputs['To Min'].default_value=1;spot.inputs['To Max'].default_value=0;links.new(length.outputs['Value'],spot.inputs['Value'])
        combine=nodes.new('ShaderNodeMath');combine.operation='MAXIMUM';links.new(edge.outputs[0],combine.inputs[0]);links.new(spot.outputs[0],combine.inputs[1]);mask=combine.outputs[0]
    mix=nodes.new('ShaderNodeMixRGB');links.new(mask,mix.inputs[0]);links.new(original,mix.inputs[1]);mix.inputs[2].default_value=(.82,.83,.78,1)
    links.new(mix.outputs[0],bs.inputs['Base Color'])
    return m
secondary_mat=marked_feather(covert)
primary_mirror=marked_feather(charcoal,True)
primary_tip=marked_feather(charcoal)

model = bpy.data.collections.new('GULL | original meshes')
scene.collection.children.link(model)
studio = bpy.data.collections.new('STUDIO | cameras and lighting')
scene.collection.children.link(studio)

def move_collection(obj, coll=model):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    coll.objects.link(obj)

def mesh_obj(name, verts, faces, materials, indices=None, subdivision=0):
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    model.objects.link(obj)
    for m in materials: mesh.materials.append(m)
    for i,f in enumerate(mesh.polygons):
        f.use_smooth=True
        if indices: f.material_index=indices[i]
    if subdivision:
        sub=obj.modifiers.new('Smooth anatomical contour','SUBSURF')
        sub.levels=subdivision
        sub.render_levels=subdivision
    return obj

# A single continuous body-neck-head surface avoids a toy-like ball-and-cylinder silhouette.
rings=[(-1.15,.025,.03,.03),(-1.02,.15,.16,.025),(-.79,.27,.26,.01),
       (-.40,.34,.33,.015),(.03,.345,.37,.035),(.39,.31,.34,.07),
       (.63,.255,.29,.13),(.78,.205,.26,.22),(.91,.205,.255,.30),
       (1.08,.218,.25,.34),(1.24,.18,.205,.33),(1.34,.12,.12,.30),
       (1.38,.07,.07,.28)]
verts=[]
for x,ry,rz,z in rings:
    for j in range(32):
        a=j/32*math.tau
        verts.append((x,math.sin(a)*ry,z+math.cos(a)*rz))
faces=[]; ids=[]
for i in range(len(rings)-1):
    for j in range(32):
        faces.append(((i+1)*32+j,(i+1)*32+(j+1)%32,i*32+(j+1)%32,i*32+j))
        # Slate saddle stops behind the neck, naturally bounded by the wing coverts.
        ids.append(1 if 1<=i<=5 and (j<5 or j>26) else 0)
faces += [tuple(reversed(range(32))),tuple((len(rings)-1)*32+j for j in range(32))]
ids += [0,0]
body=mesh_obj('Body | continuous breast neck crown',verts,faces,[ivory,mantle],ids,2)
# A softly blended saddle avoids a hard material boundary across the neck.
bodymat=ivory.copy();bodymat.name='12 | softly blended slate mantle'
nt=bodymat.node_tree;nodes=nt.nodes;links=nt.links
attr=nodes.new('ShaderNodeVertexColor');attr.layer_name='Saddle'
mix=nodes.new('ShaderNodeMixRGB');mix.inputs[1].default_value=(.79,.81,.76,1);mix.inputs[2].default_value=(.11,.15,.17,1)
links.new(attr.outputs['Color'],mix.inputs[0]);links.new(mix.outputs[0],nodes.get('Principled BSDF').inputs['Base Color'])
body.data.materials.clear();body.data.materials.append(bodymat)
colors=body.data.color_attributes.new(name='Saddle',type='FLOAT_COLOR',domain='POINT')
for i,v in enumerate(body.data.vertices):
    x=v.co.x;angle=(i%32)/32*math.tau
    a=max(0,min(1,(.61-x)/.42));b=max(0,min(1,(math.cos(angle)-.20)/.48))
    weight=a*a*(3-2*a)*b*b*(3-2*b)
    colors.data[i].color=(weight,weight,weight,1)
for poly in body.data.polygons:poly.material_index=0

def ellipsoid(name,loc,scale,material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material)
    for f in o.data.polygons:f.use_smooth=True
    move_collection(o)
    return o

def bill_mesh(name, upper=True):
    # Heavy but tapered gull bill; upper tip curves over the lower mandible.
    sections=[(1.26,.10,.30,.095),(1.43,.088,.30,.082),(1.64,.066,.30,.067),
              (1.77,.045,.275,.063),(1.84,.008,.244,.012)]
    vs=[]
    for x,w,z,h in sections:
        for j in range(12):
            a=j/12*math.tau
            vs.append((x,math.sin(a)*w,z+math.cos(a)*h))
    fs=[]
    for i in range(len(sections)-1):
        for j in range(12):fs.append((i*12+j,i*12+(j+1)%12,(i+1)*12+(j+1)%12,(i+1)*12+j))
    return mesh_obj(name,vs,fs,[yellow],subdivision=2)
bill=bill_mesh('Bill | hooked maxilla and gonys')
for s in [-1,1]:
    ellipsoid('Orbital ring '+str(s),(1.13,s*.197,.405),(.043,.012,.038),rim)
    ellipsoid('Eye '+str(s),(1.136,s*.207,.407),(.028,.010,.027),eye)
    ellipsoid('Eye catchlight '+str(s),(1.145,s*.215,.418),(.007,.003,.007),ivory)
    ellipsoid('Nostril '+str(s),(1.48,s*.080,.326),(.032,.004,.012),seam)
    ellipsoid('Gonys mark '+str(s),(1.706,s*.050,.251),(.043,.006,.023),red)
    ellipsoid('Mandible seam '+str(s),(1.56,s*.074,.273),(.18,.004,.004),seam)

# Feather vanes are curved meshes, with a subtle central ridge and overlapping rounded tips.
def feather(name,base,tip,width,material,tipmark=False,bend=.025):
    b=Vector(base); t=Vector(tip); d=t-b
    across=Vector((-d.y,d.x,0)).normalized()
    vs=[]
    steps=12
    for i in range(steps+1):
        u=i/steps
        profile=max(.008,math.sin(math.pi*(u*.94+.025))**.62)
        for v in [-1,-.48,0,.48,1]:
            pos=b+d*u+across*v*width*profile
            pos.z+=bend*math.sin(math.pi*u)+(1-v*v)*.012
            vs.append(tuple(pos))
    fs=[]; mi=[]
    for i in range(steps):
        for j in range(4):
            fs.append((i*5+j,(i+1)*5+j,(i+1)*5+j+1,i*5+j+1))
            mi.append(0)
    o=mesh_obj(name,vs,fs,[material,ivory],mi,1)
    uv=o.data.uv_layers.new(name='Feather UV')
    for loop in o.data.loops:
        idx=loop.vertex_index;uv.data[loop.index].uv=(idx//5/steps,(idx%5)/4)
    return o

# Rest wing: broad inner wing, distinct carpal angle, long tapered outer wing.
wing_rows=[(.22,.34,-.45,.22),(.52,.40,-.58,.24),(.95,.28,-.70,.20),
           (1.35,.36,-.74,.14),(1.75,.53,-.63,.11),(2.08,.42,-.67,.085),
           (2.40,.22,-.72,.055),(2.74,-.05,-.77,.015),(3.03,-.37,-.82,-.02),
           (3.28,-.72,-.87,-.055)]
wing_objects={-1:[],1:[]}
for s in [-1,1]:
    vs=[]; fs=[]; mi=[]
    for y,lead,trail,z in wing_rows:
        for j in range(13):
            a=j/12*math.tau
            chord=(1-math.cos(a))/2
            vs.append((lead+(trail-lead)*chord,s*y,z+math.sin(a)*.045))
    for i in range(len(wing_rows)-1):
        for j in range(12):
            face=(i*13+j,(i+1)*13+j,(i+1)*13+j+1,i*13+j+1)
            fs.append(tuple(reversed(face)) if s==-1 else face)
            mi.append(0 if j<6 else 1)
    wing=mesh_obj('Wing surface '+str(s),vs,fs,[mantle,under],mi,2)
    wing_objects[s].append(wing)
    # Broad overlapping secondaries; white terminal edges form a narrow trailing stripe.
    for i in range(15):
        y=.34+i*.111
        base=(.05+max(0,y-1.2)*.23,s*y,.13)
        tip=(-.79+max(0,y-1.3)*.14,s*(y+.035),.075)
        f=feather('Secondary %s %02d'%(s,i),base,tip,.105,secondary_mat,True)
        wing_objects[s].append(f)
    # Ten primaries sweep back into a pointed tip, rather than a fan of straight paddles.
    for i in range(10):
        u=i/9
        base=(.31-.52*u,s*(1.80+1.08*u),.088-.07*u)
        tip=(-.77-.38*u,s*(1.91+1.59*u),.035-.08*u)
        f=feather('Primary %s P%02d'%(s,i+1),base,tip,.112-.035*u,
                  primary_mirror if i>=8 else primary_tip if i>=4 else mantle,i>=7,bend=.022)
        wing_objects[s].append(f)
    # Two rows of overlapping coverts, restrained enough to read as feathers at close range.
    for row in range(2):
        for i in range(17):
            y=.30+i*.141
            nearest=min(wing_rows,key=lambda r:abs(r[0]-y))
            x=nearest[1]-.10-row*.21
            z=nearest[3]+.067
            f=feather('Covert %s %s %02d'%(s,row,i),(x,s*y,z),
                      (x-.34,s*(y+.045),z+.006),.080,mantle if row==0 else covert,bend=.006)
            wing_objects[s].append(f)

tail=[]
for i in range(12):
    u=(i-5.5)/5.5
    f=feather('Rectrix %02d'%(i+1),(-.77,u*.15,.075),(-1.69+.11*abs(u),u*.42,.025),.075,ivory,bend=.018)
    tail.append(f)
for s in [-1,1]:
    ellipsoid('Tucked tarsus '+str(s),(-.78,s*.16,-.205),(.27,.037,.037),pink)
    for j in range(3):
        ellipsoid('Tucked toe %s %s'%(s,j),(-1.00,s*.16+(j-1)*.043,-.215),(.16,.016,.022),pink)

# Editable armature: body + left/right upper wing, forewing and hand + tail.
bpy.ops.object.armature_add(enter_editmode=True,location=(0,0,0))
rig=bpy.context.object; rig.name='Coastal gull | flight rig'
move_collection(rig)
eb=rig.data.edit_bones
root=eb[0]; root.name='body'; root.head=(0,0,0);root.tail=(.7,0,0)
for s,side in [(-1,'R'),(1,'L')]:
    points=[(.18,s*.24,.20),(.20,s*1.02,.18),(.50,s*1.80,.10),(-.70,s*3.28,-.05)]
    parent=root
    for i,name in enumerate(['upper','fore','hand']):
        bone=eb.new(name+'.'+side);bone.head=points[i];bone.tail=points[i+1];bone.parent=parent
        parent=bone
t=eb.new('tail');t.head=(-.75,0,0);t.tail=(-1.65,0,0);t.parent=root
bpy.ops.object.mode_set(mode='OBJECT')
rig.show_in_front=True
rig.data.display_type='OCTAHEDRAL'

def skin(o,weights):
    groups={name:o.vertex_groups.new(name=name) for name in weights}
    for v in o.data.vertices:
        values=weights(v.co) if callable(weights) else weights
        for name,w in values.items():
            if w>0:groups[name].add([v.index],w,'REPLACE')
    mod=o.modifiers.new('Flight armature','ARMATURE');mod.object=rig
    o.parent=rig

for o in list(model.objects):
    if o.type!='MESH':continue
    side=next((s for s in [-1,1] if o in wing_objects[s]),None)
    if side is not None:
        suffix='L' if side==1 else 'R'
        names=['upper.'+suffix,'fore.'+suffix,'hand.'+suffix]
        groups={n:o.vertex_groups.new(name=n) for n in names}
        for v in o.data.vertices:
            y=abs(v.co.y)
            a=max(0,min(1,(y-.83)/.37)); b=max(0,min(1,(y-1.62)/.4))
            values=[1-a,a*(1-b),b]
            for name,w in zip(names,values):
                if w:groups[name].add([v.index],w,'REPLACE')
        mod=o.modifiers.new('Flight armature','ARMATURE');mod.object=rig;o.parent=rig
    else:
        skin(o,{'tail' if o in tail else 'body':1.0})

# Key every sampled pose, using local quaternion axes mapped from rest world axes.
# A clean 32-frame loop at 48 fps, with delayed wrist response and a narrower recovery stroke.
def world_rotation(bone, angles):
    basis=bone.bone.matrix_local.to_quaternion()
    q=Quaternion((1,0,0),angles[0]) @ Quaternion((0,1,0),angles[1]) @ Quaternion((0,0,1),angles[2])
    return basis.inverted() @ q @ basis

for frame in range(1,N+2):
    phase=(frame-1)/N*math.tau
    flap=math.sin(phase)
    for s,side in [(-1,'R'),(1,'L')]:
        for name,angle,fold in [('upper',flap*.55,0),
                                ('fore',math.sin(phase-.25)*.13,max(0,flap)*.07),
                                ('hand',math.sin(phase-.50)*.20,max(0,flap)*.13)]:
            pb=rig.pose.bones[name+'.'+side]
            pb.rotation_mode='QUATERNION'
            pb.rotation_quaternion=world_rotation(pb,(s*angle,.02*math.sin(phase),s*fold))
            pb.keyframe_insert('rotation_quaternion',frame=frame,group=name+'.'+side)
    pb=rig.pose.bones['tail'];pb.rotation_mode='QUATERNION'
    pb.rotation_quaternion=world_rotation(pb,(0,.045*math.sin(phase-.7),0))
    pb.keyframe_insert('rotation_quaternion',frame=frame,group='tail')
    pb=rig.pose.bones['body'];pb.location=(0,0,.012*math.sin(phase-.3))
    pb.keyframe_insert('location',frame=frame,group='body')
rig.animation_data.action.name='Flight | relaxed coastal wingbeat'

def aim(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
def light(name,loc,power,color,size):
    bpy.ops.object.light_add(type='AREA',location=loc)
    o=bpy.context.object;o.name=name;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size
    aim(o,(0,0,0));move_collection(o,studio)
light('Large warm sky',(2,-4,7),650,(1,.94,.83),7)
light('Soft marine bounce',(-1,3,2),380,(.64,.81,1),6)
light('Feather rim',(-4,0,5),500,(1,.95,.87),5)
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.64,.75,.83,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
bpy.ops.object.camera_add(location=(4,-9,4.4))
camera=bpy.context.object;camera.name='Camera | application three-quarter';move_collection(camera,studio)
camera.data.type='ORTHO';camera.data.ortho_scale=10.2;aim(camera,(0,0,.0));scene.camera=camera
rig['art_direction']='Coastal gull inspired by adult northern Western Gull; painterly slate, ivory, ochre. Decorative interpretation, not a species-ID model.'
rig['license']='Original generated geometry; no third-party meshes or textures.'
rig['animation']='32 samples, 48 fps, shoulder/forewing/hand phase delay; frame 1 is level glide.'
rig['reference']='https://www.allaboutbirds.org/guide/Western_Gull/id'

scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_distance=8
        area.spaces.active.region_3d.view_location=(0,0,0)
        area.spaces.active.shading.type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'marinecast-coastal-gull.blend'))

# Close-up renders support proportion and wing-range inspection.
for name,frame,loc in [('hero',5,(4,-9,4.4)),('glide',1,(3,-10,6)),('upstroke',9,(4,-9,4.4)),
                       ('downstroke',25,(4,-9,4.4)),('profile',1,(0,-10,1.2)),('top',1,(0,0,10))]:
    camera.location=loc;aim(camera,(0,0,0));scene.frame_set(frame)
    scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)

camera.location=(4,-9,4.4);aim(camera,(0,0,0))
if not args.preview:
    scene.render.resolution_x=512;scene.render.resolution_y=384
    for i in range(N):
        scene.frame_set(i+1);scene.render.filepath=str(OUT/'frames'/('gull-%02d.png'%i))
        bpy.ops.render.render(write_still=True)
scene.frame_set(1)
scene.render.resolution_x=1024;scene.render.resolution_y=768
scene.render.filepath=str(OUT/'hero.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'marinecast-coastal-gull.blend'))
print('COMPLETE',OUT)
