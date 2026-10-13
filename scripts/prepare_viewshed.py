"""Read a completed research pilot and install a verified, local-only browser cache.

No acquisition, scoring, input modification, or publication. Requires the producer's
Python geospatial dependencies (pyarrow, shapely, pyproj and h3).
"""

import argparse
import hashlib
import json
import math
import shutil
import tempfile
from pathlib import Path

import h3
import pyarrow.parquet as pq
from pyproj import Transformer
from shapely import from_wkb
from shapely.geometry import Polygon, mapping, shape
from shapely.ops import transform

CONTRACT = "bounded_regional_classified_viewability_pilot_v1"
AGGREGATION = "equal_source_cell_mean_with_out_of_reach_zero_v1"
WEIGHT_CONTRACT = "retained_regional_weight_diagnostics_v1"
WEIGHT_COLUMNS = {
    "source_type",
    "source_h3",
    "target_h3",
    "weight_terrain",
    "weight_distance",
    "distance_km",
    "weight_above_ground",
    "above_ground_lower",
    "above_ground_upper",
    "above_ground_status",
}


def validate_weight(row):
    terrain, distance = row["weight_terrain"], row["weight_distance"]
    lower, upper, complete = (
        row[k] for k in ("above_ground_lower", "above_ground_upper", "weight_above_ground")
    )
    if not all(
        isinstance(v, (int, float)) and math.isfinite(v) and 0 <= v <= 1
        for v in (terrain, distance)
    ):
        raise ValueError("Invalid terrain/distance weights")
    status = row["above_ground_status"]
    if status == "not_applicable":
        if terrain != 0 or any(v is not None for v in (lower, upper, complete)):
            raise ValueError("Invalid not-applicable above-ground support")
    elif (
        status not in ("known", "unknown")
        or terrain <= 0
        or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in (lower, upper))
        or not 0 <= lower <= upper <= 1
        or (status == "known" and (lower != upper or complete != lower))
        or (status == "unknown" and (complete is not None or upper <= lower))
    ):
        raise ValueError("Invalid above-ground weights or missingness")


def attach_weights(rows, diagnostics, manifest, parent_sha):
    if (
        manifest.get("contract") != WEIGHT_CONTRACT
        or manifest.get("parent_sha256") != parent_sha
        or manifest.get("pair_count") != len(rows)
    ):
        raise ValueError("Incompatible weight diagnostics lineage")

    def key(row):
        return row["source_type"], row["source_h3"], row["target_h3"]

    keyed = {key(row): row for row in diagnostics}
    if any(set(row) != WEIGHT_COLUMNS for row in diagnostics):
        raise ValueError("Unsupported weight diagnostic schema")
    if len(keyed) != len(diagnostics) or set(keyed) != {key(row) for row in rows}:
        raise ValueError("Weight diagnostic pair universe mismatch")
    result = []
    for row in rows:
        weight = keyed[key(row)]
        validate_weight(weight)
        if not math.isfinite(weight["distance_km"]) or weight["distance_km"] < 0:
            raise ValueError("Invalid centroid distance")
        result.append({**row, **weight})
    return result


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def validate_pairs(rows, sources, runtime):
    """Only a closed, completed source universe can treat absent pairs as range zeros."""
    source_ids = {s["source_h3"] for s in sources}
    infos = {s["source_h3"]: s for s in runtime["sources"]}
    if (
        runtime["contract"] != CONTRACT
        or len(source_ids) != len(sources)
        or len(sources) != runtime["source_count"]
        or set(infos) != source_ids
        or len(infos) != len(runtime["sources"])
        or len(rows) != runtime["pair_count"]
    ):
        raise ValueError("Incomplete or incompatible pilot source universe")
    if any(not h3.is_valid_cell(s) or h3.get_resolution(s) != 7 for s in source_ids):
        raise ValueError("Invalid source H3 resolution")
    keys, targets = set(), set()
    grouped = {s: [] for s in source_ids}
    for row in rows:
        key = row["source_h3"], row["target_h3"]
        if key in keys or key[0] not in source_ids or row["source_type"] != "land":
            raise ValueError("Duplicate or invalid pair identity")
        if not h3.is_valid_cell(key[1]) or h3.get_resolution(key[1]) != 7:
            raise ValueError("Invalid target H3 resolution")
        keys.add(key)
        targets.add(key[1])
        lower, upper, unknown = (row[k] for k in ("lower", "upper", "input_unknown_fraction"))
        if (
            not all(math.isfinite(x) for x in (lower, upper, unknown, row["out_of_range_fraction"]))
            or not 0 <= lower <= upper <= 1
            or not 0 <= unknown <= 1
            or not math.isclose(upper - lower, unknown, abs_tol=1e-12)
            or not 0 <= row["out_of_range_fraction"] <= 1
            or row["observer_count"] != 15
            or row["max_distance_m"] != 24140.16
            or row["target_water_pixel_count"] <= 0
            or not 0 < row["sampled_target_points"] <= row["target_water_pixel_count"]
        ):
            raise ValueError("Invalid pair bounds or spatial support")
        complete = row["average_viewability"]
        if (unknown > 0 and complete is not None) or (unknown == 0 and complete != lower):
            raise ValueError("Complete score does not preserve missingness")
        grouped[key[0]].append(row)
    if len(targets) != runtime["unique_target_cells"]:
        raise ValueError("Incomplete target universe")
    for source_id, pairs in grouped.items():
        info = infos[source_id]
        if (
            len(pairs) != info["target_cells"]
            or len(info["observers"]) != 15
            or sum(r["target_water_pixel_count"] for r in pairs) != info["target_water_points"]
            or not info["sampled_result_used"]
        ):
            raise ValueError("Incomplete source partition")
    return grouped


def aggregate_targets(grouped):
    """Average source-cell scores, retaining nullable scores and uncertainty bounds.

    Absent pairs in this validated producer contract have no water lattice points in
    observer reach, not missing input. Their contribution is zero, denominator stays
    all sources. Each pair retains its own in-reach water portion; this is not a
    whole-target-area or source-area-weighted mean.
    """
    by_target = {}
    for pairs in grouped.values():
        for pair in pairs:
            by_target.setdefault(pair["target_h3"], []).append(pair)
    count = len(grouped)
    result = []
    for target, pairs in sorted(by_target.items()):
        lower = math.fsum(p["lower"] for p in pairs) / count
        upper = math.fsum(p["upper"] for p in pairs) / count
        unknown = math.fsum(p["input_unknown_fraction"] for p in pairs) / count
        result.append(
            {
                "target_h3": target,
                "lower": lower,
                "upper": upper,
                "input_unknown_fraction": unknown,
                "average_viewability": None if unknown > 0 else lower,
                "modeled_source_count": len(pairs),
                "source_count": count,
                "outside_reach_source_count": count - len(pairs),
            }
        )
        if "weight_terrain" in pairs[0]:
            applicable = [p for p in pairs if p["above_ground_status"] != "not_applicable"]
            n = len(applicable)
            unknown_count = sum(p["above_ground_status"] == "unknown" for p in applicable)
            lo = math.fsum(p["above_ground_lower"] for p in applicable) / n if n else None
            hi = math.fsum(p["above_ground_upper"] for p in applicable) / n if n else None
            result[-1].update(
                weight_terrain=math.fsum(p["weight_terrain"] for p in pairs) / count,
                weight_distance=math.fsum(p["weight_distance"] for p in pairs) / count,
                above_ground_lower=lo,
                above_ground_upper=hi,
                weight_above_ground=lo if n and not unknown_count else None,
                above_ground_status=(
                    "not_applicable" if not n else "unknown" if unknown_count else "known"
                ),
                above_ground_source_count=n,
                above_ground_unknown_source_count=unknown_count,
                above_ground_not_applicable_source_count=count - n,
            )
    return result


def prepare(pilot, output, components=None):
    runtime = json.loads((pilot / "runtime.json").read_text())
    sources = json.loads((pilot / "source_cells.json").read_text())
    model = json.loads((pilot / "model_and_grid.json").read_text())
    parquet = pilot / "average_viewability.parquet"
    if digest(parquet) != runtime["output_sha256"]:
        raise ValueError("Pilot parquet checksum mismatch")
    rows = pq.read_table(parquet).to_pylist()
    weight_manifest = None
    if components:
        weight_manifest = json.loads((components / "manifest.json").read_text())
        if digest(components / "weights.parquet") != weight_manifest["output_sha256"]:
            raise ValueError("Weight diagnostics checksum mismatch")
        rows = attach_weights(
            rows,
            pq.read_table(components / "weights.parquet").to_pylist(),
            weight_manifest,
            runtime["output_sha256"],
        )
    grouped = validate_pairs(rows, sources, runtime)
    if model["crs"] != "EPSG:32610" or model["h3_resolution"] != 7:
        raise ValueError("Incompatible spatial model")
    # Identity includes exporter bytes so changed browser geometry/aggregation
    # cannot overwrite a previously installed immutable snapshot.
    inputs = {
        f: digest(pilot / f)
        for f in [
            "runtime.json",
            "source_cells.json",
            "model_and_grid.json",
            "land_area.parquet",
            "water_area.parquet",
            "average_viewability.parquet",
        ]
    }
    if components:
        inputs.update(
            {
                "weight_manifest.json": digest(components / "manifest.json"),
                "weights.parquet": digest(components / "weights.parquet"),
            }
        )
    snapshot = hashlib.sha256(
        json.dumps([inputs, digest(Path(__file__))], sort_keys=True).encode()
    ).hexdigest()
    to_world = Transformer.from_crs(32610, 4326, always_xy=True).transform
    to_local = Transformer.from_crs(4326, 32610, always_xy=True).transform

    def area(name):
        table = pq.read_table(pilot / name)
        geo = json.loads(table.schema.metadata[b"geo"])
        crs = geo["columns"][geo["primary_column"]]["crs"]
        from pyproj import CRS

        if CRS.from_user_input(crs).to_epsg() != 32610 or table.num_rows != 1:
            raise ValueError("Invalid pilot coastline CRS/rows")
        return from_wkb(table.column("geometry")[0].as_py())

    water, land = area("water_area.parquet"), area("land_area.parquet")

    def display(geometry):
        # Geometry simplification is presentation-only; pair values and support
        # counts remain exact. Separate land/water roles can share the same H3.
        return mapping(transform(to_world, geometry.simplify(15, preserve_topology=True)))

    infos = {s["source_h3"]: s for s in runtime["sources"]}
    source_cells = []
    for source in sources:
        source_id = source["source_h3"]
        info = infos[source_id]
        source_cells.append(
            {
                "id": source_id,
                "center": list(reversed(h3.cell_to_latlng(source_id))),
                "geometry": display(shape(source["source_land"])),
                "land_fraction": source["land_fraction"],
                "observers": [list(to_world(*o[:2])) for o in info["observers"]],
            }
        )
    target_cells = []
    for target in sorted({r["target_h3"] for r in rows}):
        polygon = transform(
            to_local, Polygon([(lon, lat) for lat, lon in h3.cell_to_boundary(target)])
        )
        geometry = polygon.intersection(water)
        if geometry.is_empty:
            raise ValueError("Target has no water support")
        target_cells.append(
            {
                "id": target,
                "center": list(reversed(h3.cell_to_latlng(target))),
                "geometry": display(geometry),
            }
        )
    output.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=".viewshed-", dir=output))
    try:
        assets = {}

        def write(name, data):
            path = stage / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(data, allow_nan=False, separators=(",", ":")) + "\n")
            if json.loads(path.read_text()) != json.loads(json.dumps(data)):
                raise ValueError("Cache round-trip mismatch")
            return {"url": f"/local-data/viewshed/{snapshot}/{name}", "sha256": digest(path)}

        for source_id, pairs in sorted(grouped.items()):
            assets[source_id] = write(
                f"sources/{source_id}.json", {"source_h3": source_id, "pairs": pairs}
            )
        common = write(
            "common.json",
            {
                "sources": source_cells,
                "targets": target_cells,
                "land": display(land),
                "averages": aggregate_targets(grouped),
            },
        )
        catalog = {
            "version": 2 if components else 1,
            "snapshot": snapshot,
            "contract": CONTRACT,
            "qualification": "research_pilot_not_empirically_calibrated",
            "source_count": len(sources),
            "target_count": len(target_cells),
            "pair_count": len(rows),
            "default_source": (
                "8728d180cffffff" if "8728d180cffffff" in grouped else sources[0]["source_h3"]
            ),
            "bounds": runtime["preparation"]["bounds_wgs84"],
            "model": model,
            "aggregation": AGGREGATION,
            "inputs": inputs,
            "limitations": runtime["limitations"],
            "input_products": {
                k: {"sha256": v["sha256"], "filename": Path(v["path"]).name}
                for k, v in runtime["preparation"]["config"]["inputs"].items()
            },
            "sampling_max_checked_error": runtime["maximum_checked_sampling_error"],
            "census_checked_sources": runtime["census_checked_sources"],
            "common": common,
            "sources": assets,
            "source_pair_counts": {s: len(pairs) for s, pairs in grouped.items()},
        }
        if weight_manifest:
            catalog["components"] = weight_manifest
        destination = output / snapshot
        if destination.exists():
            for file in stage.rglob("*.json"):
                if digest(file) != digest(destination / file.relative_to(stage)):
                    raise ValueError("Existing immutable snapshot differs")
        else:
            stage.rename(destination)
        # Atomic pointer promotion only after every asset was verified.
        pointer = output / ".catalog.json.tmp"
        pointer.write_text(json.dumps(catalog, indent=2, allow_nan=False) + "\n")
        pointer.replace(output / "catalog.json")
    finally:
        if stage.exists():
            shutil.rmtree(stage)
    return catalog


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pilot", required=True, type=Path)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "public/local-data/viewshed",
    )
    parser.add_argument(
        "--components", type=Path, help="Completed matched retained weight diagnostics folder"
    )
    args = parser.parse_args()
    result = prepare(
        args.pilot.resolve(),
        args.output.resolve(),
        args.components.resolve() if args.components else None,
    )
    print(
        json.dumps(
            {k: result[k] for k in ["snapshot", "source_count", "target_count", "pair_count"]}
        )
    )
