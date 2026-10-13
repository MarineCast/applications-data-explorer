import { useEffect, useState } from 'react';
import { Pause, Play, Waves } from 'lucide-react';
import FieldAtlasScene from '../components/field-atlas/FieldAtlasScene';
import './HomePage.css';
export type ExplorerPage = 'map' | 'viewshed' | 'relationships' | 'sightings' | 'health';
export default function HomePage({ onNavigate, menuOpen = false }: {
    onNavigate: (page: ExplorerPage) => void;
    menuOpen?: boolean;
}) {
    const [paused, setPaused] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    useEffect(() => {
        const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
        const update = () => setPaused(media?.matches ?? false);
        media?.addEventListener('change', update);
        return () => media?.removeEventListener('change', update);
    }, []);
    return <main className="home-page field-atlas-home" aria-label="MarineCast home">
  <FieldAtlasScene paused={paused || menuOpen} onNavigate={() => onNavigate('viewshed')}/>
  <header className="atlas-title"><Waves size={40} strokeWidth={1.3}/><div><h1>MarineCast</h1><p>Data Atlas</p></div></header>
  <button className="atlas-pause" aria-label={paused ? 'Play animation' : 'Pause animation'} aria-pressed={paused} onClick={() => setPaused(v => !v)}>
   {paused ? <Play size={13}/> : <Pause size={13}/>}<span>{paused ? 'Play' : 'Pause'}</span>
  </button>
  <div className="atlas-caption"><span>THE SAN JUAN ISLANDS</span><h2>Orcas Island</h2><p>A quiet study of land, water &amp; wind.</p></div>
  <small className="atlas-scene-note">Illustrative scene</small>
 </main>;
}
