import { useState } from "react";
import {
  Menu,
  X,
  Waves,
  Map,
  GitCompareArrows,
  Fish,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import MapPage from "./pages/MapPage";
import RelationshipsPage from "./pages/RelationshipsPage";
import SightingsPage from "./pages/SightingsPage";
import HealthPage from "./pages/HealthPage";
type Page = "map" | "relationships" | "sightings" | "health";
const pages = [
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
  const [page, setPage] = useState<Page>("map"),
    [open, setOpen] = useState(false);
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
          href="#map"
          onClick={(e) => {
            e.preventDefault();
            setPage("map");
            setOpen(false);
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
                  setPage(p.id);
                  setOpen(false);
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
        <MapPage />
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
