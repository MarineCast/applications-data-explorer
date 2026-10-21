import { parseWeatherFrame, weatherFrameLabel } from "../data/weatherPeriods";
import { useEffect, useState } from "react";
import { loadHourlyWeather, weatherDate } from "../data/meteorology";
import type { HourlyWeather, MeteorologyCatalog } from "../data/meteorology";
import "./WeatherInsights.css";

const hourlyNames: Record<string, string> = {
  TEMPERATURE_2M_C: "Air temperature at 2 m", DEWPOINT_2M_C: "Dewpoint at 2 m",
  RELATIVE_HUMIDITY_2M_PCT: "Relative humidity at 2 m", U_WIND_10M_MS: "Eastward wind at 10 m",
  V_WIND_10M_MS: "Northward wind at 10 m", WIND_SPEED_10M_MS: "Wind speed at 10 m",
  WIND_DIRECTION_10M_DEG_FROM: "Wind direction from", TOTAL_CLOUD_COVER_PCT: "Total cloud cover",
  MEAN_SEA_LEVEL_PRESSURE_HPA: "Sea-level pressure", PRECIPITATION_MM: "Hourly precipitation",
};

function WeatherPlot({ values, labels, name, unit, selected, circular = false }: {
  values: (number | null)[]; labels: string[]; name: string; unit: string; selected?: number; circular?: boolean;
}) {
  const available = values.filter((value): value is number => value !== null);
  if (!available.length) return <p className="insights-empty">No available values. Missing hours remain gaps.</p>;
  const low = circular ? 0 : Math.min(...available), high = circular ? 360 : Math.max(...available);
  const x = (index: number) => 48 + index / Math.max(1, values.length - 1) * 238;
  const y = (value: number) => 130 - (high === low ? .5 : (value - low) / (high - low)) * 108;
  const path = values.map((value, index) => {
    if (value === null) return "";
    const command = index > 0 && values[index - 1] !== null ? "L" : "M";
    return `${command}${x(index).toFixed(2)},${y(value).toFixed(2)}`;
  }).join(" ");
  const format = (value: number) => value.toLocaleString(undefined, { maximumSignificantDigits: 3 });
  return <svg className="weather-insight-chart" viewBox="0 0 310 166" role="img" aria-label={`${name} (${unit}); unavailable values are gaps`}>
    {[0, .5, 1].map(t => <g key={t}><line x1={48} x2={286} y1={22 + t * 108} y2={22 + t * 108} stroke="#e5ecef" />
      <text x={41} y={26 + t * 108} textAnchor="end">{format(high - t * (high - low))}</text></g>)}
    {selected !== undefined && selected >= 0 && <line x1={x(selected)} x2={x(selected)} y1={18} y2={132} stroke="#bb7a49" strokeDasharray="3 3"><title>Selected UTC day</title></line>}
    {!circular && <path d={path} fill="none" stroke="#287f9d" strokeWidth={1.6} />}
    {values.length <= 24 && values.map((value, index) => value !== null && <circle key={index} cx={x(index)} cy={y(value)} r={2.6} fill="#287f9d"><title>{labels[index]}: {value} {unit}</title></circle>)}
    <text x={48} y={153}>{labels[0]}</text><text x={286} y={153} textAnchor="end">{labels.at(-1)}</text>
  </svg>;
}

function DailyWeatherInsights({ catalog, metric: column, day, cell }: {
  catalog: MeteorologyCatalog; metric: string; day: string; cell?: string;
}) {
  const metric = catalog.metrics.find(item => item.column === column)!;
  const [period, setPeriod] = useState("year");
  const [attempt, setAttempt] = useState(0);
  const key = `${catalog.snapshot}:${day}:${column}:${cell ?? "region"}`;
  const [state, setState] = useState<{ key: string; data?: HourlyWeather; error?: string }>();
  useEffect(() => {
    const controller = new AbortController();
    // Scrubbing through days does not launch an hourly read for every intermediate date.
    const timer = window.setTimeout(() => {
      loadHourlyWeather(catalog, day, column, controller.signal, cell).then(data => {
        if (!controller.signal.aborted) setState({ key, data });
      }).catch((error: Error) => { if (!controller.signal.aborted) setState({ key, error: error.message }); });
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [catalog, day, column, cell, key, attempt]);
  const data = state?.key === key ? state.data : undefined;
  const error = state?.key === key ? state.error : undefined;
  const last = Math.max(0, catalog.dates.indexOf(day));
  const first = period === "all" ? 0 : Math.max(0, last - (period === "five" ? 1825 : 365) + 1);
  const dates = catalog.dates.slice(first, last + 1);
  const history = catalog.dailySeries[column].slice(first, last + 1);
  const selectedHourly = data?.values.filter((value): value is number => value !== null) ?? [];
  return <div className="weather-insights" aria-label="Meteorology time insights">
    <section className="insights-section">
      <h3>Hourly · {weatherDate(day)}</h3>
      <p className="insights-note">{hourlyNames[metric.hourlyColumn] ?? metric.name} · {metric.unit}</p>
      <p className="insights-note">{cell ? "Selected native H3 cell" : "Full native area · unweighted mean of available cells"} · UTC</p>
      {error ? <p role="alert">{error} <button className="weather-retry" onClick={() => setAttempt(value => value + 1)}>Retry hourly data</button></p>
        : !data ? <p role="status">Loading the selected day's hours…</p>
        : metric.circular && !cell ? <p className="insights-note">Select a cell to inspect hourly directions. Directions have no scalar regional mean.</p>
        : <>
          <WeatherPlot values={data.values} labels={data.hours.map((_, index) => `${String(index).padStart(2, "0")}:00`)} unit={metric.unit} name="Hourly weather for the selected UTC day" circular={metric.circular} />
          <p className="insights-note">{selectedHourly.length} of 24 hours available{!cell ? "; each hour uses its own available native cells" : ""}.</p>
          {column === "PRECIPITATION_MM" && <p className="insights-note">Each point is the following hour's total, not a cumulative curve.</p>}
          <details><summary>Hourly values</summary><table><thead><tr><th>UTC</th><th>{metric.unit}</th><th>{cell ? "Available" : "Cells"}</th></tr></thead><tbody>{data.hours.map((hour, index) => <tr key={hour}>
            <td>{hour.slice(11, 16)}</td><td>{data.values[index] === null ? "Unavailable" : String(data.values[index])}</td><td>{data.counts[index]}</td>
          </tr>)}</tbody></table></details>
        </>}
    </section>
    <section className="insights-section">
      <h3>Daily history</h3>
      <p className="insights-note">{metric.name} · {metric.unit}<br />Full native area · unweighted cell mean · through the selected day</p>
      {metric.circular ? <p className="insights-note">Regional scalar averages are omitted for wind direction.</p> : <>
        <label className="insights-choice">History window<select aria-label="Weather history window" value={period} onChange={event => setPeriod(event.target.value)}>
          <option value="year">Past year</option><option value="five">Past 5 years</option><option value="all">Full record</option>
        </select></label>
        <WeatherPlot values={history} labels={dates.map(weatherDate)} name="Long-term daily weather history" unit={metric.unit} selected={dates.length - 1} />
        <p className="insights-note">{dates.length.toLocaleString()} daily records. Cell means are descriptive summaries, not area averages or independent weather observations.</p>
      </>}
    </section>
  </div>;
}


export default function WeatherInsights(props: { catalog: MeteorologyCatalog; metric: string; day: string; cell?: string }) {
  const { period } = parseWeatherFrame(props.day);
  if (period === "day") return <DailyWeatherInsights {...props} />;
  const operation = props.metric === "PRECIPITATION_MM" ? "Total of daily precipitation" : props.metric.endsWith("_MIN") ? "Minimum of daily minima" : props.metric.endsWith("_MAX") ? "Maximum of daily maxima" : props.metric.includes("DIRECTION") ? "Direction of the period mean eastward and northward wind vector" : "Mean of daily values";
  return <section className="weather-insights" aria-label="Meteorology period insights"><h3>{weatherFrameLabel(props.day)}</h3>
    <p>{operation}. Complete UTC calendar {period}; every required daily value must be available for each cell.</p>
    <p>Native H3 R5 values and source units are retained. Switch to Daily to inspect hourly values and daily history.</p>
    {props.metric === "PRECIPITATION_MM" && <p>The color scale uses a fixed upper bound of {period === "week" ? 7 : 31} times the full-record daily maximum so colors remain stable during playback.</p>}
  </section>;
}
