import { ShaderMaterial } from 'three';

/** Continuous world-space cloud banks. Advection never wraps or resets at map edges. */
export function seaMist(clock: { value: number }, layer = 0) {
  return new ShaderMaterial({
    uniforms: { time: clock, layer: {value: layer} }, transparent: true, depthWrite: false,
    vertexShader: `varying vec2 world;void main(){vec4 p=modelMatrix*vec4(position,1.);world=p.xz;gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader: `
      varying vec2 world;uniform float time;uniform float layer;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*f*(f*(f*6.-15.)+10.);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
      float cloud(vec2 p){mat2 r=mat2(.8,-.6,.6,.8);return noise(p)*.48+noise(r*p*2.03+11.)*.26+noise(p*4.11+23.)*.14+noise(r*p*8.23)*.08+noise(p*16.47)*.04;}
      void main(){
        vec2 p=(world-vec2(time*.85,time*.24))/19.+vec2(7.4,13.2)+layer*.21;
        float n=cloud(p);
        float body=smoothstep(.58,.74,n);
        float sun=clamp(.55+(n-cloud(p+vec2(-.12,.16)))*3.5,0.,1.);
        vec3 color=mix(vec3(.61,.69,.70),vec3(.96,.96,.91),sun);
        gl_FragColor=vec4(color,body*(layer<.5?.84:.42));
      }
    `,
  });
}
