// pages/api/demographics.js
import {
  geocodeAddress,
  fetchBlockGroupsInRadius,
  fetchBlockGroupACS,
  fetchGeoACS,
  aggregateBlockGroups,
  computeMetrics,
  buildResultsTable
} from '../../lib/census';

// Haversine distance in miles between two lat/lng points
function distanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Check if a block group polygon intersects a radius circle.
// A block group is included if ANY of the following are true:
//   1. Its centroid is inside the circle
//   2. Any of its boundary vertices are inside the circle  
//   3. The address point is inside the block group polygon
function blockGroupIntersectsCircle(bgGeo, centerLat, centerLng, radiusMiles) {
  if (!bgGeo) return false;
  const { centroidLat, centroidLng, rings } = bgGeo;

  // 1. Centroid inside circle
  if (centroidLat && centroidLng &&
      distanceMiles(centerLat, centerLng, centroidLat, centroidLng) <= radiusMiles) return true;

  if (!rings || rings.length === 0) return false;

  // 2. Any boundary vertex inside circle
  for (const ring of rings) {
    for (const point of ring) {
      // TIGER rings are [lng, lat]
      const vLng = point[0];
      const vLat = point[1];
      if (typeof vLat !== 'number' || typeof vLng !== 'number') continue;
      if (distanceMiles(centerLat, centerLng, vLat, vLng) <= radiusMiles) return true;
    }
  }

  // 3. Address point inside block group polygon (ray casting)
  // Critical for rural areas where the block group is huge — no vertices or
  // centroid may be within 1 mile even though the address sits inside the block group.
  for (const ring of rings) {
    if (pointInRing(centerLng, centerLat, ring)) return true;
  }

  return false;
}

// Ray casting point-in-polygon for a single ring
// ring is array of [lng, lat] pairs (TIGER format)
function pointInRing(px, py, ring) {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]; // lng, lat
    const xj = ring[j][0], yj = ring[j][1];
    if (typeof xi !== 'number' || typeof yi !== 'number') continue;
    if (typeof xj !== 'number' || typeof yj !== 'number') continue;
    // Ray cast: does horizontal ray from (px,py) cross this edge?
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Geocode using Nominatim as fallback for addresses the Census geocoder can't find
async function geocodeWithFallback(address) {
  // Try Census geocoder first
  try {
    const result = await geocodeAddress(address);
    if (result?.lat && result?.lng) return result;
  } catch (e) {
    console.warn('Census geocoder failed, trying Nominatim:', e.message);
  }

  // Fallback: Nominatim (OpenStreetMap)
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=us`;
  const res = await fetch(url, { headers: { 'User-Agent': 'DemographicsRadiusTool/1.0' } });
  const data = await res.json();
  if (!data || data.length === 0) throw new Error(`Address not found: "${address}". Please check the spelling or try a nearby intersection.`);
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    matchedAddress: data[0].display_name,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');

  const { address, radiusMiles, year } = req.body;
  if (!address || !radiusMiles || !year) {
    return res.status(400).json({ error: 'Missing required fields: address, radiusMiles, year' });
  }

  const apiKey = process.env.CENSUS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Census API key not configured.' });

  try {
    // 1. Geocode address — with Nominatim fallback for rural/unrecognized addresses
    const { lat, lng, matchedAddress } = await geocodeWithFallback(address);

    // 2. Get FIPS codes, city info, and block group boundaries from TIGER
    const geoInfo = await fetchBlockGroupsInRadius(lat, lng, radiusMiles, year, apiKey);
    if (!geoInfo || !geoInfo.stateFips) {
      throw new Error('Could not determine county for this location. Try adding the state abbreviation to your address.');
    }
    const { stateFips, countyFips, cityName, cityGeoId, bgGeometries } = geoInfo;

    // 3. Fetch ACS data for all block groups in the county
    const bgData = await fetchBlockGroupACS(stateFips, countyFips, year, apiKey);
    if (!bgData || Object.keys(bgData).length === 0) {
      throw new Error(`No Census data found for this area in ${year}. Try a different year.`);
    }

    // 4. Filter block groups using polygon intersection
    const insideGeoids = new Set();
    const safeGeometries = bgGeometries || {};

    if (Object.keys(safeGeometries).length > 0) {
      for (const [geoid, bgGeo] of Object.entries(safeGeometries)) {
        if (blockGroupIntersectsCircle(bgGeo, lat, lng, radiusMiles)) insideGeoids.add(geoid);
      }
      // If still 0, the address is likely in a very large rural block group whose
      // boundary vertices are all beyond the radius. Include the block group
      // containing the address point directly.
      if (insideGeoids.size === 0) {
        console.warn('0 block groups via intersection — finding containing block group');
        for (const [geoid, bgGeo] of Object.entries(safeGeometries)) {
          if (!bgGeo?.rings) continue;
          for (const ring of bgGeo.rings) {
            if (pointInRing(lng, lat, ring)) {
              insideGeoids.add(geoid);
              break;
            }
          }
        }
      }
      // Last resort fallback only if all geometry checks fail
      if (insideGeoids.size === 0) {
        console.warn('All geometry checks failed — falling back to county');
        for (const geoid of Object.keys(bgData)) insideGeoids.add(geoid);
      }
    } else {
      for (const geoid of Object.keys(bgData)) insideGeoids.add(geoid);
    }

    // 5. Aggregate block group data for the radius area
    const radiusRaw = aggregateBlockGroups(bgData, insideGeoids);
    const radiusMetrics = computeMetrics(radiusRaw);

    // 6. Fetch county, state, city comparison data in parallel
    const [countyRaw, stateRaw, cityRaw] = await Promise.all([
      fetchGeoACS('county', stateFips, countyFips, year, apiKey),
      fetchGeoACS('state', stateFips, null, year, apiKey),
      cityGeoId ? fetchGeoACS('place', stateFips, cityGeoId, year, apiKey) : Promise.resolve(null),
    ]);

    const countyMetrics = computeMetrics(countyRaw || {});
    const stateMetrics = computeMetrics(stateRaw || {});
    const cityMetrics = cityRaw ? computeMetrics(cityRaw) : null;

    // 7. Build unified results table server-side
    const tableRows = buildResultsTable(radiusMetrics, countyMetrics, stateMetrics, cityMetrics);

    return res.status(200).json({
      lat,
      lng,
      matchedAddress,
      radiusMiles,
      year,
      stateFips,
      countyFips,
      countyName: countyRaw?.NAME || 'County',
      stateName: stateRaw?.NAME || 'State',
      cityName: cityName || null,
      blockGroupsInRadius: insideGeoids.size,
      blockGroupsTotal: Object.keys(bgData).length,
      tableRows,
    });

  } catch (err) {
    console.error('Demographics API error:', err);
    return res.status(500).json({ error: err.message || 'Unexpected error fetching demographic data.' });
  }
}

export const config = {
  api: { responseLimit: '50mb' }
};
