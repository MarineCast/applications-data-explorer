import { useEffect, useMemo, useState } from "react";
import useDataRevision from "./useDataRevision";
import { loadSeascapeCatalog } from "../data/seascape";
import { loadMeteorologyCatalog, withMeteorology } from "../data/meteorology";
import { loadOrcaData, withOrca } from "../data/orca";
import { loadHydrologyData, withHydrology } from "../data/hydrology";

import {loadRiverInfluence,withRiverInfluence} from "../data/riverInfluence";

type Domain = "base" | "meteorology" | "orca" | "hydrology" | "riverInfluence";
type Catalogs = { base: Awaited<ReturnType<typeof loadSeascapeCatalog>>;
  meteorology: Awaited<ReturnType<typeof loadMeteorologyCatalog>>;
  orca: Awaited<ReturnType<typeof loadOrcaData>>;
  hydrology: Awaited<ReturnType<typeof loadHydrologyData>>;
  riverInfluence: Awaited<ReturnType<typeof loadRiverInfluence>> };
/** Optional sources load independently; a slow or failed adapter cannot block the base map. */
export default function useFeatureCatalog(attempt: number) {
  const revision = useDataRevision(["seascape", "governance", "human", "oceanography", "meteorology", "orca", "hydrology", "river-influence"]);
  const [data, setData] = useState<Partial<Catalogs>>({});
  const [errors, setErrors] = useState<Partial<Record<Domain, string>>>({});
  useEffect(() => {
    let active = true;
    const load = <K extends Domain>(domain: K, request: Promise<Catalogs[K]>) => {
      request.then(value => {
        if (!active) return;
        setData(previous => ({ ...previous, [domain]: value }));
        setErrors(previous => ({ ...previous, [domain]: undefined }));
      }).catch((error: unknown) => {
        if (active) {
          setData(previous => ({ ...previous, [domain]: undefined }));
          setErrors(previous => ({ ...previous, [domain]: error instanceof Error ? error.message : String(error) }));
        }
      });
    };
    load("base", loadSeascapeCatalog());
    load("meteorology", loadMeteorologyCatalog());
    load("orca", loadOrcaData(import.meta.env.MODE === "orca-fixture"));
    load("hydrology", loadHydrologyData());
    load("riverInfluence", loadRiverInfluence());
    return () => { active = false; };
  }, [attempt, revision]);
  const weather = useMemo(() => data.base && (data.meteorology ? withMeteorology(data.base, data.meteorology) : data.base), [data.base, data.meteorology]);
  const mammals = useMemo(() => weather && (data.orca ? withOrca(weather, data.orca) : weather), [weather, data.orca]);
  const hydroCatalog = useMemo(() => mammals && (data.hydrology ? withHydrology(mammals, data.hydrology) : mammals), [mammals, data.hydrology]);
  const catalog=useMemo(()=>hydroCatalog&&(data.riverInfluence?withRiverInfluence(hydroCatalog,data.riverInfluence):hydroCatalog),[hydroCatalog,data.riverInfluence]);
  return { catalog, errors };
}
