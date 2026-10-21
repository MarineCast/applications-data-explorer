import {describe,it,expect} from "vitest";
import {decodeOrcaSightings,defaultOrcaState,filterOrcaFrame,orcaPeriods,currentOrcaPeriod,isoWeekLabel,orcaPodSummary} from "./orca";
import {orcaFixture,sighting,pod} from "../test/orcaFixture";
const all={...defaultOrcaState,granularity:"all" as const};
const payload=(data=orcaFixture())=>({kind:"orca-sightings",version:1,snapshot:data.catalog.snapshot,grid:data.grid,records:data.records});
describe("reported Orca sightings",()=>{
 it("gates synthetic fixtures and preserves nullable native lineage",()=>{const data=orcaFixture();expect(()=>decodeOrcaSightings(payload(data),data.catalog)).toThrow("unsupported catalog");const decoded=decodeOrcaSightings(payload(data),data.catalog,true);expect(decoded.records[0].source_occurrence_ids).toBeNull();expect(decoded.records[2].native_classification).toBe("native mixed");});
 it("unions All without double counting IDs and detects conflicting source records",()=>{const data=orcaFixture();const records=[...data.records,data.records[0]];const decoded=decodeOrcaSightings({...payload(data),records},{...data.catalog,rows:records.length},true);expect(decoded.records).toHaveLength(6);expect(filterOrcaFrame(decoded,all).records).toHaveLength(6);expect(filterOrcaFrame(decoded,{...all,categories:["srkw","srkw"]}).records).toHaveLength(3);expect(()=>decodeOrcaSightings({...payload(data),records:[...data.records,sighting("leap",{source:"conflicting"})]},{...data.catalog,rows:7},true)).toThrow("conflicting duplicate");});
 it("shares record filtering for points/counts and discloses missing spatial support",()=>{const frame=filterOrcaFrame(orcaFixture(),all);expect(frame.points).toHaveLength(5);expect([...frame.counts.values()].reduce((a,b)=>a+b,0)).toBe(5);expect(frame.unlocated).toBe(1);expect(frame.unbinned).toBe(1);expect(frame.undatedIncluded).toBe(1);expect(filterOrcaFrame(orcaFixture(),{...all,categories:[]}).records).toHaveLength(0);});
 it("uses calendar leap days and whole local-day containment rather than synthetic noon",()=>{const data=orcaFixture(),daily={...defaultOrcaState,granularity:"daily" as const,anchor:"2024-02-29T00:00:00Z"};const frame=filterOrcaFrame(data,daily);expect(frame.records.map(r=>r.event_id)).not.toContain("synthetic:pacific-day");expect(frame.records).toHaveLength(4);expect(frame.unassignedTime).toBe(2);expect(filterOrcaFrame(data,{...daily,granularity:"monthly"}).records).toHaveLength(5);expect(orcaPeriods(data,"daily").map(p=>p.start?.slice(0,10))).toEqual(["2024-02-28","2024-02-29"]);});
 it("uses ISO Monday weeks through year boundaries, calendar months and years",()=>{expect(isoWeekLabel(Date.parse("2021-01-01T00:00:00Z"))).toBe("2020-W53");const data=orcaFixture();data.records=[sighting("year",{time_start_utc:"2020-12-31T23:59:59Z",time_end_utc:"2021-01-01T00:00:00Z",observed_at_utc:"2020-12-31T23:59:59Z"})];expect(orcaPeriods(data,"weekly")[0].start).toBe("2020-12-28T00:00:00.000Z");expect(orcaPeriods(data,"yearly")).toHaveLength(1);expect(orcaPeriods(data,"monthly")).toHaveLength(1);});
 it("preserves exact submillisecond half-open intervals",()=>{const data=orcaFixture();data.records=[sighting("micro",{time_start_utc:"2024-02-29T23:59:59.999998Z",time_end_utc:"2024-02-29T23:59:59.999999Z",observed_at_utc:"2024-02-29T23:59:59.999998Z",time_precision:"subsecond"})];data.catalog={...data.catalog,rows:1};expect(decodeOrcaSightings(payload(data),data.catalog,true).records).toHaveLength(1);expect(filterOrcaFrame(data,{...defaultOrcaState,granularity:"daily"}).records).toHaveLength(1);});
 it("keeps the period anchor across granularity and chooses a containing calendar interval",()=>{const p=orcaPeriods(orcaFixture(),"monthly");expect(currentOrcaPeriod(p,"2024-02-29T12:00:00Z").key).toBe("2024-02-01T00:00:00.000Z");expect(currentOrcaPeriod(p,null)).toEqual(p.at(-1));});
 it("rejects invalid categories, unsupported native cells, bad time intervals and invented evidence",()=>{const data=orcaFixture();for(const patch of [{category:"all"},{h3_r6:"unknown"},{time_end_utc:"2024-02-29T12:00:00Z"},{classification_status:"mixed"},{classification_evidence_json:"{}"}])expect(()=>decodeOrcaSightings({...payload(data),records:[{...data.records[0],...patch}]},{...data.catalog,rows:1},true)).toThrow();});
 it("decodes lossless dictionary columns and leaves lineage lazily bound",()=>{const data=orcaFixture(),record={...data.records[0],classification_evidence_json:undefined};const columns=Object.fromEntries(Object.entries(record).filter(([k])=>k!=="classification_evidence_json").map(([k,v])=>[k,{dictionary:[v],indices:[0]}]));const decoded=decodeOrcaSightings({...payload(data),records:undefined,columns},{...data.catalog,rows:1,details:{}},true);expect(decoded.records[0].event_id).toBe(record.event_id);expect(decoded.records[0].classification_evidence_json).toBeUndefined();});
});

it("itemizes explicit pods/groups using distinct filtered records and leaves untyped identifiers Unknown",()=>{
 const data=orcaFixture(),frame=filterOrcaFrame(data,all);
 const inCell=frame.records.filter(r=>r.h3_r6===data.grid[0]);const summary=orcaPodSummary([...inCell,inCell[0]]);
 expect(summary.distinctRecords).toBe(5);expect(summary.groups).toEqual(expect.arrayContaining([{label:"J",groupType:"pod",records:2},{label:"K",groupType:"pod",records:2},{label:"Unknown pod/group",groupType:"unknown",records:1}]));
 expect(summary.groups.reduce((sum,g)=>sum+g.records,0)).toBe(6);
 const daily=filterOrcaFrame(data,{...defaultOrcaState,granularity:"daily",anchor:"2024-02-29T00:00:00Z"});
 expect(orcaPodSummary(daily.records.filter(r=>r.h3_r6===data.grid[0])).groups.find(g=>g.label==="K")?.records).toBe(1);
 expect(orcaPodSummary([sighting("identifier",{pod_group_assignments:[pod("T65A","identifier_untyped")]})]).groups).toEqual([{label:"Unknown pod/group",groupType:"unknown",records:1}]);
});

it("retains known native clock precision without inventing UTC support for unknown source time zones",()=>{
 const data=orcaFixture();data.records=[sighting("native",{observed_at_utc:null,time_start_utc:null,time_end_utc:null,time_precision:"second",source_timezone:"unknown",qc_flags:["UNKNOWN_SOURCE_TIMEZONE"]})];data.catalog={...data.catalog,rows:1};
 const decoded=decodeOrcaSightings(payload(data),data.catalog,true);expect(decoded.records[0].time_precision).toBe("second");expect(filterOrcaFrame(decoded,all).records).toHaveLength(1);expect(filterOrcaFrame(decoded,{...defaultOrcaState,granularity:"daily"}).records).toHaveLength(0);
});

it("keeps an empty requested period when a category has no reports there",()=>{
 const data=orcaFixture();data.records=[sighting("early",{category:"other",time_start_utc:"2023-01-01T12:00:00Z",time_end_utc:"2023-01-01T12:00:01Z",observed_at_utc:"2023-01-01T12:00:00Z"}),sighting("late")];
 const frame=filterOrcaFrame(data,{categories:["srkw"],granularity:"monthly",anchor:"2023-01-01T00:00:00Z"});expect(frame.period.start).toBe("2023-01-01T00:00:00.000Z");expect(frame.records).toHaveLength(0);
});
