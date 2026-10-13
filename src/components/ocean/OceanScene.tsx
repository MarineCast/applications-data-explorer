import { useEffect, useRef, useState } from "react";
import { mapTransform } from "./sanJuanMotion";
import type { OceanController } from "./createOceanScene";

export default function OceanScene({ paused }: { paused: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<OceanController | null>(null);
  const requestedPause = useRef(paused);
  const [frame, setFrame] = useState({ scale: 1, x: 0, y: 0 });
  useEffect(() => {
    const element = host.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const resize = () => setFrame(mapTransform(element.clientWidth, element.clientHeight));
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    return () => observer.disconnect();
  }, []);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    requestedPause.current = paused;
    controller.current?.setPaused(paused);
  }, [paused]);
  useEffect(() => {
    const element = host.current;
    if (!element || !("WebGLRenderingContext" in window)) return;
    const abort = new AbortController();
    let instance: OceanController | undefined;
    import("./createOceanScene").then(({ createOceanScene }) =>
      createOceanScene(element, abort.signal, requestedPause.current),
    ).then((scene) => {
      if (!scene) return;
      if (abort.signal.aborted) { scene.destroy(); return; }
      instance = scene;
      controller.current = scene;
      scene.setPaused(requestedPause.current);
      setReady(true);
    }).catch((error: unknown) => {
      if (!abort.signal.aborted) {
        console.warn("Ocean animation unavailable; using the illustrated fallback.", error);
        setUnavailable(true);
      }
    });
    return () => {
      abort.abort();
      instance?.destroy();
      controller.current = null;
    };
  }, []);
  return <div className="ocean-scene" ref={host} aria-hidden="true" data-renderer={ready ? "webgl" : unavailable ? "fallback" : "loading"}>
    <div className={`ocean-fallback ${ready ? "is-ready" : ""}`}>
      <div className="island-fallback-world" style={{ transform: `translate(${frame.x}px, ${frame.y}px) scale(${frame.scale})` }}>
        <img className="ocean-background" src="/assets/home/san-juan/background.webp" alt="" fetchPriority="high" />
        <img className="island-fallback-orca" src="/assets/home/san-juan/orca.webp" alt="" />
        <img className="island-fallback-calf" src="/assets/home/san-juan/orca.webp" alt="" />
        <img className="island-fallback-boat" src="/assets/home/san-juan/boat.webp" alt="" />
        <img className="island-fallback-buoy" src="/assets/home/san-juan/buoy.webp" alt="" />
      </div>
    </div>
  </div>;
}
