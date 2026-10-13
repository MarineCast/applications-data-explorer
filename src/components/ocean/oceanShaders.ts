// Pixi v8 filter vertex contract. GLSL resources remain local to the home renderer.
export const vertex = `
precision highp float;
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main() {
 vec2 p = aPosition * uOutputFrame.zw + uOutputFrame.xy;
 p.x = p.x * (2.0 / uOutputTexture.x) - 1.0;
 p.y = p.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
 gl_Position = vec4(p, 0.0, 1.0);
 vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}`;
export const oceanFragment = `
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform float uTime;
uniform float uScale;
uniform vec2 uOffset;
uniform vec2 uSub;
uniform float uHeading;
void main() {
 vec2 pixel = vTextureCoord * uInputSize.xy;
 vec2 world = (pixel - uOffset) / uScale;
 vec2 uv = world / vec2(1672.0, 941.0);
 float water = smoothstep(.344, .40, uv.y);
 float surface = exp(-pow((uv.y - .376) * 38.0, 2.0));
 vec2 source = uv;
 // Wind bends the existing detailed coastal canopy about its shoreline roots.
 float tree = (1.0-smoothstep(.10,.16,uv.x))*(1.0-smoothstep(.26,.33,uv.y));
 float treeHeight = clamp((.32-uv.y)/.28,0.0,1.0);
 source.x += sin(uTime*.65-uv.y*9.0+uv.x*27.0)*.0015*tree*treeHeight*treeHeight;
 source.x += sin(uv.y * 110.0 + uTime * 1.05) * .0011 * water;
 source.y += (sin(uv.x * 68.0 - uTime * 1.25) + sin(uv.x * 115.0 + uTime * .7) * .35) * .0032 * surface;
 // The flexible kelp canopy bends more near its free surface ends.
 float kelp = (1.0 - smoothstep(.20, .34, uv.x)) * water * (1.0 - smoothstep(.68, .87, uv.y));
 source.x += (sin(uv.y * 15.0 + uTime * .67)*.0045+sin(uTime*.31)*.0015) * kelp;
 vec4 color = texture(uTexture, clamp(source, .001, .999) * uOutputFrame.zw * uInputSize.zw);
 float rays = pow(max(0.0, sin(uv.x * 44.0 + uv.y * 9.0 + sin(uTime * .22) * .7)), 14.0);
 color.rgb += vec3(.04, .10, .095) * rays * water * exp(-max(uv.y - .40, 0.0) * 7.0) * .4;
 color.rgb += vec3(.018, .035, .035) * surface * sin(uv.x * 120.0 + uTime * 1.6);
 // Layered streamlines and moving light packets describe an illustrative current field.
 float field = .635 + .049 * sin(uv.x * 8.8 + .2) - .12 * smoothstep(.72, 1.0, uv.x);
 float fade = smoothstep(.37, .53, uv.x) * (1.0 - smoothstep(.95, 1.04, uv.x));
 for (int i = 0; i < 9; i++) {
  float fi = float(i);
  float line = field + fi * .011 + .009 * sin(uv.x * 18.0 + fi * .27 + uTime * .13);
  float d = abs(uv.y - line);
  float pulse = pow(max(0.0, sin(uv.x * 125.0 - uTime * 1.7 + fi * 3.2)), 34.0);
  color.rgb += vec3(.08, .65, .70) * exp(-d * 1400.0) * fade * (.32 + pulse * .8);
 }
 // Submarine headlight follows the independently simulated sprite.
 vec2 beam = world - (uSub + vec2(60.0 * uHeading, 8.0));
 beam.x *= uHeading;
 float cone = smoothstep(-2.0, 8.0, beam.x) * exp(-max(beam.x, 0.0) / 100.0);
 float beamWidth = 5.0 + max(beam.x, 0.0) * .22;
 cone *= exp(-pow(beam.y / beamWidth, 2.0));
 color.rgb += vec3(.63, .70, .62) * cone * 1.05;
 finalColor = color;
}`;
