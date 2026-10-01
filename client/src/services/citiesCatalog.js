// Global & Regional Cities Reference Catalog and Spatial Proximity Engine
// Provides dynamic nearby city discovery and global disaster intelligence hubs

export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c)
}

export const REGIONAL_CITIES = [
  {
    id: 'guwahati',
    name: 'Guwahati',
    fullName: 'Guwahati Dispur Hub',
    district: 'Kamrup Metropolitan',
    state: 'Assam',
    country: 'India',
    lat: 26.1445,
    lon: 91.7898,
    riskScore: 25,
    riskStatus: 'LOW',
    gridId: 'AS_00210744',
  },
  {
    id: 'dispur',
    name: 'Dispur',
    fullName: 'Dispur Capital Complex',
    district: 'Kamrup Metropolitan',
    state: 'Assam',
    country: 'India',
    lat: 26.1500,
    lon: 91.7900,
    riskScore: 28,
    riskStatus: 'LOW',
    gridId: 'AS_00210744',
  },
  {
    id: 'boko',
    name: 'Boko',
    fullName: 'Boko Bridge Corridor (NH-27)',
    district: 'Kamrup',
    state: 'Assam',
    country: 'India',
    lat: 25.9750,
    lon: 91.2330,
    riskScore: 68,
    riskStatus: 'CRITICAL',
    gridId: 'AS_00239973',
  },
  {
    id: 'jorabat',
    name: 'Jorabat',
    fullName: 'Jorabat Transit Bottleneck',
    district: 'Kamrup Metropolitan',
    state: 'Assam',
    country: 'India',
    lat: 26.1012,
    lon: 91.8682,
    riskScore: 60,
    riskStatus: 'HIGH',
    gridId: 'AS_00224110',
  },
  {
    id: 'shillong',
    name: 'Shillong',
    fullName: 'Shillong Police Bazar & Plateau',
    district: 'East Khasi Hills',
    state: 'Meghalaya',
    country: 'India',
    lat: 25.5788,
    lon: 91.8933,
    riskScore: 24,
    riskStatus: 'LOW',
    gridId: 'ML_00104821',
  },
  {
    id: 'tezpur',
    name: 'Tezpur',
    fullName: 'Tezpur North Bank Transit',
    district: 'Sonitpur',
    state: 'Assam',
    country: 'India',
    lat: 26.6338,
    lon: 92.8006,
    riskScore: 35,
    riskStatus: 'MODERATE',
    gridId: 'AS_00189022',
  },
  {
    id: 'silchar',
    name: 'Silchar',
    fullName: 'Silchar Barak Valley Hub',
    district: 'Cachar',
    state: 'Assam',
    country: 'India',
    lat: 24.8333,
    lon: 92.7789,
    riskScore: 62,
    riskStatus: 'HIGH',
    gridId: 'AS_00341102',
  },
  {
    id: 'dibrugarh',
    name: 'Dibrugarh',
    fullName: 'Dibrugarh Upper Assam Corridor',
    district: 'Dibrugarh',
    state: 'Assam',
    country: 'India',
    lat: 27.4728,
    lon: 94.9120,
    riskScore: 54,
    riskStatus: 'HIGH',
    gridId: 'AS_00112349',
  },
  {
    id: 'jorhat',
    name: 'Jorhat',
    fullName: 'Jorhat Cultural Hub',
    district: 'Jorhat',
    state: 'Assam',
    country: 'India',
    lat: 26.7509,
    lon: 94.2037,
    riskScore: 38,
    riskStatus: 'MODERATE',
    gridId: 'AS_00194420',
  },
  {
    id: 'nagaon',
    name: 'Nagaon',
    fullName: 'Nagaon Central Bypass',
    district: 'Nagaon',
    state: 'Assam',
    country: 'India',
    lat: 26.3464,
    lon: 92.6840,
    riskScore: 48,
    riskStatus: 'HIGH',
    gridId: 'AS_00204910',
  },
  {
    id: 'goalpara',
    name: 'Goalpara',
    fullName: 'Goalpara River Corridor',
    district: 'Goalpara',
    state: 'Assam',
    country: 'India',
    lat: 26.1805,
    lon: 90.6250,
    riskScore: 52,
    riskStatus: 'HIGH',
    gridId: 'AS_00220199',
  },
  {
    id: 'tura',
    name: 'Tura',
    fullName: 'Tura Hills Incident Outpost',
    district: 'West Garo Hills',
    state: 'Meghalaya',
    country: 'India',
    lat: 25.5141,
    lon: 90.2033,
    riskScore: 36,
    riskStatus: 'MODERATE',
    gridId: 'ML_00129033',
  },
]

export const PAN_INDIA_CITIES = [
  // North
  { id: 'delhi', name: 'Delhi', fullName: 'National Capital Region (NCR)', district: 'New Delhi', state: 'Delhi NCR', country: 'India', lat: 28.6139, lon: 77.2090, riskScore: 42, riskStatus: 'MODERATE', tag: 'Seismic & Yamuna Inundation' },
  { id: 'dehradun', name: 'Dehradun', fullName: 'Dehradun Doon Valley Hub', district: 'Dehradun', state: 'Uttarakhand', country: 'India', lat: 30.3165, lon: 78.0322, riskScore: 54, riskStatus: 'HIGH', tag: 'Himalayan Seismic & Flash Flood' },
  { id: 'joshimath', name: 'Joshimath', fullName: 'Joshimath-Chamoli Sector NH-7', district: 'Chamoli', state: 'Uttarakhand', country: 'India', lat: 30.5570, lon: 79.5660, riskScore: 82, riskStatus: 'CRITICAL', tag: 'Subsidence & Slope Debris Flow' },
  { id: 'shimla', name: 'Shimla', fullName: 'Shimla Ridge-Cart Corridor', district: 'Shimla', state: 'Himachal Pradesh', country: 'India', lat: 31.1048, lon: 77.1734, riskScore: 62, riskStatus: 'HIGH', tag: 'Escarpment Landslide Watch' },
  { id: 'chandigarh', name: 'Chandigarh', fullName: 'Chandigarh Tri-City Hub', district: 'Chandigarh', state: 'Chandigarh', country: 'India', lat: 30.7333, lon: 76.7794, riskScore: 24, riskStatus: 'LOW', tag: 'Regional Relief Logistics Base' },
  { id: 'srinagar', name: 'Srinagar', fullName: 'Srinagar Jhelum Basin', district: 'Srinagar', state: 'Jammu & Kashmir', country: 'India', lat: 34.0837, lon: 74.7973, riskScore: 58, riskStatus: 'HIGH', tag: 'Jhelum Inundation & Seismic' },
  { id: 'lucknow', name: 'Lucknow', fullName: 'Lucknow Gomti Basin Hub', district: 'Lucknow', state: 'Uttar Pradesh', country: 'India', lat: 26.8467, lon: 80.9462, riskScore: 32, riskStatus: 'LOW', tag: 'Central Gangetic Plain' },
  { id: 'varanasi', name: 'Varanasi', fullName: 'Varanasi Ganga Ghat Corridor', district: 'Varanasi', state: 'Uttar Pradesh', country: 'India', lat: 25.3176, lon: 82.9739, riskScore: 40, riskStatus: 'MODERATE', tag: 'Ganga Flood Season Watch' },
  { id: 'jaipur', name: 'Jaipur', fullName: 'Jaipur Aravalli Logistics Depot', district: 'Jaipur', state: 'Rajasthan', country: 'India', lat: 26.9124, lon: 75.7873, riskScore: 20, riskStatus: 'LOW', tag: 'Semi-Arid Logistics Corridor' },
  // West
  { id: 'mumbai', name: 'Mumbai', fullName: 'Mumbai Coastal Corridor', district: 'Mumbai Suburban', state: 'Maharashtra', country: 'India', lat: 19.0760, lon: 72.8777, riskScore: 68, riskStatus: 'CRITICAL', tag: 'Coastal Storm Surge & Monsoonal Inundation' },
  { id: 'pune', name: 'Pune', fullName: 'Pune Mutha-Mula Valley', district: 'Pune', state: 'Maharashtra', country: 'India', lat: 18.5204, lon: 73.8567, riskScore: 34, riskStatus: 'MODERATE', tag: 'Western Ghats Leeward Grid' },
  { id: 'ahmedabad', name: 'Ahmedabad', fullName: 'Ahmedabad Sabarmati Hub', district: 'Ahmedabad', state: 'Gujarat', country: 'India', lat: 23.0225, lon: 72.5714, riskScore: 38, riskStatus: 'MODERATE', tag: 'Sabarmati Hydrology Grid' },
  { id: 'surat', name: 'Surat', fullName: 'Surat Tapi Estuary', district: 'Surat', state: 'Gujarat', country: 'India', lat: 21.1702, lon: 72.8311, riskScore: 52, riskStatus: 'HIGH', tag: 'Tapi Tidal & Flood Corridor' },
  // South
  { id: 'bengaluru', name: 'Bengaluru', fullName: 'Bengaluru Metro Basin', district: 'Bengaluru Urban', state: 'Karnataka', country: 'India', lat: 12.9716, lon: 77.5946, riskScore: 26, riskStatus: 'LOW', tag: 'Urban Drainage Grid' },
  { id: 'chennai', name: 'Chennai', fullName: 'Chennai Coromandel Coastal Grid', district: 'Chennai', state: 'Tamil Nadu', country: 'India', lat: 13.0827, lon: 80.2707, riskScore: 64, riskStatus: 'HIGH', tag: 'Bay of Bengal Cyclone & Inundation' },
  { id: 'hyderabad', name: 'Hyderabad', fullName: 'Hyderabad Musi Basin', district: 'Hyderabad', state: 'Telangana', country: 'India', lat: 17.3850, lon: 78.4867, riskScore: 28, riskStatus: 'LOW', tag: 'Deccan Plateau Command Hub' },
  { id: 'kochi', name: 'Kochi', fullName: 'Kochi Backwater Coastal Hub', district: 'Ernakulam', state: 'Kerala', country: 'India', lat: 9.9312, lon: 76.2673, riskScore: 56, riskStatus: 'HIGH', tag: 'Coastal Tidal Inundation' },
  { id: 'wayanad', name: 'Wayanad', fullName: 'Wayanad Western Ghats Escarpment', district: 'Wayanad', state: 'Kerala', country: 'India', lat: 11.6854, lon: 76.1320, riskScore: 86, riskStatus: 'CRITICAL', tag: 'Severe Landslide & Debris Flow Zone' },
  { id: 'visakhapatnam', name: 'Visakhapatnam', fullName: 'Vizag Eastern Naval Coastal Grid', district: 'Visakhapatnam', state: 'Andhra Pradesh', country: 'India', lat: 17.6868, lon: 83.2185, riskScore: 48, riskStatus: 'HIGH', tag: 'Cyclone Landfall Monitor' },
  // East & Central
  { id: 'kolkata', name: 'Kolkata', fullName: 'Kolkata Hooghly Estuary', district: 'Kolkata', state: 'West Bengal', country: 'India', lat: 22.5726, lon: 88.3639, riskScore: 58, riskStatus: 'HIGH', tag: 'Sundarbans Storm Surge' },
  { id: 'patna', name: 'Patna', fullName: 'Patna Ganga-Son Confluence', district: 'Patna', state: 'Bihar', country: 'India', lat: 25.5941, lon: 85.1376, riskScore: 66, riskStatus: 'CRITICAL', tag: 'Gangetic Plains Inundation Corridor' },
  { id: 'supaul', name: 'Supaul', fullName: 'Supaul Kosi River Basin Corridor', district: 'Supaul', state: 'Bihar', country: 'India', lat: 26.1260, lon: 86.6020, riskScore: 84, riskStatus: 'CRITICAL', tag: 'Kosi Active Avulsion & Breached Levee' },
  { id: 'bhubaneswar', name: 'Bhubaneswar', fullName: 'Bhubaneswar Mahanadi Delta Hub', district: 'Khurda', state: 'Odisha', country: 'India', lat: 20.2961, lon: 85.8245, riskScore: 42, riskStatus: 'MODERATE', tag: 'Delta Flood Coordination' },
  { id: 'puri', name: 'Puri', fullName: 'Puri Coastal Cyclone Corridor', district: 'Puri', state: 'Odisha', country: 'India', lat: 19.8135, lon: 85.8312, riskScore: 74, riskStatus: 'HIGH', tag: 'Direct Coastal Surge Belt' },
  { id: 'ranchi', name: 'Ranchi', fullName: 'Ranchi Chota Nagpur Plateau', district: 'Ranchi', state: 'Jharkhand', country: 'India', lat: 23.3441, lon: 85.3096, riskScore: 22, riskStatus: 'LOW', tag: 'Plateau High Relief Base' },
  { id: 'bhopal', name: 'Bhopal', fullName: 'Bhopal Upper Lake Command', district: 'Bhopal', state: 'Madhya Pradesh', country: 'India', lat: 23.2599, lon: 77.4126, riskScore: 24, riskStatus: 'LOW', tag: 'Central National Logistics' },
  { id: 'raipur', name: 'Raipur', fullName: 'Raipur Mahanadi Basin Hub', district: 'Raipur', state: 'Chhattisgarh', country: 'India', lat: 21.2514, lon: 81.6296, riskScore: 25, riskStatus: 'LOW', tag: 'Central Relief Staging Post' },
]

export const GLOBAL_METROS = [
  {
    id: 'tokyo',
    name: 'Tokyo',
    fullName: 'Tokyo Shinjuku Central',
    district: 'Shinjuku',
    state: 'Kanto',
    country: 'Japan',
    lat: 35.6762,
    lon: 139.6503,
    riskScore: 38,
    riskStatus: 'MODERATE',
    tag: 'Seismic & Typhoon Monitor',
  },
  {
    id: 'newyork',
    name: 'New York',
    fullName: 'New York Manhattan Hub',
    district: 'Manhattan',
    state: 'NY',
    country: 'USA',
    lat: 40.7128,
    lon: -74.0060,
    riskScore: 18,
    riskStatus: 'LOW',
    tag: 'Coastal Estuary Grid',
  },
  {
    id: 'london',
    name: 'London',
    fullName: 'Greater London Central',
    district: 'Westminster',
    state: 'England',
    country: 'UK',
    lat: 51.5074,
    lon: -0.1278,
    riskScore: 16,
    riskStatus: 'LOW',
    tag: 'Thames Tidal Defense',
  },
  {
    id: 'paris',
    name: 'Paris',
    fullName: 'Paris Seine Basin',
    district: 'Île-de-France',
    state: 'Île-de-France',
    country: 'France',
    lat: 48.8566,
    lon: 2.3522,
    riskScore: 20,
    riskStatus: 'LOW',
    tag: 'Seine River Drainage',
  },
  {
    id: 'sanfrancisco',
    name: 'San Francisco',
    fullName: 'San Francisco Bay Area',
    district: 'San Francisco',
    state: 'CA',
    country: 'USA',
    lat: 37.7749,
    lon: -122.4194,
    riskScore: 45,
    riskStatus: 'MODERATE',
    tag: 'San Andreas Fault Grid',
  },
  {
    id: 'singapore',
    name: 'Singapore',
    fullName: 'Singapore Marina Bay',
    district: 'Central Region',
    state: 'Singapore',
    country: 'Singapore',
    lat: 1.3521,
    lon: 103.8198,
    riskScore: 15,
    riskStatus: 'LOW',
    tag: 'Tropical Flash Drainage',
  },
  {
    id: 'sydney',
    name: 'Sydney',
    fullName: 'Sydney Harbour Coastal',
    district: 'New South Wales',
    state: 'NSW',
    country: 'Australia',
    lat: -33.8688,
    lon: 151.2093,
    riskScore: 24,
    riskStatus: 'LOW',
    tag: 'Bushfire & Coast Grid',
  },
  {
    id: 'dubai',
    name: 'Dubai',
    fullName: 'Dubai Urban Corridor',
    district: 'Dubai',
    state: 'Dubai',
    country: 'UAE',
    lat: 25.2048,
    lon: 55.2708,
    riskScore: 26,
    riskStatus: 'LOW',
    tag: 'Desert Storm Inundation',
  },
]

export const METROPOLITAN_SURROUNDINGS = [
  // Delhi NCR Surroundings
  { id: 'noida', name: 'Noida', fullName: 'Noida Gautam Buddha Nagar', district: 'Gautam Buddha Nagar', state: 'Uttar Pradesh', country: 'India', lat: 28.5355, lon: 77.3910, riskScore: 28, riskStatus: 'LOW' },
  { id: 'gurugram', name: 'Gurugram', fullName: 'Gurugram Cyber Hub', district: 'Gurugram', state: 'Haryana', country: 'India', lat: 28.4595, lon: 77.0266, riskScore: 34, riskStatus: 'MODERATE' },
  { id: 'faridabad', name: 'Faridabad', fullName: 'Faridabad Industrial Sector', district: 'Faridabad', state: 'Haryana', country: 'India', lat: 28.4089, lon: 77.3178, riskScore: 36, riskStatus: 'MODERATE' },
  { id: 'ghaziabad', name: 'Ghaziabad', fullName: 'Ghaziabad Hindon Corridor', district: 'Ghaziabad', state: 'Uttar Pradesh', country: 'India', lat: 28.6692, lon: 77.4538, riskScore: 31, riskStatus: 'LOW' },
  // Mumbai Surroundings
  { id: 'thane', name: 'Thane', fullName: 'Thane Creek Basin', district: 'Thane', state: 'Maharashtra', country: 'India', lat: 19.2183, lon: 72.9781, riskScore: 52, riskStatus: 'HIGH' },
  { id: 'navimumbai', name: 'Navi Mumbai', fullName: 'Navi Mumbai Coastal Hub', district: 'Thane', state: 'Maharashtra', country: 'India', lat: 19.0330, lon: 73.0297, riskScore: 49, riskStatus: 'HIGH' },
  { id: 'pune', name: 'Pune', fullName: 'Pune Western Ghats Hub', district: 'Pune', state: 'Maharashtra', country: 'India', lat: 18.5204, lon: 73.8567, riskScore: 30, riskStatus: 'LOW' },
  // Tokyo Surroundings
  { id: 'yokohama', name: 'Yokohama', fullName: 'Yokohama Port & Coastal', district: 'Kanagawa', state: 'Kanto', country: 'Japan', lat: 35.4437, lon: 139.6380, riskScore: 32, riskStatus: 'LOW' },
  { id: 'kawasaki', name: 'Kawasaki', fullName: 'Kawasaki Industrial Coastal', district: 'Kanagawa', state: 'Kanto', country: 'Japan', lat: 35.5308, lon: 139.7029, riskScore: 30, riskStatus: 'LOW' },
  { id: 'chiba', name: 'Chiba', fullName: 'Chiba Bay Monitor', district: 'Chiba', state: 'Kanto', country: 'Japan', lat: 35.6074, lon: 140.1065, riskScore: 26, riskStatus: 'LOW' },
  // New York Surroundings
  { id: 'jerseycity', name: 'Jersey City', fullName: 'Jersey City Hudson Riverfront', district: 'Hudson', state: 'NJ', country: 'USA', lat: 40.7178, lon: -74.0431, riskScore: 19, riskStatus: 'LOW' },
  { id: 'newark', name: 'Newark', fullName: 'Newark Passaic Basin', district: 'Essex', state: 'NJ', country: 'USA', lat: 40.7357, lon: -74.1724, riskScore: 22, riskStatus: 'LOW' },
  // London Surroundings
  { id: 'watford', name: 'Watford', fullName: 'Watford Colne Valley', district: 'Hertfordshire', state: 'England', country: 'UK', lat: 51.6565, lon: -0.3903, riskScore: 14, riskStatus: 'LOW' },
  { id: 'slough', name: 'Slough', fullName: 'Slough Thames Reach', district: 'Berkshire', state: 'England', country: 'UK', lat: 51.5105, lon: -0.5950, riskScore: 15, riskStatus: 'LOW' },
]

export const ALL_CITIES = [...PAN_INDIA_CITIES, ...REGIONAL_CITIES, ...GLOBAL_METROS, ...METROPOLITAN_SURROUNDINGS]

// Computes the closest nearby cities to an active coordinate point
export function getNearbyCities(lat, lon, limit = 5) {
  if (lat == null || lon == null) return REGIONAL_CITIES.slice(0, limit)

  const numLat = parseFloat(lat)
  const numLon = parseFloat(lon)

  return ALL_CITIES.map((city) => {
    const dist = haversineDistanceKm(numLat, numLon, city.lat, city.lon)
    return {
      ...city,
      distanceKm: dist,
    }
  })
    .filter((c) => c.distanceKm > 2) // exclude immediate active point
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
}
