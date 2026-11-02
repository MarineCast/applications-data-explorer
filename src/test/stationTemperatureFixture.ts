import type {StationTemperature} from "../data/stationTemperature";
export const stationTemperatureFixture:StationTemperature = {
  "sha256": "a471a16751519e8f43c68e2ffa67a9f779bcf945230da4fc1a0f6066709a106c",
  "stations": {
    "DFO-QUALARK": {
      "author": "Fisheries and Oceans Canada",
      "availability": "original operational availability and revisions unknown",
      "cadence": "sparse report-date daily means; underlying loggers not acquired",
      "coordinate_crs": "EPSG:4326",
      "coordinate_precision": "published coordinate; no current sensor survey",
      "coordinate_source": "https://doi.org/10.1080/00028487.2015.1031282",
      "coordinate_source_detail": "Robinson et al. 2015, p.698, Qualark water-temperature station used in 2011",
      "day_definition": "DFO report native daily mean; timezone and averaging boundaries unpublished/unverified",
      "identity_note": "Local stable ID; not asserted to be a provider-issued station code",
      "latitude": 49.53281388888889,
      "longitude": -121.42240833333334,
      "model_eligible": false,
      "provider": "DFO Environmental Watch",
      "provider_station_name": "Fraser River at Qualark",
      "quality": "provider report; approval/provisional status not supplied",
      "relationship": "Fraser mainstem at Qualark; distinct from WSC Hope discharge station; not river-mouth temperature",
      "rights": "Attributed local non-commercial reproduction; commercial redistribution requires DFO permission",
      "rights_url": "https://www.dfo-mpo.gc.ca/terms-avis/terms-conditions-avis-eng.htm",
      "river_id": "fraser",
      "station_id": "DFO-QUALARK",
      "statistics": [
        "daily_mean"
      ],
      "timezone": null,
      "unit": "degC"
    }
  },
  "rows": [
    {
      "station_id": "DFO-QUALARK",
      "river_id": "fraser",
      "date": "2023-07-26",
      "statistic": "daily_mean",
      "value": 19.4,
      "unit": "degC",
      "status": "valid",
      "temporal_basis": "provider_daily",
      "quality_flags": "{\"approval\": \"not_supplied\", \"provisional\": \"unknown\", \"source\": \"published_report\"}",
      "source_url": "https://www.pac.dfo-mpo.gc.ca/science/habitat/frw-rfo/reports-rapports/2023.zip#2023/2023-07-27-eng.html",
      "source_sha256": "e853dd71f34303cd507f0a43c57fb37561f9ea871770d284105eb893d62e67cf",
      "retrieved_at": "2026-10-26T20:55:51.688284+00:00",
      "report_date": "2023-07-27",
      "source_title": "Fraser River environmental watch report - July 27, 2023"
    },
    {
      "station_id": "DFO-QUALARK",
      "river_id": "fraser",
      "date": "2026-09-20",
      "statistic": "daily_mean",
      "value": 16.1,
      "unit": "degC",
      "status": "valid",
      "temporal_basis": "provider_daily",
      "quality_flags": "{\"approval\": \"not_supplied\", \"provisional\": \"unknown\", \"source\": \"published_report\"}",
      "source_url": "https://www.pac.dfo-mpo.gc.ca/science/habitat/frw-rfo/reports-rapports/2026/2026-09-21-eng.html",
      "source_sha256": "c278d43f19fdc8ffc8650e338583075f1423e43bf43e100822ba148f8125a91c",
      "retrieved_at": "2026-10-26T20:54:03.856338+00:00",
      "report_date": "2026-09-21",
      "source_title": "Fraser River environmental watch report: September 21, 2026"
    }
  ],
  "missingness": "Absent dates unobserved in acquired reports; no filling/interpolation"
};
