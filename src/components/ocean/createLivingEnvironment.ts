import { BufferAttribute, BufferGeometry, Color, DoubleSide, HemisphereLight, DirectionalLight, Mesh, MeshStandardMaterial, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector3, WebGLRenderer } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { coverTransform, WORLD } from "./oceanMotion";
import { cloudFragment, environmentVertex, waterFragment } from "./livingShaders";

export type LivingEnvironment = Awaited<ReturnType<typeof createLivingEnvironment>>;

/** Decorative world coordinates; this scene does not represent measured conditions. */
export async function createLivingEnvironment(host: HTMLDivElement, signal: AbortSignal) {
  const renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.setClearColor(0, 0);
  renderer.domElement.className = "living-environment";
  renderer.domElement.setAttribute("aria-hidden", "true");
  const scene = new Scene();
  const camera = new OrthographicCamera(0, WORLD.width, WORLD.height, 0, .1, 5000);
  camera.position.z = 2000;
  scene.add(new HemisphereLight(0xd4f1d1, 0x063a42, 2.1));
  const sun = new DirectionalLight(0xffe4a9, 2.0);
  sun.position.set(-500, 1600, 1000); scene.add(sun);
  const time = { value: 0 };
  const rippleValues = Array.from({ length: 5 }, () => new Vector3(0, 0, -100));
  let rippleIndex = 0;
  const water = new Mesh(new PlaneGeometry(1672, 90), new ShaderMaterial({
    uniforms: { time, ripples: { value: rippleValues } },
    vertexShader: environmentVertex, fragmentShader: waterFragment,
    transparent: true, depthWrite: false,
  }));
  water.position.set(836, 941 - 352, 30); scene.add(water);
  const clouds = [
    { x: 1160, y: 126, width: 830, height: 235, speed: 1.2 },
    { x: 421, y: 175, width: 310, height: 100, speed: .7 },
    { x: 725, y: 80, width: 205, height: 68, speed: .9 },
  ].map((p, i) => {
    const mesh = new Mesh(new PlaneGeometry(p.width, p.height), new ShaderMaterial({
      uniforms: { time, seed: { value: i * 3.71 } }, vertexShader: environmentVertex,
      fragmentShader: cloudFragment, transparent: true, depthWrite: false,
    }));
    mesh.position.set(p.x, 941 - p.y, 10); scene.add(mesh);
    return { mesh, ...p };
  });
  const geometries: BufferGeometry[] = [];
  const plants: { mesh: Mesh; force: { value: number }; rootX: number; rootY: number }[] = [];
  let disposed = false;
  let lost = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    renderer.domElement.removeEventListener("webglcontextlost", contextLost);
    renderer.domElement.removeEventListener("webglcontextrestored", contextRestored);
    scene.traverse(object => {
      if (object instanceof Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => material.dispose());
      }
    });
    geometries.forEach(geometry => geometry.dispose());
    renderer.dispose(); renderer.domElement.remove();
  };
  const contextLost = (event: Event) => { event.preventDefault(); lost = true; renderer.domElement.style.visibility = "hidden"; };
  const contextRestored = () => { lost = false; renderer.domElement.style.visibility = "visible"; };
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  renderer.domElement.addEventListener("webglcontextrestored", contextRestored);
  try {
    const model = await new GLTFLoader().loadAsync("/assets/home/ocean/living-coast/rooted-kelp.glb");
    model.scene.updateMatrixWorld(true);
    model.scene.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      geometry.applyMatrix4(object.matrixWorld);
      for (const name of Object.keys(geometry.attributes)) if (name !== "position" && name !== "normal") geometry.deleteAttribute(name);
      const material = Array.isArray(object.material) ? object.material[0] : object.material;
      const color = material.color instanceof Color ? material.color : new Color(0x69742b);
      const colors = new Float32Array(geometry.attributes.position.count * 3);
      for (let i = 0; i < colors.length; i += 3) { colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b; }
      geometry.setAttribute("color", new BufferAttribute(colors, 3));
      geometries.push(geometry);
      object.geometry.dispose();
      (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => m.dispose());
    });
    const geometry = mergeGeometries(geometries);
    if (!geometry) throw new Error("Kelp geometry could not be assembled");
    geometries.push(geometry);
    const positions = [
      [72, 706, 305], [173, 761, 340], [268, 775, 365], [378, 832, 366], [464, 837, 295], [557, 769, 168],
      [1100, 702, 66], [1266, 683, 102], [1379, 672, 77], [1530, 660, 118], [1614, 678, 104],
    ];
    positions.forEach(([x, y, height], index) => {
      const force = { value: 0 };
      const material = new MeshStandardMaterial({ color: index < 6 ? 0xb3bc76 : 0x387e71, vertexColors: true, roughness: .9, side: DoubleSide });
      material.onBeforeCompile = shader => {
        shader.uniforms.coastTime = time;
        shader.uniforms.coastForce = force;
        shader.uniforms.coastPhase = { value: index * 1.79 };
        shader.vertexShader = `uniform float coastTime; uniform float coastForce; uniform float coastPhase;\n` + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `
          vec3 transformed=vec3(position);
          float h=clamp(position.y/4.7,0.,1.);
          float sway=sin(coastTime*.67-h*2.4+coastPhase)*.24+sin(coastTime*.31+coastPhase)*.12;
          transformed.x+=(sway+coastForce)*h*h;
          transformed.z+=sin(coastTime*.83-h*4.+coastPhase)*h*h*.16;
          transformed.x+=sin(coastTime*1.65+position.y*7.+coastPhase)*abs(position.x)*h*.035;
        `);
      };
      const mesh = new Mesh(geometry, material);
      mesh.position.set(x, 941 - y, 80);
      mesh.scale.setScalar(height / 4.7);
      mesh.rotation.y = index * 1.8;
      // The GPU bends beyond the unmodified Blender bounds.
      mesh.frustumCulled = false;
      scene.add(mesh); plants.push({ mesh, force, rootX: x, rootY: y });
    });
    if (signal.aborted) { dispose(); return undefined; }
    host.appendChild(renderer.domElement);
    host.dataset.environment = "live";
    return {
      draw(seconds: number, delta: number, pointer: { x: number; y: number }, parallax: { x: number; y: number }) {
        if (disposed || lost) return;
        time.value = seconds;
        scene.position.set(parallax.x, -parallax.y, 0);
        clouds.forEach(cloud => {
          cloud.mesh.position.x = cloud.x + Math.sin(seconds * .012) * 100 * cloud.speed;
          cloud.mesh.position.y = 941 - cloud.y + Math.sin(seconds * .045 + cloud.x) * 2;
        });
        plants.forEach(plant => {
          const distance = Math.hypot(pointer.x - plant.rootX, (pointer.y - plant.rootY + 140) * .65);
          const push = Math.exp(-distance * distance / 23000) * Math.max(-.45, Math.min(.45, (pointer.x - plant.rootX) / 130));
          plant.force.value += (push - plant.force.value) * Math.min(delta * 2, 1);
        });
        renderer.render(scene, camera);
      },
      ripple(x: number, y: number, seconds: number) {
        rippleValues[rippleIndex].set(x, y, seconds);
        rippleIndex = (rippleIndex + 1) % rippleValues.length;
      },
      resize(width: number, height: number) {
        renderer.setSize(width, height);
        const t = coverTransform(width, height);
        camera.left = -t.x / t.scale; camera.right = (width - t.x) / t.scale;
        camera.top = 941 + t.y / t.scale; camera.bottom = 941 - (height - t.y) / t.scale;
        camera.updateProjectionMatrix();
      },
      destroy: dispose,
    };
  } catch (error) { dispose(); throw error; }
}
