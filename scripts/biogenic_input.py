"""Presentation-only normalization for current and verified startup catalogs."""
SPATIAL_INTERNAL_FIELDS = {'GRAPH_NODE_ELIGIBLE', 'HAS_WATER_OVERLAP', 'CONNECTOR_TARGET_H3_INDEX', 'GRAPH_QC_REASON', 'IS_HIERARCHY_ONLY_PARENT', 'CONNECTOR_WATER_PATH_FRACTION', 'IS_AOI_BOUNDARY_CELL', 'GRAPH_CONNECTION_STATUS', 'PARENT_H3_INDEX', 'CONNECTOR_DISTANCE_M'}
ANTHROPOGENIC_RETIRED = {'COMPREHENSIVE_SURVEY_COVERAGE_ESTABLISHED', 'FULL_H3_WITHIN_SOURCE_RECTANGLE', 'GENERALIZED_FALLBACK', 'GLOBAL_INVENTORY_COMPLETE', 'NATIVE_LAND_FOOTPRINT_UNKNOWN', 'NETWORK_DISTANCE_QC_REASON', 'OBSERVATION_PERIOD', 'OVERWATER_QC', 'AQUACULTURE_MAPPED_AREA_M2', 'POLICY_EDGE_REVIEW', 'SOURCE_COVERAGE', 'AQUACULTURE_POSITIVE_MAPPED_WATER_FRAC', 'MAPPED_WATER_AREA_M2', 'DISPOSAL_SITE_POSITIVE_MAPPED_WATER_FRAC', 'PROJECTED_PRECISION_NORMALIZATION_TILE_BOUNDS_INTERSECT_CELL', 'ARMORING_AVAILABILITY_DISAGREEMENT_LENGTH_M', 'MAPPED_WATER_SHARE_OF_FULL_CELL', 'ARTIFICIAL_REEF_MAPPED_POSITIVE_EVIDENCE'}
ANTHROPOGENIC_NAMES = {'AQUACULTURE_MAPPED_POSITIVE_EVIDENCE': 'Aquaculture', 'ARTIFICIAL_REEF_MAPPED_POSITIVE_EVIDENCE': 'Artificial Reef', 'DISPOSAL_SITE_MAPPED_POSITIVE_EVIDENCE': 'Disposal Site', 'DREDGED_CHANNEL_MAPPED_POSITIVE_EVIDENCE': 'Dredged Channel'}
ANTHROPOGENIC_DEFINITIONS = {'AQUACULTURE_MAPPED_POSITIVE_EVIDENCE': 'True means a qualified mapped aquaculture point intersects this native cell. This is mapped presence, not footprint area, activity or regulatory growing-area classification. False means no mapped positive evidence, including unknown values filled False by the requested public-display policy. False does not establish ecological or physical absence. Original nullable evidence and source coverage/QC are retained internally.', 'ARTIFICIAL_REEF_MAPPED_POSITIVE_EVIDENCE': 'True means mapped artificial-reef inventory evidence intersects this native cell. It does not establish present activity or comprehensive reef coverage. False means no mapped positive evidence, including unknown values filled False by the requested public-display policy. False does not establish ecological or physical absence. Original nullable evidence and source coverage/QC are retained internally.', 'DISPOSAL_SITE_MAPPED_POSITIVE_EVIDENCE': 'True means positive mapped disposal-site polygon area in this native cell, qualified by positive_mapped_polygon_inventory QC. It does not establish current disposal activity. False means no mapped positive evidence, including unknown values filled False by the requested public-display policy. False does not establish ecological or physical absence. Original nullable evidence and source coverage/QC are retained internally.', 'DREDGED_CHANNEL_MAPPED_POSITIVE_EVIDENCE': 'True means positive mapped dredged-channel polygon area in this native cell, qualified by positive_mapped_polygon_inventory QC. It does not establish current dredging activity. False means no mapped positive evidence, including unknown values filled False by the requested public-display policy. False does not establish ecological or physical absence. Original nullable evidence and source coverage/QC are retained internally.'}
NAMES = {
    'SEAGRASS_EXTENT_BOOL': 'Seagrass Mapped Presence (All Time)',
    'BIVALVE_EXTENT_BOOL': 'Bivalve Mapped Presence (All Time)',
    'KELP_EXTENT_BOOL': 'Kelp Mapped Presence (All Time)',
    'ANNUAL_KELP_EXTENT_M2': 'Annual Kelp Extent',
    'KELP_EXTENT_ALL_TIME_M2': 'Kelp Extent (All Time)',
    'SEAGRASS_EXTENT_ALL_TIME_M2': 'Seagrass Extent (All Time)',
    'BIVALVE_EXTENT_ALL_TIME_M2': 'Bivalve Extent (All-Time)',
}
RETIRED_FAMILIES = {'Bivalve', 'Bi-Valve', 'Biogenic Habitats', 'Kelp', 'Annual Kelp Footprints', 'Mapped Kelp Mosaic', 'Seagrass', 'Seagrass Evidence', 'Sentinel-2 Seagrass Habitat'}


def biogenic_features(features):
    result = []
    for field in features:
        if field.get('dataset', 'seascape') != 'seascape':
            result.append(field)
            continue
        native = field.get('column', field['id']).split('__')[-1]
        if field.get('family') == 'Anthropogenic':
            if native == 'has_mapped_artificial_reef':
                result.append(dict(field, name='Artificial Reef', kind='categorical', categories=[0, 1], range=[0, 1], unit='boolean'))
                continue
            if native in ANTHROPOGENIC_NAMES:
                result.append(dict(field, name=ANTHROPOGENIC_NAMES[native], definition=ANTHROPOGENIC_DEFINITIONS[native], categories=[False, True], range=[0, 1], available=field.get('rows', field.get('available'))))
                continue
            if native in ANTHROPOGENIC_RETIRED or any(group in native for group in ('AQUACULTURE','ARTIFICIAL_REEF','DISPOSAL_SITE','DREDGED_CHANNEL')):
                continue
        if field.get('family') == 'Spatial Support' and native in SPATIAL_INTERNAL_FIELDS:
            continue
        if field.get('family') in {'Mapped Substrate Classes', 'Shoreline', 'Coast Complexity', 'Coastal Complexity', 'Nearshore Transitions'}:
            family = 'Substrate' if field['family'] == 'Mapped Substrate Classes' else 'Coastal Environment'
            result.append(dict(field, family=family))
            continue
        column = field.get('column', field['id']).split('__')[-1]
        if column in NAMES:
            result.append(dict(field, name=NAMES[column], family='Biogenic Habitats'))
        elif (field.get('family') not in RETIRED_FAMILIES
              and not field.get('column', field['id']).startswith('BIVALVE__')
              and column != 'ANNUAL_SEAGRASS_EXTENT_M2'):
            result.append(field)
    return result


def anthropogenic_public_values(field, values):
    native = field.get('column', field.get('id', '')).split('__')[-1]
    if field.get('dataset', 'seascape') == 'seascape' and field.get('family') == 'Anthropogenic' and native in ANTHROPOGENIC_NAMES:
        return [False if value is None else value for value in values]
    return values
