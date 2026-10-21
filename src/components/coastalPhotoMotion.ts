import { createScenicStars } from './scenicStars';
import { CanvasTexture, Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Texture, Vector2, Vector4, WebGLRenderer } from 'three';

// Masks follow this specific 1672 × 941 image, in source-image coordinates.
// Keep their edges inside the water/sky so the original shoreline stays still; white regions isolate foliage.
function motionMask() {
  const canvas = document.createElement('canvas');
  canvas.width = 1672; canvas.height = 941;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1672, 941);
  const polygon = (color: string, points: number[][], blur = 6) => {
    ctx.filter = `blur(${blur}px)`;
    ctx.fillStyle = color; ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath(); ctx.fill();
  };
  polygon('#f00', [[-30,278],[290,270],[326,280],[315,304],[450,317],[617,306],[615,285],[748,277],[941,282],
    [880,309],[803,329],[715,359],[694,403],[628,416],[651,440],[730,457],[842,464],[824,491],
    [901,518],[1016,537],[1082,563],[1140,604],[1240,631],[1408,642],[1550,629],[1702,634],[1702,971],[-30,971]]);
  polygon('#0f0', [[-30,-30],[1702,-30],[1702,110],[1540,108],[1410,93],[1300,85],[1210,70],
    [1100,75],[1000,94],[950,111],[800,124],[650,132],[500,137],[360,157],[200,155],[-30,158]], 12);
  // Separate wisps in the existing distant channels, away from mountain silhouettes.
  polygon('#00f', [[290,226],[380,215],[485,220],[525,228],[462,239],[342,246]], 7);
  polygon('#00f', [[698,210],[764,204],[810,211],[779,227],[730,232]], 5);
  polygon('#00f', [[1033,213],[1144,206],[1270,209],[1255,220],[1150,231],[1048,233]], 6);
  // White encodes foliage independently of the red/green/blue water/sky/fog masks.
  // Stay inside the canopy and above the rock faces; trunks and shore remain anchored.
  polygon('#fff', [[735,354],[960,277],[1175,257],[1385,202],[1480,211],
    [1518,304],[1650,323],[1702,347],[1702,535],[1530,510],[1410,455],
    [1300,442],[1195,428],[1100,390],[1020,378],[905,388],[790,373]], 9);
  return new CanvasTexture(canvas);
}

const fragmentShader = `
  uniform sampler2D photo;
  uniform sampler2D regions;
  uniform vec4 crop;
  uniform float time;
  uniform float stars;
  uniform sampler2D starField;
  uniform vec2 pointer;
  varying vec2 vUv;
  vec4 samplePhoto(vec2 p) { return texture2D(photo, vec2(clamp(p.x, 0.001, 0.999), 1.0 - clamp(p.y, 0.001, 0.999))); }
  vec4 movingSample(vec2 origin, vec2 shifted, vec3 channel) {
    vec3 sourceMask = texture2D(regions, vec2(shifted.x, 1.0 - shifted.y)).rgb;
    sourceMask -= vec3(min(sourceMask.r, min(sourceMask.g, sourceMask.b)));
    float safe = smoothstep(0.2, 0.95, dot(sourceMask, channel));
    return mix(samplePhoto(origin), samplePhoto(shifted), safe);
  }
  vec4 drift(vec2 p, vec2 velocity, float period, vec3 channel) {
    float a = fract(time / period);
    float b = fract(a + 0.5);
    float weight = 0.5 - 0.5 * cos(a * 6.2831853);
    // The resetting phase has zero weight: both streams meet without a loop jump.
    return mix(movingSample(p, p - velocity * (b - 0.5) * period, channel),
               movingSample(p, p - velocity * (a - 0.5) * period, channel), weight);
  }
  void main() {
    vec2 p = crop.xy + vec2(vUv.x, 1.0 - vUv.y) * crop.zw;
    vec3 mask = texture2D(regions, vec2(p.x, 1.0 - p.y)).rgb;
    float foliage = min(mask.r, min(mask.g, mask.b));
    mask -= vec3(foliage);
    // Eroded soft masks leave coastline pixels completely untouched.
    mask = smoothstep(vec3(0.16), vec3(0.96), mask);
    float fade = smoothstep(0.0, 2.0, time);
    float nearWater = smoothstep(0.28, 0.95, p.y);
    vec2 ripple = vec2(
      sin(p.y * 155.0 + p.x * 25.0 - time * 1.3) * 0.0020 + sin(p.y * 310.0 - time * 1.7) * 0.0011,
      sin(p.y * 210.0 + p.x * 31.0 - time * 1.1) * 0.0010 + sin(p.x * 95.0 + p.y * 110.0 + time * 0.8) * 0.0008
    ) * mix(0.45, 1.0, nearWater);
    vec4 color = samplePhoto(p);
    // Advect the original water texture as a current, with smaller ripples riding it.
    // This moves reflections through the scene instead of making the surface wobble.
    vec2 current = vec2(0.0043, 0.00075) * mix(0.35, 1.0, nearWater);
    color = mix(color, drift(p + ripple, current, 12.0, vec3(1.0, 0.0, 0.0)), mask.r * fade);
    color = mix(color, drift(p, vec2(0.0031, 0.000055), 32.0, vec3(0.0, 1.0, 0.0)), mask.g * fade);
    color = mix(color, drift(p, vec2(0.0020, 0.00006), 28.0, vec3(0.0, 0.0, 1.0)), mask.b * fade);
    // Catalog positions stay fixed relative to the sky; only brightness twinkles.
    if (stars > 0.5) {
      float skyVisibility = smoothstep(0.85, 1.0, mask.g)
        * (1.0 - smoothstep(0.12, 0.27, dot(color.rgb, vec3(0.2126, 0.7152, 0.0722))));
      float starlight = texture2D(starField, vec2(p.x, 1.0 - p.y)).r;
      float proximity = 1.0 - smoothstep(8.0, 55.0, length((pointer-p) * vec2(1672.0, 941.0)));
      float phase = p.x * 213.0 + p.y * 491.0;
      float shimmer = 0.5 + 0.5 * sin(time * 2.1 + phase);
      float strength = 0.85 + 0.08 * sin(time * 0.8 + phase)
        + proximity * (1.0 + 1.8 * shimmer);
      color.rgb += vec3(0.82, 0.9, 1.0) * starlight * strength * skyVisibility;
    }

    gl_FragColor = color;
  }
`;

export function startCoastalCinemagraph(canvas: HTMLCanvasElement, image: HTMLImageElement, paused: boolean, stars = false) {
  const renderer = new WebGLRenderer({ canvas, alpha: false, antialias: false, powerPreference: 'low-power' });

  const photo = new Texture(image); photo.needsUpdate = true;
  photo.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const regions = motionMask();
  const starMap = stars ? createScenicStars() : null;
  const material = new ShaderMaterial({
    uniforms: { photo: { value: photo }, regions: { value: regions }, crop: { value: new Vector4(0, 0, 1, 1) }, time: { value: 0 }, stars: { value: stars ? 1 : 0 }, starField: { value: starMap?.texture ?? regions }, pointer: { value: new Vector2(-10, -10) } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader,
    depthTest: false, depthWrite: false,
  });
  const geometry = new PlaneGeometry(2, 2);
  const scene = new Scene(); scene.add(new Mesh(geometry, material));
  const camera = new OrthographicCamera();
  let frame = 0;
  let previous = 0;
  let lastDraw = 0;
  let stopped = false;
  let lost = false;
  const draw = () => { starMap?.update(); renderer.render(scene, camera); };
  const resize = () => {
    if (lost) return;
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    // Retina rendering, bounded to roughly a 4K framebuffer on larger displays.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(8294400 / (width * height))));
    renderer.setSize(width, height, false);
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const x = width / (image.naturalWidth * scale);
    const y = height / (image.naturalHeight * scale);
    const position = window.matchMedia('(max-width: 700px)').matches ? 0.68 : 0.58;
    material.uniforms.crop.value.set((1 - x) * position, (1 - y) * 0.5, x, y);
    draw();
  };
  const tick = (now: number) => {
    frame = 0;
    if (stopped || paused || document.hidden || lost) return;
    if (previous) material.uniforms.time.value += Math.min((now - previous) / 1000, 0.1);
    previous = now;
    if (now - lastDraw >= 1000 / 30) { draw(); lastDraw = now; }
    frame = requestAnimationFrame(tick);
  };
  const sync = () => {
    cancelAnimationFrame(frame); frame = 0; previous = 0;
    if (!stopped && !paused && !document.hidden && !lost) frame = requestAnimationFrame(tick);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!stars || paused || event.pointerType !== 'mouse') return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const c = material.uniforms.crop.value;
    if (x < 0 || x > 1 || y < 0 || y > 1) material.uniforms.pointer.value.set(-10, -10);
    else material.uniforms.pointer.value.set(c.x + x * c.z, c.y + y * c.w);
  };
  const onPointerLeave = () => material.uniforms.pointer.value.set(-10, -10);
  if (stars) {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
  }
  const onLost = (event: Event) => {
    event.preventDefault(); lost = true; canvas.style.visibility = 'hidden'; sync();
  };
  const onRestored = () => { lost = false; resize(); canvas.style.visibility = ''; sync(); };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);
  document.addEventListener('visibilitychange', sync);
  const observer = new ResizeObserver(resize); observer.observe(canvas);
  resize(); sync();
  return {
    setPaused(next: boolean) { paused = next; sync(); },
    dispose() {
      stopped = true; cancelAnimationFrame(frame); observer.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', sync);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      geometry.dispose(); material.dispose(); photo.dispose(); regions.dispose(); starMap?.texture.dispose(); renderer.dispose();
    },
  };
}
