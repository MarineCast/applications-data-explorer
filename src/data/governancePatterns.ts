import type { MapLayer } from "./map";
import { createCategoryScale } from "./colorScale";
import type { ColorScale, PaletteId } from "./colorScale";

export const membershipPatternLimit = 512;
export const membershipStripeLimit = 6;
export const membershipPatternNote = "Diagonal stripes show recorded memberships, not area shares or the direction of boundaries. Up to six feature colors are shown; a slate stripe marks additional memberships. Dense combinations use a slate hatch. Inspect a cell for every feature and source record.";
function hash(text: string) {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}
/** Stable colors by qualified identity, independent of native row order and resolution. */
export function membershipCategoryScale(layer: MapLayer, palette: PaletteId): ColorScale {
  const scale = createCategoryScale(layer.values, layer.categories ?? [], palette);
  const byKey = new Map<string, string>();
  const used = new Set<string>();
  for (const key of [...(layer.categoryKeys ?? [])].sort()) {
    let color: string, attempt = 0;
    do {
      const value = hash(attempt ? `${key}:${attempt}` : key);
      // A broad RGB gamut avoids quantizing thousands of identities onto a narrow hue ramp.
      color = "#" + [0, 8, 16].map(shift => (35 + Math.round(((value >>> shift) & 255) * .73)).toString(16).padStart(2, "0")).join("");
      attempt++;
    } while (used.has(color));
    used.add(color); byKey.set(key, color);
  }
  const colors = (layer.categoryKeys ?? []).map(key => byKey.get(key)!);
  return { ...scale, colors };
}
export interface MembershipPattern { id: string; colors: readonly string[]; }
export interface MembershipStyles { patterns: MembershipPattern[]; cells: ReadonlyMap<string, string>; }
const cache = new WeakMap<MapLayer, WeakMap<ColorScale, MembershipStyles>>();
/** Bounded per-layer cache. No pattern is generated per cell. */
export function membershipStyles(layer?: MapLayer, scale?: ColorScale): MembershipStyles | undefined {
  if (!layer?.categoryMemberships || !scale) return undefined;
  let scales = cache.get(layer);
  if (!scales) { scales = new WeakMap(); cache.set(layer, scales); }
  const prior = scales.get(scale);
  if (prior) return prior;
  const sets = new Map<string, readonly number[]>();
  const frequencies = new Map<string, number>();
  for (const row of layer.categoryMemberships.values()) if (row?.length) {
    const indices = [...row].sort((a,b) => a-b);
    const key = indices.join(",");
    sets.set(key, indices); frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
  }
  // Single categories use plain fill-color and do not consume atlas images.
  const admitted = new Set([...sets.keys()].filter(key => sets.get(key)!.length > 1).sort((a,b) => frequencies.get(b)! - frequencies.get(a)! || (a < b ? -1 : a > b ? 1 : 0)).slice(0, membershipPatternLimit));
  const patterns = new Map<string, MembershipPattern>();
  const cells = new Map<string,string>();
  const register = (id: string, colors: readonly string[]) => { patterns.set(id,{id,colors}); return id; };
  for (const [cell,row] of layer.categoryMemberships) {
    if (row === null) cells.set(cell, register("membership-unknown", ["#d4d8d4", "#93a0a9"]));
    else if (!row.length) cells.set(cell, register("membership-empty", ["#f5f3e8"]));
    else if (row.length > 1) {
      const sorted = [...row].sort((a,b) => a-b), key = sorted.join(",");
      if (!admitted.has(key)) cells.set(cell, register("membership-dense", ["#64748b", "#d6dee7"]));
      else {
        const colors = sorted.slice(0,membershipStripeLimit).map(index => scale.colors[index]);
        if (sorted.length > membershipStripeLimit) colors.push("#64748b");
        // Full stable set identifies cache entry, never a selected 'dominant' member.
        const id = `membership-set-${hash(JSON.stringify(sorted.map(index => layer.categoryKeys?.[index]))).toString(16)}-${hash(colors.join(",")).toString(16)}`;
        cells.set(cell,register(id,colors));
      }
    }
  }
  const result = { patterns:[...patterns.values()], cells };
  scales.set(scale,result);
  return result;
}
export function stripeImage(colors: readonly string[]) {
  const width=16, height=16, data=new Uint8Array(width*height*4);
  for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
    const color=colors[Math.floor(((x+y)%width)*colors.length/width)];
    const offset=(y*width+x)*4;
    for (let channel=0;channel<3;channel++) data[offset+channel]=parseInt(color.slice(1+channel*2,3+channel*2),16);
    data[offset+3]=255;
  }
  return {width,height,data};
}
export function stripeBackground(colors: readonly string[]) {
  return `repeating-linear-gradient(135deg, ${colors.flatMap((color,i) => [`${color} ${i*8}px`,`${color} ${(i+1)*8}px`]).join(", ")})`;
}
