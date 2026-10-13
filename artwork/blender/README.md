# MarineCast gull animation

`marinecast-gull.blend` is the editable Blender 5.2 source for the homepage gulls. It contains an articulated procedural gull with separate shoulder joints, primary feathers, tail feathers, camera, and lighting. The 16-frame cycle alternates a broad powered downstroke with a quicker folded upstroke.

Regenerate the transparent PNG frames from the repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background \
  --python scripts/blender/render_gull_flight.py
```

Package the renders for the app:

```sh
mkdir -p public/assets/home/ocean/gull-flight
for png in artwork/blender/renders/gull-flight/gull-*.png; do
  name=${png##*/}
  cwebp -quiet -q 82 -alpha_q 100 -m 6 "$png" \
    -o "public/assets/home/ocean/gull-flight/${name%.png}.webp"
done
```

The Pixi scene varies flap timing, gliding holds, scale, banking, altitude, direction, and route for three birds. These paths are decorative and do not represent wildlife observations.
