import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { calendarFrames, timelineTickLabel, timelineTicks } from "../data/timeline";
import type { TimelineIncrement } from "../data/timeline";
import "./WeatherTimeSlider.css";

export type TimelineControlsProps = {
  startDate: string; endDate: string; increment: TimelineIncrement;
  value: string; onChange: (value: string) => void;
  /** Explicit source period keys, including a single All time frame, take precedence. */
  values?: readonly string[];
  periodControl?: ReactNode;
  onPrefetch?: (values: readonly string[], signal: AbortSignal) => Promise<void>;
  busy?: boolean; error?: string; label: string; rangeLabel: string;
  stepLabel?: string; playbackLabel?: string; basisLabel?: string;
  format: (value: string) => string; caption?: string;
};
/** Controlled React timeline shared by every time-enabled map layer. */
export default function TimelineControls({ startDate, endDate, increment, values: sourceValues, value, onChange,
  periodControl, onPrefetch, busy=false, error, label, rangeLabel, stepLabel="period", playbackLabel="timeline", format, caption, basisLabel="UTC",
}: TimelineControlsProps) {
  const { unit, step } = increment;
  const values = useMemo(() => sourceValues ?? calendarFrames(startDate, endDate, { unit, step }),
    [sourceValues, startDate, endDate, unit, step]);
  const ticks = timelineTicks(values.length);
  const [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(800);
  const index = Math.max(0, values.indexOf(value));
  const selected = values.includes(value) ? value : values[index];
  const move = (next: number) => { setPlaying(false); if (values[next]) onChange(values[next]); };
  useEffect(() => {
    if (!onPrefetch || !values.length) return;
    const controller = new AbortController();
    const upcoming = index === values.length - 1 ? values.slice(0, 3) : values.slice(index + 1, index + 4);
    // Sequential, bounded look-ahead; failures are surfaced only if that frame is requested.
    void onPrefetch(upcoming, controller.signal).catch(() => {});
    return () => controller.abort();
  }, [onPrefetch, values, index]);
  useEffect(() => {
    const pause = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, []);
  useEffect(() => {
    if (!playing || busy || error || index >= values.length - 1) return;
    const timer = window.setTimeout(() => { onChange(values[index + 1]); if (index + 1 === values.length - 1) setPlaying(false); }, speed);
    return () => window.clearTimeout(timer);
  }, [playing, busy, error, index, values, onChange, speed]);
  return <section className={`weather-time-slider timeline-controls panel ${values.length === 1 ? "timeline-single-frame" : ""}`} aria-label={label}>
    {periodControl}
    <div className="timeline-controls-row">
      <button type="button" className="timeline-play" aria-label={`${playing ? "Pause" : "Play"} ${playbackLabel}`} aria-pressed={playing}
        disabled={values.length < 2 || (!playing && (busy || Boolean(error)))} onClick={() => { if (!playing && index === values.length - 1) onChange(values[0]); setPlaying(!playing); }}>{playing ? <Pause size={17}/> : <Play size={17}/>}</button>
      <button type="button" aria-label={`Previous ${stepLabel}`} disabled={!index || !values.length} onClick={() => move(index - 1)}><ChevronLeft size={17}/></button>
      <div className="timeline-track">
        <input type="range" aria-label={rangeLabel} min={0} max={Math.max(0, values.length - 1)} step={1} value={index} disabled={values.length < 2}
          aria-valuetext={selected ? `${format(selected)} · ${basisLabel}` : "No available periods"} onChange={event => move(Number(event.target.value))}/>
        <div className="timeline-axis" aria-label="Timeline date axis">
          {ticks.map((tick, i) => <span key={tick} className={`timeline-axis-tick ${ticks.length === 5 && i % 2 ? "timeline-axis-tick-minor" : ""} ${i === 0 ? "first" : i === ticks.length - 1 ? "last" : ""}`}
            style={{ left: `${values.length > 1 ? tick / (values.length - 1) * 100 : 50}%` }}>
            <time dateTime={values[tick] === "all" ? undefined : values[tick].replace(/^(week|month):/, "")}>{timelineTickLabel(values[tick], values[0], values.at(-1)!)}</time>
          </span>)}
        </div>
      </div>
      <button type="button" aria-label={`Next ${stepLabel}`} disabled={!values.length || index === values.length - 1} onClick={() => move(index + 1)}><ChevronRight size={17}/></button>
      <div className="timeline-playback">
        <select aria-label="Playback speed" value={speed} onChange={event => setSpeed(Number(event.target.value))}>
          <option value={1600}>0.5×</option><option value={800}>1×</option><option value={400}>2×</option>
        </select>
        <output aria-label="Selected date" title={selected ? format(selected) : undefined}>{selected ? format(selected) : "No available periods"}</output>
      </div>
    </div>
    {<div className="timeline-caption">
      <span role="status">{error ? "Unable to load period" : busy ? "Loading period…" : caption}</span>
    </div>}
  </section>;
}
