import { useEffect, useState } from "react";
import {
  House,
  Menu,
  X,
  Waves,
  Map,
  GitCompareArrows,
  Fish,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import HomePage from "./pages/HomePage";
import type { ExplorerPage } from "./pages/HomePage";
import type { FeatureId } from "./data/demo";
import MapPage from "./pages/MapPage";
import RelationshipsPage from "./pages/RelationshipsPage";
import SightingsPage from "./pages/SightingsPage";
import HealthPage from "./pages/HealthPage";
type Page = "home" | ExplorerPage;
function pageFromHash(): Page {
  const hash = window.location.hash.slice(1);
  return ["home", "map", "relationships", "sightings", "health"].includes(hash)
    ? (hash as Page)
    : "home";
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
    name: "Map",
    description: "Explore features across the water",
    icon: Map,
  },
  {
    id: "relationships" as const,
    name: "Relationships",
    description: "Compare features and distributions",
    icon: GitCompareArrows,
  },
  {
    id: "sightings" as const,
    name: "Sightings",
    description: "Inspect synthetic observation context",
    icon: Fish,
  },
  {
    id: "health" as const,
    name: "Data health",
    description: "Review coverage and provenance",
    icon: ShieldCheck,
  },
];
export default function App() {
  const [page, setPage] = useState<Page>(pageFromHash);
  const [open, setOpen] = useState(false);
  const [mapFeature, setMapFeature] = useState<FeatureId>("temperature");
  useEffect(() => {
    const update = () => {
      setPage(pageFromHash());
      setOpen(false);
    };
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
    };
  }, []);
  const navigate = (next: Page, feature?: FeatureId) => {
    if (next === "map") setMapFeature(feature ?? "temperature");
    if (window.location.hash !== `#${next}`)
      window.history.pushState(null, "", `#${next}`);
    setPage(next);
    setOpen(false);
  };
  if (page === "home") return <HomePage onNavigate={navigate} />;
  return (
    <div className={`app ${page === "map" ? "map-mode" : ""}`}>
      <header className="app-header">
        <button
          className="menu-button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="main-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
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
          <Waves size={27} />
          <span>
            MarineCast <small>Explorer</small>
          </span>
        </a>
        <span className="header-divider" />
        <span className="current-page">
          {pages.find((p) => p.id === page)?.name}
        </span>
        <span className="demo-status">
          <i /> Synthetic demo <span>· No data connected</span>
        </span>
      </header>
      {open && (
        <>
          <button
            className="nav-backdrop"
            aria-label="Dismiss navigation"
            onClick={() => setOpen(false)}
          />
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
            <div className="nav-footer">Local fixtures only · v0.1</div>
          </nav>
        </>
      )}
      {page === "map" ? (
        <MapPage initialFeature={mapFeature} />
      ) : page === "relationships" ? (
        <RelationshipsPage />
      ) : page === "sightings" ? (
        <SightingsPage />
      ) : (
        <HealthPage />
      )}
    </div>
  );
}
