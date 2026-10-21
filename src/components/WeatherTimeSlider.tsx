import { useMemo } from "react";
import TimelineControls from "./TimelineControls";
import { parseWeatherFrame, weatherFrames, weatherFrameLabel } from "../data/weatherPeriods";
import type { WeatherPeriod } from "../data/weatherPeriods";
export default function WeatherTimeSlider({dates,value,onChange,busy,error,onPrefetch}:{dates:string[];value:string;onChange:(date:string)=>void;busy:boolean;error?:string;onPrefetch?:(values:readonly string[],signal:AbortSignal)=>Promise<void>}) {
  const {period,date} = parseWeatherFrame(value);
  const frames = useMemo(()=>weatherFrames(dates,period),[dates,period]);
  const periodName = period === "day" ? "Daily" : period === "week" ? "Weekly" : "Monthly";
  return <TimelineControls key={period} startDate={frames[0] ?? ""} endDate={frames.at(-1) ?? ""} increment={{unit:period}}
    values={frames} value={value} onChange={onChange} onPrefetch={onPrefetch} busy={busy} error={error}
    label="Meteorology timeline" rangeLabel={`${periodName} weather timeline`}
    stepLabel={period === "day" ? "weather day" : "weather period"} playbackLabel="weather playback" format={weatherFrameLabel}
    periodControl={<label className="weather-period-control">Period<select aria-label="Weather aggregation period" value={period} onChange={event=>{
      const next = weatherFrames(dates,event.target.value as WeatherPeriod);
      onChange([...next].reverse().find(key=>parseWeatherFrame(key).date<=date) ?? next[0]);
    }}><option value="day">Daily</option><option value="week" disabled={!weatherFrames(dates,"week").length}>Weekly</option><option value="month" disabled={!weatherFrames(dates,"month").length}>Monthly</option></select></label>}
    caption={period === "day" ? undefined : "Complete UTC calendar periods · missing inputs stay unavailable"}/>;
}
