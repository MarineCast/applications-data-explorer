import { useState } from "react";
import {
  FeatureSelect,
  RegionSelect,
  SeasonSelect,
  Stat,
  Empty,
} from "../components/Controls";
import { Scatter, Histogram } from "../components/Charts";
import PageLegend from "../components/PageLegend";
import MapCanvas from "../components/MapCanvas";
import {
  sightings,
  seasonMonths,
  valueFor,
  pairedValues,
  months,
} from "../data/demo";
import type { FeatureId, Region } from "../data/demo";
export default function SightingsPage() {
  const [x, setX] = useState<FeatureId>("temperature"),
    [y, setY] = useState<FeatureId>("chlorophyll"),
    [species, setSpecies] = useState("all"),
    [encounter, setEncounter] = useState("all"),
    [region, setRegion] = useState<Region>("all"),
    [season, setSeason] = useState("all"),
    [background, setBackground] = useState(true);
  const selected = sightings.filter(
    (s) =>
      (species === "all" || s.species === species) &&
      (encounter === "all" || s.encounter === encounter) &&
      (region === "all" || s.cell.zone === region) &&
      seasonMonths[season].includes(s.month),
  );
  const observations = selected.flatMap((s) => {
    const a = valueFor(s.cell, x, s.month),
      b = valueFor(s.cell, y, s.month);
    return a === null || b === null ? [] : [{ x: a, y: b }];
  });
  const bg = pairedValues(region, season, x, y);
  return (
    <main className="workspace">
      <div className="page-heading">
        <div>
          <span className="eyebrow">OBSERVATION CONTEXT</span>
          <h1>Sightings</h1>
          <p>Synthetic encounters and their surrounding feature space.</p>
        </div>
        <span className="tag orange">Demo encounters</span>
      </div>
      <section className="panel filter-bar sightings-filters">
        <label className="field">
          Species
          <select value={species} onChange={(e) => setSpecies(e.target.value)}>
            <option value="all">All species</option>
            <option value="orca">Killer whale</option>
            <option value="humpback">Humpback whale</option>
            <option value="harbour-porpoise">Harbour porpoise</option>
          </select>
        </label>
        <label className="field">
          Encounter
          <select
            value={encounter}
            onChange={(e) => setEncounter(e.target.value)}
          >
            <option value="all">All encounters</option>
            <option value="group">Group</option>
            <option value="single">Single</option>
          </select>
        </label>
        <RegionSelect value={region} onChange={setRegion} />
        <SeasonSelect value={season} onChange={setSeason} />
        <FeatureSelect label="X feature" value={x} onChange={setX} />
        <FeatureSelect label="Y feature" value={y} onChange={setY} />
      </section>
      <div className="stat-row">
        <Stat label="Demo encounters" value={selected.length} />
        <Stat label="Matched feature pairs" value={observations.length} />
        <Stat
          label="Background pairs"
          value={background ? bg.length.toLocaleString() : "Hidden"}
        />
      </div>
      {selected.length === 0 ? (
        <Empty
          title="No demo encounters match"
          detail="Choose a different season, species, encounter type, or region."
        />
      ) : (
        <div className="analysis-grid">
          <section className="panel chart-panel">
            <div className="panel-title">
              <h2>Encounter locations</h2>
              <span className="tag orange">{selected.length} points</span>
            </div>
            <div className="small-map">
              <MapCanvas
                feature={x}
                month={6}
                region={region}
                showGrid={false}
                markers={selected}
              />
            </div>
            <p className="chart-note">
              Illustrative coastline. All positions and encounters are
              synthetic.
            </p>
          </section>
          <section className="panel chart-panel">
            <div className="panel-title">
              <h2>Sightings vs. background</h2>
              <label className="check">
                <input
                  type="checkbox"
                  checked={background}
                  onChange={(e) => setBackground(e.target.checked)}
                />{" "}
                Background
              </label>
            </div>
            <div className="scatter-stack">
              {background && <Scatter rows={bg} x={x} y={y} />}
              <Scatter rows={observations} x={x} y={y} highlight />
            </div>
          </section>
          <section className="panel chart-panel">
            <h2>Encounter feature distribution</h2>
            <Histogram
              values={observations.map((r) => r.x)}
              feature={x}
              color="#c88561"
            />
          </section>
          <section className="panel chart-panel context-panel">
            <h2>Observation support</h2>
            <div>
              <span>Observer effort</span>
              <strong className="tag">Not modeled</strong>
            </div>
            <div>
              <span>Physical viewability</span>
              <strong className="tag">Placeholder</strong>
            </div>
            <div>
              <span>Detection probability</span>
              <strong className="tag">Not estimated</strong>
            </div>
            <p className="chart-note">
              Encounter patterns cannot establish occurrence or habitat
              preference without observation-support assumptions.
            </p>
          </section>
        </div>
      )}
      <section className="panel table-panel">
        <h2>Demo encounter register</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Encounter</th>
                <th>Species</th>
                <th>Type</th>
                <th>Month</th>
                <th>H3 cell</th>
              </tr>
            </thead>
            <tbody>
              {selected.slice(0, 8).map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.species.replaceAll("-", " ")}</td>
                  <td>{s.encounter}</td>
                  <td>{months[s.month]} 2026</td>
                  <td>
                    <code>{s.cell.id}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="chart-note">
          Showing {Math.min(8, selected.length)} of {selected.length} filtered
          synthetic encounters.
        </p>
      </section>
      <PageLegend name="Sightings" entries={[
        { color: "#c77d54", label: "Synthetic encounters" },
        ...(background ? [{ color: "#4d9289", label: "Background feature pairs" }] : []),
        { color: "#c88561", label: "Encounter feature distribution" },
      ]} note="All positions and encounters are synthetic. Background points use the selected feature, region and season filters." />
    </main>
  );
}
