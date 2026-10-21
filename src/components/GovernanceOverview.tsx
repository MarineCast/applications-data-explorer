import {useMemo} from "react";
import type {MapLayer} from "../data/map";
import {InsightMetrics,RankedBars} from "./InsightCharts";
export default function GovernanceOverview({layer,colors}:{layer:MapLayer;colors:readonly string[]}){
 const summary=useMemo(()=>{const counts=new Map<number,number>();let covered=0,overlap=0,unknown=0,empty=0;
 for(const cell of layer.cells){const row=layer.categoryMemberships?.get(cell.id);if(row==null){unknown++;continue;}if(!row.length){empty++;continue;}covered++;if(row.length>1)overlap++;for(const i of row)counts.set(i,(counts.get(i)??0)+1);}
 return {counts,covered,overlap,unknown,empty};},[layer]);
 return <><InsightMetrics items={[{label:"Mapped cells",value:summary.covered},{label:"Overlapping",value:summary.overlap},{label:"Unknown",value:summary.unknown}]}/>
 <RankedBars title="Feature coverage" caption="Cells per recorded feature · overlaps count in each row" rows={[...summary.counts].map(([i,value])=>({key:layer.categoryKeys?.[i]??String(i),label:layer.categories?.[i]??String(i),value,color:colors[i]??"#287f9d"}))}/>
 <p className="insights-note">{summary.empty.toLocaleString()} cells have verified empty support. Recorded geometry does not establish current legal applicability.</p></>;
}
