import { useAppTheme } from '../theme/appTheme';
import { flushSync } from 'react-dom';
import HomeCardVisual from '../components/HomeCardVisual';
import { useEffect, useRef, useState } from 'react';
import { MapPinned, Layers, House, Network, Waves, Sun, Moon, Boxes, ArrowUpRight, CircleHelp, X } from 'lucide-react';
import CoastalCinemagraph from '../components/CoastalPhotoBackground';
import './HomePage.css';

export type ExplorerPage = 'map' | 'viewshed' | 'relationships' | 'models' | 'forecasts' | 'health';
const destinations = [
  { page: 'map', label: 'Features', description: 'Explore coastal data across the map.', Icon: Layers },
  { page: 'relationships', label: 'Relationships', description: 'Compare patterns and connections.', Icon: Network },
  { page: 'models', label: 'Models', description: 'A home for marine models.', Icon: Boxes },
  { page: 'forecasts', label: 'Forecasts', description: 'Explore model predictions and uncertainty on the map.', Icon: MapPinned },
] as const;

export default function HomePage({ onNavigate }: { onNavigate: (page: ExplorerPage) => void }) {
  const [entrance] = useState(() => {
    try { return !window.sessionStorage.getItem('marinecast.home.entered'); } catch { return false; }
  });
  useEffect(() => {
    try { window.sessionStorage.setItem('marinecast.home.entered', 'true'); } catch { /* Optional animation preference. */ }
  }, []);
  const enterDestination = (page: ExplorerPage) => {
    if (page === 'map' && document.startViewTransition && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      document.startViewTransition(() => flushSync(() => onNavigate(page)));
    } else onNavigate(page);
  };
  const helpDialog = useRef<HTMLDialogElement>(null);
  const [controlOpen, setControlOpen] = useState(false);
  const controlPointer = useRef('');
  const [hovered, setHovered] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelHoverTimer = () => {
    if (hoverTimer.current !== null) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  };
  const previewSidebar = (open: boolean) => {
    cancelHoverTimer();
    hoverTimer.current = setTimeout(() => {
      setHovered(open);
      hoverTimer.current = null;
    }, open ? 150 : 300);
  };
  useEffect(() => () => {
    if (hoverTimer.current !== null) clearTimeout(hoverTimer.current);
  }, []);
  const [theme, setTheme] = useAppTheme();
  const [settledTheme, setSidebarTheme] = useState(theme);
  const [sweep, setSweep] = useState(false);
  const sidebarTheme = sweep ? settledTheme : theme;
  const changeTheme = (next: 'light' | 'dark') => {
    if (next === theme) return;
    setSweep(true);
    setTheme(next);
  };
  const compact = !controlOpen && !hovered;
  const toggleLabel = compact ? 'Expand sidebar' : 'Collapse sidebar';
  const toggle = useRef<HTMLButtonElement>(null);
  const closeSidebar = () => {
    cancelHoverTimer(); setControlOpen(false); setHovered(false); toggle.current?.focus();
  };
  return <main className={`home-page coastal-home ${compact ? 'rail-collapsed' : ''}`} data-theme={theme} data-sidebar-theme={sidebarTheme} aria-label="MarineCast home">
    <CoastalCinemagraph theme={theme} sweep={sweep} onSweepComplete={() => { setSidebarTheme(theme); setSweep(false); }} />
    <button className="coastal-theme-toggle" onClick={() => changeTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label={theme === 'dark' ? 'Switch to day mode' : 'Switch to night mode'}
      title={theme === 'dark' ? 'Switch to day mode' : 'Switch to night mode'}>
      {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
    {!compact && <button className="coastal-sidebar-scrim" aria-label="Close sidebar" tabIndex={-1} onClick={closeSidebar} />}
    <aside className="coastal-sidebar" aria-label="Home sidebar"
      onPointerEnter={event => { if (event.pointerType === 'mouse') previewSidebar(true); }}
      onPointerLeave={() => previewSidebar(false)} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setControlOpen(false);
    }} onKeyDown={event => {
      if (event.key === 'Tab') setControlOpen(true);
      if (event.key === 'Escape' && !compact) { event.preventDefault(); closeSidebar(); }
    }}>
      <header className="coastal-brand">
        <button className="coastal-brand-toggle" ref={toggle}
          onPointerDown={event => { controlPointer.current = event.pointerType; }}
          onClick={event => {
            // Mouse navigation is hover-only; touch and keyboard retain an explicit control.
            if (event.detail === 0 || controlPointer.current === 'touch' || controlPointer.current === 'pen') {
              cancelHoverTimer(); setHovered(false); setControlOpen(open => !open);
            }
            controlPointer.current = '';
          }} aria-label={toggleLabel}
          aria-expanded={!compact} aria-controls="home-sidebar-navigation" title={toggleLabel}><Waves size={33} /></button><div><h1>MarineCast</h1><p>Data Atlas</p></div></header>
      <nav id="home-sidebar-navigation" aria-label="Atlas destinations">
        <a className="coastal-current" href="#home" aria-current="page" aria-label="Home" title="Home"><House size={21} /><span>Home</span></a>
        {destinations.map(({ page, label, Icon }) => <button key={page} title={label}
          aria-label={label} onClick={() => onNavigate(page)}>
          <Icon size={21} /><span>{label}</span>
        </button>)}
      </nav>
      <div className="coastal-sidebar-bottom">
        <button className="coastal-help-toggle" aria-label="Help" title="Help" onClick={() => helpDialog.current?.showModal()}><CircleHelp size={21} aria-hidden="true" /></button>
        <p>EXPLORE<br />UNDERSTAND<br />PROTECT</p>
      </div>
    </aside>
    <dialog ref={helpDialog} className="coastal-help-dialog" aria-labelledby="coastal-help-title" onClick={event => { if (event.target === event.currentTarget) helpDialog.current?.close(); }}>
      <div className="coastal-help-content">
        <form method="dialog"><button aria-label="Close help" autoFocus><X size={19} /></button></form>
        <h2 id="coastal-help-title">Welcome to MarineCast</h2>
        <p>Choose a card or open the sidebar to explore.</p>
        <ul>
          <li><strong>Features</strong> — explore coastal data on the map.</li>
          <li><strong>Relationships, Models & Forecasts</strong> — coming soon.</li>
        </ul>
        <p>Hover anywhere over the sidebar to open it; move away to close it. With touch or a keyboard, use the waves button to expand or collapse it.</p>
        <p>The sun/moon button changes the scene. The play/pause button controls animation; stars brighten near your pointer at night.</p>
      </div>
    </dialog>
    <nav className={`coastal-destination-cards ${entrance ? 'has-entrance' : ''}`} aria-label="Explore MarineCast">
      {destinations.map(({ page, label, description, Icon }) => <a key={page} className={`coastal-destination-card portal-${page}`} onPointerMove={event => {
        if (event.pointerType !== 'mouse') return;
        const bounds = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty('--pointer-x', `${event.clientX - bounds.left}px`);
        event.currentTarget.style.setProperty('--pointer-y', `${event.clientY - bounds.top}px`);
      }} aria-label={`${label}${page !== 'map' ? ' — Coming soon' : ''}`} href={`#${page}`} onClick={event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault(); enterDestination(page);
      }}>
        <HomeCardVisual kind={page} theme={theme} />
        <span className="coastal-card-top">
          <span className="coastal-card-icon"><Icon size={23} aria-hidden="true" /></span>
          {(page !== 'map') && <span className="coastal-card-status">Coming soon</span>}
          <ArrowUpRight className="coastal-card-arrow" size={17} aria-hidden="true" />
        </span>
        <h2>{label}</h2>
        <p>{description}</p>
        <span className="coastal-card-action">{page !== 'map' ? 'See what’s coming' : `Explore ${label}`} <ArrowUpRight size={14} aria-hidden="true" /></span>
      </a>)}
    </nav>
  </main>;
}
