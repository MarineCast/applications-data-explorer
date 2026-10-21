"""Rasterize cached GSHHG polygons for the illustrative Salish Sea world. No acquisition.
Run with Python + Pillow + NumPy. Original San Juan assets remain untouched.
"""
from pathlib import Path
from zipfile import ZipFile
import struct, json, hashlib, math
import numpy as np
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/assets/home/coastal-world'
SOURCE=ROOT.parents[1]/'Toolkits/toolkit-seascape/.seascape/cache/regional/coastline/gshhg-shp-2.3.7.zip'
WEST,EAST,SOUTH,NORTH=-125.5,-121.8,46.8,50.3
W,H=1800,2600
SX=120/.82;SZ=80/(48.766517153043594-48.405)
def project(lon,lat):return ((lon-WEST)/(EAST-WEST)*(W-1),(NORTH-lat)/(NORTH-SOUTH)*(H-1))
image=Image.new('L',(W,H));draw=ImageDraw.Draw(image)
# Shapefile Polygon records: bounding box, part offsets, then little-endian XY doubles.
# All L1 parts represent land; L2 inland lakes are omitted to keep the demo marine-only.
with ZipFile(SOURCE) as archive:
 data=archive.read('GSHHS_shp/f/GSHHS_f_L1.shp');offset=100;count=0
 while offset<len(data):
  length=struct.unpack_from('>i',data,offset+4)[0]*2;record=memoryview(data)[offset+8:offset+8+length];offset+=8+length
  if struct.unpack_from('<i',record)[0]!=5:continue
  xmin,ymin,xmax,ymax=struct.unpack_from('<4d',record,4)
  if xmax<WEST or xmin>EAST or ymax<SOUTH or ymin>NORTH:continue
  parts,points=struct.unpack_from('<2i',record,36);starts=list(struct.unpack_from('<'+str(parts)+'i',record,44))+[points]
  xy=np.frombuffer(record,dtype='<f8',offset=44+parts*4,count=points*2).reshape(-1,2)
  for a,b in zip(starts,starts[1:]):
   draw.polygon([project(float(lon),float(lat)) for lon,lat in xy[a:b]],fill=255)
  count+=1
 for name in ('LICENSE.TXT','COPYING.LESSERv3'):(OUT/('GSHHG-'+name)).write_bytes(archive.read(name))
# Preserve the previously verified finer local coastline with the exact geodetic transform.
local=Image.open(ROOT/'public/assets/home/san-juan/land-mask.png').convert('L')
x0,y0=project(-123.3,48.766517153043594);x1,y1=project(-122.48,48.405)
local=local.resize((round(x1)-round(x0),round(y1)-round(y0)),Image.Resampling.NEAREST)
image.paste(local,(round(x0),round(y0)))
image.save(OUT/'regional-land-mask.png')
land=np.asarray(image)>127
# Vectorized chamfer sweeps. Work in world units, shared by shader and vessel footprint.
dx=(EAST-WEST)*SX/(W-1);dz=(NORTH-SOUTH)*SZ/(H-1)
def distances(seed):
 d=np.where(land==seed,0.,10000.).astype(np.float32)
 # Four directional passes, repeated for diagonal paths around complex coastal geometry.
 for _ in range(2):
  for y in range(1,H):d[y]=np.minimum(d[y],d[y-1]+dz)
  for y in range(H-2,-1,-1):d[y]=np.minimum(d[y],d[y+1]+dz)
  for x in range(1,W):d[:,x]=np.minimum(d[:,x],d[:,x-1]+dx)
  for x in range(W-2,-1,-1):d[:,x]=np.minimum(d[:,x],d[:,x+1]+dx)
 return d
outside,inside=distances(True),distances(False)
# Small-radius hull clearance uses a conservative local metric: Manhattan / sqrt(2).
# This underestimates Euclidean distance and never makes the hull less conservative.
clearance=np.maximum(0,outside/math.sqrt(2)-math.hypot(dx,dz))
np.floor(np.minimum(25.5,clearance)*10).astype('uint8').tofile(OUT/'clearance.bin')
Image.fromarray(np.stack([land.astype('uint8')*255,np.clip(outside*25.5,0,255).astype('uint8'),np.clip(inside*25.5,0,255).astype('uint8')],axis=-1)).save(OUT/'coast-field.png')
meta={'width':W,'height':H,'minX':(WEST+122.89)*SX,'maxX':(EAST+122.89)*SX,'minZ':(48.5857585765218-NORTH)*SZ,'maxZ':(48.5857585765218-SOUTH)*SZ,'clearanceScale':.1,'clearanceUrl':'/assets/home/coastal-world/clearance.bin','boundsWgs84':[WEST,SOUTH,EAST,NORTH],'source':'GSHHG 2.3.7 L1 with retained San Juan mask inset','sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest()}
(OUT/'region.json').write_text(json.dumps(meta,indent=2))
print('Regional coastline prepared:',count,'polygons;',meta)
