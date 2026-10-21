import { DoubleSide, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, Texture } from 'three';

/** World-space texture detail follows the modeled relief, including steep cliff faces. */
export function terrainMaterial(rock: Texture, snowy = false) {
  rock.wrapS = rock.wrapT = RepeatWrapping;
  rock.colorSpace = SRGBColorSpace;
  const material = new MeshStandardMaterial({ color: '#ffffff', roughness: .94, side: DoubleSide });
  material.onBeforeCompile = shader => {
    shader.uniforms.rockTexture = { value: rock };
    shader.vertexShader = 'varying vec3 terrainWorld; varying vec3 terrainNormal;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n terrainWorld=(modelMatrix*vec4(transformed,1.)).xyz; terrainNormal=normalize(mat3(modelMatrix)*objectNormal);');
    shader.fragmentShader = `
      uniform sampler2D rockTexture; varying vec3 terrainWorld; varying vec3 terrainNormal;
      float hashTerrain(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noiseTerrain(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hashTerrain(i),hashTerrain(i+vec2(1,0)),f.x),mix(hashTerrain(i+vec2(0,1)),hashTerrain(i+vec2(1)),f.x),f.y);}
      vec3 rockAt(vec3 p,vec3 n){vec3 w=pow(abs(n),vec3(6.));w/=w.x+w.y+w.z;return texture2D(rockTexture,p.zy*.34).rgb*w.x+texture2D(rockTexture,p.xz*.34).rgb*w.y+texture2D(rockTexture,p.xy*.34).rgb*w.z;}
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec3 p=terrainWorld;vec3 n=normalize(terrainNormal);
      float meadowPatch=noiseTerrain(p.xz*.45)*.6+noiseTerrain(p.xz*1.8)*.28+noiseTerrain(p.xz*7.)*.12;
      vec3 stone=rockAt(p,n);
      vec3 meadow=mix(vec3(.08,.13,.075),vec3(.20,.28,.15),smoothstep(.15,.9,meadowPatch));
      meadow*=.78+texture2D(rockTexture,p.xz*.75).g*.5;
      float cliff=smoothstep(.20,.51,1.-abs(n.y));
      float shoreType=noiseTerrain(p.xz*.12);
      float shore=1.-smoothstep(.10,.42,p.y);
      cliff=max(cliff,shore*smoothstep(.40,.62,shoreType)*.85);
      vec3 beach=vec3(.36,.34,.26);
      meadow=mix(meadow,beach,shore*(1.-smoothstep(.35,.52,shoreType))*.72);
      cliff=max(cliff,smoothstep(.73,.87,meadowPatch)*.65);
      diffuseColor.rgb=mix(meadow,stone*.65,cliff);
      ${snowy ? `float snowline=11.5+noiseTerrain(p.xz*.24)*2.0;
      float snow=smoothstep(snowline,snowline+2.5,p.y);
      snow*=smoothstep(.48,.88,abs(n.y)+noiseTerrain(p.xz*1.4)*.18);
      vec3 alpineRock=mix(stone*.56,vec3(.30,.36,.40),.35);
      diffuseColor.rgb=mix(diffuseColor.rgb,alpineRock,smoothstep(6.,11.,p.y));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.65,.72,.73),snow*.85);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.29,.39,.42),smoothstep(3.,14.,p.y)*.22);` : ''}
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      float grit=dot(rockAt(terrainWorld,normalize(terrainNormal)),vec3(.333));
      normal=normalize(normal + vec3(dFdx(grit),dFdy(grit),0.)*.28);
    `);
  };
  material.customProgramCacheKey = () => snowy ? 'snowy-regional-v2' : 'coastal-ground-v1';
  return material;
}

export const detailedWaterFragment = `
 varying vec2 world; uniform vec4 region; uniform sampler2D coast; uniform float time; uniform vec2 boat; uniform float boatScale; uniform vec2 whale; uniform float splash;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
 float wave(vec2 p){return sin(p.x*.7+p.y*.55+time*.8)*.08+sin(p.x*2.8-p.y*1.9-time*1.1)*.025+sin(p.x*8.+p.y*4.2+time*1.3)*.007+noise(p*2.+time*.06)*.08;}
 void main(){
  vec2 p=world;vec2 uv=vec2((p.x-region.x)/(region.y-region.x),(p.y+region.w)/(region.w-region.z));
  float edge=smoothstep(0.,.035,min(min(uv.x,uv.y),min(1.-uv.x,1.-uv.y)));
  float d=texture2D(coast,clamp(uv,0.,1.)).g*100.;
  // Broad, irregular channel shading; only the narrow littoral edge is pale.
  float seabed=noise(p*.09)*.65+noise(p*.21+17.)*.35;
  float channel=(1.-smoothstep(3.,65.,d))*(.3+seabed*.5);
  vec3 c=mix(vec3(.055,.145,.20),vec3(.13,.31,.36),channel);
  c+=vec3(.008,.014,.016)*(seabed-.5);
  float shallow=(1.-smoothstep(.2,3.5+seabed*2.,d))*edge;
  c=mix(c,vec3(.30,.44,.42),shallow*.48);
  float h=wave(p);vec3 n=normalize(vec3((h-wave(p+vec2(.04,0.)))/.04,1.,(wave(p+vec2(0.,.04))-h)/.04));
  vec3 viewDir=normalize(cameraPosition-vec3(p.x,0.,-p.y));
  vec3 lightDir=normalize(vec3(-.5,.8,.55));
  float shine=pow(max(dot(reflect(-lightDir,n),viewDir),0.),80.);
  c+=vec3(.8,.85,.76)*shine*.14;
  float streak=pow(max(0.,sin(p.x*2.8+p.y*4.1+h*8.+time)),28.)*smoothstep(.57,.83,noise(p*.9+time*.06));
  c+=vec3(.025,.045,.045)*streak;
  float foam=exp(-pow((d-1.6-sin(time*.6+p.x*.8)*.45)/.75,2.))*edge;
  c=mix(c,vec3(.55,.64,.59),foam*.16*smoothstep(.35,.7,noise(p*.7)));
  float bow=exp(-pow((length(p-boat)/boatScale-.95)*3.,2.));c+=bow*.025;
  float r=length(p-whale);float rings=exp(-pow((r/.22-splash*8.)*2.5,2.))*(1.-splash)*step(.01,splash);c+=rings*.32;
  // Broad moving cloud shadows: separate from the wave frequencies.
  float cloud=pow(noise(p*.045+vec2(time*.005,0.)),4.);c*=1.-cloud*.13;
  gl_FragColor=vec4(c,1.);
 }`;
