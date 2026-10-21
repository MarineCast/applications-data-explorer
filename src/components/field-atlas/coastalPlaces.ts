/** Approximate town-center anchors for the illustrated atlas, not navigational points. */
export const coastalCities = [
  // WA State Parks: parks.wa.gov/find-parks/state-parks/lime-kiln-point-state-park
  {text:'Lime Kiln Point',lat:48.5158,lon:-123.1523,major:false,minZoom:1.6},
  {text:'Vancouver',lat:49.283,lon:-123.121,major:true,minZoom:0},
  {text:'Seattle',lat:47.606,lon:-122.332,major:true,minZoom:0},
  // BC Geographical Names: https://apps.gov.bc.ca/pub/bcgnws/names/22474.html
  {text:'Victoria',lat:48.428,lon:-123.365,major:true,minZoom:0},
  {text:'Nanaimo',lat:49.166,lon:-123.940,major:true,minZoom:0},
  {text:'Tacoma',lat:47.253,lon:-122.444,major:true,minZoom:0},
  {text:'Bellingham',lat:48.752,lon:-122.479,major:true,minZoom:0},
  {text:'Everett',lat:47.979,lon:-122.202,major:false,minZoom:.38},
  {text:'Olympia',lat:47.038,lon:-122.901,major:false,minZoom:.38},
  {text:'Port Angeles',lat:48.118,lon:-123.431,major:false,minZoom:.38},
  {text:'Sequim',lat:48.080,lon:-123.102,major:false,minZoom:.38},
  {text:'Friday Harbor',lat:48.534,lon:-123.017,major:false,minZoom:.6},
  {text:'Port Townsend',lat:48.117,lon:-122.760,major:false,minZoom:.45},
  {text:'Anacortes',lat:48.513,lon:-122.612,major:false,minZoom:.6},
].map(city=>({...city,x:(city.lon+122.89)*120/.82,z:(48.5857585765218-city.lat)*80/(48.766517153043594-48.405)}));
