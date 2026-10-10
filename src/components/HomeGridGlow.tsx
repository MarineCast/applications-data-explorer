import { useEffect, useRef } from "react";

const ART_WIDTH = 1536;
const ART_HEIGHT = 1024;
const TAU = Math.PI * 2;

import { artworkTransform, gridCandidates } from "./homeGridMotion";

export default function HomeGridGlow({ paused = false }: { paused?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const container = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !container || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hover = window.matchMedia("(hover: hover) and (pointer: fine)");
    const image = new Image();
    const mask = document.createElement("canvas");
    const layer = document.createElement("canvas");
    mask.width = layer.width = ART_WIDTH;
    mask.height = layer.height = ART_HEIGHT;
    const maskCtx = mask.getContext("2d", { willReadFrequently: true });
    const layerCtx = layer.getContext("2d");
    if (!maskCtx || !layerCtx) return;
    let disposed = false;
    let ready = false;
    let frame = 0;
    let last = 0;
    let elapsed = 0;
    let width = 0;
    let height = 0;
    let points: ReturnType<typeof gridCandidates> = [];
    const pointer = { x: -1000, y: -1000, active: false, strength: 0 };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
    };
    const resize = () => {
      pointer.active = false;
      const box = container.getBoundingClientRect();
      width = box.width;
      height = box.height;
      // Cap resolution rather than drawing at unbounded display density.
      const density = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * density);
      canvas.height = Math.round(height * density);
      ctx.setTransform(density, 0, 0, density, 0, 0);
    };
    const draw = (now: number) => {
      if (disposed || reduced.matches || document.hidden || paused) return;
      frame = requestAnimationFrame(draw);
      if (last && now - last < 33) return; // At most 30 rendered frames/second.
      const delta = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      elapsed += delta;
      pointer.strength +=
        ((pointer.active ? 1 : 0) - pointer.strength) * Math.min(delta * 3, 1);
      layerCtx.clearRect(0, 0, ART_WIDTH, ART_HEIGHT);
      const breath = (1 - Math.cos((elapsed * TAU) / 14)) / 2;
      layerCtx.fillStyle = `rgba(205,239,255,${0.018 + breath * 0.055})`;
      layerCtx.fillRect(0, 0, ART_WIDTH, ART_HEIGHT);
      for (const point of points) {
        const cycle = (elapsed / point.period + point.phase) % 1;
        // A rounded ~4 second swell, with a long quiet interval per cell.
        const twinkle =
          point.twinkles && cycle < 0.22
            ? Math.sin((cycle / 0.22) * Math.PI) ** 2
            : 0;
        const distance = Math.hypot(point.x - pointer.x, point.y - pointer.y);
        const proximity =
          Math.max(0, 1 - distance / 135) ** 2 * pointer.strength;
        const alpha = twinkle * 0.15 + proximity * 0.22;
        if (alpha < 0.004) continue;
        const glow = layerCtx.createRadialGradient(
          point.x,
          point.y,
          0,
          point.x,
          point.y,
          24,
        );
        glow.addColorStop(0, `rgba(205,241,255,${alpha})`);
        glow.addColorStop(0.55, `rgba(179,230,255,${alpha * 0.65})`);
        glow.addColorStop(1, "rgba(179,230,255,0)");
        layerCtx.fillStyle = glow;
        layerCtx.fillRect(point.x - 24, point.y - 24, 48, 48);
      }
      // The source-derived alpha mask restricts light to the existing blue
      // grid band, including irregular coastline cells; nothing floats over land.
      layerCtx.globalCompositeOperation = "destination-in";
      layerCtx.drawImage(mask, 0, 0);
      layerCtx.globalCompositeOperation = "source-over";
      const transform = artworkTransform(width, height);
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(
        layer,
        transform.x,
        transform.y,
        ART_WIDTH * transform.scale,
        ART_HEIGHT * transform.scale,
      );
    };
    const sync = () => {
      stop();
      pointer.active = false;
      if (reduced.matches) {
        ctx.clearRect(0, 0, width, height);
        canvas.dataset.motion = "reduced";
      } else if (document.hidden || paused) {
        canvas.dataset.motion = "paused";
      } else if (ready && !disposed) {
        canvas.dataset.motion = "running";
        frame = requestAnimationFrame(draw);
      }
    };
    const move = (event: PointerEvent) => {
      if (!hover.matches || event.pointerType !== "mouse" || reduced.matches)
        return;
      const box = container.getBoundingClientRect();
      const transform = artworkTransform(width, height);
      pointer.x = (event.clientX - box.left - transform.x) / transform.scale;
      pointer.y = (event.clientY - box.top - transform.y) / transform.scale;
      pointer.active = true;
    };
    const leave = () => {
      pointer.active = false;
    };
    image.onload = () => {
      if (disposed) return;
      maskCtx.drawImage(image, 0, 0, ART_WIDTH, ART_HEIGHT);
      const pixels = maskCtx.getImageData(0, 0, ART_WIDTH, ART_HEIGHT);
      for (let y = 0; y < ART_HEIGHT; y++) {
        for (let x = 0; x < ART_WIDTH; x++) {
          const index = (y * ART_WIDTH + x) * 4;
          const r = pixels.data[index];
          const g = pixels.data[index + 1];
          const b = pixels.data[index + 2];
          const inBand = x >= 330 + y * 0.4 && x <= 1120;
          const blue = inBand && b - r > 18 && g - r > 10;
          pixels.data[index] =
            pixels.data[index + 1] =
            pixels.data[index + 2] =
              255;
          pixels.data[index + 3] = blue ? Math.min(255, (b - r - 18) * 7) : 0;
        }
      }
      maskCtx.putImageData(pixels, 0, 0);
      points = gridCandidates().filter(
        ({ x, y }) =>
          pixels.data[(Math.round(y) * ART_WIDTH + Math.round(x)) * 4 + 3] >
          160,
      );
      ready = true;
      sync();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    reduced.addEventListener("change", sync);
    hover.addEventListener("change", leave);
    document.addEventListener("visibilitychange", sync);
    container.addEventListener("pointermove", move);
    container.addEventListener("pointerleave", leave);
    image.src = "/assets/home/marinecast-coastal-map.jpg";
    return () => {
      disposed = true;
      stop();
      image.onload = null;
      observer.disconnect();
      reduced.removeEventListener("change", sync);
      hover.removeEventListener("change", leave);
      document.removeEventListener("visibilitychange", sync);
      container.removeEventListener("pointermove", move);
      container.removeEventListener("pointerleave", leave);
      ctx.clearRect(0, 0, width, height);
    };
  }, [paused]);
  return <canvas ref={ref} className="home-grid-glow" aria-hidden="true" />;
}
