"""Illustrative mountain masses in the existing atlas bounds; not DEM elevations.
Approximate geographic anchors locate the ranges. Heights/radii are art direction.
Baker: https://www.usgs.gov/volcanoes/mount-baker/
Olympics: https://www.nps.gov/olym/learn/nature/mountains.htm
Canadian ranges: https://bcparks.ca/garibaldi-park/
"""
import math

SX = 120 / .82
SZ = 80 / (48.766517153043594 - 48.405)
# name, longitude, latitude, scene height, east-west / north-south reach.
# Off-map summits contribute only their in-bounds slopes; the footprint never expands.
PEAKS = [
    ('Olympus', -123.71, 47.80, 22, 53, 60),
    ('Hurricane Ridge', -123.49, 47.97, 11, 44, 39),
    ('Mount Anderson', -123.33, 47.74, 17, 38, 45),
    ('Mount Deception', -123.24, 47.81, 18, 35, 40),
    ('Mount Constance', -123.13, 47.77, 17, 31, 39),
    ('The Brothers', -123.00, 47.65, 14, 29, 38),
    ('Southern Olympics', -123.52, 47.56, 12, 51, 45),
    ('Mount Baker', -121.813, 48.777, 28, 46, 49),
    ('Mount Shuksan', -121.60, 48.83, 21, 40, 43),
    ('North Cascades', -121.56, 48.48, 19, 53, 68),
    ('Mountain Loop', -121.62, 48.08, 17, 57, 63),
    ('Central Cascades', -121.48, 47.63, 18, 62, 73),
    ('Southern Cascades', -121.65, 47.22, 16, 53, 66),
    ('Mount Rainier', -121.76, 46.852, 29, 43, 49),
    ('North Shore Mountains', -123.04, 49.44, 13, 48, 35),
    ('Howe Sound', -123.20, 49.66, 17, 51, 48),
    ('Garibaldi', -123.00, 49.85, 23, 47, 55),
    ('Tantalus Range', -123.53, 49.81, 19, 40, 55),
    ('Sunshine Coast Mountains', -123.96, 49.91, 16, 47, 64),
    ('Golden Ears', -122.47, 49.36, 15, 42, 37),
    ('Southern Vancouver Island', -123.86, 48.63, 8, 52, 47),
    ('Vancouver Island Ranges', -124.45, 49.08, 14, 61, 72),
    ('Central Island Ranges', -125.15, 49.58, 19, 56, 85),
]
MASSES = [(name, (lon + 122.89)*SX, (48.5857585765218-lat)*SZ, h, rx, rz)
          for name, lon, lat, h, rx, rz in PEAKS]

def mountain_height(x, z):
    heights = []
    for _, px, pz, h, rx, rz in MASSES:
        dx, dz = (x-px)/rx, (z-pz)/rz
        r = math.hypot(dx, dz)
        if r >= 1.25:
            continue
        angle = math.atan2(dz, dx)
        # Uneven radial spurs and cut valleys, continuous at each range's foot.
        r /= 1 + .10*math.sin(angle*5+px) + .06*math.sin(angle*9+pz)
        envelope = max(0, 1-r/1.15)
        ridges = .82 + .13*math.cos(angle*7 + r*9) + .05*math.sin(x*.31-z*.22)
        heights.append(h*envelope**1.45*ridges)
    if not heights:
        return 0.
    heights.sort(reverse=True)
    # Overlapping shoulders connect peaks without adding all summits into one wall.
    return heights[0] + sum(heights[1:3])*.12
