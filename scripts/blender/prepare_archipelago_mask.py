"""Prepare a decorative distance field from the retained San Juan land mask.
Requires Pillow. Distances are chamfer approximations in artwork pixels, not depths.
"""
from pathlib import Path
from PIL import Image, ImageFilter
import math
from collections import deque
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/assets/home/coastal-world'
W,H=1200,800
image=Image.open(ROOT/'public/assets/home/san-juan/land-mask.png').convert('L').resize((W,H),Image.Resampling.NEAREST)
# Remove sub-pixel crenellations while retaining the major islands and navigable channels.
image=image.filter(ImageFilter.MedianFilter(3))
land=[v>=128 for v in image.getdata()]
seen=bytearray(W*H);removed=0
for start in range(W*H):
    if seen[start] or not land[start]:continue
    seen[start]=1;queue=deque([start]);component=[]
    while queue:
        i=queue.popleft();component.append(i);x,y=i%W,i//W
        for dx,dy in ((-1,0),(1,0),(0,-1),(0,1)):
            xx,yy=x+dx,y+dy
            if 0<=xx<W and 0<=yy<H:
                j=yy*W+xx
                if land[j] and not seen[j]:seen[j]=1;queue.append(j)
    if len(component)<45:
        removed+=1
        for i in component:land[i]=False
print('Omitted sub-resolution islets:',removed)
preview=Image.new('L',(W,H));preview.putdata([255 if v else 0 for v in land]);preview.save(OUT/'stylized-land-mask.png')
def distance(seed):
    values=[0.0 if v==seed else 2000.0 for v in land]
    for y in range(H):
        for x in range(W):
            i=y*W+x; d=values[i]
            if x:d=min(d,values[i-1]+1)
            if y:d=min(d,values[i-W]+1)
            if x and y:d=min(d,values[i-W-1]+math.sqrt(2))
            if x<W-1 and y:d=min(d,values[i-W+1]+math.sqrt(2))
            values[i]=d
    for y in range(H-1,-1,-1):
        for x in range(W-1,-1,-1):
            i=y*W+x; d=values[i]
            if x<W-1:d=min(d,values[i+1]+1)
            if y<H-1:d=min(d,values[i+W]+1)
            if x<W-1 and y<H-1:d=min(d,values[i+W+1]+math.sqrt(2))
            if x and y<H-1:d=min(d,values[i+W-1]+math.sqrt(2))
            values[i]=d
    return values
outside,inside=distance(True),distance(False)
result=Image.new('RGB',(W,H))
result.putdata([(255 if v else 0,min(255,round(outside[i]*2.55)),min(255,round(inside[i]*2.55))) for i,v in enumerate(land)])
result.save(OUT/'coast-field.png')
print('Prepared complete San Juan coastline distance field')
