import { useEffect, useRef, useState } from "react";
import {
  House,
  Menu,
  Waves,
  Map,
  GitCompareArrows,
  Fish,
  ShieldCheck,
  ArrowUpRight,
  Eye,
} from "lucide-react";
import HomePage from "./pages/HomePage";
import type { ExplorerPage } from "./pages/HomePage";
import MapPage from "./pages/MapPage";
import RelationshipsPage from "./pages/RelationshipsPage";
import SightingsPage from "./pages/SightingsPage";
import HealthPage from "./pages/HealthPage";
import ViewshedPage from "./pages/ViewshedPage";
type Page = "home" | ExplorerPage;
function pageFromHash(): Page {
  const hash = window.location.hash.slice(1);
  return ["home", "map", "viewshed", "relationships", "sightings", "health"].includes(hash)
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
    name: "Features",
    description: "Explore features across the water",
    icon: Map,
  },
  {
    id: "sightings" as const,
    name: "Sightings",
    description: "Inspect synthetic observation context",
    icon: Fish,
  },
  {
    id: "relationships" as const,
    name: "Relationships",
    description: "Compare features and distributions",
    icon: GitCompareArrows,
  },
  {
    id: "viewshed" as const,
    name: "Viewshed",
    description: "See water target scores from land cells",
    icon: Eye,
  },
  {
    id: "health" as const,
    name: "Health",
    description: "Review coverage and provenance",
    icon: ShieldCheck,
  },
];
export default function App() {
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
  const [viewshedContext, setViewshedContext] = useState("Average target viewability / Lower estimate");
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
  const navigate = (next: Page) => {
    if (window.location.hash !== `#${next}`)
      window.history.pushState(null, "", `#${next}`);
    setPage(next);
    setOpen(false);
  };
  const atlasPage = page === "map" || page === "viewshed";
  return (
    <div className={`app unified-shell ${page === "home" ? "home-mode" : ""} ${atlasPage ? "map-mode" : ""} ${page === "viewshed" ? "viewshed-mode" : ""}`}>
      <header className="app-header">
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
            {page === "home" ? <><span>Menu</span><Menu size={18} /></> : <Waves size={33} />}
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
        {page === "viewshed" && (
          <div className="atlas-location viewshed-context">
            <Map size={16} />
            <span>
              Viewshed / {viewshedContext} <small>Local viewshed pilot</small>
            </span>
          </div>
        )}
      </header>
      {page === "home" ? (
        <HomePage onNavigate={navigate} menuOpen={open} />
      ) : page === "map" ? (
        <MapPage />
      ) : page === "viewshed" ? (
        <ViewshedPage onContextChange={setViewshedContext} />
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
