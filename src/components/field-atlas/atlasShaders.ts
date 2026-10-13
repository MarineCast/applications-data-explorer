export const planeVertex = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
export const baseFragment = `
varying vec2 vUv;
uniform sampler2D coast;uniform sampler2D terrain;uniform float time;uniform float preview;
float grain(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){
 vec2 uv=vec2(vUv.x,1.-vUv.y);vec3 field=texture2D(coast,vec2(uv.x,1.-uv.y)).rgb;
 float land=field.r,d=field.g*100.,inland=field.b*100.;
 vec3 sea=vec3(.38,.55,.57);
 // Three low-contrast shelf bands: distance from shore, not bathymetry.
 sea=mix(vec3(.415,.578,.585),sea,smoothstep(0.,25.,d));
 sea+=vec3(.012,.018,.016)*(1.-smoothstep(28.,36.,d));
 sea+=vec3(.009,.013,.012)*(1.-smoothstep(54.,66.,d));
 float contours=exp(-pow((d-32.)/1.0,2.))+exp(-pow((d-61.)/1.0,2.));
 sea-=vec3(.013,.018,.015)*contours;
 sea+=vec3((grain(uv*vec2(1200.,800.))-.5)*.008);
 vec3 paint=texture2D(terrain,vUv).rgb;
 vec3 ground=mix(vec3(.65,.69,.54),paint,.30);
 ground=mix(vec3(.77,.74,.62),ground,smoothstep(0.,4.,inland));
 // Broad, very faint cloud shade travels with the same west-to-east breeze.
 float shadow=exp(-pow((uv.x*1200.-mod(time*6.+100.,1700.)+250.)/190.,2.)-pow((uv.y*800.-390.)/160.,2.));
 ground*=1.-shadow*.026;
 vec3 color=mix(sea,ground,land);
 // Hover/focus demonstration only: a schematic viewing sector, not a visibility result.
 vec2 p=uv*vec2(1200.,800.)-vec2(790.,385.);
 float r=length(p),a=atan(-p.y,p.x);
 float fan=smoothstep(.12,.14,a)*(1.-smoothstep(1.12,1.14,a))*(1.-smoothstep(245.,250.,r))*smoothstep(5.,18.,r);
 color=mix(color,vec3(.91,.86,.65),fan*preview*.19);
 gl_FragColor=vec4(color,1.);
}`;
export const treeVertex = `
uniform float time;attribute float treePhase;attribute vec2 treeRoot;varying vec2 vUv;
void main(){
 vUv=uv;vec3 p=position;
 float cycle=mod(time-(treeRoot.x-400.)/150.-treeRoot.y/1500.,24.);
 float envelope=cycle<8.?pow(sin(cycle*3.14159265/8.),2.):0.;
 float wind=envelope*(.032+.010*sin(time*.8+treePhase));
 // Unit geometry begins at y=0: trunks and roots remain exactly anchored.
 p.x+=wind*uv.y*uv.y;
 p.y-=abs(wind)*uv.y*uv.y*.035;
 gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.);
}`;
export const treeFragment = `uniform sampler2D map;varying vec2 vUv;void main(){vec4 c=texture2D(map,vUv);if(c.a<.08)discard;gl_FragColor=c;}`;
