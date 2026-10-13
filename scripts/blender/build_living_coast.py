"""Original rooted kelp and wind-shaped conifer for MarineCast's live environment."""
import bpy, math, random, argparse, sys
from pathlib import Path
from mathutils import Vector
parser=argparse.ArgumentParser();parser.add_argument('--output',required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True)
random.seed(17)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def material(name,color):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1)
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.85
    m.use_backface_culling=False
    return m
olive=material('Kelp | golden olive',(.20,.28,.045));leafmat=material('Kelp | translucent jade',(.16,.25,.047));stemmat=material('Kelp | ochre stipe',(.22,.21,.06))
bark=material('Cedar | weathered bark',(.15,.12,.068));needles=[material('Cedar | needles '+str(i),c) for i,c in enumerate([(.035,.095,.067),(.057,.13,.074),(.105,.17,.075)])]

def tube(name,points,radius,mat):
    cv=bpy.data.curves.new(name,'CURVE');cv.dimensions='3D';cv.resolution_u=4;cv.bevel_depth=radius;cv.bevel_resolution=2
    sp=cv.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
    for p,co in zip(sp.bezier_points,points):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    ob=bpy.data.objects.new(name,cv);bpy.context.collection.objects.link(ob);ob.data.materials.append(mat)
    return ob
def ball(name,loc,scale,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=loc)
    ob=bpy.context.object;ob.name=name;ob.scale=scale;ob.data.materials.append(mat)
    for f in ob.data.polygons:f.use_smooth=True
    return ob

start=set(bpy.data.objects)
for j in range(3):
    phase=j*2.1
    height=4.6-j*.55
    def stem(z):return (.10*math.sin(z*1.7+phase)*z/height,.08*math.cos(z*1.4+phase)*z/height,z)
    tube('Stipe '+str(j),[stem(i*height/10) for i in range(11)],.016,stemmat)
    for i in range(12):
        z=.6+i*(height-.7)/12
        base=Vector(stem(z));angle=i*2.4+phase
        direction=Vector((math.cos(angle),math.sin(angle),.22))
        length=.65+.28*math.sin(i*.7+j)
        ball('Pneumatocyst %s %s'%(j,i),base+direction*.035,(.038,.038,.055),olive)
        vs=[];fs=[]
        across=Vector((-direction.y,direction.x,0))
        for k in range(17):
            u=k/16
            for n in range(5):
                v=(n-2)/2
                center=base+direction*(length*u)
                center.z+=.15*math.sin(u*math.pi)-.30*u*u
                width=.105*math.sin(math.pi*u)**.75
                pos=center+across*width*v
                pos.z+=math.sin(u*math.pi*5+phase)*.04*abs(v)*u
                vs.append(pos)
        for k in range(16):
            for n in range(4):fs.append((k*5+n,(k+1)*5+n,(k+1)*5+n+1,k*5+n+1))
        mesh=bpy.data.meshes.new('Ruffled blade');mesh.from_pydata(vs,[],fs);mesh.update()
        ob=bpy.data.objects.new('Blade %s %02d'%(j,i),mesh);bpy.context.collection.objects.link(ob);mesh.materials.append(leafmat if i%3 else olive)
        for f in mesh.polygons:f.use_smooth=True
for i in range(10):
    a=i*math.tau/10
    tube('Holdfast haptera '+str(i),[(0,0,.1),(.13*math.cos(a),.13*math.sin(a),.04),(.27*math.cos(a+.2),.27*math.sin(a+.2),0)],.012,stemmat)
kelp=list(set(bpy.data.objects)-start)
for o in kelp:o['root_pinned']=True;o['bend_height']=4.6

def export(objects,filename):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:ob.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.export_scene.gltf(filepath=str(out/filename),export_format='GLB',use_selection=True,export_apply=True)
export(kelp,'rooted-kelp.glb')
for ob in kelp:ob.hide_render=True;ob.hide_set(True)

start=set(bpy.data.objects)
tube('Coastal cedar trunk',[(0,0,0),(.02,0,1.0),(-.04,.01,2.1),(.02,0,3.2),(0,0,4.2)],.045,bark)
for tier in range(17):
    z=.48+tier*.21;radius=(1-z/4.25)*.86
    for branch in range(5):
        a=branch*math.tau/5+tier*1.37
        r=radius*(.82+random.random()*.2)
        points=[(0,0,z),(math.cos(a)*r*.45,math.sin(a)*r*.45,z-.02),(math.cos(a)*r,math.sin(a)*r,z-.16)]
        tube('Drooping cedar bough',points,.010,bark)
        for k in range(4):
            u=.24+k*.20
            pos=(math.cos(a)*r*u,math.sin(a)*r*u,z-.16*u+.015)
            ob=ball('Needle spray',pos,(r*.30,.09,.075),needles[(branch+tier+k)%3]);ob.rotation_euler[2]=a
ball('Cedar leader',(0,0,4.0),(.065,.06,.23),needles[1])
trees=list(set(bpy.data.objects)-start)
export(trees,'coastal-cedar.glb')
for ob in kelp:ob.hide_render=False;ob.hide_set(False);ob.location.x-=1.5
for ob in trees:ob.location.x+=1.5
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1000;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.film_transparent=True
scene.world.color=(.3,.3,.3)
bpy.ops.object.light_add(type='AREA',location=(1,-4,7));bpy.context.object.data.energy=800;bpy.context.object.data.size=7
bpy.ops.object.camera_add(location=(6,-12,7));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,2.1))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=7;scene.camera=camera
scene.render.filepath=str(out/'environment-assets.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'living-coast.blend'))
print('EXPORTED',out)
