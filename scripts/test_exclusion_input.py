import unittest
from governance_input import exclusion_zone_features, EXCLUSION_FEATURES

class ExclusionChoices(unittest.TestCase):
    def test_two_choices_keep_source_bindings_and_nested_context(self):
        fields=[{'column':n,'id':'GOVERNANCE__'+n,'membershipColumn':n if 'memberships' in n else None,
                 'sourceSha256':'exact','sourceRecordContext':{'original':{'prohibited_activity':'seabed disturbance','permitted_activity':'transit'}}}
                for n in [*EXCLUSION_FEATURES,'exclusion_zones__recorded_polygon_union_area_fraction','exclusion_zones__recorded_point_feature_count']]
        result=exclusion_zone_features(fields)
        self.assertEqual([f['name'] for f in result],['Exclusion Zone Count','Exclusion Zone Assignment'])
        self.assertTrue(all(f['family']=='Exclusion Zones' and f['sourceSha256']=='exact' for f in result))
        self.assertEqual(result[1]['sourceRecordContext']['original']['permitted_activity'],'transit')
