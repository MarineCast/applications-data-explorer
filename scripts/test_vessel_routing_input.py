import unittest
from governance_input import vessel_routing_features,VESSEL_ROUTING_RECORDED

class VesselRoutingChoices(unittest.TestCase):
    def test_one_boolean_and_every_identity_preserve_original_bindings(self):
        identity={'column':'shipping_lanes__chs_recommended_track__feature_memberships_v1','membershipColumn':'same-native-column','sourceSha256':'exact','sourceRecordContext':{'original':{'status':'advisory'}}}
        boolean={'column':VESSEL_ROUTING_RECORDED,'sourceSha256':'exact','definition':'Unknown no-hit support'}
        old={'column':'speed_restriction_zones__recorded_polygon_union_area_fraction'}
        other={'column':'exclusion_zones__recorded_feature_count'}
        result=vessel_routing_features([identity,boolean,old,other])
        self.assertEqual(result,[identity,boolean,other]);self.assertEqual(identity['membershipColumn'],'same-native-column')
        self.assertEqual(identity['sourceRecordContext']['original']['status'],'advisory')
        self.assertEqual(boolean['categories'],[False,True]);self.assertEqual(boolean['unit'],'boolean')
        self.assertEqual(boolean['sourceSha256'],'exact');self.assertEqual(other,{'column':'exclusion_zones__recorded_feature_count'})


    def test_groups_every_traffic_scheme_role_with_separation_zones(self):
        shipping='vessel_routing_regulations__shipping_lanes__feature_memberships_v1';zones='vessel_routing_regulations__traffic_separation_zones__feature_memberships_v1'
        columns=[shipping,zones,'speed_restriction_zones__feature_memberships_v1','shipping_lanes__chs_recommended_track__feature_memberships_v1','traffic_separation_schemes__chs_separation_zone__feature_memberships_v1','traffic_separation_schemes__noaa_separation_zone__feature_memberships_v1','traffic_separation_schemes__chs_scheme_boundary__feature_memberships_v1','traffic_separation_schemes__chs_scheme_crossing__feature_memberships_v1','traffic_separation_schemes__chs_lane_part__feature_memberships_v1','traffic_separation_schemes__chs_separation_line__feature_memberships_v1','traffic_separation_schemes__noaa_traffic_lane__feature_memberships_v1']
        features=[{'column':c,'membershipColumn':c,'sourceSha256':'exact'} for c in columns];result=vessel_routing_features(features)
        self.assertEqual([f['column'] for f in result],[zones,columns[2]])
        self.assertEqual([f['name'] for f in result],['Shipping Lanes & Traffic Separation Zones','Speed Restriction Zones'])
        self.assertTrue(all(f['sourceSha256']=='exact' for f in result))
