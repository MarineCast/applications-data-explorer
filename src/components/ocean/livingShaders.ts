export const environmentVertex = `
varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;

// A translucent surface layer: overlapping wave slopes catch sky light and foam.
export const waterFragment = `
uniform float time;
uniform vec3 ripples[5];
varying vec2 vUv;
void main(){
 vec2 p=vec2(vUv.x*1672.,(1.-vUv.y)*90.+307.);
 float depth=smoothstep(0.,1.,1.-vUv.y);
 float phase=p.x*.042+sin(p.x*.012-time*.6)*1.4-time*1.55;
 float w=sin(phase+p.y*.45)+.42*sin(p.x*.086-p.y*.9+time*2.1);
 float ridge=pow(max(0.,w*.7),6.);
 float glint=pow(max(0.,sin(p.x*.34+time)*sin(p.y*.71-time*1.4)),12.);
 float ring=0.;
 for(int i=0;i<5;i++){
  float age=time-ripples[i].z;
  vec2 d=p-ripples[i].xy;d.y*=3.;
  float radius=length(d);
  float envelope=exp(-pow((radius-age*68.)/16.,2.))*exp(-age*.8)*step(0.,age)*step(age,6.);
  ring+=envelope*(.5+.5*cos(radius*.3-age*18.));
 }
 float edge=smoothstep(0.,.18,vUv.y)*smoothstep(0.,.15,1.-vUv.y);
 vec3 color=mix(vec3(.04,.32,.39),vec3(.67,.87,.86),clamp(ridge*.7+glint*.7+ring,0.,1.));
 gl_FragColor=vec4(color,edge*(.13+ridge*.16+glint*.22+ring*.6)*(.6+.4*depth));
}`;

// Bounded volume integration through drifting, deforming cloud lobes.
export const cloudFragment = `
uniform float time;
uniform float seed;
varying vec2 vUv;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise(vec3 p){
 vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float density(vec3 p){
 float shape=0.;
 for(int i=0;i<6;i++){
  float f=float(i);
  vec3 c=vec3((f-2.5)*.52,sin(f*2.4+seed)*.21,cos(f*1.7)*.1);
  vec3 q=(p-c)/vec3(.55,.42+sin(f*3.1+seed)*.14,.48);
  shape=max(shape,1.-dot(q,q));
 }
 vec3 q=p*4.5+vec3(time*.021,0.,seed);
 float n=noise(q)*.65+noise(q*2.1)*.25+noise(q*4.2)*.1;
 return max(0.,shape-(1.-n)*.68)*1.8;
}
void main(){
 vec3 p=vec3((vUv.x-.5)*4.3,(vUv.y-.46)*1.7,-.8);
 vec4 sum=vec4(0.);
 for(int i=0;i<14;i++){
  p.z+=.115;
  float d=density(p);
  float lighting=clamp((d-density(p+vec3(-.15,.2,-.16)))*2.2+.65,.15,1.);
  vec3 c=mix(vec3(.52,.64,.68),vec3(1.,.96,.87),lighting);
  float a=1.-exp(-d*.38);
  sum.rgb+=(1.-sum.a)*a*c;sum.a+=(1.-sum.a)*a;
 }
 if(sum.a<.002)discard;
 gl_FragColor=vec4(sum.rgb/max(sum.a,.001),sum.a);
}`;
