import { useEffect, useState } from "react";
import { checkedAsset } from "../data/seascape";
import type { NativeProduct, SlicedProduct } from "../data/seascape";

type CivilRow = { date: string; country: string; timezone: string; is_weekend: boolean; is_holiday: boolean; holiday_names: string };
export type CivilCalendar = { rows: CivilRow[]; metadata: { rules_version: string; timezone_rules_version: string; temporal_support: { start: string; end_exclusive: string; as_of: string }; limitations: string[] } };

export function CivilCalendarView({ data }: { data: CivilCalendar }) {
  const [country, setCountry] = useState("US");
  const [date, setDate] = useState(data.metadata.temporal_support.as_of);
  const rows = data.rows.filter(row => row.country === country);
  const row = rows.find(row => row.date === date);
  return <section aria-label="Human civil calendar">
    <p className="insights-note">Country and reference-zone calendar context. Dates are local civil dates, independent of the selected map cell. This is not measured activity or observer effort.</p>
    <label className="insights-choice">Country<select aria-label="Calendar country" value={country} onChange={event => setCountry(event.target.value)}><option value="US">United States · federal + WA + OR</option><option value="CA">Canada · federal + BC</option></select></label>
    <label className="insights-choice">Civil date<input aria-label="Calendar civil date" type="date" min={rows[0]?.date} max={rows.at(-1)?.date} value={date} onChange={event => setDate(event.target.value)}/></label>
    {row ? <dl className="insights-cell-details">
      <div><dt>Reference timezone</dt><dd>{row.timezone}</dd></div>
      <div><dt>Local date</dt><dd>{row.date}</dd></div>
      <div><dt>Weekend</dt><dd>{row.is_weekend ? "Yes" : "No"}</dd></div>
      <div><dt>Holiday</dt><dd>{row.is_holiday ? row.holiday_names : "No named holiday"}</dd></div>
    </dl> : <p role="status">No calendar record for this country and civil date. Choose a date from {rows[0]?.date} through {rows.at(-1)?.date}.</p>}
    {date > data.metadata.temporal_support.as_of && <p className="insights-note">Future rule-based context relative to {data.metadata.temporal_support.as_of}; rules may change.</p>}
    <details className="insights-qualifiers"><summary>Calendar source &amp; limitations</summary>
      <p className="insights-note">Rules {data.metadata.rules_version} · timezone rules {data.metadata.timezone_rules_version} · as of {data.metadata.temporal_support.as_of}. Coverage {data.metadata.temporal_support.start} to {rows.at(-1)?.date} inclusive.</p>
      {data.metadata.limitations.map(note => <p className="insights-note" key={note}>{note}</p>)}
    </details>
  </section>;
}

export default function HumanCalendar({ product }: { product?: NativeProduct | SlicedProduct }) {
  const asset = product && "calendar" in product ? product.calendar : undefined;
  const [result, setResult] = useState<{ key?: string; data?: CivilCalendar; error?: string }>({});
  const [attempt, setAttempt] = useState(0);
  const key = asset ? `${asset.url}:${asset.sha256}` : undefined;
  useEffect(() => {
    if (!asset) return;
    let active = true;
    checkedAsset(asset).then(data => { if (active) setResult({ key, data: data as CivilCalendar }); }, () => { if (active) setResult({ key, error: "Calendar could not be verified." }); });
    return () => { active = false; };
  }, [asset, key, attempt]);
  if (!asset) return <p className="insights-note">Civil calendar is unavailable in this source encoding.</p>;
  if (result.key === key && result.error) return <p role="alert">{result.error} <button onClick={() => setAttempt(value => value + 1)}>Retry calendar</button></p>;
  if (result.key !== key || !result.data) return <p role="status">Loading civil calendar…</p>;
  return <CivilCalendarView key={key} data={result.data}/>;
}
