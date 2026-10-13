"""Contract tests for the viewshed cache exporter; fixtures are not app inputs."""

import unittest
from copy import deepcopy

from prepare_viewshed import (
    CONTRACT,
    WEIGHT_CONTRACT,
    aggregate_targets,
    attach_weights,
    validate_pairs,
)

A, B, TARGET = "8728d180cffffff", "8728d1874ffffff", "8728d1810ffffff"


def fixture():
    sources = [{"source_h3": A}, {"source_h3": B}]
    rows = [
        {
            "source_type": "land",
            "source_h3": A,
            "target_h3": TARGET,
            "lower": 0.4,
            "upper": 0.6,
            "average_viewability": None,
            "input_unknown_fraction": 0.2,
            "out_of_range_fraction": 0.1,
            "observer_count": 15,
            "max_distance_m": 24140.16,
            "target_water_pixel_count": 2000,
            "sampled_target_points": 600,
        },
        {
            "source_type": "land",
            "source_h3": B,
            "target_h3": A,
            "lower": 0,
            "upper": 0,
            "average_viewability": 0,
            "input_unknown_fraction": 0,
            "out_of_range_fraction": 0,
            "observer_count": 15,
            "max_distance_m": 24140.16,
            "target_water_pixel_count": 100,
            "sampled_target_points": 100,
        },
    ]
    runtime = {
        "contract": CONTRACT,
        "source_count": 2,
        "pair_count": 2,
        "unique_target_cells": 2,
        "sources": [
            {
                "source_h3": r["source_h3"],
                "target_cells": 1,
                "observers": [[0, 0, 0]] * 15,
                "target_water_points": r["target_water_pixel_count"],
                "sampled_result_used": True,
            }
            for r in rows
        ],
    }
    return sources, rows, runtime


class ExportContract(unittest.TestCase):
    def test_weight_join_requires_exact_keys_lineage_and_null_semantics(self):
        _, rows, _ = fixture()
        weights = [
            {
                "source_type": r["source_type"],
                "source_h3": r["source_h3"],
                "target_h3": r["target_h3"],
                "weight_terrain": 0.2,
                "weight_distance": 0.5,
                "distance_km": 9.0,
                "weight_above_ground": 0.8,
                "above_ground_lower": 0.8,
                "above_ground_upper": 0.8,
                "above_ground_status": "known",
            }
            for r in rows
        ]
        manifest = {"contract": WEIGHT_CONTRACT, "parent_sha256": "parent", "pair_count": 2}
        joined = attach_weights(rows, list(reversed(weights)), manifest, "parent")
        self.assertEqual(joined[0]["lower"], rows[0]["lower"])
        self.assertEqual(joined[0]["weight_above_ground"], 0.8)
        for invalid in [weights[:1], [weights[0], weights[0]]]:
            with self.assertRaisesRegex(ValueError, "universe"):
                attach_weights(rows, invalid, manifest, "parent")
        with self.assertRaisesRegex(ValueError, "lineage"):
            attach_weights(rows, weights, manifest, "wrong")
        with self.assertRaisesRegex(ValueError, "schema"):
            attach_weights(rows, [{**w, "lower": 0.9} for w in weights], manifest, "parent")
        weights[0]["above_ground_status"] = "unknown"
        with self.assertRaisesRegex(ValueError, "missingness"):
            attach_weights(rows, weights, manifest, "parent")

    def test_component_means_have_explicit_different_denominators(self):
        _, rows, _ = fixture()
        target = rows[0]["target_h3"]
        known = dict(
            rows[0],
            weight_terrain=0.2,
            weight_distance=0.5,
            weight_above_ground=0.8,
            above_ground_lower=0.8,
            above_ground_upper=0.8,
            above_ground_status="known",
        )
        na = dict(
            rows[1],
            target_h3=target,
            weight_terrain=0.0,
            weight_distance=0.3,
            weight_above_ground=None,
            above_ground_lower=None,
            above_ground_upper=None,
            above_ground_status="not_applicable",
        )
        result = aggregate_targets({A: [known], B: [na], "third": []})[0]
        self.assertAlmostEqual(result["weight_terrain"], 0.2 / 3)
        self.assertAlmostEqual(result["weight_distance"], 0.8 / 3)
        self.assertEqual(result["weight_above_ground"], 0.8)
        self.assertEqual(result["above_ground_source_count"], 1)
        self.assertEqual(result["above_ground_not_applicable_source_count"], 2)
        unknown = dict(
            na,
            weight_terrain=0.1,
            above_ground_status="unknown",
            above_ground_lower=0.2,
            above_ground_upper=0.6,
        )
        result = aggregate_targets({A: [known], B: [unknown]})[0]
        self.assertIsNone(result["weight_above_ground"])
        self.assertAlmostEqual(result["above_ground_lower"], 0.5)
        self.assertAlmostEqual(result["above_ground_upper"], 0.7)
        self.assertEqual(result["above_ground_unknown_source_count"], 1)

    def test_all_sources_denominator_and_absent_range_zeros(self):
        sources, rows, runtime = fixture()
        result = {
            r["target_h3"]: r for r in aggregate_targets(validate_pairs(rows, sources, runtime))
        }
        self.assertEqual(result[TARGET]["lower"], 0.2)
        self.assertEqual(result[TARGET]["upper"], 0.3)
        self.assertIsNone(result[TARGET]["average_viewability"])
        self.assertEqual(result[TARGET]["outside_reach_source_count"], 1)
        self.assertEqual(result[TARGET]["source_count"], 2)
        self.assertEqual(result[A]["average_viewability"], 0)

    def test_missing_partition_cannot_become_range_zero(self):
        sources, rows, runtime = fixture()
        with self.assertRaisesRegex(ValueError, "Incomplete"):
            validate_pairs(rows[:1], sources, runtime)

    def test_missing_water_points_cannot_become_range_zero(self):
        sources, rows, runtime = fixture()
        runtime["sources"][0]["target_water_points"] += 1
        with self.assertRaisesRegex(ValueError, "Incomplete source partition"):
            validate_pairs(rows, sources, runtime)

    def test_duplicate_pairs_and_false_complete_scores_rejected(self):
        sources, rows, runtime = fixture()
        duplicate = deepcopy(rows)
        duplicate[1] = duplicate[0]
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            validate_pairs(duplicate, sources, runtime)
        rows[0]["average_viewability"] = 0
        with self.assertRaisesRegex(ValueError, "missingness"):
            validate_pairs(rows, sources, runtime)

    def test_invalid_bounds_and_different_resolution_rejected(self):
        sources, rows, runtime = fixture()
        rows[0]["upper"] = 0.2
        with self.assertRaisesRegex(ValueError, "bounds"):
            validate_pairs(rows, sources, runtime)
        sources, rows, runtime = fixture()
        rows[0]["target_h3"] = "8628d180fffffff"
        with self.assertRaisesRegex(ValueError, "resolution"):
            validate_pairs(rows, sources, runtime)


if __name__ == "__main__":
    unittest.main()
