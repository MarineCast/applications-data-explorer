import { useEffect, useMemo, useState } from "react";
import { calendarSlices, summarizeBox } from "../data/compareInsights";
import type { TemporalBox, TemporalComparison } from "../data/compareInsights";
import { loadSeascapeValues } from "../data/seascape";
import type { SeascapeCatalog, SeascapeFeature } from "../data/seascape";

/** Lazy original-column reads only; no qualifier duplication or spatial/time resampling. */
export function useComparisonTimeline(catalog: SeascapeCatalog | undefined, left: SeascapeFeature | undefined,
  right: SeascapeFeature | undefined, enabled: boolean): TemporalComparison | undefined {
  const plan = useMemo(() => {
    const l = calendarSlices(left?.productId ? catalog?.products?.[left.productId] : undefined);
    const r = calendarSlices(right?.productId ? catalog?.products?.[right.productId] : undefined);
    if (!l || !r || left?.kind === "categorical" || right?.kind === "categorical") return undefined;
    if (l.grain !== r.grain) return { rows: [], error: "These layers have different time grains. Temporal box plots require matching source periods; no resampling is applied." };
    const times = [...new Set([...l.entries.map(entry => entry.time), ...r.entries.map(entry => entry.time)])].sort((a, b) => a - b);
    if (!times.length) return { rows: [], error: "No recorded time slices are available." };
    return { rows: times.map(time => {
      const le = l.entries.find(entry => entry.time === time), re = r.entries.find(entry => entry.time === time);
      return { time, key: (le ?? re)!.key, label: (le ?? re)!.label, leftKey: le?.key, rightKey: re?.key };
    }) };
  }, [catalog, left, right]);
  const [state, setState] = useState<{ plan: typeof plan; result: TemporalComparison }>();
  useEffect(() => {
    if (!enabled || !plan || plan.error || !catalog || !left || !right) return;
    let active = true;
    const run = async () => {
      const rows: TemporalBox[] = [];
      for (const period of plan.rows) {
        if (!active) return;
        const results = await Promise.allSettled([
          period.leftKey ? loadSeascapeValues(catalog, left, period.leftKey) : Promise.resolve(undefined),
          period.rightKey ? loadSeascapeValues(catalog, right, period.rightKey) : Promise.resolve(undefined),
        ]);
        if (!active) return;
        const boxes = results.map(result => result.status === "fulfilled" && result.value ? summarizeBox(result.value.values()) : undefined);
        const errors = results.flatMap((result, i) => result.status === "rejected" ? [`${i ? "Right" : "Left"}: ${String(result.reason instanceof Error ? result.reason.message : result.reason)}`] : []);
        rows.push({ ...period, left: boxes[0], right: boxes[1], error: errors.length ? errors.join("; ") : undefined });
        setState({ plan, result: { rows: [...rows], loading: rows.length < plan.rows.length, total: plan.rows.length } });
      }
    };
    void run();
    return () => { active = false; };
  }, [enabled, plan, catalog, left, right]);
  if (!enabled || !plan) return undefined;
  if (plan.error) return { rows: [], loading: false, error: plan.error };
  return state?.plan === plan ? state.result : { rows: [], loading: true, total: plan.rows.length };
}
