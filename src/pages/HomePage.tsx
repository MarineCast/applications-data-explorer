import { useEffect, useRef, useState } from "react";
import {
  Map,
  Database,
  ChartNoAxesCombined,
  Binoculars,
  Activity,
  X,
  ArrowUpRight,
  Thermometer,
  Droplets,
  Ship,
  Eye,
} from "lucide-react";
import { features } from "../data/demo";
import type { FeatureId } from "../data/demo";
import HomeGridGlow from "../components/HomeGridGlow";
import "./HomePage.css";
export type ExplorerPage = "map" | "relationships" | "sightings" | "health";
const featureIcons = {
  temperature: Thermometer,
  chlorophyll: Droplets,
  traffic: Ship,
  viewability: Eye,
};
const destinations = [
  { page: "map" as const, label: "Map", icon: Map },
  { page: "catalog" as const, label: "Data", icon: Database },
  {
    page: "relationships" as const,
    label: "Analyze",
    icon: ChartNoAxesCombined,
  },
  { page: "sightings" as const, label: "Sightings", icon: Binoculars },
  { page: "health" as const, label: "Data Health", icon: Activity },
];
export default function HomePage({
  onNavigate,
}: {
  onNavigate: (page: ExplorerPage, feature?: FeatureId) => void;
}) {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const current = dialog.current;
    if (!current) return;
    if (catalogOpen && !current.open) current.showModal();
    else if (!catalogOpen && current.open) current.close();
  }, [catalogOpen]);
  return (
    <main className="home-page" aria-label="MarineCast home">
      <img
        className="home-artwork"
        src="/assets/home/marinecast-coastal-map.jpg"
        width="1536"
        height="1024"
        alt="Illustrated Pacific Northwest coastline, evergreen forest and mountains blending into a blue hexagonal map of the Salish Sea. Decorative artwork, not a data layer."
        fetchPriority="high"
      />
      <HomeGridGlow paused={catalogOpen} />
      <div className="home-sidebar">
        <header className="home-brand">
          <div className="home-wordmark">
            <img
              src="/assets/home/marinecast-wave.png"
              width="256"
              height="128"
              alt=""
            />
            <h1>MARINECAST</h1>
          </div>
          <p>OCEAN DATA&nbsp; FOR A WILDER TOMORROW</p>
        </header>
        <nav className="home-navigation" aria-label="Home navigation">
          {destinations.map(({ page, label, icon: Icon }) =>
            page === "catalog" ? (
              <button
                key={page}
                onClick={() => setCatalogOpen(true)}
                aria-haspopup="dialog"
              >
                <Icon size={22} strokeWidth={1.6} />
                <span>{label}</span>
              </button>
            ) : (
              <a
                key={page}
                href={`#${page}`}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(page);
                }}
                data-primary={page === "map" ? true : undefined}
              >
                <Icon size={22} strokeWidth={1.6} />
                <span>{label}</span>
              </a>
            ),
          )}
        </nav>
        <div className="home-mission">
          <hr />
          <p>
            INTEGRATED DATA
            <br />
            FOR HEALTHIER OCEANS
          </p>
        </div>
      </div>
      <footer className="home-demo-note">
        Illustrative artwork · Synthetic demo · No data connected
      </footer>
      <dialog
        ref={dialog}
        className="home-catalog"
        aria-labelledby="catalog-title"
        onClose={() => setCatalogOpen(false)}
        onCancel={() => setCatalogOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setCatalogOpen(false);
        }}
      >
        <div className="home-catalog-heading">
          <div>
            <span className="eyebrow">DEMO CATALOG</span>
            <h2 id="catalog-title">Explore demo data</h2>
          </div>
          <button
            aria-label="Close data catalog"
            onClick={() => setCatalogOpen(false)}
            autoFocus
          >
            <X size={21} />
          </button>
        </div>
        <p className="home-catalog-intro">
          Four synthetic features to explore. Choose one to open it on the map.
        </p>
        <div className="home-catalog-products">
          {features.map((f) => {
            const Icon = featureIcons[f.id];
            return (
              <button key={f.id} onClick={() => onNavigate("map", f.id)}>
                <Icon size={23} />
                <span>
                  <strong>{f.name}</strong>
                  <small>
                    {f.domain} · {f.unit} · {f.temporal ? "Monthly" : "Static"}
                  </small>
                </span>
                <ArrowUpRight size={17} />
              </button>
            );
          })}
        </div>
        <p className="home-catalog-note">
          Local demo fixtures only. No product files or data API connected.
        </p>
      </dialog>
    </main>
  );
}
