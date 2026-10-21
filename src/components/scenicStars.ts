import { CanvasTexture } from 'three';
import catalog from '../data/scenicStarCatalog.json';
import { horizontal, precess } from '../data/northernSky';

// North-facing panorama at the existing San Juan Islands observer. The vertical
// angle is compressed into the artwork's sky, so this is not a navigation chart.
export function scenicStarPositions(date: Date) {
  return catalog.flatMap(([ra, dec, magnitude]) => {
    const [r, d] = precess(ra, dec, date);
    const { altitude, azimuth } = horizontal(r, d, date);
    const bearing = ((azimuth + 180) % 360) - 180;
    if (altitude < 0 || Math.abs(bearing) > 100) return [];
    return [{ x: (bearing + 100) / 200, y: 0.165 * (1 - altitude / 90), magnitude }];
  });
}

export function createScenicStars() {
  const canvas = document.createElement('canvas');
  canvas.width = 3344; canvas.height = 1882;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Star canvas unavailable');
  const texture = new CanvasTexture(canvas);
  let updatedAt = 0;
  const update = (now = Date.now()) => {
    if (updatedAt && now - updatedAt < 60000) return;
    updatedAt = now;
    context.fillStyle = '#000'; context.fillRect(0, 0, canvas.width, canvas.height);
    for (const star of scenicStarPositions(new Date(now))) {
      const x = star.x * canvas.width, y = star.y * canvas.height;
      const brightness = Math.min(1, 0.05 + Math.pow(10, -0.24 * (star.magnitude - 1)));
      const radius = Math.max(0.8, 2.1 - star.magnitude * 0.19);
      const glow = context.createRadialGradient(x, y, 0, x, y, radius * 3.5);
      glow.addColorStop(0, `rgba(255,255,255,${brightness * 0.28})`);
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = glow; context.fillRect(x-radius*3.5,y-radius*3.5,radius*7,radius*7);
      context.fillStyle = `rgba(255,255,255,${brightness})`;
      context.beginPath(); context.arc(x,y,radius,0,Math.PI*2); context.fill();
    }
    texture.needsUpdate = true;
  };
  update();
  return { texture, update };
}
