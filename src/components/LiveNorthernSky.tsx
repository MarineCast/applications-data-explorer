import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Stars } from 'lucide-react';
import { northernSky, skyGroups, skyLocation, sunAltitude } from '../data/northernSky';
import './LiveNorthernSky.css';

export default function LiveNorthernSky() {
  const [open, setOpen] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [selected, setSelected] = useState('Polaris');
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(timer);
  }, []);
  const stars = northernSky(now);
  const star = stars.find(item => item.name === selected)!;
  const sun = sunAltitude(now);
  const time = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(now);
  return <section className="live-sky" aria-label="Live northern sky">
    <button className="live-sky-toggle" aria-expanded={open} aria-controls="live-sky-chart" onClick={() => setOpen(!open)}>
      <Stars size={16} /> Northern sky · live {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
    </button>
    {open && <div id="live-sky-chart">
      <div className="live-sky-meta"><span>{skyLocation.name} · 48.55° N, 123.08° W</span><time dateTime={now.toISOString()}>{time}</time></div>
      <svg viewBox="0 0 600 320" aria-label="North-facing altitude and azimuth chart" role="group">
        {[0,30,60,90].map(alt => <g key={alt}><line x1="48" x2="552" y1={286-alt*2.8} y2={286-alt*2.8} className="sky-grid" /><text x="14" y={290-alt*2.8}>{alt}°</text></g>)}
        {['W','NW','N','NE','E'].map((name,i) => <g key={name}><line x1={48+i*126} x2={48+i*126} y1="34" y2="286" className="sky-grid" /><text x={48+i*126} y="310" textAnchor="middle">{name}</text></g>)}
        {skyGroups.flatMap(group => group.paths.flatMap((path,p) => path.slice(1).map((index,i) => {
          const a=stars[path[i]], b=stars[index];
          return a.visible && b.visible ? <line key={`${group.name}-${p}-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="sky-connection" /> : null;
        })))}
        {stars.filter(item => item.visible).map(item => <g key={item.name} className="sky-star" role="button" tabIndex={0}
          aria-label={`${item.name}, altitude ${item.altitude.toFixed(0)} degrees, azimuth ${item.azimuth.toFixed(0)} degrees`}
          onPointerEnter={() => setSelected(item.name)} onFocus={() => setSelected(item.name)} onClick={() => setSelected(item.name)}
          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(item.name); } }}>
          <circle cx={item.x} cy={item.y} r="11" fill="transparent" />
          <circle className="sky-star-glow" cx={item.x} cy={item.y} r="7" />
          <circle className="sky-star-core" cx={item.x} cy={item.y} r={Math.max(1.4,3.7-item.magnitude*.45)} />
          {(item.name === 'Polaris' || item.name === selected) && <text x={item.x+8} y={item.y-8} className="sky-star-label">{item.name}</text>}
        </g>)}
      </svg>
      <p className="live-sky-selection"><strong>{star.name}</strong> · {star.altitude.toFixed(1)}° above horizon · bearing {star.azimuth.toFixed(1)}°{!star.visible && ' · outside this northern view'}</p>
      <p>Big Dipper · Little Dipper · Cassiopeia</p>
      <p className="live-sky-note">{sun > 0 ? 'Daylight here — stars shown for orientation.' : sun > -18 ? 'Twilight here — faint stars may not be visible.' : 'Astronomical night here.'} North-facing chart; the artwork is not a calibrated horizon. Approximate positions; weather and terrain are not modeled.</p>
    </div>}
  </section>;
}
