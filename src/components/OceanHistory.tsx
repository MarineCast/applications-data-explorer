import { useEffect, useState } from "react";
import { loadSeascapeValues, type SeascapeCatalog, type SeascapeFeature } from "../data/seascape";

type Point = {date:string;value:number|null};
export default function OceanHistory({catalog,field,day,cell,onDate}:{catalog:SeascapeCatalog;field:SeascapeFeature;day:string;cell?:string;onDate:(date:string)=>void}) {
  const [state,setState]=useState<{key:string;rows?:Point[];error?:string}>({key:""});
  const key=`${field.productId}:${field.id}:${day}:${cell}`;
  useEffect(()=>{
    let active=true;
    const product=catalog.products?.[field.productId??""];
    if(!cell||!product||!("slices" in product))return;
    const dates=Object.keys(product.slices);const end=Math.max(0,dates.indexOf(day));
    const window=dates.length<=31?dates:dates.slice(Math.max(0,end-30),end+1);
    void (async()=>{
      const rows:Point[]=[];
      for(const date of window){
        if(!active)return;
        const values=await loadSeascapeValues(catalog,field,date);const value=values.get(cell);
        rows.push({date,value:typeof value==="number"?value:null});
      }
      if(active)setState({key,rows});
    })().catch(error=>{if(active)setState({key,error:String(error.message)});});
    return()=>{active=false;};
  },[catalog,field,day,cell,key]);
  if(!cell)return <p>Select a cell to see its native period history.</p>;
  if(state.key!==key||(!state.rows&&!state.error))return <p role="status">Loading selected-cell history…</p>;
  if(state.error)return <p role="alert">History unavailable: {state.error}</p>;
  const rows=state.rows!;const values=rows.flatMap(r=>r.value===null?[]:[r.value]);
  const lo=field.signed?-Math.max(...values.map(Math.abs),0):Math.min(...values,0);const hi=field.signed?-lo:Math.max(...values,0);
  const x=(i:number)=>40+i*480/Math.max(1,rows.length-1);const y=(v:number)=>150-(v-lo)*125/Math.max(hi-lo,0.001);
  return <section aria-label="Ocean Conditions cell history"><p>{field.name} · {field.unit} · {field.seasonalContext?"seasonal regional context; not daily or local observations":"native daily values"}. At most 31 {field.seasonalContext?"periods":"dates"}; nulls remain gaps.</p>
    {values.length>0&&<svg style={{width:"100%",maxHeight:260}} viewBox="0 0 560 190" role="img" aria-label={`${field.name} selected-cell history`}>
      <text x="2" y="23">{hi.toPrecision(3)}</text><text x="2" y="151">{lo.toPrecision(3)}</text>
      {field.signed&&<line x1="40" x2="520" y1={y(0)} y2={y(0)} stroke="#a9bac2"/>}
      {rows.map((r,i)=>r.value===null?null:<g key={r.date}>
        {i>0&&rows[i-1].value!==null&&<line x1={x(i-1)} y1={y(rows[i-1].value!)} x2={x(i)} y2={y(r.value)} stroke="#287f9d"/>}
        <circle cx={x(i)} cy={y(r.value)} r="4" fill="#287f9d" role="button" tabIndex={0} aria-label={`${r.date}: ${r.value} ${field.unit}`} onClick={()=>onDate(r.date)} onKeyDown={e=>{if(e.key==="Enter")onDate(r.date);}}><title>{r.date}: {r.value} {field.unit}</title></circle>
      </g>)}
      <text x="40" y="180">{rows[0]?.date}</text><text x="520" y="180" textAnchor="end">{rows.at(-1)?.date}</text>
    </svg>}
    {!values.length&&<p>No qualified values in this window.</p>}
  </section>;
}
