import { savedVesselRouting, vesselRoutingRecorded } from "../data/vesselRouting";
import { savedPortFeature } from "../data/humanPorts";
import { isPercentCoverage, savedConservation } from "../data/marineConservation";
import { savedWaterAssignment, waterAssignmentFamily, geographicWaterColors, internationalBoundaryColumn } from "../data/waterAssignments";
import GovernanceOverview from "../components/GovernanceOverview";
import SourceWarning from "../components/SourceWarning";
import WarningNotice from "../components/WarningNotice";
import { MapWarningsProvider, MapWarningsRegion } from "../components/MapWarnings";
import {filterCategoryLayer} from "../data/categoryVisibility";
import useFeatureCatalog from "../hooks/useFeatureCatalog";
import useComparisonAppearance from "../hooks/useComparisonAppearance";
import {HumanGeometryLegend,HumanGeometryInspector,HumanGeometryOverview,HumanGeometryPopup} from "../components/HumanGeometryControls";
import {defaultHumanFilter,filteredHumanRecords,humanVisibleFeatures} from "../data/humanGeometry";
import type {HumanGeometryFilter,HumanGeometryView} from "../data/humanGeometry";
import {RiverInfluenceSettings,RiverInfluenceInsights} from "../components/RiverInfluenceControls";
import {riverInfluenceLayer,defaultInfluenceSettings,isRiverInfluenceFeature,riverInfluenceDatasetInfo} from "../data/riverInfluence";
import type {InfluenceSettings} from "../data/riverInfluence";
import HydrologyHistory from "../components/HydrologyHistory";
import HumanPopulationInsights from "../components/HumanPopulationInsights";
import { populationSupport, populationScaleValues, samePopulationQuantity, populationLegendContext } from "../data/humanPopulation";
import { hydrologyLayer, hydrologyCaveat } from "../data/hydrology";
import type { HydrologyMetricId } from "../data/hydrology";
import { HydrologyLegend, HydrologyOverview } from "../components/HydrologyControls";
import HydrologyInsights from "../components/HydrologyInsights";
import { defaultOrcaState, orcaPeriods, currentOrcaPeriod, filterOrcaFrame, orcaCountLayer, orcaCaveat } from "../data/orca";
import type { OrcaState } from "../data/orca";
import { OrcaControls, OrcaTimeline, OrcaPointLegend, OrcaDemography, OrcaOverview } from "../components/OrcaControls";
import OrcaInspector, { OrcaSourceCoverage } from "../components/OrcaInspector";
import CategoricalCellPopup from "../components/CategoricalCellPopup";
import GovernanceMembershipInspector from "../components/GovernanceMembershipInspector";
import { membershipCategoryScale } from "../data/governancePatterns";
import type { ViewshedMapProps } from "../data/viewshedMap";
import ViewshedLayer from "../components/ViewshedLayer";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Layers3,
  ChevronLeft,
  ChevronRight,
  Check,
  Download,
  Copy,
  GitCompareArrows,
  ArrowLeftRight,
  Pencil,
  CircleHelp,
  X,
} from "lucide-react";
import MapCanvas from "../components/MapCanvas";
import MapSwipeCompare from "../components/MapSwipeCompare";
import { createMapCameraLink } from "../data/mapCamera";
import MapLegend from "../components/MapLegend";
import DataDomainDock from "../components/DataDomainDock";
import SourcePicker from "../components/SourcePicker";
import { tribalAreaColumn, tribalAssignmentColumn } from "../data/tribalAreas";
import { refugePercent } from "../data/wildlifeRefuges";
import { savedCriticalHabitat } from "../data/criticalHabitat";
import { savedExclusionZone } from "../data/exclusionZones";
import { managementAreaCountColumn } from "../data/managementAreas";
import { featureDisplayName } from "../data/sourcePicker";
import FamilyFeaturePicker from "../components/FamilyFeaturePicker";
import TimelineControls from "../components/TimelineControls";
import WeatherTimeSlider from "../components/WeatherTimeSlider";
import WeatherInsights from "../components/WeatherInsights";
import { loadMeteorologyLayer } from "../data/meteorology";
import DatasetInsights from "../components/DatasetInsights";
import type { InsightDataset } from "../components/DatasetInsights";
import { useComparisonTimeline } from "../components/useComparisonTimeline";
import AtlasDialog from "../components/AtlasDialog";
import { createColorScale, createCategoryScale, palettes } from "../data/colorScale";
import { standardizeLayer } from "../data/standardize";
import type { MapBounds, MapLayer } from "../data/map";
import type { PaletteId, ScaleMode } from "../data/colorScale";
import type { Cell } from "../data/demo";
import {
  loadSeascapeLayer,
  sourceValue,
} from "../data/seascape";
import type {
  NativeResolution,
  SeascapeCatalog,
  SeascapeFeature,
  SeascapeLayer,
} from "../data/seascape";
import { savedRegionalBoundary } from "../data/regionalBoundaries";
import { savedCoastGuard } from "../data/coastGuard";
function isDepth(feature?: SeascapeFeature) {
  return feature?.measurement?.quantity === "depth" && feature.unit === "m" && feature.measurement.positiveDirection === "down";
}
function displayScale(layer: MapLayer | undefined, field: SeascapeFeature | undefined, palette: PaletteId, mode: ScaleMode | undefined, standardized: boolean) {
  if (!layer) return undefined;
  if (layer.categoryMemberships) {
    const scale = membershipCategoryScale(layer, palette);
    return waterAssignmentFamily(field?.column) ? { ...scale, colors: geographicWaterColors.slice(0, layer.categories?.length ?? 0) } : scale;
  }
  if (layer.categories) return createCategoryScale(layer.values, layer.categories, palette);
  const effectiveMode = !mode || mode === "depth" ? isDepth(field) && !standardized ? "depth" : "equal" : mode;
  if ((field?.dataset === "meteorology" || field?.dataset === "hydrology"&&!isRiverInfluenceFeature(field)) && !standardized && effectiveMode !== "quantile") {
    const range = field.circular ? [0, 360] : layer.range;
    const fixed = createColorScale(new Map([["min", range[0]], ["max", range[1]]]), palette, effectiveMode);
    return { ...fixed, count: [...layer.values.values()].filter(value => value !== null).length };
  }
  const populationValues = !standardized && field?.dataset === "human" ? populationScaleValues(layer as SeascapeLayer) : undefined;
  const scale = createColorScale(populationValues ?? layer.values, palette, effectiveMode);
  return populationValues ? { ...scale, count: [...layer.values.values()].filter(value => value !== null && Number.isFinite(value)).length } : scale;
}

// Flat products retain their namespaced source columns; legacy aliases remain supported.
function selectFeature(catalog: SeascapeCatalog | undefined, resolution: NativeResolution, dataset: string, preferred = "BATHYMETRY") {
  const migratedPort = dataset === "governance" ? savedPortFeature(catalog?.features ?? [], preferred) : undefined;
  if (migratedPort) return migratedPort;
  const candidates = catalog?.features.filter(f => f.resolution === resolution && (f.dataset ?? "seascape") === dataset) ?? [];
  const aliases: Record<string, string> = {
    BATHYMETRY: "BATHYMETRY__BATHYMETRY",
    BATHYMETRY_LOCAL_ANOMALY: "WATERGRAPH_ANOMALY__BATHYMETRY_LOCAL_ANOMALY",
  };
  return candidates.find(f => f.id === preferred) ??
    (dataset === "governance" ? savedCriticalHabitat(candidates, preferred) : undefined) ??
    (dataset === "governance" ? savedExclusionZone(candidates, preferred) : undefined) ??
    (dataset === "governance" ? savedVesselRouting(candidates, preferred) : undefined) ??
    (dataset === "governance" ? savedConservation(candidates, preferred) : undefined) ??
    (dataset === "governance" ? savedCoastGuard(candidates, preferred) : undefined) ??
    (dataset === "governance" ? savedRegionalBoundary(candidates, preferred) : undefined) ??
    (dataset === "governance" ? savedWaterAssignment(candidates, preferred) : undefined) ??
    candidates.find(f => dataset === "governance" && /^GOVERNANCE__(?:dynamic__)?tribal_first_nations_areas__/.test(preferred) && f.column === (preferred.endsWith("__feature_memberships_v1") ? tribalAssignmentColumn : tribalAreaColumn)) ??
    candidates.find(f => dataset === "governance" && /^GOVERNANCE__(?:dynamic__)?wildlife_refuges__/.test(preferred) && f.column === "wildlife_refuges__recorded_feature_count") ??
    candidates.find(f => dataset === "governance" && /^GOVERNANCE__(?:dynamic__)?management_areas__/.test(preferred) && (f.column ?? f.id.replace(/^GOVERNANCE__(?:dynamic__)?/, "")) === managementAreaCountColumn) ??
    candidates.find(f => f.productId === `seascape-bathymetry-static-r${resolution}` && f.column === aliases[preferred]) ??
    candidates.find(f => dataset === "human" && f.column === "population_within_100km_collected") ??
    candidates.find(f => f.id === "BATHYMETRY" || (f.productId === `seascape-bathymetry-static-r${resolution}` && f.column === aliases.BATHYMETRY)) ??
    candidates.find(f => f.available > 0 && f.kind !== "categorical" && f.range[0] !== f.range[1] && !/quality|context|processing/.test(f.role) && !/status|qualification/i.test(f.name) && (dataset !== "governance" || !/count/i.test(f.name))) ??
    candidates.find(f => f.available > 0 && f.kind !== "categorical" && !/quality|context|processing/.test(f.role)) ?? candidates.find(f => f.available > 0) ?? candidates[0];
}
function useLayer(
  catalog: SeascapeCatalog | undefined,
  field: SeascapeFeature | undefined,
  slice?: string,
) {
  const [state, setState] = useState<{
    layer?: SeascapeLayer;
    error?: string;
    field?: SeascapeFeature;
    slice?: string;
  }>({});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    if (catalog && field)
      (isRiverInfluenceFeature(field) ? Promise.resolve().then(()=>riverInfluenceLayer(catalog,field,slice?JSON.parse(slice):undefined)) : field.dataset === "meteorology" ? loadMeteorologyLayer(catalog, field, slice, controller.signal) : loadSeascapeLayer(catalog, field, slice))
        .then((layer) => {
          if (active) setState({ layer, field, slice });
        })
        .catch((error) => {
          if (active && !controller.signal.aborted) setState({ error: String(error.message), field, slice });
        });
    return () => {
      active = false;
      controller.abort();
    };
  }, [catalog, field, slice, attempt]);
  const current = state.layer?.field === field && state.slice === slice;
  const failed = state.field === field && state.slice === slice ? state.error : undefined;
  return {
    // Preserve the basemap between weather frames. Its legend keeps the displayed
    // day's date until the requested complete native frame replaces it atomically.
    layer: current || (field?.dataset === "meteorology" && state.layer?.field === field) ? state.layer : undefined,
    loading: Boolean(catalog && field && !current && !failed),
    error: failed,
    retry: () => {
      setState({});
      setAttempt((a) => a + 1);
    },
  };
}
function metric(value: number | null | undefined, unit: string, precision = 7) {
  return value == null
    ? "Unavailable"
    : `${value !== 0 && (Math.abs(value) < 0.001 || Math.abs(value) >= 1e7) ? value.toExponential(3) : value.toLocaleString(undefined, { maximumSignificantDigits: precision })} ${unit}`;
}
export default function SeascapeMapPage({ headerHost, initialDomain }: { headerHost?: HTMLElement | null; initialDomain?: string }) {
  const [viewshedOverlay, setViewshedOverlay] = useState<ViewshedMapProps>();
  const [viewshedActive, setViewshedActive] = useState(initialDomain === "viewshed");
  const [hydrologyDay, setHydrologyDay] = useState<string>();
  const [hydrologyRiver, setHydrologyRiver] = useState<string>();

  const [orcaState, setOrcaState] = useState<OrcaState>(defaultOrcaState);
  const [rightOrcaState, setRightOrcaState] = useState<OrcaState>(defaultOrcaState);
  const [selectedEvent, setSelectedEvent] = useState<{id:string;right:boolean}>();
  const [attempt, setAttempt] = useState(0);
  const {catalog, errors: catalogErrors} = useFeatureCatalog(attempt);
  const {base:error} = catalogErrors;
  const sourceNames = { base: 'Local data', meteorology: 'Meteorology', orca: 'Orca', hydrology: 'Hydrology', riverInfluence: 'River influence' };
  const sourceIssues = [
    ...Object.entries(catalogErrors).flatMap(([domain, message]) => message ? [{ name: sourceNames[domain as keyof typeof sourceNames], message }] : []),
    ...(catalog?.unavailableProducts ?? []).map(source => ({ name: source.name, message: source.reason })),
  ];
  const [resolution, setResolution] = useState<NativeResolution>(6);
  const [dataset, setDataset] = useState("seascape");
  const [otherDataset, setOtherDataset] = useState("seascape");
  const [slice, setSlice] = useState<string>();
  const [otherSlice, setOtherSlice] = useState<string>();
  const [id, setId] = useState("BATHYMETRY");
  const [otherId, setOtherId] = useState("BATHYMETRY_LOCAL_ANOMALY");
  const [selectedLocation,setSelectedLocation] = useState<{id:string;right:boolean;field:string}>();
  const [locationFilters,setLocationFilters] = useState<Record<string,HumanGeometryFilter>>({});
  const [selected, setSelected] = useState<{ cell: Cell; right: boolean }>();
  const [leftBounds, setLeftBounds] = useState<MapBounds>();
  const [rightBounds, setRightBounds] = useState<MapBounds>();

  const [compare, setCompare] = useState(false);
  const [comparisonSetup, setComparisonSetup] = useState(false);
  const [comparisonFocus, setComparisonFocus] = useState<"left" | "right">();
  const comparisonSetupRoot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (comparisonSetup && comparisonFocus) comparisonSetupRoot.current?.querySelector<HTMLButtonElement>(`button[aria-label="${comparisonFocus === "right" ? "Right" : "Left"} map feature"]`)?.focus();
  }, [comparisonSetup, comparisonFocus]);
  const [selectionNotice, setSelectionNotice] = useState("");
  const appearanceState = useComparisonAppearance();
  const { left: appearance, right: rightStyle, linked: linkedAppearance, link: changeAppearanceLink } = appearanceState;
  const { palette, scaleMode, opacity, outlines, smoothing, standardize, hydrology: hydrologyAppearance } = appearance;
  const setPalette = (value: typeof palette) => appearanceState.change("left", "palette", value);
  const setScaleMode = (value: typeof scaleMode) => appearanceState.change("left", "scaleMode", value);
  const setOpacity = (value: number) => appearanceState.change("left", "opacity", value);
  const setOutlines = (value: boolean) => appearanceState.change("left", "outlines", value);
  const setSmoothing = (value: typeof smoothing) => appearanceState.change("left", "smoothing", value);
  const setStandardize = (value: boolean) => appearanceState.change("left", "standardize", value);
  const setHydrologyAppearance = (value: typeof hydrologyAppearance) => appearanceState.change("left", "hydrology", value);
  const changeRightAppearance = <K extends keyof typeof appearance>(key: K, value: (typeof appearance)[K]) => appearanceState.change("right", key, value);
  const [cameraLink] = useState(createMapCameraLink);
  const [overlayHost, setOverlayHost] = useState<HTMLDivElement | null>(null);
  const [layers, setLayers] = useState(false);
  const [domainsOpen, setDomainsOpen] = useState(true);
  const domainsButton = useRef<HTMLButtonElement>(null);
  const layersButton = useRef<HTMLButtonElement>(null);
  const layersRoot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!domainsOpen) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (layers) { setLayers(false); layersButton.current?.focus(); }
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !layersRoot.current?.contains(event.target) && !domainsButton.current?.contains(event.target)
        && !(event.target instanceof Element && event.target.closest('.dataset-insights'))) {
        setLayers(false);
      }
    };
    document.addEventListener("keydown", dismiss);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", dismiss);
      document.removeEventListener("pointerdown", outside);
    };
  }, [layers, domainsOpen]);
  const [dialog, setDialog] = useState<"export" | "help" | "source">();
  const [insightsOpen, setInsightsOpen] = useState(false);
  useEffect(() => {
    if (!insightsOpen) return;
    const viewport = window.matchMedia?.('(min-width: 1100px)');
    const onResize = (event: MediaQueryListEvent) => { if (!event.matches) setLayers(false); };
    viewport?.addEventListener('change', onResize);
    return () => viewport?.removeEventListener('change', onResize);
  }, [insightsOpen]);
  const [insightsSide, setInsightsSide] = useState<"left" | "right">("left");
  const [legendSide, setLegendSide] = useState<"left" | "right">();
  const setLegendOpen = useCallback((side: "left" | "right" | undefined) => {
    setLegendSide(side);
    if (side) {
      setLayers(false);
      setDialog(undefined);
    }
  }, []);
  const setLeftLegendOpen = useCallback((open: boolean) => setLegendOpen(open ? "left" : undefined), [setLegendOpen]);
  const setRightLegendOpen = useCallback((open: boolean) => setLegendOpen(open ? "right" : undefined), [setLegendOpen]);
  const [exportSide, setExportSide] = useState<"left" | "right">("left");
  const [copied, setCopied] = useState<string>();
  const field = selectFeature(catalog, resolution, dataset, id);
  const otherField = compare
    ? selectFeature(catalog, resolution, otherDataset, otherId)
    : undefined;
  const influence=catalog?.riverInfluence;
  const [savedInfluenceLeft,setInfluenceLeft]=useState<InfluenceSettings>();
  const [savedInfluenceRight,setInfluenceRight]=useState<InfluenceSettings>();
  const influenceSettings=(saved:InfluenceSettings|undefined)=>{if(!influence)return undefined;const defaults=defaultInfluenceSettings(influence);return{date:saved&&influence.recipe.dates.includes(saved.date)?saved.date:defaults.date,distance:saved&&influence.recipe.config.distance_profiles.some(p=>p.id===saved.distance)?saved.distance:defaults.distance,lag:saved&&influence.recipe.config.lag_profiles.some(p=>p.id===saved.lag)?saved.lag:defaults.lag};};
  const influenceLeft=influenceSettings(savedInfluenceLeft),influenceRight=influenceSettings(savedInfluenceRight);
  const leftInfluence=isRiverInfluenceFeature(field),rightInfluence=isRiverInfluenceFeature(otherField);
  const influenceActive=Boolean(!viewshedActive&&influence&&(leftInfluence||rightInfluence));
  const hydro=catalog?.hydrology;
  const hydroDay=hydro?.dates.includes(hydrologyDay??"")?hydrologyDay!:hydro?.dates.at(-1);
  const leftHydro=field?.dataset==="hydrology"&&!leftInfluence,rightHydro=otherField?.dataset==="hydrology"&&!rightInfluence;
  const hydroActive=Boolean(!viewshedActive&&hydro&&(leftHydro||rightHydro));
  const leftHydroLayer=useMemo(()=>catalog&&field&&leftHydro&&hydroDay?hydrologyLayer(catalog,field,hydroDay):undefined,[catalog,field,leftHydro,hydroDay]);
  const rightHydroLayer=useMemo(()=>catalog&&otherField&&rightHydro&&hydroDay?hydrologyLayer(catalog,otherField,hydroDay):undefined,[catalog,otherField,rightHydro,hydroDay]);
  const orca=catalog?.orca;
  const orcaActive=Boolean(!viewshedActive&&orca&&(field?.dataset==="marine-mammals"||otherField?.dataset==="marine-mammals"));
  const periods=useMemo(()=>orca?orcaPeriods(orca,orcaState.granularity):[],[orca,orcaState.granularity]);
  const orcaFrame=useMemo(()=>orca?filterOrcaFrame(orca,{categories:orcaState.categories,granularity:orcaState.granularity,anchor:orcaState.anchor},currentOrcaPeriod(periods,orcaState.anchor)):undefined,[orca,periods,orcaState.categories,orcaState.granularity,orcaState.anchor]);
  const rightPeriods = useMemo(() => orca ? orcaPeriods(orca, rightOrcaState.granularity) : [], [orca, rightOrcaState.granularity]);
  const rightOrcaFrame = useMemo(() => orca ? filterOrcaFrame(orca, rightOrcaState, currentOrcaPeriod(rightPeriods, rightOrcaState.anchor)) : undefined, [orca, rightOrcaState, rightPeriods]);
  const leftOrca=field?.dataset==="marine-mammals",rightOrca=otherField?.dataset==="marine-mammals";
  const leftAsync=useLayer(catalog,leftOrca||leftHydro?undefined:field,leftInfluence?JSON.stringify(influenceLeft):slice),rightAsync=useLayer(catalog,rightOrca||rightHydro?undefined:otherField,rightInfluence?JSON.stringify(influenceRight):otherSlice);
  const leftOrcaLayer=useMemo(()=>catalog&&field&&leftOrca&&orcaFrame?orcaCountLayer(catalog,field,orcaFrame):undefined,[catalog,field,leftOrca,orcaFrame]);
  const rightOrcaLayer=useMemo(()=>catalog&&otherField&&rightOrca&&rightOrcaFrame?orcaCountLayer(catalog,otherField,rightOrcaFrame):undefined,[catalog,otherField,rightOrca,rightOrcaFrame]);
  const left=leftOrca?{...leftAsync,layer:leftOrcaLayer,loading:false,error:undefined}:leftHydro?{...leftAsync,layer:leftHydroLayer,loading:false,error:undefined}:leftAsync;
  const right=rightOrca?{...rightAsync,layer:rightOrcaLayer,loading:false,error:undefined}:rightHydro?{...rightAsync,layer:rightHydroLayer,loading:false,error:undefined}:rightAsync;
  const leftPoints=leftOrca&&orcaState.representation==="points",rightPoints=rightOrca&&rightOrcaState.representation==="points";
  const nativeViews=useMemo(()=>([false,true] as const).map(rightSide=>{
    const layer=rightSide?right.layer:left.layer;
    if(!layer?.humanGeometry || viewshedActive || rightSide&&!compare)return undefined;
    const savedFilter=locationFilters[`${rightSide}:${layer.field.id}`]??defaultHumanFilter;
    const filter=savedFilter.search ? {...savedFilter,search:""} : savedFilter;
    const selection=selectedLocation?.field===layer.field.id&&selectedLocation.right===rightSide?selectedLocation.id:undefined;
    const record=filteredHumanRecords(layer.humanGeometry,filter).find(f=>f.properties.record_id===selection);
    const clear=()=>setSelectedLocation(undefined);
    return {data:layer.humanGeometry,filter,selected:record?.properties.record_id,opacity:rightSide?rightStyle.opacity:opacity,
      onSelect:(id:string)=>{setSelectedLocation({id,right:rightSide,field:layer.field.id});setSelected(undefined);setSelectedEvent(undefined);setInsightsSide(rightSide?"right":"left");setLayers(false);setLegendSide(undefined);},
      onBackground:clear,popup:record&&(filter.showRecords||filter.showFootprints&&layer.humanGeometry.footprints.some(f=>f.properties.record_id===record.properties.record_id))?<HumanGeometryPopup feature={record} onClose={clear}/>:undefined} satisfies HumanGeometryView;
  }),[left.layer,right.layer,viewshedActive,compare,locationFilters,selectedLocation,rightStyle.opacity,opacity]);
  const leftNative=nativeViews[0],rightNative=nativeViews[1];
  const changeLocationFilter=(rightSide:boolean,filter:HumanGeometryFilter)=>{const layer=rightSide?right.layer:left.layer;if(layer)setLocationFilters(old=>({...old,[`${rightSide}:${layer.field.id}`]:filter}));};

  const changeOrca=(state:OrcaState,rightSide=false)=>{setSelectedLocation(undefined);(rightSide?setRightOrcaState:setOrcaState)(state);setSelected(undefined);setSelectedEvent(undefined);};
  const selectEvent=useCallback((id:string,right:boolean)=>{setSelectedLocation(undefined);setSelectedEvent({id,right});setSelected(undefined);setInsightsSide(right?"right":"left");setLayers(false);setLegendSide(undefined);},[]);
  const pointOverlays=useMemo(()=>([false,true] as const).map(right=> {
    const frame=right?rightOrcaFrame:orcaFrame, state=right?rightOrcaState:orcaState;
    return frame?{records:frame.points,selected:selectedEvent?.right===right?selectedEvent.id:undefined,whaleMarkers:state.whaleMarkers,onSelect:(id:string)=>selectEvent(id,right)}:undefined;
  }),[orcaFrame,rightOrcaFrame,selectedEvent,orcaState,rightOrcaState,selectEvent]);
  const sameComparison = compare && (!leftOrca || JSON.stringify(orcaState) === JSON.stringify(rightOrcaState)) && field?.id === otherField?.id && dataset === otherDataset && (left.layer?.slice?.value ?? slice ?? "") === (right.layer?.slice?.value ?? otherSlice ?? "");
  const leftStandardized = useMemo(
    () => (standardize && left.layer && !left.layer.categories ? standardizeLayer(left.layer) : undefined),
    [left.layer, standardize],
  );
  const rightStandardized = useMemo(
    () => (rightStyle.standardize && right.layer && !right.layer.categories ? standardizeLayer(right.layer) : undefined),
    [right.layer, rightStyle.standardize],
  );
  const leftDisplay = !leftOrca && !leftHydro && standardize && !left.layer?.categories && !field?.circular ? leftStandardized?.layer : left.layer;
  const rightDisplay = !rightOrca && !rightHydro && rightStyle.standardize && !right.layer?.categories && !otherField?.circular ? rightStandardized?.layer : right.layer;
  const [hiddenCategories,setHiddenCategories]=useState<Record<string,string[]>>({});
  const leftCategoryKey=`left:${dataset}:${field?.id}:${resolution}`,rightCategoryKey=`right:${otherDataset}:${otherField?.id}:${resolution}`;
  const leftHidden=hiddenCategories[leftCategoryKey],rightHidden=hiddenCategories[rightCategoryKey];
  const changeHiddenCategories=(rightSide:boolean,keys:string[])=>{const id=rightSide?rightCategoryKey:leftCategoryKey;setHiddenCategories(prior=>({...prior,[id]:keys}));};
  const leftMapDisplay=useMemo(()=>filterCategoryLayer(leftDisplay,leftHidden??[]),[leftDisplay,leftHidden]);
  const rightMapDisplay=useMemo(()=>filterCategoryLayer(rightDisplay,rightHidden??[]),[rightDisplay,rightHidden]);
  const leftIndividualScale = useMemo(
    () => displayScale(leftDisplay, field, palette, scaleMode, standardize && !leftHydro && !leftOrca && !field?.circular),
    [leftDisplay, palette, scaleMode, field, standardize,leftHydro,leftOrca],
  );
  const rightIndividualScale = useMemo(
    () => displayScale(rightDisplay, otherField, rightStyle.palette, rightStyle.scaleMode, rightStyle.standardize && !rightHydro && !rightOrca && !otherField?.circular),
    [rightDisplay, rightStyle.palette, rightStyle.scaleMode, otherField, rightStyle.standardize,rightHydro,rightOrca],
  );
  // Comparing the same metric uses one pooled classification, including across slices.
  const sharedScale = useMemo(() => {
    if (!compare || !linkedAppearance || !leftDisplay || !rightDisplay || (field?.id !== otherField?.id && !(samePopulationQuantity(field, otherField) && !standardize)) || dataset !== otherDataset || leftDisplay.unit !== rightDisplay.unit || leftDisplay.categories || rightDisplay.categories) return undefined;
    if (field?.dataset === "hydrology"&&!leftInfluence || field?.dataset === "meteorology" && !standardize) return leftIndividualScale;
    if (samePopulationQuantity(field, otherField) && !standardize) return leftIndividualScale;
    const values = new Map([...leftDisplay.values].map(([key, value]) => [`left:${key}`, value]));
    for (const [key, value] of rightDisplay.values) values.set(`right:${key}`, value);
    return createColorScale(values, palette, leftIndividualScale!.mode);
  }, [compare, linkedAppearance, dataset, otherDataset, leftDisplay, rightDisplay, field, otherField, palette, leftIndividualScale, standardize,leftInfluence]);
  const leftScale = useMemo(() => sharedScale && leftIndividualScale ? { ...sharedScale, count: leftIndividualScale.count } : leftIndividualScale, [sharedScale, leftIndividualScale]);
  const rightScale = useMemo(() => sharedScale && rightIndividualScale ? { ...sharedScale, count: rightIndividualScale.count } : rightIndividualScale, [sharedScale, rightIndividualScale]);
  const currentAppearance = (dialog === "export" ? exportSide === "right" : selectedLocation?.right ?? selectedEvent?.right ?? selected?.right) && compare ? rightStyle : appearance;
  const currentDisplay =
    (dialog === "export" ? exportSide === "right" : selectedLocation?.right ?? selectedEvent?.right ?? selected?.right) && compare ? rightDisplay : leftDisplay;
  const currentStandardized =
    (dialog === "export" ? exportSide === "right" : selectedLocation?.right ?? selectedEvent?.right ?? selected?.right) && compare ? rightStandardized : leftStandardized;
  const current = (dialog === "export" ? exportSide === "right" : selectedLocation?.right ?? selectedEvent?.right ?? selected?.right) && compare ? right.layer : left.layer;
  const visible = useMemo(() => current?.cells ?? [], [current]);
  const originalValue = (layer: SeascapeLayer | undefined, cell: string) => layer?.rawValues?.get(cell) ?? layer?.values.get(cell) ?? null;
  const currentDataset = riverInfluenceDatasetInfo(current) ?? catalog?.datasets?.[current?.field.dataset ?? "seascape"];
  const insightsRight = compare && insightsSide === "right";
  const [timelineSide, setTimelineSide] = useState<"left"|"right">("left");
  const timelineRight = compare && (rightOrca || rightHydro) && (timelineSide === "right" || !(leftOrca || leftHydro));
  const activeOrcaFrame = timelineRight ? rightOrcaFrame : orcaFrame;
  const insightOrcaFrame = insightsRight ? rightOrcaFrame : orcaFrame;
  const insightOrcaState = insightsRight ? rightOrcaState : orcaState;
  const insightHydrologyAppearance = insightsRight ? rightStyle.hydrology : hydrologyAppearance;
  const insightLayer = insightsRight ? right.layer : left.layer;
  const insightNative=insightsRight?rightNative:leftNative;
  const insightNativeRecord=insightNative?.data.records.find(f=>f.properties.record_id===insightNative.selected);
  const prefetchWeather = useCallback(async (frames: readonly string[], signal: AbortSignal) => {
    if (!catalog) return;
    const fields = [field, ...(compare ? [otherField] : [])].filter((item): item is SeascapeFeature => item?.dataset === "meteorology");
    for (const frame of frames) for (const item of fields) {
      if (signal.aborted) return;
      await loadMeteorologyLayer(catalog, item, frame, signal);
    }
  }, [catalog, field, otherField, compare]);
  const weather = catalog?.meteorology;
  const weatherActive = Boolean(!hydroActive && !orcaActive && !viewshedActive && weather && (field?.dataset === "meteorology" || otherField?.dataset === "meteorology"));
  const weatherDay = (field?.dataset === "meteorology" ? slice : otherSlice) ?? weather?.dates.at(-1);
  const changeWeatherDate = useCallback((value: string) => {
    if (dataset === "meteorology") setSlice(value);
    if (compare && otherDataset === "meteorology") setOtherSlice(value);
  }, [dataset, compare, otherDataset]);
  const insightRow = selected && insightLayer ? insightLayer.index.get(selected.cell.id) : undefined;
  const timeline = useComparisonTimeline(catalog, field, otherField, compare && insightsOpen);
  const describeLayer = (rightSide: boolean): InsightDataset => {
    const layer = rightSide ? right.layer : left.layer;
    const displayLayer = rightSide ? rightMapDisplay : leftMapDisplay;
    const feature = rightSide ? otherField : field;
    const info = riverInfluenceDatasetInfo(layer) ?? catalog?.datasets?.[feature?.dataset ?? "seascape"];
    const published = info ? info.publishedAt : catalog?.publishedAt;
    const standardized = rightSide ? rightStandardized : leftStandardized;
    const style = rightSide ? rightStyle : appearance;
    return {
      supportLabel: feature?.geometryGroup ? "Source records" : feature?.dataset==="hydrology"&&!isRiverInfluenceFeature(feature)?"River gauges":undefined,
      name: feature?.dataset === "meteorology" ? layer?.name ?? featureDisplayName(feature) : featureDisplayName(feature), unit: isPercentCoverage(feature) ? "%" : feature?.unit ?? "", formatValue: isPercentCoverage(feature) ? refugePercent : undefined, resolution, circular: feature?.circular,
      slice: layer?.slice,
      scope: feature?.geometryGroup ? "Retained source records · partial inventory · original geometry" : feature?.dataset === "hydrology"&&!isRiverInfluenceFeature(feature) ? "Unique upstream river gauges · native provider date · no mouth allocation" : "Full native area · non-null cells · unweighted",
      visibleValues: insightsOpen && (feature?.dataset !== "hydrology"||isRiverInfluenceFeature(feature)) && layer && (rightSide ? rightBounds : leftBounds) ? new Map((displayLayer?.cells??layer.cells).filter(c => {
        const b = (rightSide ? rightBounds : leftBounds)!;
        return c.lon >= b[0] && c.lon <= b[2] && c.lat >= b[1] && c.lat <= b[3];
      }).map(c => [c.id, originalValue(layer, c.id)])) : undefined,
      values: feature?.dataset === "hydrology"&&!isRiverInfluenceFeature(feature) && hydro && hydroDay ? new Map(hydro.rivers.map(r=>[r.id,r.series[feature.column as HydrologyMetricId].values[hydro.dates.indexOf(hydroDay)]])) : layer?.rawValues ?? layer?.values, categorical: Boolean(layer?.categories ?? feature?.kind === "categorical"),
      colors: palettes[style.palette].colors, error: rightSide ? right.error : left.error,
      categoryColors: layer?.categories ? new Map((feature?.membershipColumn ? layer.categories : feature?.categories ?? layer.categories).map((value, i) => [value, (rightSide ? rightScale : leftScale)?.colors[i] ?? palettes[style.palette].colors[0]])) : undefined,
      note: [layer?.riverInfluence?.recipe.qualification,feature?.dataset === "hydrology"&&!isRiverInfluenceFeature(feature) ? hydrologyCaveat : undefined, feature?.dataset === "marine-mammals" ? orcaCaveat : undefined, feature?.membershipColumn ? "Recorded membership categories; overlapping features are retained in full. Stripe widths do not indicate area shares." : undefined, feature?.dataset === "meteorology" ? `ERA5 reanalysis · UTC calendar periods · ~31 km source. ${feature.circular ? "Direction is circular; scalar mean, median, smoothing and z-scores are omitted." : "Default colors use the full-record range, so playback colors stay comparable."}` : undefined,
        !(["hydrology","marine-mammals","river-influence"].includes(feature?.dataset??"")) && style.smoothing.enabled && !layer?.categories && !feature?.circular ? "Map: Gaussian blended display. Insights: original source cells." : undefined,
        !(["hydrology","marine-mammals","river-influence"].includes(feature?.dataset??"")) && style.standardize && !layer?.categories && !feature?.circular ? standardized?.unavailable ? "Standardization is unavailable. Insights retains original values." : "Map: z-scores. Insights: original source values." : undefined].filter(Boolean).join(" ") || undefined,
      metadata: [
        { label: "Original variable", value: feature?.name ?? "Unavailable" },
        { label: "Family", value: feature?.family ?? "Unavailable" },
        { label: "Product", value: info?.name ?? "Seascape" },
        { label: layer?.riverInfluence ? "Method" : "Release", value: info?.release ?? catalog?.release ?? "Unavailable" },
        ...(feature?.sourceRelease ? [{ label: "Source release", value: feature.sourceRelease }] : []),
        ...(layer?.slice ? [{ label: layer.slice.axis, value: layer.slice.label }] : []),
        ...(published ? [{ label: catalog?.receiptStatus === "current flat data" ? "Snapshot timestamp" : "Published", value: published }] : []),
        { label: "Source", value: feature?.sourcePath ?? "Unavailable" },
        { label: "Coverage", value: info?.limitations ?? catalog?.sourceCompleteness ?? "Source coverage retained" },
      ],
    };
  };
  const selectedQualifiers = (layer?: SeascapeLayer) => Object.entries(layer?.qualifiers ?? {}).map(([label, values]) => {
    const index = selected ? layer?.index.get(selected.cell.id) : undefined;
    return { label, value: sourceValue(index == null ? null : values[index]) };
  });
  const toggleCompare = () => {
    if (!compare && field && !catalog?.features.some(f => f.resolution === resolution && (f.dataset ?? "seascape") === otherDataset && f.id === otherId)) {
      const preferred = selectFeature(catalog, resolution, dataset, otherId);
      setOtherDataset(dataset); setOtherId(preferred?.id ?? field.id); setOtherSlice(slice);
    }
    setLegendSide(undefined);
    setLayers(false);
    setCompare(!compare);
    setComparisonFocus(undefined);
    setComparisonSetup(!compare);
    setSelectedLocation(undefined); setSelected(undefined); setSelectedEvent(undefined);
  };
  const swapLayers = () => {
    setDataset(otherDataset); setOtherDataset(dataset);
    setId(otherField?.id ?? otherId); setOtherId(field?.id ?? id);
    setSlice(otherSlice); setOtherSlice(slice);
    appearanceState.swap();
    setInfluenceLeft(influenceRight);setInfluenceRight(influenceLeft);
    setOrcaState(rightOrcaState); setRightOrcaState(orcaState);
    setSelectedLocation(undefined); setSelected(undefined); setSelectedEvent(undefined); setSelectionNotice("");
  };
  const exportLayer = () => {
    if (!current) return;
    if(current.humanGeometry){
      const view=(exportSide==="right"&&compare?rightNative:leftNative);
      if(!view)return;
      const visible=humanVisibleFeatures(view);
      const payload={type:"FeatureCollection",features:[...visible.records,...visible.footprints],
        source_path:current.field.sourcePath,source_sha256:current.field.sourceSha256,source_release:current.field.sourceRelease,
        filters:view.filter,limitations:current.field.definition,scope:"Filtered original source geometry; no H3 aggregation; record count is not unique physical sites."};
      const url=URL.createObjectURL(new Blob([JSON.stringify(payload)],{type:"application/geo+json"}));
      const link=document.createElement("a");link.href=url;link.download=`human-${current.field.geometryGroup}.geojson`;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);setDialog(undefined);return;
    }
    const payload = {
      release: currentDataset?.release ?? catalog?.release,
      manifest_sha256: currentDataset?.manifestSha256 ?? catalog?.manifestSha256,
      dataset: current.field.dataset ?? "seascape",
      slice: current.slice,
      source_release: current.field.sourceRelease,
      source_path: current.field.sourcePath,
      source_sha256: current.field.sourceSha256,
      source_record_context: current.field.sourceRecordContext,
      column: current.field.column ?? current.id,
      display_smoothing: !["hydrology","marine-mammals","river-influence"].includes(current.field.dataset??"") && currentAppearance.smoothing.enabled && !current.categories && !current.field.circular ? {
        requested: true, method: "normalized Gaussian blend of native-cell values", sigma_cell_widths: currentAppearance.smoothing.radius, contours: currentAppearance.smoothing.contours, visualization_only: true,
      } : undefined,
      display_standardization: !["hydrology","marine-mammals","river-influence"].includes(current.field.dataset??"") && currentAppearance.standardize && !current.categories && !current.field.circular
        ? {
            formula: isPercentCoverage(current.field) ? "(value * 100 - mean) / std" : "(value - mean) / std",
            ...(isPercentCoverage(current.field) ? { input_unit: current.field.unit, mean_unit: "%", std_unit: "%" } : {}),
            scope: "full native layer, non-null cells, unweighted",
            ddof: 0,
            count: currentStandardized?.count,
            mean: currentStandardized?.mean,
            std: currentStandardized?.std,
            unavailable: currentStandardized?.unavailable,
          }
        : undefined,
      unit: current.field.unit,
      display_conversion: isPercentCoverage(current.field) ? { unit: "%", scale: 100, formula: "fraction * 100" } : undefined,
      h3_resolution: resolution,
      scope:
        currentDataset?.limitations ?? "Full native area; published partial source coverage; not an ecological qualification",
      modeling_eligibility: current.field.modelingEligibility,
      river_influence: current.riverInfluence?{settings:current.riverInfluence.settings,recipe:current.riverInfluence.recipe,contributions:Object.fromEntries(current.riverInfluence.contributions)}:undefined,
      hydrology_high_flow_definitions: current.field.dataset==="hydrology"&&current.field.column==="high_flow_duration"?hydro?.rivers.map(r=>({river_id:r.id,definition:r.highFlowDefinition})):undefined,
      hydrology_flow_pulse_definitions: current.field.dataset==="hydrology"&&current.field.column==="days_since_flow_pulse"?hydro?.rivers.map(r=>({river_id:r.id,definition:r.flowPulseDefinition})):undefined,
      hydrology_low_flow_definitions: current.field.dataset==="hydrology"&&current.field.column==="low_flow_duration"?hydro?.rivers.map(r=>({river_id:r.id,definition:r.lowFlowDefinition})):undefined,
      cells: current.cells.map((c) => ({
        h3_index: c.id,
        value: originalValue(current, c.id),
        ...(current.governanceMemberships ? { memberships: current.governanceMemberships.cells[current.index.get(c.id)!], membership_count: current.governanceMemberships.counts[current.index.get(c.id)!], membership_status: current.governanceMemberships.statuses[current.index.get(c.id)!] } : {}),
      })),
      qualifiers: current.qualifiers,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${current.field.dataset ?? "seascape"}-${current.id}-R${resolution}${current.slice ? `-${current.slice.value}` : ""}.json`;
    link.click();
    const revoke = URL.revokeObjectURL.bind(URL);
    window.setTimeout(() => revoke(url), 1000);
    setDialog(undefined);
  };
  const row =
    selected && current ? current.index.get(selected.cell.id) : undefined;
  const changeField = (value: string) => {
    setSelectedLocation(undefined);
    setId(value);
    setSelectionNotice("");
    if(dataset!=="hydrology"||isRiverInfluenceFeature(catalog?.features.find(f=>f.id===value))!==leftInfluence)setSelected(undefined);
    setSelectedEvent(undefined);
  };
  const changeResolution = (res: NativeResolution) => {
    setResolution(res);
    setSelectedLocation(undefined); setSelected(undefined); setSelectedEvent(undefined);
    const pick = (domain: string, chosen: string) => {
      return selectFeature(catalog, res, domain, chosen) ?? catalog?.features.find(feature => feature.resolution === res);
    };
    const chosen = pick(dataset, id);
    const other = pick(otherDataset, otherId);
    setDataset(chosen?.dataset ?? "seascape");
    setId(chosen?.id ?? "BATHYMETRY");
    setOtherDataset(other?.dataset ?? "seascape");
    setOtherId(other?.id ?? "BATHYMETRY");
    if (compare && other?.id !== otherId) setSelectionNotice(`The right variable is unavailable at H3 R${res}. Review the updated comparison.`);
    setSlice(undefined);
    setOtherSlice(undefined);
  };
  useEffect(() => {
    if (!catalog) return;
    const leftPort = dataset === "governance" ? savedPortFeature(catalog.features, id) : undefined;
    const rightPort = otherDataset === "governance" ? savedPortFeature(catalog.features, otherId) : undefined;
    if (!leftPort && !rightPort) return;
    // Port point locations use the Human product's native R7 context. No R6/R8
    // cell reassignment or count conversion occurs when restoring a legacy choice.
    let active = true;
    queueMicrotask(() => {
    if (!active) return;
    setResolution(7);
    const left = leftPort ?? selectFeature(catalog, 7, dataset, id) ?? catalog.features.find(f => f.resolution === 7);
    const right = rightPort ?? selectFeature(catalog, 7, otherDataset, otherId) ?? catalog.features.find(f => f.resolution === 7);
    if (left) { setDataset(left.dataset ?? "seascape"); setId(left.id); }
    if (right) { setOtherDataset(right.dataset ?? "seascape"); setOtherId(right.id); }
    setSelected(undefined); setSelectedLocation(undefined); setSelectedEvent(undefined);
    setSlice(undefined); setOtherSlice(undefined);
    setSelectionNotice("Ports moved to Human → Port Locations. Original source points are retained; comparison choices use the available R7 context.");
    });
    return () => { active = false; };
  }, [catalog, dataset, id, otherDataset, otherId]);
  const openDomain = (domain: string) => {
    setSelectedLocation(undefined);
    if (domain === "viewshed") { window.history.replaceState(null, "", "#map?layer=viewshed"); setViewshedActive(true); setLayers(false); setCompare(false); setComparisonSetup(false); setInsightsOpen(false); setLegendSide(undefined); setDialog(undefined); return; }
    if (domain === dataset && layers) { setLayers(false); return; }
    const nextResolution = catalog?.features.some(f => (f.dataset ?? "seascape") === domain && f.resolution === resolution)
      ? resolution : catalog?.features.find(f => (f.dataset ?? "seascape") === domain)?.resolution;
    if (!nextResolution) return;
    const next = selectFeature(catalog, nextResolution, domain, domain === dataset ? id : "BATHYMETRY");
    if (!next) return;
    if (nextResolution !== resolution) changeResolution(nextResolution);
    setDataset(domain);
    setId(next.id);
    if (domain !== dataset) setSlice(undefined);
    setLayers(true);
    if (window.matchMedia?.('(min-width: 1100px)').matches === false) setInsightsOpen(false);

    setLegendSide(undefined);
    setSelectedLocation(undefined); setSelected(undefined); setSelectedEvent(undefined);
    setDialog(undefined);
  };
  const productSelect = (rightSide: boolean) => catalog?.datasets && (
    <SourcePicker label={rightSide ? "Right data product" : compare ? "Left data product" : "Data product"} value={rightSide ? otherDataset : dataset}
      items={Object.entries(catalog.datasets).map(([key, info]) => {
        const available = catalog.features.some(f => (f.dataset ?? "seascape") === key && f.resolution === resolution);
        return { id:key, name:info.name, group:"Data products", summary:info.limitations || `Prepared ${info.name.toLowerCase()} data.`,
          details:[{label:"Source status",value:info.status}, ...(!available ? [{ label:"Availability", value:`No prepared layers at H3 R${resolution}. Choose this product from the product dock to use its native grid.` }] : [])], unavailable:!available, disabled:!available };
      })} onChange={domain => {
        if (domain === (rightSide ? otherDataset : dataset)) return;
        setSelectionNotice("");
        const first = selectFeature(catalog, resolution, domain);
        if (!first) return;
        if (rightSide) { setOtherDataset(domain); setOtherId(first.id); setOtherSlice(undefined); }
        else { setDataset(domain); setId(first.id); setSlice(undefined); }
        setSelectedLocation(undefined); setSelected(undefined); setSelectedEvent(undefined);
      }} />
  );
  const sliceSelect = (feature: SeascapeFeature | undefined, value: string | undefined, change: (v: string) => void, rightSide = false) => {
    const product = feature?.productId ? catalog?.products?.[feature.productId] : undefined;
    return product && "slices" in product ? <label className="field">{rightSide ? `Right ${product.axis.toLowerCase()}` : product.axis}
      <select value={value ?? product.defaultSlice} onChange={(e) => { change(e.target.value); setSelected(undefined); }}>
        {Object.entries(product.slices).map(([key, slice]) => <option key={key} value={key}>{slice.label ?? key}</option>)}
      </select>
    </label> : null;
  };
  const inspectHydrology=(riverId:string,rightSide=false,focus=true)=>{
    const river=hydro?.rivers.find(r=>r.id===riverId),layer=rightSide?right.layer:left.layer;
    const mouth=river?.mouths[0],cell=mouth&&layer?.cells.find(c=>c.id===mouth.cell);
    if(!mouth||!cell)return;
    setSelectedLocation(undefined);setHydrologyRiver(riverId);setSelected({cell,right:rightSide});setSelectedEvent(undefined);setInsightsSide(rightSide?"right":"left");setLayers(false);setLegendSide(undefined);
    if(focus) { setComparisonSetup(false); setInsightsOpen(true); }
    if(focus)cameraLink.publish({setCamera:()=>{},finishMove:()=>{}},{...cameraLink.getCamera(),center:[mouth.longitude,mouth.latitude],zoom:Math.max(8.8,cameraLink.getCamera().zoom)},false);
  };
  const step = (direction: number) => {
    const i = visible.findIndex((c) => c.id === selected?.cell.id);
    if (visible.length)
      setSelected({
        cell: visible[(i + direction + visible.length) % visible.length],
        right: selected?.right ?? false,
      });
  };
  const cellPopup = (layer: SeascapeLayer | undefined, rightSide: boolean) =>
    !viewshedActive && selected && selected.right === rightSide && layer?.field.kind === "categorical" && layer.index.has(selected.cell.id)
      ? <CategoricalCellPopup layer={layer} cell={selected.cell} onClose={() => setSelected(undefined)} /> : undefined;
  const leftMap = (
    <div className="map-layer-frame">
      <MapCanvas
        nativeData
        onBoundsChange={setLeftBounds}
        basemap="maptiler"
        cameraLink={cameraLink}
        overlayHost={overlayHost}
        feature="temperature"
        month={0}
        humanGeometry={leftNative}
        layer={viewshedActive || leftPoints || leftNative ? undefined : leftMapDisplay}
        orcaPoints={!viewshedActive && leftPoints ? pointOverlays[0] : undefined}
        hydrologyPoints={!viewshedActive && leftHydro && hydro && hydroDay ? {data:hydro,metric:field!.column as HydrologyMetricId,day:hydroDay,appearance:hydrologyAppearance,selected:hydrologyRiver,onSelect:id=>inspectHydrology(id,false,false)} : undefined}
        viewshed={viewshedActive ? viewshedOverlay : undefined}
        colorScale={leftScale}
        region="all"
        showGrid={!leftPoints && !leftHydro && !leftNative}
        outlines={leftHydro?false:outlines}
        smoothing={viewshedActive || leftNative || leftOrca || leftHydro || leftInfluence || field?.circular ? { ...smoothing, enabled: false } : smoothing}
        opacity={opacity}
        selected={selected?.right === false ? selected.cell.id : undefined}
        popup={cellPopup(left.layer, false)}
        onSelect={(cell) => {
          setLegendSide(undefined);
          setSelectedLocation(undefined);
          setSelected({ cell, right: false });
          setSelectedEvent(undefined);
          setLayers(false);
          setInsightsSide("left");
        }}
      />
      {!viewshedActive && !left.layer && !left.error && !error && <div className="map-layer-status" role="status">
        {catalog ? "Loading native source values…" : "Loading layer…"}
      </div>}
      {!viewshedActive && !catalog && error && <WarningNotice title="Feature data unavailable" message={error} onRetry={() => setAttempt(value => value + 1)} retryLabel="Retry local data" />}
      {!viewshedActive && left.error && <WarningNotice title={compare ? "Left layer unavailable" : "Layer unavailable"} message={left.error} onRetry={left.retry} retryLabel="Retry layer" />}
    </div>
  );
  const rightMap = (
    <div className="map-layer-frame">
      <MapCanvas
        nativeData
        onBoundsChange={setRightBounds}
        basemap="maptiler"
        cameraLink={cameraLink}
        overlayHost={overlayHost}
        showControls={false}
        feature="temperature"
        month={0}
        humanGeometry={rightNative}
        layer={rightPoints || rightNative ? undefined : rightMapDisplay}
        orcaPoints={rightPoints ? pointOverlays[1] : undefined}
        hydrologyPoints={rightHydro && hydro && hydroDay ? {data:hydro,metric:otherField!.column as HydrologyMetricId,day:hydroDay,appearance:rightStyle.hydrology,selected:hydrologyRiver,onSelect:id=>inspectHydrology(id,true,false)} : undefined}
        colorScale={rightScale}
        region="all"
        showGrid={!rightPoints && !rightHydro && !rightNative}
        outlines={rightHydro?false:rightStyle.outlines}
        smoothing={rightNative || rightOrca || rightHydro || rightInfluence || otherField?.circular ? { ...rightStyle.smoothing, enabled: false } : rightStyle.smoothing}
        opacity={rightStyle.opacity}
        selected={selected?.right === true ? selected.cell.id : undefined}
        popup={cellPopup(right.layer, true)}
        onSelect={(cell) => {
          setLegendSide(undefined);
          setSelectedLocation(undefined);
          setSelected({ cell, right: true });
          setSelectedEvent(undefined);
          setLayers(false);
          setInsightsSide("right");
        }}
      />
      {!right.layer && !right.error && <div className="map-layer-status" role="status">Loading comparison…</div>}
      {right.error && <WarningNotice title="Comparison layer unavailable" message={right.error} onRetry={right.retry} retryLabel="Retry comparison" />}
    </div>
  );
  const mapHeader = (
      <div className="data-map-topbar">
        <div className="active-layer-breadcrumb" aria-label="Active layer"><span>{catalog?.datasets?.[dataset]?.name ?? "Seascape"}</span><span aria-hidden="true">/</span><strong>{field ? featureDisplayName(field) : catalog ? "No prepared layer" : "Bathymetry"}</strong>{standardize && !leftHydro && !leftOrca && field?.kind !== "categorical" && <em>z-scores</em>}</div>
        <nav className="data-map-actions" aria-label="Map actions">
          <button aria-label="Compare" title="Compare layers" disabled={!field} aria-pressed={compare} onClick={toggleCompare}><GitCompareArrows size={17} /><span>Compare</span></button>
          <button aria-label="Export" title="Export layer" disabled={!current} onClick={() => { setLegendSide(undefined); setLayers(false); setDialog("export"); }}><Download size={17} /><span>Export</span></button>
          <button aria-label="Map help" title="Map help" disabled={!catalog} onClick={() => { setLayers(false); setLegendSide(undefined); setDialog("help"); }}><CircleHelp size={18} /></button>
        </nav>
      </div>
  );
  return (
    <MapWarningsProvider><main
      id="features-explorer"
      aria-label="Features explorer"
      className={`map-page ${viewshedActive ? "viewshed-open" : ""} reference-map seascape-map atlas-map colorbar-map drawer-map ${weatherActive || orcaActive || hydroActive || influenceActive ? "has-weather-timeline" : ""} ${hydroActive ? "has-hydrology-timeline" : ""} ${orcaActive ? "has-orca-timeline" : ""} ${legendSide ? "appearance-open" : ""} ${layers ? "layers-open" : ""} ${compare ? "comparing swipe-comparing" : ""} ${insightsOpen ? "insights-open" : ""}`}
    >
      <MapWarningsRegion />
      {catalog && <SourceWarning issues={sourceIssues} onRetry={() => setAttempt(value => value + 1)} />}
      <h1 className="sr-only">Features</h1>
      {!viewshedActive && <>{headerHost ? createPortal(mapHeader, headerHost) : mapHeader}
      <DatasetInsights selectionName={insightNative||selectedEvent?"record":"cell"} focusSelection persistentTrigger selectionToken={selectedLocation ?? selectedEvent ?? selected} onSourceDetails={insightNative||["marine-mammals","hydrology"].includes(insightLayer?.field.dataset??"")?undefined:()=>setDialog("source")} open={insightsOpen} onOpenChange={open => {
        setInsightsOpen(open);
        if (open) {
          setLegendSide(undefined); setDialog(undefined);
          if (window.matchMedia?.('(min-width: 1100px)').matches === false) setLayers(false);
        }
      }} dataset={describeLayer(insightsRight)} overviewContent={insightLayer?.riverInfluence?<RiverInfluenceInsights layer={insightLayer}/>:insightLayer?.categoryMemberships?<GovernanceOverview layer={(insightsRight?rightMapDisplay:leftMapDisplay)!} colors={(insightsRight?rightScale:leftScale)?.colors??[]}/>:insightOrcaFrame&&insightLayer?.field.dataset==="marine-mammals"?<OrcaOverview frame={insightOrcaFrame}/>:insightNative?<HumanGeometryOverview data={insightNative.data} filter={insightNative.filter}/>:hydro&&hydroDay&&insightLayer?.field.dataset==="hydrology"?<HydrologyOverview data={hydro} metric={insightLayer.field.column as HydrologyMetricId} day={hydroDay} onInspect={id=>inspectHydrology(id,insightsRight)}/>:undefined} selectedContent={insightLayer?.riverInfluence?<RiverInfluenceInsights layer={insightLayer} cell={selected?.right===insightsRight?selected.cell.id:undefined}/>:insightNative?<HumanGeometryInspector feature={insightNativeRecord} footprints={insightNative.data.footprints}/>:populationSupport(insightLayer?.field) && insightLayer ? <HumanPopulationInsights layer={insightLayer} cell={selected?.right===insightsRight?selected.cell.id:undefined} /> : hydro && hydroDay && insightLayer?.field.dataset==="hydrology" ? <HydrologyInsights appearance={insightHydrologyAppearance} riverId={hydrologyRiver} data={hydro} metric={insightLayer.field.column as HydrologyMetricId} day={hydroDay} cell={selected?.right===insightsRight?selected.cell.id:undefined} onDate={setHydrologyDay} onMetric={value=>{if(insightsRight)setOtherId(`HYDROLOGY__${value}`);else setId(`HYDROLOGY__${value}`);}} onRiver={river=>inspectHydrology(river,insightsRight)}/> : insightOrcaFrame && insightLayer?.field.dataset === "marine-mammals" ? <OrcaInspector data={orca!} records={insightOrcaFrame.records} eventId={selectedEvent?.right===insightsRight?selectedEvent.id:undefined} cell={selected?.right===insightsRight?selected.cell.id:undefined} /> : selected && insightLayer?.field.membershipColumn && selected.right === insightsRight && insightRow !== undefined ? <><dl className="insights-cell-details"><div><dt>H3 index</dt><dd><code>{selected.cell.id}</code></dd></div><div><dt>Latitude / longitude</dt><dd>{selected.cell.lat.toFixed(6)}, {selected.cell.lon.toFixed(6)}</dd></div></dl><GovernanceMembershipInspector
        sourceContext={insightLayer.field.sourceContext} sourceRecordContext={insightLayer.field.sourceRecordContext}
        memberships={insightLayer.governanceMemberships?.cells[insightRow]}
        countLabel={insightLayer.field.assignmentSemantics === "conservation_status" ? "Assignment entries" : undefined}
        count={insightLayer.governanceMemberships?.counts[insightRow]} status={insightLayer.governanceMemberships?.statuses[insightRow]} /></> : undefined} temporalContent={insightsOpen && insightLayer?.field.dataset === "marine-mammals" && orca ? <><OrcaDemography data={orca} state={insightOrcaState} /><OrcaSourceCoverage data={orca} /></> : insightsOpen && weather && insightLayer?.field.dataset === "meteorology" && <WeatherInsights
        catalog={weather} metric={insightLayer.field.column!} day={insightLayer.slice!.value}
        cell={selected && selected.right === insightsRight ? selected.cell.id : undefined} />} cell={insightNativeRecord?{id:insightNativeRecord.properties.record_id,value:insightNativeRecord.properties.category,coordinates:[insightNativeRecord.properties.label_point[1],insightNativeRecord.properties.label_point[0]],details:[],qualifiers:[]}:selectedEvent && selectedEvent.right===insightsRight && insightOrcaFrame?.points.find(r=>r.event_id===selectedEvent.id) ? (()=>{const r=insightOrcaFrame.points.find(r=>r.event_id===selectedEvent.id)!;return{id:r.event_id,value:1,coordinates:[r.latitude!,r.longitude!] as [number,number],details:[],qualifiers:[]};})() : selected && insightLayer && selected.right === insightsRight ? {
        id: selected.cell.id, value: originalValue(insightLayer, selected.cell.id), coordinates: [selected.cell.lat, selected.cell.lon],
        details: [
          ...((insightsRight ? rightStyle.standardize : standardize) && !insightLayer.categories && !insightLayer.field.circular ? [{ label: "Map z-score", value: metric((insightsRight ? rightDisplay : leftDisplay)?.values.get(selected.cell.id), "z", 4) }] : []),
        ],
        qualifiers: Object.entries(insightLayer.qualifiers).map(([label, values]) => ({ label, value: sourceValue(insightRow == null ? null : values[insightRow]) })),
      } : undefined} comparison={compare ? {
        referenceOnly:Boolean(leftNative||rightNative||leftHydro||rightHydro), referenceNote:leftNative||rightNative?"Native Human points, source lines and areas retain original record identities. Spatial cell correlations and pooled H3 summaries are omitted; these records are not a common sampled cell surface.":undefined, left: describeLayer(false), right: describeLayer(true), temporal: timeline, sameLayer: sameComparison,
        cell: selected ? { id: selected.cell.id, coordinates: [selected.cell.lat, selected.cell.lon],
          leftQualifiers: selectedQualifiers(left.layer), rightQualifiers: selectedQualifiers(right.layer) } : undefined,
      } : undefined} />
      </>}
      <div className="maps">
        {compare ? <MapSwipeCompare left={leftMap} right={rightMap} onDragStart={() => {
          setLegendSide(undefined);
          setLayers(false);
          setSelected(undefined);setSelectedLocation(undefined);
        }} /> : leftMap}
      </div>
      <div className="map-overlay-host" ref={setOverlayHost} />
      {viewshedActive && <ViewshedLayer integration={{ headerHost, onMapChange: setViewshedOverlay,
        display: {value:appearance,onChange:value=>{
          if(value.palette!==undefined)setPalette(value.palette);
          if(value.opacity!==undefined)setOpacity(value.opacity);
          if(value.outlines!==undefined)setOutlines(value.outlines);
          if(value.smoothing!==undefined)setSmoothing(value.smoothing);
        }},
        available: [...new Set(catalog?.features.map(feature => feature.dataset ?? "seascape") ?? ["seascape"])],
        names: Object.fromEntries(Object.entries(catalog?.datasets ?? {}).map(([key, info]) => [key, info.name])),
        onSelect: domain => { window.history.replaceState(null, "", "#map"); setViewshedActive(false); setViewshedOverlay(undefined); openDomain(domain); },
      }} />}
      {!viewshedActive && <>
      {!domainsOpen && <button className="panel collapsed-product-dock" ref={domainsButton} aria-label="Map layers" aria-expanded={false} onClick={() => setDomainsOpen(true)} title="Show data products"><Layers3 size={21} /></button>}
      {domainsOpen && <div className="domain-layer-controls" ref={layersRoot}>
        <DataDomainDock active={dataset} open={layers} activeButton={layersButton}
          available={[...new Set([...(catalog?.features.map(f => f.dataset ?? "seascape") ?? []), "viewshed"])]}
          availabilityStatus={!catalog ? error ? "error" : "loading" : undefined}
          names={Object.fromEntries(Object.entries(catalog?.datasets ?? {}).map(([key, info]) => [key, info.name]))}
          onSelect={openDomain} onCollapse={() => { setLayers(false); setDomainsOpen(false); }}>
            {layers && catalog && (
              <section className={`panel layer-panel domain-layer-panel ${leftInfluence?"river-influence-panel":""}`} id="domain-layer-panel" aria-label="Map layers">
                <div className="panel-title">
                  <h2>{compare ? "Left · " : ""}{catalog.datasets?.[dataset]?.name ?? "Seascape"}</h2>
                  <button
                    aria-label="Close map layers"
                    onClick={() => { setLayers(false); layersButton.current?.focus(); }}
                  >
                    <X size={19} />
                  </button>
                </div>
                <div className="layer-body">
                  <FamilyFeaturePicker
                    showFeature={!leftOrca}
                    label="Feature"
                    catalog={catalog}
                    resolution={resolution}
                    dataset={dataset}
                    value={field?.id ?? ""}
                    onChange={changeField}
                  />
                  {leftInfluence&&influence&&influenceLeft&&<RiverInfluenceSettings data={influence} value={influenceLeft} onChange={setInfluenceLeft}/>}
                  {leftOrca && orca && <OrcaControls data={orca} state={orcaState} onChange={changeOrca} />}
                  {sliceSelect(field, slice, setSlice)}
                  {new Set(catalog.features.filter(f => (f.dataset ?? "seascape") === dataset).map(f => f.resolution)).size > 1 ? (
                  <label className="field">
                    Native H3 resolution
                    <select
                      aria-label="Native H3 resolution"
                      value={resolution}
                      onChange={(e) =>
                        changeResolution(Number(e.target.value) as NativeResolution)
                      }
                    >
                      <option value="6" disabled={!catalog.features.some(f => (f.dataset ?? "seascape") === dataset && f.resolution === 6)}>
                        R6 ·{" "}
                        {catalog.resolutions?.["6"]?.rows.toLocaleString() ??
                          "native"}{" "}
                        cells
                      </option>
                      <option value="8" disabled={!catalog.features.some(f => (f.dataset ?? "seascape") === dataset && f.resolution === 8)}>
                        R8 ·{" "}
                        {catalog.resolutions?.["8"]?.rows.toLocaleString() ??
                          "native"}{" "}
                        cells
                      </option>
                    </select>
                  </label>
                  ) : leftNative ? null : leftHydro && hydro ? <p className="native-resolution">{hydro.rivers.length} rivers · {hydro.rivers.reduce((n,r)=>n+r.mouths.length,0)} approximate mouth references</p> : <p className="native-resolution">Native grid <strong>H3 R{resolution}</strong></p>}

                </div>
              </section>
            )}
        </DataDomainDock>
      </div>}
      </>}
      {!viewshedActive && catalog && <>
      <div className="map-bottom-controls">
      {compare && (leftOrca && rightOrca || leftHydro && rightHydro || leftInfluence && rightInfluence) && <label className="timeline-side-control panel">Timeline map<select aria-label="Timeline map" value={timelineSide} onChange={e=>setTimelineSide(e.target.value as "left"|"right")}><option value="left">Left map</option><option value="right">Right map</option></select></label>}
      {hydroActive && hydro && hydroDay && <HydrologyHistory appearance={timelineRight?rightStyle.hydrology:hydrologyAppearance} data={hydro} metric={(timelineRight?otherField:field)!.column as HydrologyMetricId} day={hydroDay} onDate={setHydrologyDay}/>}
      {!hydroActive && orcaActive && activeOrcaFrame && <OrcaTimeline state={timelineRight?rightOrcaState:orcaState} periods={timelineRight?rightPeriods:periods} frame={activeOrcaFrame} onChange={value=>changeOrca(value,timelineRight)} />}
      {influenceActive&&!weatherActive&&!hydroActive&&!orcaActive&&influence&&<TimelineControls startDate={influence.recipe.dates[0]} endDate={influence.recipe.dates.at(-1)!} increment={{unit:"day"}} values={influence.recipe.dates} value={(rightInfluence&&(!leftInfluence||timelineSide==="right")?influenceRight:influenceLeft)!.date} onChange={date=>rightInfluence&&(!leftInfluence||timelineSide==="right")?setInfluenceRight({...influenceRight!,date}):setInfluenceLeft({...influenceLeft!,date})} format={value=>value} basisLabel="provider date" label="River influence timeline" rangeLabel="River influence provider date" stepLabel="river influence day" playbackLabel="river influence playback" caption="Provider dates · exploratory lag scenarios"/>}
      {weatherActive && weather && weatherDay && <WeatherTimeSlider onPrefetch={prefetchWeather} dates={weather.dates} value={weatherDay} onChange={changeWeatherDate}
        busy={Boolean((field?.dataset === "meteorology" && left.loading) || (otherField?.dataset === "meteorology" && right.loading))}
        error={left.error ?? right.error} />}
      <div className={`map-legends ${compare ? "two-legends" : ""}`}>
        <div className="map-legend-tools">
          {leftNative ? <HumanGeometryLegend appearanceScope={compare?{linked:linkedAppearance,onChange:changeAppearanceLink}:undefined} open={legendSide==="left"} onOpenChange={setLeftLegendOpen} view={leftNative} onFilterChange={filter=>changeLocationFilter(false,filter)} name={field!.name} side={compare?"Left":undefined} onOpacity={setOpacity}/> : leftHydro && hydro && hydroDay ? <HydrologyLegend appearanceScope={compare?{linked:linkedAppearance,onChange:changeAppearanceLink}:undefined} appearance={hydrologyAppearance} onAppearanceChange={setHydrologyAppearance} open={legendSide==="left"} onOpenChange={setLeftLegendOpen} data={hydro} metric={field!.column as HydrologyMetricId} day={hydroDay} side={compare?"Left":undefined} onInspect={id=>inspectHydrology(id)}/> : leftPoints && orcaFrame ? <OrcaPointLegend side={compare?"Left":undefined} open={legendSide==="left"} onOpenChange={setLeftLegendOpen} state={orcaState} onChange={changeOrca} /> : left.layer && leftScale && (
            <MapLegend
              layer={{ ...leftDisplay!, name: field?.dataset === "meteorology" ? leftDisplay!.name : featureDisplayName(field) }}
              hiddenCategories={leftHidden} onHiddenCategoriesChange={keys=>changeHiddenCategories(false,keys)}
              scale={leftScale}
              categoricalCounts={field?.dataset==="governance" && ([tribalAreaColumn,tribalAssignmentColumn,internationalBoundaryColumn,vesselRoutingRecorded].includes(field.column??"") || !!waterAssignmentFamily(field.column))}
              missingLabel={field?.column===vesselRoutingRecorded?"Unknown routing / regulation coverage":field?.column===internationalBoundaryColumn?"Unknown boundary support":waterAssignmentFamily(field?.column)?"Unknown water assignment support":field?.column===tribalAssignmentColumn?"Unknown membership support":field?.column===tribalAreaColumn?"Unknown overlap support":populationSupport(field)?.coverageIndicator?`Missing status · ${left.layer.field.rows-left.layer.field.available} cells`:leftOrca?"No assigned reports · effort unknown":undefined}
              side={compare ? "Left" : undefined}
              appearanceScope={compare ? { linked: linkedAppearance, onChange: changeAppearanceLink } : undefined}
              opacity={opacity}
              depthBands={isDepth(field) && !standardize}
              outlines={leftHydro?undefined:outlines} onOutlines={leftHydro?undefined:setOutlines}
              smoothing={leftOrca||leftHydro||leftInfluence?undefined:smoothing} onSmoothing={setSmoothing}
              context={`${leftHydro&&hydroDay?`${hydroDay} · provider date · upstream gauge proxy · `:""}${leftOrca&&orcaFrame?`${orcaFrame.period.label} · ${orcaFrame.records.length.toLocaleString()} reported records · blank cells: no assigned reports; effort unknown · `:""}${isDepth(field) ? "Mean depth · " : ""}${leftDisplay!.unit} · H3 R${resolution}${isDepth(field) && !standardize ? " · positive down" : ""}${field?.dataset === "meteorology" ? ` · ${left.layer.slice!.label} UTC` : ""}${populationLegendContext(field, standardize)}`}
              onPalette={setPalette}
              onScaleMode={setScaleMode}
              onOpacity={setOpacity}
              standardization={leftOrca||leftHydro?undefined:{ enabled: standardize, onChange: setStandardize, unavailable: leftStandardized?.unavailable }}
              open={legendSide === "left"}
              onOpenChange={setLeftLegendOpen}
            />
          )}
        </div>
        {compare && rightNative ? <div className="comparison-legend"><HumanGeometryLegend appearanceScope={compare?{linked:linkedAppearance,onChange:changeAppearanceLink}:undefined} open={legendSide==="right"} onOpenChange={setRightLegendOpen} view={rightNative} onFilterChange={filter=>changeLocationFilter(true,filter)} name={otherField!.name} side="Right" onOpacity={value=>changeRightAppearance("opacity",value)}/></div> : compare && rightHydro && hydro && hydroDay ? <div className="comparison-legend"><HydrologyLegend appearanceScope={compare?{linked:linkedAppearance,onChange:changeAppearanceLink}:undefined} appearance={rightStyle.hydrology} onAppearanceChange={value=>changeRightAppearance("hydrology",value)} open={legendSide==="right"} onOpenChange={setRightLegendOpen} data={hydro} metric={otherField!.column as HydrologyMetricId} day={hydroDay} side="Right" onInspect={id=>inspectHydrology(id,true)}/></div> : compare && rightPoints && rightOrcaFrame ? <div className="comparison-legend"><OrcaPointLegend side="Right" open={legendSide==="right"} onOpenChange={setRightLegendOpen} state={rightOrcaState} onChange={value=>changeOrca(value,true)} /></div> : compare && right.layer && rightScale && (
          <div className="comparison-legend">
            <MapLegend
              layer={{ ...rightDisplay!, name: otherField?.dataset === "meteorology" ? rightDisplay!.name : featureDisplayName(otherField) }}
              hiddenCategories={rightHidden} onHiddenCategoriesChange={keys=>changeHiddenCategories(true,keys)}
              scale={rightScale}
              categoricalCounts={otherField?.dataset==="governance" && ([tribalAreaColumn,tribalAssignmentColumn,internationalBoundaryColumn,vesselRoutingRecorded].includes(otherField.column??"") || !!waterAssignmentFamily(otherField.column))}
              missingLabel={otherField?.column===vesselRoutingRecorded?"Unknown routing / regulation coverage":otherField?.column===internationalBoundaryColumn?"Unknown boundary support":waterAssignmentFamily(otherField?.column)?"Unknown water assignment support":otherField?.column===tribalAssignmentColumn?"Unknown membership support":otherField?.column===tribalAreaColumn?"Unknown overlap support":populationSupport(otherField)?.coverageIndicator?`Missing status · ${right.layer.field.rows-right.layer.field.available} cells`:rightOrca?"No assigned reports · effort unknown":undefined}
              side="Right"
              appearanceScope={{ linked: linkedAppearance, onChange: changeAppearanceLink }}
              opacity={rightStyle.opacity}
              depthBands={isDepth(otherField) && !rightStyle.standardize}
              outlines={rightHydro?undefined:rightStyle.outlines} onOutlines={rightHydro?undefined:value => changeRightAppearance("outlines", value)}
              smoothing={rightOrca||rightHydro||rightInfluence?undefined:rightStyle.smoothing} onSmoothing={value => changeRightAppearance("smoothing", value)}
              onPalette={value => changeRightAppearance("palette", value)}
              onScaleMode={value => changeRightAppearance("scaleMode", value)}
              onOpacity={value => changeRightAppearance("opacity", value)}
              standardization={rightOrca||rightHydro?undefined:{ enabled: rightStyle.standardize, onChange: value => changeRightAppearance("standardize", value), unavailable: rightStandardized?.unavailable }}
              context={`${rightHydro&&hydroDay?`${hydroDay} · provider date · upstream gauge proxy · `:""}${rightOrca&&rightOrcaFrame?`${rightOrcaFrame.period.label} · ${rightOrcaFrame.records.length.toLocaleString()} reported records · `:""}${rightDisplay!.unit} · H3 R${resolution}${otherField?.dataset === "meteorology" ? ` · ${right.layer.slice!.label} UTC` : ""}${populationLegendContext(otherField, rightStyle.standardize)}`}
              open={legendSide === "right"}
              onOpenChange={setRightLegendOpen}
            />
          </div>
        )}
      </div>
      </div>
      {compare && <div className="comparison-toolbar panel" aria-label="Comparison controls">
        {([false, true] as const).map(rightSide => <button key={String(rightSide)} className="comparison-layer-chip" aria-label={`Edit ${rightSide ? "right" : "left"} comparison layer`} onClick={() => { setComparisonFocus(rightSide ? "right" : "left"); setComparisonSetup(true); setLayers(false); setLegendSide(undefined); }}>
          <span>{rightSide ? "Right" : "Left"} · {catalog.datasets?.[rightSide ? otherDataset : dataset]?.name ?? "Seascape"}</span>
          <strong title={(rightSide ? otherField : field)?.name}>{featureDisplayName(rightSide ? otherField : field)}</strong><Pencil size={14} />
        </button>)}
        <button className="comparison-swap" aria-label="Swap comparison layers" title="Swap layers" onClick={swapLayers}><ArrowLeftRight size={17} /></button>
        <button className="comparison-exit" aria-label="Exit comparison" title="Exit comparison" onClick={toggleCompare}><X size={18} /></button>
        {(selectionNotice || sameComparison) && <WarningNotice title="Comparison warning" role="status" message={selectionNotice || "Both maps show the same variable and slice. Choose another variable to compare."} />}
      </div>}
      {compare && comparisonSetup && <AtlasDialog title="Compare layers" onClose={() => setComparisonSetup(false)}>
        <div className="comparison-setup-scroll" ref={comparisonSetupRoot}>
        <div className="comparison-setup">
          {([false, true] as const).map(rightSide => <section key={String(rightSide)} aria-label={`${rightSide ? "Right" : "Left"} layer settings`}>
            <h3>{rightSide ? "Right" : "Left"} map</h3>
            {productSelect(rightSide)}
            <FamilyFeaturePicker showFeature={!(rightSide ? rightOrca : leftOrca)} label={`${rightSide ? "Right" : "Left"} map feature`} familyLabel={`${rightSide ? "Right" : "Left"} map family`} catalog={catalog} resolution={resolution}
              dataset={rightSide ? otherDataset : dataset} value={(rightSide ? otherField : field)?.id ?? ""}
              onChange={value => { if (rightSide) setOtherId(value); else setId(value); setSelectedLocation(undefined); setSelected(undefined); setSelectionNotice(""); }} />
            {(rightSide?rightInfluence:leftInfluence)&&influence&&<RiverInfluenceSettings data={influence} value={(rightSide?influenceRight:influenceLeft)!} onChange={rightSide?setInfluenceRight:setInfluenceLeft}/>}
            {(rightSide ? rightOrca : leftOrca) && orca && <OrcaControls data={orca} state={rightSide?rightOrcaState:orcaState} onChange={value=>changeOrca(value,rightSide)} />}
            {sliceSelect(rightSide ? otherField : field, rightSide ? otherSlice : slice, rightSide ? setOtherSlice : setSlice, rightSide)}
          </section>)}
        </div>
        {(selectionNotice || sameComparison) && <WarningNotice inline title="Comparison warning" role="status" message={selectionNotice || "Both maps show the same variable and slice. Choose another variable to compare."} />}
        <p className="comparison-grid-note">{leftNative||rightNative?"Native source geometry is compared visually. Record locations are not paired or aggregated as H3 cells.":`Native H3 R${resolution} · Products must share this grid to compare cells. Change the native grid in the product settings.`}</p>
        <label className="comparison-appearance-link"><input type="checkbox" checked={linkedAppearance} onChange={event => changeAppearanceLink(event.target.checked)} />Link appearance between maps</label>
        <p className="comparison-grid-note">{linkedAppearance ? "Changes in either legend apply to both maps." : "Each legend changes only its own map."}</p>
        </div>
        <div className="comparison-setup-actions"><button className="button" onClick={swapLayers}><ArrowLeftRight size={16} />Swap layers</button><button className="button" onClick={() => setComparisonSetup(false)}>Show maps</button></div>
      </AtlasDialog>}
      {dialog && (
        <AtlasDialog
          title={
            dialog === "export"
              ? "Export local layer"
              : dialog === "source"
                ? "Source & quality"
                : "Explore the data atlas"
          }
          onClose={() => setDialog(undefined)}
        >
          {dialog === "source" ? (
            <div className="atlas-source-inspector">
              <div className="atlas-cell-detail">
                {selected && current ? (
                  <>
                    <h3>Selected native H3 R{resolution} cell</h3>
                    <dl>
                      <div>
                        <dt>ID</dt>
                        <dd>
                          <code>{selected.cell.id}</code>
                        </dd>
                      </div>
                      <div>
                        <dt>Exact stored value</dt>
                        <dd>
                          {sourceValue(originalValue(current, selected.cell.id))}{" "}
                          {current.field.unit}
                        </dd>
                      </div>
                      {currentAppearance.standardize && !current?.categories && (
                        <div>
                          <dt>Standardized value</dt>
                          <dd>
                            {sourceValue(
                              currentDisplay?.values.get(selected.cell.id),
                            )}{" "}
                            z
                          </dd>
                        </div>
                      )}
                      <div>
                        <dt>Cell center</dt>
                        <dd>
                          {selected.cell.lat.toFixed(5)}°,{" "}
                          {selected.cell.lon.toFixed(5)}°
                        </dd>
                      </div>
                      <div>
                        <dt>Data status</dt>
                        <dd>
                          {current.values.get(selected.cell.id) == null
                            ? "Unavailable"
                            : "Available"}
                        </dd>
                      </div>
                    </dl>
                    <div className="atlas-cell-actions">
                      <button
                        className="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              selected.cell.id,
                            );
                            setCopied(selected.cell.id);
                          } catch {
                            setCopied(undefined);
                          }
                        }}
                      >
                        {copied === selected.cell.id ? (
                          <Check size={15} />
                        ) : (
                          <Copy size={15} />
                        )}{" "}
                        {copied === selected.cell.id ? "Copied" : "Copy ID"}
                      </button>
                      <button className="button" onClick={() => step(-1)}>
                        <ChevronLeft size={16} /> Previous cell
                      </button>
                      <button className="button" onClick={() => step(1)}>
                        Next cell <ChevronRight size={16} />
                      </button>
                    </div>
                    <p className="source-note">
                      Full native H3 cell geometry. See Source & quality for
                      original row qualifiers and provenance.
                    </p>
                  </>
                ) : (
                  <p className="detail-note">
                    Click a map cell to inspect its exact source value.
                  </p>
                )}
              </div>
              <div className="environment-context source-quality">
                <p>
                  <strong>Column</strong> <code>{current?.id}</code>
                </p>
                {selected && (
                  <p>
                    <strong>Exact stored value</strong>{" "}
                    {sourceValue(originalValue(current, selected.cell.id))}{" "}
                    {current?.field.unit}
                  </p>
                )}
                {currentAppearance.standardize && !current?.categories && (
                  <p>
                    <strong>Display standardization</strong>(value − mean) / std
                    · population std · full native area, non-null cells,
                    unweighted. Mean: {sourceValue(currentStandardized?.mean)}{" "}
                    {current?.unit}; std:{" "}
                    {sourceValue(currentStandardized?.std)} {current?.unit}.
                  </p>
                )}
                <p>
                  <strong>Source release</strong> {current?.field.sourceRelease}
                </p>
                <p>
                  <strong>Source artifact</strong> {current?.field.sourcePath}
                </p>
                <p>
                  <strong>Source SHA-256</strong>{" "}
                  <code>{current?.field.sourceSha256}</code>
                </p>
                <p>
                  <strong>Data updated</strong> {currentDataset?.publishedAt ?? catalog.publishedAt}
                </p>
                <p>
                  <strong>Source status</strong> {currentDataset?.status ?? catalog.receiptStatus} · {currentDataset ? currentDataset.publishedAt ?? "source observation dates retained below" : catalog.publishedAt}
                </p>
                <p>
                  <strong>Definition</strong> {current?.field.definition}{" "}
                  {current?.unit === "source units" &&
                    "This field's unit is not encoded by the adapter; consult its source definition."}
                </p>
                <p>
                  <strong>Modeling eligibility</strong>{" "}
                  {current?.field.modelingEligibility}
                </p>
                <p>
                  <strong>Scope</strong>{" "}
                  {currentDataset?.limitations}
                  {current?.slice && <span> {current.slice.axis}: {current.slice.label}. </span>}
                  {current?.field.dataset === "governance" ? <span> Original dataset shapes and attributes are retained under Governance/OriginalData.</span> : <a
                    href={`/local-data/seascape/${catalog.manifestSha256}/consumption-guide.txt`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Source consumption guide
                  </a>}{" "}
                  · Source observation dates may be unknown. Static history does
                  not establish current presence.
                </p>
                {row !== undefined ? (
                  Object.entries(current?.qualifiers ?? {}).map(
                    ([name, column]) => (
                      <p key={name}>
                        <strong>{name}</strong> {sourceValue(column[row])}
                      </p>
                    ),
                  )
                ) : (
                  <p>
                    Select a cell to see its original status, coverage, and
                    observation-date fields.
                  </p>
                )}
              </div>
            </div>
          ) : dialog === "export" ? (
            <>
              {compare && <label className="field">Export map<select aria-label="Export map" value={exportSide} onChange={event=>setExportSide(event.target.value as "left"|"right")}><option value="left">Left · {featureDisplayName(field)}</option><option value="right">Right · {featureDisplayName(otherField)}</option></select></label>}
              {current?.field.dataset === "marine-mammals" && <p>Exports native H3 reported-record counts for this side’s filters and period. Point-marker geometry is not included.</p>}
              <p>
                {current?.humanGeometry ? "Download the filtered source geometry as GeoJSON, preserving record identities, access restrictions and original attributes." : <>Download the full native {current?.name} layer as JSON,
                including exact values, nulls, H3 IDs, units, source bindings
                and row qualifiers. The file is created locally. Display
                standardization does not replace the original exported values.</>}
              </p>
              <button
                className="button"
                onClick={exportLayer}
                disabled={!current}
              >
                <Download size={16} /> {current?.humanGeometry ? "Download source GeoJSON" : "Download layer JSON"}
              </button>
            </>
          ) : (
            <>
              <p>
                Explore the local seascape, governance, annual kelp and directional coastal products across their native areas.
                Choose a data product, variable and native resolution in Layers. Annual kelp and coastal rays also require a survey year or bearing; adjust its
                palette, scale, and opacity by clicking the colorbar.
                Standardize in the legend popup displays dimensionless z-scores using the
                full-area mean and population standard deviation; original
                source values stay available in the inspector and export.
              </p>
              <p>
                Click a cell for its source value. Compare links both layers to the same geographic view. Drag the
                divider to reveal each layer; pan and zoom move them together.
                Each variable keeps its own legend and native resolution. R8
                cells load at the current zoom.
              </p>
              <p>
                Basemap credits: <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">© MapTiler</a>{" "}
                · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>.
              </p>
              <p>
                Values may be missing and source inventories are partial.
                Historic records and mapped intersections do not establish
                current habitat presence or absence. The other explorer pages
                still use synthetic demo data.
              </p>
            </>
          )}
        </AtlasDialog>
      )}
      </>}
    </main></MapWarningsProvider>
  );
}
