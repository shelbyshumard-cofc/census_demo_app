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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Disable caching so every request is fresh
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');

  const { address, radiusMiles, year } = req.body;
  if (!address || !radiusMiles || !year) {
    return res.status(400).json({ error: 'Missing required fields: address, radiusMiles, year' });
  }

  const apiKey = process.env.CENSUS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Census API key not configured.' });

  try {
    // 1. Geocode address to lat/lng
    const { lat, lng, matchedAddress } = await geocodeAddress(address);

    // 2. Get FIPS codes, city info, and block group centroids from TIGER
    const { stateFips, countyFips, cityName, cityGeoId, bgCentroids } =
      await fetchBlockGroupsInRadius(lat, lng, radiusMiles, year, apiKey);

    // 3. Fetch ACS data for all block groups in the county
    const bgData = await fetchBlockGroupACS(stateFips, countyFips, year, apiKey);

    // 4. Filter block groups to those within the radius using real centroids
    const insideGeoids = new Set();
    if (Object.keys(bgCentroids).length > 0) {
      for (const [geoid, centroid] of Object.entries(bgCentroids)) {
        const dist = distanceMiles(lat, lng, centroid.lat, centroid.lng);
        if (dist <= radiusMiles) insideGeoids.add(geoid);
      }
    } else {
      // Fallback: use all block groups in county if TIGER fetch failed
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

    const countyMetrics = computeMetrics(countyRaw);
    const stateMetrics = computeMetrics(stateRaw);
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
      countyName: countyRaw.NAME || 'County',
      stateName: stateRaw.NAME || 'State',
      cityName: cityName || null,
      blockGroupsInRadius: insideGeoids.size,
      blockGroupsTotal: Object.keys(bgData).length,
      tableRows,
    });

  } catch (err) {
    console.error('Demographics API error:', err);
    return res.status(500).json({ error: err.message || 'Unexpected error' });
  }
}

export const config = {
  api: { responseLimit: '50mb' }
};
