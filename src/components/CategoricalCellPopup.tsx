import { internationalBoundaryColumn, normalizeWaterCountry } from "../data/waterAssignments";
import { conservationReferenceStatus } from "../data/governanceMemberships";
import { X } from "lucide-react";
import type { Cell } from "../data/demo";
import type { SeascapeLayer } from "../data/seascape";
import { sourceValue } from "../data/seascape";
import "./CategoricalCellPopup.css";

/** Paired records stay together; source strings render only as React text. */
export default function CategoricalCellPopup({ layer, cell, onClose }: {
  layer: SeascapeLayer; cell: Cell; onClose: () => void;
}) {
  const index = layer.index.get(cell.id);
  const data = layer.governanceMemberships;
  const members = index === undefined ? undefined : data?.cells[index];
  const value = layer.rawValues?.get(cell.id);
  const boundary = layer.field.column === internationalBoundaryColumn;
  const conservation = layer.field.assignmentSemantics === "conservation_status";
  const geographic = layer.field.assignmentSemantics === "geographic";
  return <section className="categorical-cell-popup" role="dialog" aria-label="Cell information"
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
    <header><strong>{layer.name}</strong><button aria-label="Close cell information" onClick={onClose}><X size={17}/></button></header>
    <div className="categorical-cell-popup-body" tabIndex={0} aria-label="Cell details">
      <dl><div><dt>H3 cell</dt><dd><code>{cell.id}</code></dd></div><div><dt>Resolution</dt><dd>R{layer.resolution}</dd></div>
        {!layer.field.membershipColumn && <div><dt>Value</dt><dd>{sourceValue(value)}</dd></div>}
        {data && index !== undefined && <div><dt>Support</dt><dd>{data.statuses[index]}</dd></div>}
      </dl>
      {layer.field.supportLimitation && <p className="cell-membership-note">{layer.field.supportLimitation}</p>}
      {layer.field.membershipColumn && value != null && <p>Assignment: {sourceValue(value)}</p>}
      {members === null ? <p>{boundary ? "Unknown boundary support. No recorded line intersection does not establish that this cell has no international boundary." : geographic ? "Unknown water assignment support. This cell is unresolved, not zero or International." : "Unknown membership support. No recorded match does not establish that this cell has no areas."}</p>
        : members === undefined ? <p>{value == null ? "The category is unavailable or unknown for this cell." : "Feature identities are not supplied for this category."}</p>
        : !members.length ? <p>{index !== undefined && data?.statuses[index] === "observed" && data.counts[index] === 0
          ? boundary ? "No mapped international boundary under verified complete geographic support." : "No recorded areas under verified empty support." : "Unknown membership support; an empty list does not establish absence."}</p>
        : <><p>{members.length} recorded {boundary ? (members.length === 1 ? "boundary" : "boundaries") : conservation ? (members.length === 1 ? "assignment entry" : "assignment entries") : (members.length === 1 ? "area" : "areas")}. All overlaps are retained.</p><ol>
          {members.map(member => <li key={member.feature_id}>
            {conservationReferenceStatus(member) && <p><strong>{conservationReferenceStatus(member)}</strong> · Reference only; excluded from Marine Conservation Area Count and Coverage.</p>}
            <p className="cell-area-id"><span>{boundary ? "Boundary ID" : "Area ID"}</span> <code>{member.feature_id}</code></p>
            {member.records.map((record,i) => {
              const context = (layer.governanceSourceContext ?? layer.field.sourceContext)?.[record.source_dataset_id];
              const details = [
                ["Source",record.source_dataset_id], ["Source record ID",record.source_feature_id],
                ["Agency",context?.agency ?? record.authority], ["Country",geographic ? ({USA:"United States",CAN:"Canada"} as Record<string,string>)[normalizeWaterCountry(record.jurisdiction) ?? ""] : context?.country],
                [boundary ? "Boundary type" : "Area type",context?.boundary_type ?? record.feature_type], ["Source jurisdiction",record.jurisdiction],
                ["Region",record.region], ["Area code",record.area_code],
              ].filter(([,value])=>value != null);
              return <div className="cell-area-record" key={`${record.source_dataset_id}:${record.source_feature_id}:${i}`}>
                <h4>{record.feature_name ?? record.area_title ?? "Name not supplied"}</h4>
                <dl>{details.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
                {layer.field.sourceRecordContext?.[record.source_feature_id] && <dl>{Object.entries(layer.field.sourceRecordContext[record.source_feature_id]).map(([key,value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{value ?? "Not supplied"}</dd></div>)}</dl>}
                <details><summary>Intersecting geometry parts ({record.geometry_part_ids.length})</summary><ul>{record.geometry_part_ids.map(part=><li key={part}><code>{part}</code></li>)}</ul></details>
              </div>;
            })}
          </li>)}
        </ol></>}
      {data && <p className="cell-membership-note">Mapped reference geometry does not establish current legal applicability or sovereign/traditional territory. Stripe widths do not represent area shares.</p>}
    </div>
  </section>;
}
