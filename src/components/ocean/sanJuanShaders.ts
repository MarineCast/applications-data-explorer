export { vertex } from './oceanShaders';
export const islandFragment = `
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform sampler2D uLand;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform float uTime;
uniform float uScale;
uniform float uHeat;
uniform vec2 uOffset;
void main() {
 vec2 p = (vTextureCoord * uInputSize.xy - uOffset) / uScale;
 vec2 uv = clamp(p / vec2(1536.,1024.),.001,.999);
 vec2 fit = uOutputFrame.zw * uInputSize.zw;
 vec4 still = texture(uTexture, uv * fit);
 float land = texture(uLand, uv).r;
 // Both the surveyed mask and painted sand/trees stay completely stationary.
 float blue = smoothstep(.03,.15,still.b-still.r);
 float water = (1.-smoothstep(.02,.25,land))*blue;
 vec2 flow = vec2(sin(uv.y*38.+uTime*.7)+.4*sin(uv.y*81.-uTime), cos(uv.x*53.-uTime*.9));
 vec2 shift = flow * vec2(.0018,.0012) * water;
 vec4 color = texture(uTexture, clamp(uv+shift,.001,.999)*fit);
 float shimmer=sin(uv.y*265.+sin(uv.x*38.)*3.-uTime*2.2)*sin(uv.x*177.+uTime*.8);
 color.rgb += vec3(.023,.041,.04)*shimmer*water;
 // Decorative warm-water bloom: a soft, irregular field that disappears fully every cycle.
 vec2 h=(p-vec2(150.+sin(uTime*.12)*13.,644.))/vec2(95.,125.);
 float blob=exp(-dot(h,h)*1.9)*( .86+.14*sin(h.y*5.+h.x*3.+uTime*.25));
 vec3 heat=mix(vec3(1.,.8,.25),vec3(1.,.29,.13),exp(-dot(h,h)*5.));
 color.rgb=mix(color.rgb,heat,blob*uHeat*water);
 finalColor=color;
}`;
