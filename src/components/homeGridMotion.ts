const ART_WIDTH = 1536;
const ART_HEIGHT = 1024;

// The coarse hex band in the supplied artwork is flat-topped, with roughly
// 27px column spacing and 31px row spacing. Candidates are retained only where
// the source image itself contains blue grid paint (not terrain or UI).
export function gridCandidates() {
  const points: {
    x: number;
    y: number;
    phase: number;
    period: number;
    twinkles: boolean;
  }[] = [];
  for (let column = -8; column < 19; column++) {
    for (let row = -12; row < 23; row++) {
      const x = 568 + column * 27;
      const y = 354 + row * 31.2 + (Math.abs(column) % 2) * 15.6;
      if (y < 0 || y > ART_HEIGHT || x < 330 + y * 0.4) continue;
      const seed = Math.abs(column * 113 + row * 53);
      points.push({
        x,
        y,
        phase: (seed % 97) / 97,
        period: 16 + (seed % 13),
        twinkles: seed % 5 === 0,
      });
    }
  }
  return points;
}

export function artworkTransform(width: number, height: number) {
  const scale = Math.max(width / ART_WIDTH, height / ART_HEIGHT);
  return {
    scale,
    x: (width - ART_WIDTH * scale) * (width <= 700 ? 0.1 : 0),
    y: (height - ART_HEIGHT * scale) * 0.5,
  };
}
