import SeascapeMapPage from "./SeascapeMapPage";

export default function MapPage({ headerHost, initialDomain }: { headerHost?: HTMLElement | null; initialDomain?: string }) {
  return <SeascapeMapPage headerHost={headerHost} initialDomain={initialDomain} />;
}
