export const ATLAS = { width: 1200, height: 800 };
export const LOOKOUT = { x: 790, y: 385, height: 112 };
export function atlasFrame(width: number, height: number) {
    // On phones, frame the island itself while preserving its aspect ratio.
    const sceneWidth = width <= 700 ? 780 : ATLAS.width;
    const scale = Math.min(width / sceneWidth, height / ATLAS.height);
    return { scale, x: (width - ATLAS.width * scale) / 2, y: (height - ATLAS.height * scale) / 2 };
}
/** A shared travelling gust, with 16 quiet seconds between eight-second events. */
export function windAt(time: number, x: number, y: number, phase = 0) {
    const cycle = ((time - (x - 400) / 150 - y / 1500) % 24 + 24) % 24;
    if (cycle >= 8)
        return 0;
    const envelope = Math.sin(cycle * Math.PI / 8) ** 2;
    return envelope * (.032 + .010 * Math.sin(time * .8 + phase));
}
