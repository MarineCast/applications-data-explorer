import { createPortal } from "react-dom";
import type { MapCanvasProps } from "../data/map";
import { humanRecordName, humanVisibleFeatures } from "../data/humanGeometry";
import { hydrologyPointGeoJSON } from "../data/hydrologyOverlay";
import { sourceLabel } from "../data/viewshed";

/** Page-state driver only. Geometry, camera and picking use the real MapTilerCanvas suite. */
export default function MapInteractionDriver(props: MapCanvasProps) {
  const controls = props.showControls === false ? null : <div>
    <button aria-label="Zoom in" /><button aria-label="Zoom out" />
  </div>;
  const human = props.humanGeometry;
  return <div className="map-canvas" data-testid="map-interaction-driver">
    {!props.viewshed && !props.hydrologyPoints && !human && props.layer?.cells.map(cell =>
      <button key={cell.id} className="hex-cell" aria-label={`Inspect cell ${cell.id}`} onClick={() => props.onSelect?.(cell)} />)}
    {props.viewshed && <>
      {props.viewshed.data.sources.map(cell => <button key={`land-${cell.id}`} aria-label={`Select land source ${sourceLabel(cell.id)}`} onClick={() => props.viewshed!.onSource(cell.id)} />)}
      {props.viewshed.data.targets.map(cell => <button key={`water-${cell.id}`} aria-label={`Inspect water target ${cell.id}`} onClick={() => props.viewshed!.onTarget(cell.id)} />)}
    </>}
    {props.hydrologyPoints && hydrologyPointGeoJSON(props.hydrologyPoints).features.map(node => {
      const p = node.properties!;
      const inspect = () => p.station ? props.hydrologyPoints!.onSelectStation?.(p.station) : props.hydrologyPoints!.onSelect(p.river);
      return <button key={node.id} aria-label={`Inspect ${p.name} ${p.station ? "temperature station" : "river"}`} onClick={inspect}
        onKeyDown={event => { if (event.key === "Enter") inspect(); }} />;
    })}
    {human && [...humanVisibleFeatures(human).footprints, ...humanVisibleFeatures(human).records].map(record =>
      <button key={record.id} aria-label={`Inspect ${humanRecordName(record)}`} onClick={() => human.onSelect(record.properties.record_id)} />)}
    {props.orcaPoints?.records.filter(record => record.latitude !== null && record.longitude !== null).map(record =>
      <button key={record.event_id} aria-label={`Inspect sighting ${record.event_id}`} onClick={() => props.orcaPoints!.onSelect(record.event_id)} />)}
    {props.popup}
    {props.overlayHost ? createPortal(controls, props.overlayHost) : controls}
  </div>;
}
