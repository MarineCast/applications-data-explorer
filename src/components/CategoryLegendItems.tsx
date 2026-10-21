import {useRef,useState} from "react";
import "./CategoryLegendItems.css";
export interface CategoryLegendItem {key:string;label:string;color:string;selected:boolean}
/** One interaction and visual treatment for every categorical Features legend. */
export default function CategoryLegendItems({items,onSelectionChange,identity,emptyLabel="No matching categories"}:{emptyLabel?:string;items:CategoryLegendItem[];onSelectionChange:(keys:string[])=>void;identity:string}){
 const [search,setSearch]=useState({identity,query:"",page:0});
 // A browser double-click emits click(1), click(2), then dblclick. Remember
 // the pre-gesture selection so the first click cannot reverse restore/isolate.
 const gesture=useRef<{identity:string;key:string;selected:string[]} | null>(null);
 const selected=()=>items.filter(item=>item.selected).map(item=>item.key);
 const click=(key:string,detail:number)=>{
   if(detail>1)return;
   const before=selected();
   gesture.current=detail===1?{identity,key,selected:before}:null;
   onSelectionChange(items.filter(item=>item.key===key?!item.selected:item.selected).map(item=>item.key));
 };
 const isolate=(key:string)=>{
   const before=gesture.current?.identity===identity&&gesture.current.key===key?gesture.current.selected:selected();
   gesture.current=null;
   onSelectionChange(before.length===1&&before[0]===key?items.map(item=>item.key):[key]);
 };
 const current=search.identity===identity?search:{identity,query:"",page:0};
 const filtered=items.filter(item=>item.label.toLocaleLowerCase().includes(current.query.toLocaleLowerCase()));
 const last=Math.max(0,Math.ceil(filtered.length/50)-1),page=Math.min(current.page,last);
 return <div className="category-legend-items" aria-label="Category key">
 {items.length>50&&<input type="search" aria-label="Find legend category" placeholder="Find category" value={current.query} onChange={e=>setSearch({identity,query:e.target.value,page:0})}/>}
 <div className="category-legend-list">{filtered.slice(page*50,page*50+50).map(item=><button type="button" key={item.key} aria-label={item.label} aria-pressed={item.selected} onClick={event=>click(item.key,event.detail)} onDoubleClick={()=>isolate(item.key)}><i style={{background:item.color}} aria-hidden="true"/><span>{item.label}</span></button>)}</div>
 {!filtered.length&&<span>{emptyLabel}</span>}
 {filtered.length>50&&<div className="category-legend-pages"><button aria-label="Previous legend categories" disabled={!page} onClick={()=>setSearch({...current,page:page-1})}>Previous</button><span>{page+1} / {last+1}</span><button aria-label="Next legend categories" disabled={page===last} onClick={()=>setSearch({...current,page:page+1})}>Next</button></div>}
 </div>;
}
