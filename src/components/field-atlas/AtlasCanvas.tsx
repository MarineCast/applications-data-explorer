/* eslint-disable react-hooks/immutability -- Three.js resources are intentionally mutated in frame/effect callbacks; React state remains immutable. */
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, InstancedBufferAttribute, InstancedMesh, Line, LineBasicMaterial, Matrix4, MeshBasicMaterial, OrthographicCamera, PlaneGeometry, Points, PointsMaterial, ShaderMaterial, SRGBColorSpace, TextureLoader, Vector3 } from 'three';
import { atlasFrame, LOOKOUT } from './atlasMotion';
import { baseFragment, planeVertex, treeFragment, treeVertex } from './atlasShaders';
import grove from './grove.json';
const ROOT = '/assets/home/field-atlas/';
type Props = {
    paused: boolean;
    preview: boolean;
    onReady: () => void;
    host: React.RefObject<HTMLDivElement | null>;
};
function Study({ paused, preview, onReady, host }: Props) {
    const textures = useLoader(TextureLoader, ['coast-field.png', 'terrain.webp', 'lookout.webp', ...Array.from({ length: 6 }, (_, i) => `tree-${i + 1}.webp`)].map(x => ROOT + x));
    const { camera, size, invalidate } = useThree();
    const clock = useMemo(() => ({ value: 0 }), []);
    const count = useRef(0);
    const base = useMemo(() => new ShaderMaterial({ uniforms: { coast: { value: textures[0] }, terrain: { value: textures[1] }, time: clock, preview: { value: 0 } }, vertexShader: planeVertex, fragmentShader: baseFragment, depthWrite: false }), [textures, clock]);
    const trees = useMemo(() => textures.slice(3).map((texture, variant) => {
        const entries = grove.filter(p => p.variant === variant);
        const ratio = texture.image.width / texture.image.height;
        const geometry = new PlaneGeometry(ratio, 1, 4, 12);
        geometry.translate(0, .5, 0);
        geometry.setAttribute('treePhase', new InstancedBufferAttribute(new Float32Array(entries.map(p => p.phase)), 1));
        geometry.setAttribute('treeRoot', new InstancedBufferAttribute(new Float32Array(entries.flatMap(p => [p.x, p.y])), 2));
        const material = new ShaderMaterial({ uniforms: { map: { value: texture }, time: clock }, vertexShader: treeVertex, fragmentShader: treeFragment, transparent: true });
        const mesh = new InstancedMesh(geometry, material, entries.length);
        const matrix = new Matrix4();
        entries.forEach((p, i) => { matrix.makeScale(p.height, p.height, 1); matrix.setPosition(p.x, 800 - p.y, 20 + p.y * .01); mesh.setMatrixAt(i, matrix); });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.frustumCulled = false;
        return mesh;
    }), [textures, clock]);
    // A handful of slow current tracks in open water, independent of wind.
    const currents = useMemo(() => {
        const routes = [[[135, 615], [135, 495], [172, 372], [223, 268]], [[130, 590], [120, 455], [159, 314], [240, 211]], [[934, 535], [1001, 450], [1027, 365], [1030, 265]], [[884, 721], [992, 670], [1080, 530], [1090, 380]], [[381, 115], [523, 104], [710, 105], [855, 158]]];
        const paths = routes.map(points => {
            const [a, b, c, d] = points;
            const vertices: Vector3[] = [];
            for (let i = 0; i <= 80; i++) {
                const t = i / 80, s = 1 - t;
                vertices.push(new Vector3(s * s * s * a[0] + 3 * s * s * t * b[0] + 3 * s * t * t * c[0] + t * t * t * d[0], 800 - (s * s * s * a[1] + 3 * s * s * t * b[1] + 3 * s * t * t * c[1] + t * t * t * d[1]), 3));
            }
            const geometry = new BufferGeometry().setFromPoints(vertices), material = new LineBasicMaterial({ color: '#d5e2d9', transparent: true, opacity: .26 });
            return { line: new Line(geometry, material), vertices };
        });
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new BufferAttribute(new Float32Array(paths.length * 3), 3));
        const material = new PointsMaterial({ color: '#eee7d3', size: 2.1, sizeAttenuation: false, transparent: true, opacity: .7 });
        return { paths, particles: new Points(geometry, material) };
    }, []);
    const towerMaterial = useMemo(() => { textures[2].colorSpace = SRGBColorSpace; return new MeshBasicMaterial({ map: textures[2], transparent: true, alphaTest: .08 }); }, [textures]);
    useLayoutEffect(() => {
        const frame = atlasFrame(size.width, size.height), cam = camera as OrthographicCamera;
        cam.left = -frame.x / frame.scale;
        cam.right = (size.width - frame.x) / frame.scale;
        cam.top = 800 + frame.y / frame.scale;
        cam.bottom = 800 - (size.height - frame.y) / frame.scale;
        cam.position.set(0, 0, 1000);
        cam.near = .1;
        cam.far = 2000;
        cam.updateProjectionMatrix();
        invalidate();
    }, [camera, size, invalidate]);
    useEffect(() => { base.uniforms.preview.value = preview ? 1 : 0; invalidate(); }, [preview, base, invalidate]);
    useEffect(() => { onReady(); }, [onReady]);
    useEffect(() => () => {
        base.dispose();
        towerMaterial.dispose();
        trees.forEach(mesh => { mesh.geometry.dispose(); (mesh.material as ShaderMaterial).dispose(); });
        currents.paths.forEach(({ line }) => { line.geometry.dispose(); (line.material as LineBasicMaterial).dispose(); });
        currents.particles.geometry.dispose();
        (currents.particles.material as PointsMaterial).dispose();
    }, [base, trees, currents, towerMaterial]);
    useFrame((_, delta) => {
        if (!paused)
            clock.value += Math.min(delta, .05);
        const positions = currents.particles.geometry.getAttribute('position') as BufferAttribute;
        currents.paths.forEach(({ vertices }, i) => {
            const t = ((clock.value * .021 + i * .21) % 1) * 80, index = Math.floor(t), next = Math.min(80, index + 1), blend = t - index;
            positions.setXYZ(i, vertices[index].x * (1 - blend) + vertices[next].x * blend, vertices[index].y * (1 - blend) + vertices[next].y * blend, 4);
        });
        positions.needsUpdate = true;
        count.current++;
        if (host.current) {
            host.current.dataset.sceneTime = clock.value.toFixed(3);
            host.current.dataset.frameCount = String(count.current);
            host.current.dataset.wind = String(Math.round(clock.value));
        }
    });
    return <>
  <mesh position={[600, 400, 0]} material={base}><planeGeometry args={[1200, 800]}/></mesh>
  {currents.paths.map(({ line }, i) => <primitive key={i} object={line} dispose={null}/>)}
  <primitive object={currents.particles} dispose={null}/>
  {trees.map((tree, i) => <primitive key={i} object={tree} dispose={null}/>)}
  <mesh position={[LOOKOUT.x, 800 - LOOKOUT.y + LOOKOUT.height / 2, 50]} material={towerMaterial}>
   <planeGeometry args={[LOOKOUT.height * textures[2].image.width / textures[2].image.height, LOOKOUT.height]}/>
  </mesh>
 </>;
}
export default function AtlasCanvas(props: Props) {
    return <Canvas orthographic camera={{ position: [0, 0, 1000], near: .1, far: 2000 }} dpr={[1, 1.5]} frameloop={props.paused ? 'demand' : 'always'} gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}>
  <Suspense fallback={null}><Study {...props}/></Suspense>
 </Canvas>;
}
