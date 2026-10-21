import { ArrowUpRight, Boxes, Network, MapPinned } from 'lucide-react';
const content = {
  relationships: { title:'Relationships', subtitle:'Explore how coastal features connect.', Icon:Network },
  models: { title:'Models', subtitle:'Build and run marine models.', Icon:Boxes },
  forecasts: { title:'Forecasts', subtitle:'Explore model predictions on the map.', Icon:MapPinned },
};
export default function ComingSoonPage({ page }: { page: keyof typeof content }) {
  const { title, subtitle, Icon } = content[page];
  return <main className="workspace coming-soon-page">
    <section className="coming-soon-card" aria-labelledby="coming-soon-title">
      <Icon size={42} strokeWidth={1.25} aria-hidden="true" />
      <span className="coming-soon-badge">Coming soon</span>
      <h1 id="coming-soon-title">{title}</h1>
      <p>{subtitle}</p>
      <p className="coming-soon-detail">We’re preparing this part of MarineCast. In the meantime, explore the data in Features.</p>
      <a className="button coming-soon-link" href="#map">Explore Features <ArrowUpRight size={17} aria-hidden="true" /></a>
    </section>
  </main>;
}
