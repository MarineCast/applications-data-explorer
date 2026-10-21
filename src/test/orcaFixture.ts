/** Deterministic synthetic records for contract tests only. Never production fallback. */
import {latLngToCell} from "h3-js";
import type {OrcaSighting,OrcaData,OrcaPodAssignment} from "../data/orca";
export const orcaFixtureCell=latLngToCell(48.5,-123.4,6);
export function sighting(id:string,patch:Partial<OrcaSighting>={}):OrcaSighting{return {
 source_description:null,observed_at_raw:null,observed_date_raw:null,pod_group_status:"unknown",pod_group_assignments:[],
 event_id:`synthetic:${id}`,source:"SYNTHETIC_TEST_ONLY",source_record_id:id,source_native_id:null,source_event_id:null,source_dataset_id:null,source_occurrence_ids:null,source_occurrence_count:1,
 ecotype_detail:"SRKW",category:"srkw",classification_status:"source_supported",native_classification:"test SRKW",classification_evidence_json:"[]",
 observed_at_utc:"2024-02-29T12:00:00.000000Z",time_start_utc:"2024-02-29T12:00:00.000000Z",time_end_utc:"2024-02-29T12:00:01.000000Z",time_precision:"second",native_date:"2024-02-29",source_timezone:"UTC",utc_date:"2024-02-29",
 latitude:48.5,longitude:-123.4,latitude_raw:"48.500",longitude_raw:"-123.400",coordinate_uncertainty_m:null,coordinate_transform:"NONE",coordinate_role:null,h3_r6:orcaFixtureCell,h3_precision_status:"assignment_only_unknown_accuracy",source_license:"SYNTHETIC",source_use_class:"TEST_ONLY",source_retrieved_at_utc:null,qc_flags:[],...patch
};}
export const pod=(label:string,group_type="pod"):OrcaPodAssignment=>({label,group_type,source_term:label,evidence_field:"POD",evidence_text:`Explicit source ${label}`,confidence:"EXPLICIT",conflicting:false});
export function orcaFixture():OrcaData{return {catalog:{version:1,status:"synthetic_fixture",snapshot:"a".repeat(64),rows:6,events:{url:"/local-data/orca/test.json",sha256:"b".repeat(64)},source:{catalogSha256:"c".repeat(64),parquetSha256:"d".repeat(64),schemaVersion:"orca-study-sightings-v1",limitations:"Synthetic fixture only",publishedAt:"2026-10-16T00:00:00Z"}},grid:[orcaFixtureCell],records:[
 sighting("leap",{pod_group_status:"reported",pod_group_assignments:[pod("J")]}),sighting("transient",{category:"transient",ecotype_detail:"TRANSIENT",pod_group_status:"reported",pod_group_assignments:[pod("T65A matriline","source_named_matriline")]}),
 sighting("mixed",{category:"other",ecotype_detail:"MIXED",classification_status:"mixed",native_classification:"native mixed",pod_group_status:"multiple_reported",pod_group_assignments:[pod("J"),pod("K")],source_description:"<img src=x onerror=alert(1)> J and K reported together.",observed_at_raw:"2024-02-29 12:00 UTC"}),
 sighting("pacific-day",{pod_group_status:"reported",pod_group_assignments:[pod("K")],observed_at_utc:null,time_start_utc:"2024-02-28T08:00:00.000000Z",time_end_utc:"2024-02-29T08:00:00.000000Z",time_precision:"day",source_timezone:"America/Los_Angeles",native_date:"2024-02-28",utc_date:null}),
 sighting("unknown",{category:"other",ecotype_detail:"UNKNOWN",classification_status:"unknown",observed_at_utc:null,time_start_utc:null,time_end_utc:null,time_precision:"unknown",native_date:null,utc_date:null}),
 sighting("unlocated",{pod_group_status:"reported",pod_group_assignments:[pod("L")],latitude:null,longitude:null,h3_r6:null,latitude_raw:null,longitude_raw:null}),
 ]};}
