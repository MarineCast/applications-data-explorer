import { describe, it, expect } from "vitest";
import { decodeGovernanceMemberships, governanceIdentityView } from "./governanceMemberships";
import { membershipCategoryScale, membershipStyles, membershipPatternLimit, stripeImage } from "./governancePatterns";
import fixture from "./governanceMemberships.fixture.json";
import type { MapLayer } from "./map";
function layerFixture() {
  const view = governanceIdentityView(decodeGovernanceMemberships(fixture, fixture), ["a","b","c","d"]);
  return { ...view, id:"governance", name:"Areas", unit:"membership", range:[0,2], resolution:6, cells:[], sourceLabel:"test" } as MapLayer;
}
describe("categorical membership patterns", () => {
  it("retains constituent colors in overlap and distinguishes unknown from verified empty", () => {
    const layer = layerFixture(), scale = membershipCategoryScale(layer,"ocean");
    const styles = membershipStyles(layer,scale)!;
    expect(styles).toBe(membershipStyles(layer,scale));
    expect(styles.cells.get("b")).toBe("membership-unknown");
    expect(styles.cells.get("c")).toBe("membership-empty");
    expect(styles.cells.has("d")).toBe(false);
    const mixed = styles.patterns.find(pattern => pattern.id === styles.cells.get("a"))!;
    expect(mixed.colors).toEqual(scale.colors.slice(0,2));
    const image = stripeImage(mixed.colors);
    expect(image.data).toHaveLength(16*16*4);
    expect(new Set(Array.from(image.data.filter((_,i) => i%4 === 3)))).toEqual(new Set([255]));
  });
  it("keeps identity colors stable across resolution and row order", () => {
    const a = layerFixture(), b = { ...a, resolution:8, categoryKeys:[...a.categoryKeys!].reverse(), categories:[...a.categories!].reverse() };
    expect(membershipCategoryScale(a,"ocean").colors).toEqual([...membershipCategoryScale(b,"warm").colors].reverse());
  });
  it("assigns distinct colors to a large identity key independent of category order", () => {
    const layer=layerFixture();
    layer.categoryKeys=Array.from({length:6000},(_,i)=>`feature:${i}`);
    layer.categories=[...layer.categoryKeys];
    const first=membershipCategoryScale(layer,"ocean");
    expect(new Set(first.colors).size).toBe(6000);
    const reverse=membershipCategoryScale({...layer,categoryKeys:[...layer.categoryKeys].reverse(),categories:[...layer.categories].reverse()},"ocean");
    expect(first.colors).toEqual([...reverse.colors].reverse());
  });
  it("marks more than six memberships without dropping any identity from the cell", () => {
    const layer=layerFixture();
    layer.categoryKeys=Array.from({length:8},(_,i)=>`feature:${i}`);
    layer.categories=[...layer.categoryKeys];
    layer.categoryMemberships=new Map([["many",[0,1,2,3,4,5,6,7]]]);
    const pattern=membershipStyles(layer,membershipCategoryScale(layer,"ocean"))!.patterns[0];
    expect(pattern.colors).toHaveLength(7);
    expect(pattern.colors.at(-1)).toBe("#64748b");
    expect(layer.categoryMemberships.get("many")).toHaveLength(8);
  });
  it("bounds pattern count and marks many memberships without losing source data", () => {
    const layer = layerFixture();
    layer.categoryKeys = Array.from({length:membershipPatternLimit+102},(_,i) => `feature:${i}`);
    layer.categories = [...layer.categoryKeys];
    layer.categoryMemberships = new Map(Array.from({length:membershipPatternLimit+100},(_,i) => [String(i),[i,i+1]]));
    const styles=membershipStyles(layer,membershipCategoryScale(layer,"ocean"))!;
    expect(styles.patterns.length).toBeLessThanOrEqual(membershipPatternLimit+1);
    expect(styles.patterns.some(p => p.id === "membership-dense")).toBe(true);
    expect(layer.categoryMemberships.size).toBe(membershipPatternLimit+100);
    expect(membershipStyles({ ...layer, categoryMemberships:undefined },membershipCategoryScale(layer,"ocean"))).toBeUndefined();
  });
});
