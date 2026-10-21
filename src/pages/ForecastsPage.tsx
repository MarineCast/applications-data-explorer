import { MapPinned } from 'lucide-react';

export default function ForecastsPage() {
  return <main className="workspace">
    <div className="page-heading">
      <div><span className="eyebrow">MARINECAST</span><h1>Forecasts</h1><p>Model results on the map.</p></div>
      <span className="tag">Coming soon</span>
    </div>
    <section className="panel" style={{ padding: 'clamp(28px, 6vw, 72px)', maxWidth: 760 }} aria-label="Forecast availability">
      <MapPinned size={36} strokeWidth={1.25} aria-hidden="true" />
      <h2>A map for your model results</h2>
      <p>This will be the place to explore predictions, forecast periods, and uncertainty from model runs. No forecast outputs are connected yet.</p>
      <a href="#map">Explore Features →</a>
    </section>
  </main>;
}
