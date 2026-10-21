import {useState} from "react";
export interface InsightBar {key:string;label:string;value:number;color:string;onSelect?:()=>void}
export function InsightMetrics({items}:{items:{label:string;value:string|number}[]}){
 return <dl className="insight-metrics">{items.map(item=><div key={item.label}><dt>{item.label}</dt><dd>{typeof item.value==="number"?item.value.toLocaleString():item.value}</dd></div>)}</dl>;
}
/** Zero-based horizontal bars; labels and exact values remain readable without hover. */
export function RankedBars({rows,title,caption,unit="",limit=8}:{rows:InsightBar[];title:string;caption:string;unit?:string;limit?:number}){
 const [expanded,setExpanded]=useState(false);
 const ordered=[...rows].sort((a,b)=>b.value-a.value||a.label.localeCompare(b.label));
 const low=Math.min(0,...rows.map(row=>row.value)),high=Math.max(0,...rows.map(row=>row.value)),span=high-low||1;
 const visible=expanded?ordered:ordered.slice(0,limit);
 return <section className="insight-chart-card" aria-label={title}><header><h3>{title}</h3><p>{caption}</p></header>
 <div className="insight-ranked-bars">{visible.map(row=>{
  const content=<><span className="insight-bar-label">{row.label}</span><strong>{row.value.toLocaleString(undefined,{maximumSignificantDigits:4})}{unit&&` ${unit}`}</strong><span className="insight-bar-track" aria-hidden="true"><i style={{left:`${(Math.min(0,row.value)-low)/span*100}%`,width:`${Math.abs(row.value)/span*100}%`,background:row.color}}/><b style={{left:`${-low/span*100}%`}}/></span></>;
  return row.onSelect?<button className="insight-bar-row" key={row.key} onClick={row.onSelect}>{content}</button>:<div className="insight-bar-row" key={row.key}>{content}</div>;
 })}</div>
 {!rows.length&&<p className="insights-empty">No available values in this selection.</p>}
 {rows.length>limit&&<button className="insight-more" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?"Show fewer":`Show all ${rows.length.toLocaleString()}`}</button>}
 </section>;
}
/** Fixed compass sectors. Radius uses square root so sector area represents frequency. */
export function DirectionRose({values,color}:{values:Iterable<unknown>;color:string}){
 const counts=Array<number>(12).fill(0);
 for(const value of values)if(typeof value==="number"&&Number.isFinite(value))counts[Math.floor((((value%360)+375)%360)/30)%12]++;
 const max=Math.max(1,...counts),total=counts.reduce((a,b)=>a+b,0);
 const point=(angle:number,r:number)=>[155+Math.sin(angle*Math.PI/180)*r,105-Math.cos(angle*Math.PI/180)*r];
 return <section className="insight-chart-card"><header><h3>Direction frequency</h3><p>{total.toLocaleString()} available cells · 30° sectors</p></header><svg viewBox="0 0 310 216" className="insight-direction-rose" role="img" aria-label="Direction frequency by compass sector">
 {[28,56,84].map(r=><circle key={r} cx="155" cy="105" r={r} fill="none" stroke="currentColor" opacity=".12"/>)}
 {counts.map((count,i)=>{const radius=84*Math.sqrt(count/max),a=point(i*30-14,radius),z=point(i*30+14,radius);return count>0&&<path key={i} d={`M155,105 L${a.join(",")} A${radius},${radius} 0 0 1 ${z.join(",")} Z`} fill={color} opacity=".8"><title>{i*30}°: {count} cells ({(count/total*100).toFixed(1)}%)</title></path>;})}
 <text x="155" y="13" textAnchor="middle">N</text><text x="251" y="109">E</text><text x="155" y="208" textAnchor="middle">S</text><text x="58" y="109" textAnchor="end">W</text>
 </svg></section>;
}
