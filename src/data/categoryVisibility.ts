import type {MapLayer} from "./map";
/** Display-only projection: source values, membership identities and support stay untouched. */
export function filterCategoryLayer<T extends MapLayer>(layer:T|undefined,hidden:readonly string[]):T|undefined {
 if(!layer?.categories||!hidden.length)return layer;
 const disabled=new Set(hidden),indices=new Set(layer.categories.map((label,i)=>disabled.has(layer.categoryKeys?.[i]??label)?i:-1));
 const values=new Map(layer.values);
 const memberships=layer.categoryMemberships?new Map(layer.categoryMemberships):undefined;
 const cells=layer.cells.filter(cell=>{
   if(memberships){
     const source=memberships.get(cell.id);
     // Unknown support and verified empty are not category membership.
     if(!source?.length)return true;
     const selected=source.filter(i=>!indices.has(i));
     if(!selected.length)return false;
     memberships.set(cell.id,selected);values.set(cell.id,selected.length===1?selected[0]:layer.values.get(cell.id)??null);
     return true;
   }
   const value=layer.values.get(cell.id);return value==null||!indices.has(value);
 });
 return {...layer,cells,values,categoryMemberships:memberships};
}
