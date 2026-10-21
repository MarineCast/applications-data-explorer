"""Build local illustrative GLB assets. Coastline follows the retained San Juan archipelago mask.
Relief and vegetation are art-directed, not elevation observations. No acquisition.
Run: blender --background --python scripts/blender/build_coastal_home.py
"""
import bpy, math, random, json, sys, bisect
import numpy as np
from pathlib import Path
from mathutils import noise, Vector
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/assets/home/coastal-world'
OUT.mkdir(exist_ok=True)
sys.path.insert(0, str(Path(__file__).resolve().parent))
from coastal_relief import mountain_height, PEAKS
random.seed(17)
def clear():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(name, color, roughness=.8):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1)
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=roughness
    return m
def export(name):
    bpy.ops.export_scene.gltf(filepath=str(OUT / (name+'.glb')),export_format='GLB',export_yup=True)
def sphere(name, loc, scale, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale; o.data.materials.append(material)
    for p in o.data.polygons:p.use_smooth=True
    return o
def box(name,loc,scale,material,bevel=.08):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material)
    mod=o.modifiers.new('Soft edges','BEVEL');mod.width=bevel;mod.segments=2
    return o
clear()
coast=bpy.data.images.load(str(OUT/'coast-field.png'))
coast.colorspace_settings.name='Non-Color'
w,h=coast.size;pixels=np.empty(w*h*4,dtype=np.float32);coast.pixels.foreach_get(pixels)
region=json.loads((OUT/'region.json').read_text())
X0,X1,Z0,Z1=[region[k] for k in ('minX','maxX','minZ','maxZ')]
# The local artwork coordinate transform is retained so boat/label anchors stay stable.
def world_to_art(wx,wz):return ((wx+60)*10,(wz+40)*10)
def field(x,y):
    wx,wz=x/10-60,y/10-40
    ix=min(w-1,max(0,int((wx-X0)/(X1-X0)*(w-1))));iy=min(h-1,max(0,int((1-(wz-Z0)/(Z1-Z0))*(h-1))))
    i=(iy*w+ix)*4
    return tuple(float(v) for v in pixels[i:i+3])
def elevation(x,y):
    land,_,inland=field(x,y)
    if land<.5:return -.65
    d=inland*100
    # Ridge relief is deliberately exaggerated; it is not DEM elevation.
    p=Vector((x/100,y/100,1.7))
    broad=noise.hetero_terrain(p,1.0,2.1,4,1.0)
    ridge=noise.ridged_multi_fractal(Vector((x/58,y/58,3.1)),1.0,2.15,4,1.0,2.0)
    # Low Lopez/plain areas, moderate San Juan ridges, and a distinct eastern Orcas summit.
    massif=1.6+3.4*math.exp(-((x-730)/135)**2-((y-220)/130)**2)
    wx,wz=x/10-60,y/10-40
    # Connected regional ranges use geographic anchors within the existing map bounds.
    mountains=mountain_height(wx,wz)
    hills=massif*(.18+.11*broad)+ridge*.38
    # Give mountain shoulders a gradual coastal approach rather than extruding tall sea walls.
    mountain_ramp=min(1.,d/95.)**1.65
    hills+=mountains*(.92+.08*broad)*mountain_ramp
    shore=noise.noise(Vector((x/85,y/85,8)))
    # Harder headlands alternate with gradual pocket-beach approaches.
    ramp_width=12. if shore>.15 else 45.
    coastal_ramp=min(1.,d/ramp_width)**(.55 if shore>.15 else 1.25)
    valley=1.-.28*math.exp(-((x-600)/55)**2)*math.exp(-((y-600)/210)**2)
    strata=.09*math.sin(x*.47+y*.33)+.07*noise.noise(Vector((x/3.8,y/3.8,4)))
    return .10+coastal_ramp*max(.4,hills)*valley+strata*min(1.,d/3.)

xs=sorted(set([X0+i*(X1-X0)/700 for i in range(701) if not -60<i*(X1-X0)/700+X0<60]+[-60+i*.3 for i in range(401)]))
zs=sorted(set([Z0+j*(Z1-Z0)/1000 for j in range(1001) if not -40<j*(Z1-Z0)/1000+Z0<40]+[-40+j*.3 for j in range(267)]+[40.]))
verts=[];faces=[];colors=[];nx,ny=len(xs)-1,len(zs)-1
for j in range(ny+1):
    for i in range(nx+1):
        x,y=world_to_art(xs[i],zs[j]);z=elevation(x,y)
        verts.append(((x-600)/10,(400-y)/10,z))
        land,_,inland=field(x,y)
        shade=.9+.1*noise.noise(Vector((x/25,y/25,5)))
        c=(.38,.42,.20) if inland*100>7 else (.58,.55,.46)
        colors.append((*[v*shade for v in c],1))
for j in range(ny):
    for i in range(nx):
        a=j*(nx+1)+i;faces.extend([(a,a+nx+2,a+1),(a,a+nx+1,a+nx+2)])
mesh=bpy.data.meshes.new('Coastal relief');mesh.from_pydata(verts,[],faces);mesh.update()
for poly in mesh.polygons: poly.use_smooth=True
o=bpy.data.objects.new('San Juan archipelago illustrative terrain',mesh);bpy.context.collection.objects.link(o)
attr=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
for i,c in enumerate(colors):attr.data[i].color=c
m=mat('Muted grass and granite',(.4,.45,.28));nodes=m.node_tree.nodes
v=nodes.new('ShaderNodeVertexColor');v.layer_name='Color';m.node_tree.links.new(v.outputs['Color'],nodes['Principled BSDF'].inputs['Base Color']);mesh.materials.append(m)
export('terrain')
# Tree roots sit on the exported triangles, including the coarser regional grid.
def mesh_height(wx,wz):
    i=max(0,min(nx-1,bisect.bisect_right(xs,wx)-1))
    j=max(0,min(ny-1,bisect.bisect_right(zs,wz)-1))
    tx=(wx-xs[i])/(xs[i+1]-xs[i]);tz=(wz-zs[j])/(zs[j+1]-zs[j])
    a=j*(nx+1)+i
    ha,hb,hc,hd=[verts[k][2] for k in (a,a+1,a+nx+1,a+nx+2)]
    return ha*(1-tx)+hb*(tx-tz)+hd*tz if tx>=tz else ha*(1-tz)+hc*(tz-tx)+hd*tx
# Runtime mask and heights share precisely the terrain coordinate transform.
# Same candidate density everywhere; the San Juan patch is retained as the first pass.
# Binary records avoid a very large JSON object graph for the expanded forest.
forest=[]
regional_attempts=round((X1-X0)*(Z1-Z0)*45000/(120*80))
for attempt in range(45000+regional_attempts):
    if attempt<45000:x,y=random.uniform(2,1198),random.uniform(2,798)
    else:
        wx,wz=random.uniform(X0,X1),random.uniform(Z0,Z1)
        if -60<wx<60 and -40<wz<40:continue
        x,y=world_to_art(wx,wz)
    land,_,inland=field(x,y)
    if land<.9 or inland*100<=3:continue
    altitude=elevation(x,y)
    if altitude<=.18 or altitude>=10.5:continue
    slope=math.hypot(elevation(x+1,y)-elevation(x-1,y),elevation(x,y+1)-elevation(x,y-1))
    patch=noise.noise(Vector((x/100,y/100,5)))
    grove_detail=noise.noise(Vector((x/32,y/32,7)))
    density=max(.05,min(.98,.62+patch*.95+grove_detail*.28))
    if patch<-.30 or slope>.48:density*=.10
    # Forested lower slopes give way to scattered subalpine trees, then exposed summits.
    density*=min(1.,max(0.,(10.5-altitude)/3.5))
    if slope<.65 and random.random()<density:
        scale=random.uniform(12,29)*(1.+patch*.2)/43
        root_y=mesh_height((x-600)/10,(y-400)/10)
        if root_y>.18:forest.extend([(x-600)/10,root_y,(y-400)/10,scale,random.random()*6.28,(len(forest)//6)%3])
np.asarray(forest,dtype='<f4').tofile(OUT/'forest.bin')
data={**region,'forestUrl':'/assets/home/coastal-world/forest.bin','treeCount':len(forest)//6,
      'forestStride':6,'mountainRanges':[p[0] for p in PEAKS]}
print('Regional forest:',data['treeCount'],'trees',flush=True)

rocks=[]
for _ in range(16000):
    x,y=random.uniform(2,1198),random.uniform(2,798)
    land,_,inland=field(x,y)
    if land>.9 and .8<inland*100<7 and noise.noise(Vector((x/85,y/85,8)))>.05:
        rocks.append({'x':(x-600)/10,'z':(y-400)/10,'y':elevation(x,y),'size':random.uniform(.13,.45),'phase':random.random()*math.tau})
data['rocks']=rocks
(OUT/'world.json').write_text(json.dumps(data,separators=(',',':')))
# Branch-built evergreen crowns: asymmetric radial boughs, open gaps and tapered sprays.
# Three variants are instanced separately; all sprays share one vertex-colored mesh.
for variant in range(3):
    clear()
    bark=mat('Weathered evergreen bark',(.095,.065,.035))
    foliage=mat('Deep evergreen needles',(.026,.085,.043))
    verts=[];faces=[];uvs=[]
    height=[3.8,3.2,4.2][variant];width=[.85,1.05,.68][variant]
    for layer in range(11):
        z=.45+layer*(height-.7)/11
        reach=width*(1-layer/12)**.75
        for branch in range(5):
            angle=branch*math.tau/5+layer*2.39+random.uniform(-.35,.35)
            radial=Vector((math.cos(angle),math.sin(angle),0))
            cross=Vector((-radial.y,radial.x,0))
            length=reach*random.uniform(.8,1.3)
            root=Vector((0,0,z));tip=root+radial*length+Vector((0,0,random.uniform(-.16,.2)))
            center=(root+tip)/2;half=cross*length*.48
            base=len(verts)
            # Each detailed bough has a mild V fold, catching the light naturally.
            verts.extend([tuple(root-half*.18),tuple(root+half*.18),tuple(center+half),tuple(tip),tuple(center-half)])
            faces.extend([(base,base+1,base+2,base+3),(base,base+3,base+4)])
            uvs.extend([[(.42,0),(.58,0),(1,.55),(.5,1)],[(.42,0),(.5,1),(0,.55)]])
    mesh=bpy.data.meshes.new('Textured evergreen bough cards');mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new('Evergreen boughs',mesh);bpy.context.collection.objects.link(obj)
    uv=mesh.uv_layers.new(name='Foliage UV')
    for poly,coords in zip(mesh.polygons,uvs):
        for loop,coord in zip(poly.loop_indices,coords):uv.data[loop].uv=coord
    foliage.diffuse_color=(1,1,1,1)
    shader=foliage.node_tree.nodes['Principled BSDF'];shader.inputs['Base Color'].default_value=(1,1,1,1)
    tex=foliage.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(OUT/'evergreen-bough.png'),check_existing=True)
    foliage.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color']);foliage.node_tree.links.new(tex.outputs['Alpha'],shader.inputs['Alpha'])
    foliage.surface_render_method='DITHERED';foliage.use_backface_culling=False
    mesh.materials.append(foliage)
    bpy.ops.mesh.primitive_cone_add(vertices=7,radius1=.065,radius2=.012,depth=height,location=(0,0,height/2))
    bpy.context.object.name='Tapered evergreen trunk';bpy.context.object.data.materials.append(bark)
    export('fir-'+str(variant))
clear()
navy=mat('Hull deep navy',(.045,.10,.13),.35);ivory=mat('Warm ivory',(.88,.88,.77),.4);glass=mat('Blue cabin windows',(.09,.24,.29),.2);orange=mat('Safety orange',(.73,.29,.08));metal=mat('Rail metal',(.43,.48,.46),.3)
sphere('Displacement hull',(0,0,.25),(.48,1.35,.36),navy)
box('Deck',(0,-.08,.5),(.86,2.15,.13),ivory)
box('Wheelhouse',(0,.1,.84),(.65,.8,.57),ivory)
box('Front glazing',(0,.51,.9),(.56,.025,.25),glass)
for x in [-.33,.33]:box('Side glazing',(x,.12,.9),(.025,.6,.25),glass)
box('Cabin roof',(0,.12,1.16),(.78,.94,.09),ivory)
box('Aft orange equipment',(0,-.74,.69),(.5,.38,.25),orange)
box('Antenna',(0,.1,1.5),(.025,.025,.65),metal,.01)
export('boat')
clear()
black=mat('Orca charcoal',(.025,.035,.038),.33);white=mat('Orca ivory',(.83,.86,.79),.4)
sphere('Orca body',(0,0,0),(.43,1.65,.43),black)
sphere('White underside',(0,.2,-.19),(.36,1.18,.24),white)
for x in [-.36,.36]:sphere('Eye patch',(x,.85,.14),(.09,.32,.12),white)
def fin(name,verts,material):
    m=bpy.data.meshes.new(name);m.from_pydata(verts,[],[(0,1,2),(2,1,0)]);m.update();o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o);m.materials.append(material)
fin('Dorsal fin',[(-.035,-.2,.28),(.035,.42,.28),(0,-.3,1.35)],black)
for s in [-1,1]:
    fin('Flipper',[(s*.3,.55,-.1),(s*1,.1,-.25),(s*.35,-.2,-.22)],black)
    fin('Fluke',[(0,-1.5,0),(s*.8,-1.85,.05),(0,-1.95,-.05)],black)
export('orca')
print('Coastal assets exported',OUT)
