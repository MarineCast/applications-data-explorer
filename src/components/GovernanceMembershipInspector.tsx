import type { SeascapeFeature } from "../data/seascape";
import type { GovernanceMembership, GovernanceRecord, GovernanceSupport } from "../data/governanceMemberships";
import { governanceMembershipLabel } from "../data/governanceMemberships";
import "./GovernanceMembershipInspector.css";

const fields: readonly [keyof Omit<GovernanceRecord, "geometry_part_ids">, string][] = [
  ["source_dataset_id", "Source dataset"], ["source_feature_id", "Source record"],
  ["feature_name", "Feature name"], ["feature_type", "Category"], ["authority", "Authority"],
  ["jurisdiction", "Jurisdiction"], ["region", "Region"], ["area_system_id", "Area system"],
  ["area_code", "Area code"], ["area_title", "Area title"], ["area_hierarchy_level", "Hierarchy"],
  ["parent_area_code", "Parent area code"],
];

/** Mount only after native-cell membership assets have passed the dedicated decoder. */
export default function GovernanceMembershipInspector({ memberships, count, status, sourceContext, sourceRecordContext, loading = false, error, countLabel = "Feature count" }: {
  memberships?: readonly GovernanceMembership[] | null;
  sourceContext?: SeascapeFeature["sourceContext"];
  sourceRecordContext?: SeascapeFeature["sourceRecordContext"];
  countLabel?: string;
  count?: number | null; status?: GovernanceSupport; loading?: boolean; error?: string;
}) {
  return <section className="governance-membership-inspector" aria-label="Governance feature memberships">
    <h3>Recorded features</h3>
    {loading ? <p role="status">Loading feature identities…</p>
      : error ? <p role="alert">{error}</p>
      : memberships === undefined ? <p>Feature identities are not included in this prepared product.</p>
      : <>
        <p className="governance-membership-support">{countLabel}: {count == null ? "Unknown" : count} · Support: {status ?? "unknown"}</p>
        {memberships === null ? <p>Feature membership is unknown for this cell. Missing support does not mean no features.</p>
          : !memberships.length ? <p>{status === "observed" && count === 0
            ? "No recorded features under verified empty inventory support."
            : "Membership support is unavailable; an empty list does not establish absence."}</p>
          : <ol className="governance-membership-list">
            {memberships.map(member => <li key={member.feature_id}>
              <h4>{governanceMembershipLabel(member)}</h4>
              <p className="governance-feature-id"><code>{member.feature_id}</code></p>
              {member.records.map((record, index) => <details className="governance-source-record" key={`${record.source_dataset_id}:${record.source_feature_id}:${index}`}>
                <summary>Source record {index+1}</summary>{sourceContext?.[record.source_dataset_id] && <dl>{Object.entries(sourceContext[record.source_dataset_id]).map(([key, value]) => <div key={key}><dt>{({country:"Country",agency:"Source agency",boundary_type:"Boundary type",classification:"Source classification",scope:"Source scope"} as Record<string,string>)[key] ?? key}</dt><dd>{value}</dd></div>)}</dl>}<dl>{fields.map(([key, label]) => <div key={key}>
                  <dt>{label}</dt><dd>{record[key] === null ? "Not supplied" : record[key]}</dd>
                </div>)}</dl>
                {sourceRecordContext?.[record.source_feature_id] && <dl>{Object.entries(sourceRecordContext[record.source_feature_id]).map(([key,value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{value ?? "Not supplied"}</dd></div>)}</dl>}
                <details><summary>Intersecting geometry parts ({record.geometry_part_ids.length})</summary>
                  <ul>{record.geometry_part_ids.map(part => <li key={part}><code>{part}</code></li>)}</ul>
                </details>
              </details>)}
            </li>)}
          </ol>}
        <p className="governance-membership-note">All recorded overlaps are retained. Area codes identify features; they are not continuous measurements. Recorded geometry does not establish current legal applicability.</p>
      </>}
  </section>;
}
