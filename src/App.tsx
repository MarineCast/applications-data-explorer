import { useEffect, useRef, useState } from "react";
import {
  House,
  Sun,
  Moon,
  Boxes,
  MapPinned,
  Waves,
  Map,
  GitCompareArrows,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import HomePage from "./pages/HomePage";
import type { ExplorerPage } from "./pages/HomePage";
import MapPage from "./pages/MapPage";
import RelationshipsPage from "./pages/RelationshipsPage";
import { preloadGeographicMap } from "./data/geographicRenderer";
import ComingSoonPage from "./pages/ComingSoonPage";
import { useAppTheme } from "./theme/appTheme";
import "./theme/FeatureTheme.css";
import HealthPage from "./pages/HealthPage";
type Page = "home" | ExplorerPage;
function pageFromHash(): Page {
  const hash = window.location.hash.slice(1).split("?")[0];
  if (hash === "viewshed" || hash === "sightings") return "map";
  return ["home", "map", "relationships", "models", "forecasts", "health"].includes(hash)
    ? (hash as Page)
    : "home";
}
function normalizeLegacyHash() {
  if (window.location.hash === "#viewshed") window.history.replaceState(null, "", "#map?layer=viewshed");
  else if (window.location.hash.slice(1).split("?")[0] === "sightings") window.history.replaceState(null, "", "#map");
}
const pages = [
  {
    id: "home" as const,
    name: "Home",
    description: "Ocean data for a wilder tomorrow",
    icon: House,
  },
  {
    id: "map" as const,
    name: "Features",
    description: "Explore features across the water",
    icon: Map,
  },
  {
    id: "relationships" as const,
    name: "Relationships",
    description: "Explore support-aware feature associations",
    icon: GitCompareArrows,
  },
  {
    id: "models" as const,
    name: "Models",
    description: "Marine models · coming soon",
    icon: Boxes,
  },
  {
    id: "forecasts" as const,
    name: "Forecasts",
    description: "Model results on the map · coming soon",
    icon: MapPinned,
  },
  {
    id: "health" as const,
    name: "Data Health",
    description: "Review coverage and provenance",
    icon: ShieldCheck,
  },
];
export default function App() {
  useEffect(preloadGeographicMap, []);
  const [theme, setTheme] = useAppTheme();
  useEffect(() => {
    document.documentElement.dataset.appTheme = theme;
    return () => { delete document.documentElement.dataset.appTheme; };
  }, [theme]);
  const [page, setPage] = useState<Page>(pageFromHash);
  const [open, setOpen] = useState(false);
  const navigationRoot = useRef<HTMLDivElement>(null);
  const navigationTrigger = useRef<HTMLButtonElement>(null);
  const focusNavigation = useRef(false);
  const hoverClose = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(hoverClose.current), []);
  useEffect(() => {
    if (!open) return;
    if (focusNavigation.current) {
      navigationRoot.current?.querySelector<HTMLButtonElement>("nav button")?.focus();
      focusNavigation.current = false;
    }
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !navigationRoot.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        navigationTrigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      window.clearTimeout(hoverClose.current);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const [mapEntry, setMapEntry] = useState(() => window.location.hash === "#viewshed" || window.location.hash === "#map?layer=viewshed" ? "viewshed" : undefined);
  useEffect(() => { normalizeLegacyHash(); }, []);
  useEffect(() => {
    const update = () => {
      normalizeLegacyHash();
      setPage(pageFromHash());
      setMapEntry(window.location.hash === "#viewshed" || window.location.hash === "#map?layer=viewshed" ? "viewshed" : undefined);
      setOpen(false);
    };
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
    };
  }, []);
  const navigate = (next: Page) => {
    const hash = next === "viewshed" ? "#map?layer=viewshed" : `#${next}`;
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);
    setMapEntry(next === "viewshed" ? "viewshed" : undefined);
    setPage(next === "viewshed" ? "map" : next);
    setOpen(false);
  };
  const [mapHeaderHost, setMapHeaderHost] = useState<HTMLDivElement | null>(null);
  const atlasPage = page === "map";
  return (
    <div data-app-theme={theme} className={`app unified-shell ${page === "home" ? "home-mode" : ""} ${atlasPage ? "map-mode" : ""} `}>
      {page !== "home" && <header className="app-header">
        <div
          className="brand-navigation"
          ref={navigationRoot}
          onMouseEnter={() => window.clearTimeout(hoverClose.current)}
          onFocus={() => window.clearTimeout(hoverClose.current)}
          onMouseLeave={(event) => {
            if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
            if (open && !navigationRoot.current?.querySelector("nav")?.contains(document.activeElement)) {
              window.clearTimeout(hoverClose.current);
              hoverClose.current = window.setTimeout(() => setOpen(false), 140);
            }
          }}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
          }}
        >
          <button
            className="wave-navigation"
            ref={navigationTrigger}
            aria-label="Page navigation"
            title="Explore MarineCast"
            aria-expanded={open}
            aria-controls="main-navigation"
            onMouseEnter={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                const first = navigationRoot.current?.querySelector<HTMLButtonElement>("nav button");
                if (first) first.focus();
                else { focusNavigation.current = true; setOpen(true); }
              }
            }}
          >
            <Waves size={33} />
          </button>
          <a
            className="brand"
            href="#home"
            aria-label="MarineCast home"
            onClick={(e) => {
              e.preventDefault();
              navigate("home");
            }}
          >
            <span>
              MarineCast{" "}
              <small>Data Atlas</small>
            </span>
          </a>
          {open && (
            <nav
              className="navigation panel"
              id="main-navigation"
              aria-label="Main navigation"
            >
              <span className="eyebrow">EXPLORE</span>
              {pages.map((p) => (
                <button
                  key={p.id}
                  aria-current={page === p.id ? "page" : undefined}
                  onClick={() => {
                    navigate(p.id);
                  }}
                >
                  <p.icon size={21} />
                  <span>
                    <strong>{p.name}</strong>
                    <small>{p.description}</small>
                  </span>
                  {page === p.id && <ArrowUpRight size={16} />}
                </button>
              ))}
            </nav>
          )}
        </div>
        {(page === "map" || page === "relationships") && <div className={page === "map" ? "data-map-header-host" : "rel-header-host"} ref={setMapHeaderHost} />}
        <button className="app-theme-toggle" aria-label={theme === 'dark' ? 'Switch to day mode' : 'Switch to night mode'} title={theme === 'dark' ? 'Switch to day mode' : 'Switch to night mode'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
        </button>
      </header>}
      {page === "home" ? (
        <HomePage onNavigate={navigate} />
      ) : page === "map" ? (
        <MapPage key={mapEntry ?? "features"} headerHost={mapHeaderHost} initialDomain={mapEntry} />
      ) : page === "relationships" ? (
        <RelationshipsPage headerHost={mapHeaderHost} />
      ) : page === "models" || page === "forecasts" ? (
        <ComingSoonPage page={page} />      ) : (
        <HealthPage />
      )}
    </div>
  );
}
