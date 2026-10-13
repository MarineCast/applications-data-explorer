export interface MapCamera {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}
export interface MapCameraPeer {
  setCamera: (camera: MapCamera) => void;
  finishMove: () => void;
}
// Peers share camera coordinates, never feature values or spatial aggregation.
// Only an ended gesture refreshes geometry; following every frame must not
// rebuild the native R8 source on each programmatic camera movement.
export function createMapCameraLink() {
  let camera: MapCamera = { center: [-123.5, 48.45], zoom: 6.7, bearing: 0, pitch: 0 };
  const peers = new Set<MapCameraPeer>();
  return {
    getCamera: () => camera,
    connect(peer: MapCameraPeer) {
      peers.add(peer);
      peer.setCamera(camera);
      return () => { peers.delete(peer); };
    },
    publish(origin: MapCameraPeer, next: MapCamera, moving: boolean) {
      camera = { ...next, center: [...next.center] };
      for (const peer of peers) {
        if (peer !== origin) peer.setCamera(camera);
        if (!moving) peer.finishMove();
      }
    },
  };
}
export type MapCameraLink = ReturnType<typeof createMapCameraLink>;
