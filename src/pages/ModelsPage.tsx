import { Boxes } from 'lucide-react';

export default function ModelsPage() {
  return <main className="workspace">
    <div className="page-heading">
      <div><span className="eyebrow">MARINECAST</span><h1>Models</h1><p>A home for marine models.</p></div>
      <span className="tag">Coming soon</span>
    </div>
    <section className="panel" style={{ padding: 'clamp(28px, 6vw, 72px)', maxWidth: 760 }} aria-label="Models availability">
      <Boxes size={36} strokeWidth={1.25} aria-hidden="true" />
      <h2>Models are on the horizon</h2>
      <p>This area is coming soon. Model tools and results are not available here yet.</p>
      <a href="#map">Explore Features →</a>
    </section>
  </main>;
}
