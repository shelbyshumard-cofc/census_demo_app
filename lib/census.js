// lib/census.js
// All Census API interactions and data aggregation logic

export const ACS_YEARS = [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013];

export const VARIABLES = {
  race: {
    label: 'Race & Ethnicity',
    vars: {
      total_pop:   { table: 'B03002_001E', label: 'Total Population' },
      white:       { table: 'B03002_003E', label: 'White (Non-Hispanic)' },
      black:       { table: 'B03002_004E', label: 'Black or African American' },
      native:      { table: 'B03002_005E', label: 'American Indian / Alaska Native' },
      asian:       { table: 'B03002_006E', label: 'Asian' },
      pacific:     { table: 'B03002_007E', label: 'Native Hawaiian / Pacific Islander' },
      other:       { table: 'B03002_008E', label: 'Some Other Race' },
      two_or_more: { table: 'B03002_009E', label: 'Two or More Races' },
      hispanic:    { table: 'B03002_012E', label: 'Hispanic or Latino' },
    }
  },
  age: {
    label: 'Age Breakdown',
    vars: {
      age_total:    { table: 'B01001_001E', label: 'Total Population' },
      age_0_4:      { tables: ['B01001_003E','B01001_027E'], label: 'Birth – 4' },
      age_5_9:      { tables: ['B01001_004E','B01001_028E'], label: '5 – 9' },
      age_10_14:    { tables: ['B01001_005E','B01001_029E'], label: '10 – 14' },
      age_15_19:    { tables: ['B01001_006E','B01001_007E','B01001_030E','B01001_031E'], label: '15 – 19' },
      age_20_24:    { tables: ['B01001_008E','B01001_009E','B01001_010E','B01001_032E','B01001_033E','B01001_034E'], label: '20 – 24' },
      age_25_34:    { tables: ['B01001_011E','B01001_012E','B01001_035E','B01001_036E'], label: '25 – 34' },
      age_35_44:    { tables: ['B01001_013E','B01001_014E','B01001_037E','B01001_038E'], label: '35 – 44' },
      age_45_54:    { tables: ['B01001_015E','B01001_016E','B01001_039E','B01001_040E'], label: '45 – 54' },
      age_55_64:    { tables: ['B01001_017E','B01001_018E','B01001_019E','B01001_041E','B01001_042E','B01001_043E'], label: '55 – 64' },
      age_65_74:    { tables: ['B01001_020E','B01001_021E','B01001_044E','B01001_045E'], label: '65 – 74' },
      age_75_plus:  { tables: ['B01001_022E','B01001_023E','B01001_024E','B01001_025E','B01001_046E','B01001_047E','B01001_048E','B01001_049E'], label: '75+' },
    }
  },
  income: {
    label: 'Income & Poverty',
    vars: {
      household_count:   { table: 'B19001_001E', label: 'Total Households', hidden: true },
      median_hh_income:  { table: 'B19013_001E', label: 'Median Household Income', isCurrency: true, isMedian: true },
      per_capita_income: { table: 'B19301_001E', label: 'Per Capita Income', isCurrency: true, isMedian: true },
      poverty_pop:       { table: 'B17001_002E', label: 'Population Below Poverty Line' },
      poverty_universe:  { table: 'B17001_001E', label: 'Population for Whom Poverty Status Determined', hidden: true },
    }
  },
  education: {
    label: 'Educational Attainment',
    vars: {
      edu_total:       { table: 'B15003_001E', label: 'Population 25+ (Education Universe)', hidden: true },
      no_hs:           { tables: ['B15003_002E','B15003_003E','B15003_004E','B15003_005E','B15003_006E','B15003_007E','B15003_008E','B15003_009E','B15003_010E','B15003_011E','B15003_012E','B15003_013E','B15003_014E','B15003_015E','B15003_016E'], label: 'Less Than High School' },
      hs_diploma:      { tables: ['B15003_017E','B15003_018E'], label: 'High School Diploma / GED' },
      some_college:    { tables: ['B15003_019E','B15003_020E'], label: 'Some College' },
      bachelors:       { table: 'B15003_022E', label: "Bachelor's Degree" },
      graduate:        { tables: ['B15003_023E','B15003_024E','B15003_025E'], label: 'Graduate / Professional Degree' },
    }
  }
};

// Collect all unique ACS variable codes needed
export function getAllVarCodes() {
  const codes = new Set();
  for (const cat of Object.values(VARIABLES)) {
    for (const v of Object.values(cat.vars)) {
      if (v.table) codes.add(v.table);
      if (v.tables) v.tables.forEach(t => codes.add(t));
    }
  }
  return [...codes];
}

// Geocode address using Census Geocoder (free, no key needed)
export async function geocodeAddress(address) {
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`;
  const res = await fetch(url);
  const data = await res.json();
  const matches = data?.result?.addressMatches;
  if (!matches || matches.length === 0) throw new Error('Address not found. Please try a more specific address.');
  const { x: lng, y: lat } = matches[0].coordinates;
  const matchedAddress = matches[0].matchedAddress;
  return { lat: parseFloat(lat), lng: parseFloat(lng), matchedAddress };
}

// Identify block groups within a radius using Turf (called client-side)
// On server: fetch block groups for relevant states/counties from Census API
export async function fetchBlockGroupsInRadius(lat, lng, radiusMiles, year, apiKey) {
  // Get the state/county FIPS for the center point
  const fipsUrl = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
  const fipsRes = await fetch(fipsUrl);
  const fipsData = await fipsRes.json();
  const geos = fipsData?.result?.geographies;
  const county = geos?.['Counties']?.[0];
  if (!county) throw new Error('Could not determine county for this location.');

  const stateFips = county.STATE;
  const countyFips = county.COUNTY;
  const cityName = geos?.['Incorporated Places']?.[0]?.NAME || geos?.['Census Designated Places']?.[0]?.NAME || null;
  const cityGeoId = geos?.['Incorporated Places']?.[0]?.GEOID || geos?.['Census Designated Places']?.[0]?.GEOID || null;
  const cityType = geos?.['Incorporated Places']?.[0] ? 'place' : geos?.['Census Designated Places']?.[0] ? 'place' : null;

  // Fetch block group centroids from Census TIGER for real radius filtering
  // We use the Census geocoder internal point endpoint to get centroids
  let bgCentroids = {};
  try {
    const tigerUrl = `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/10/query?where=STATE%3D'${stateFips}'%20AND%20COUNTY%3D'${countyFips}'&outFields=GEOID,INTPTLAT,INTPTLON&f=json&returnGeometry=false`;
    const tigerRes = await fetch(tigerUrl);
    const tigerData = await tigerRes.json();
    if (tigerData?.features) {
      for (const f of tigerData.features) {
        const { GEOID, INTPTLAT, INTPTLON } = f.attributes;
        bgCentroids[GEOID] = { lat: parseFloat(INTPTLAT), lng: parseFloat(INTPTLON) };
      }
    }
  } catch (e) {
    console.warn('TIGER centroid fetch failed, will use all block groups:', e.message);
  }

  return { stateFips, countyFips, cityName, cityGeoId, cityType, bgCentroids };
}

// Fetch ACS data for block groups (used for radius aggregation)
export async function fetchBlockGroupACS(stateFips, countyFips, year, apiKey) {
  const vars = getAllVarCodes();
  // Census API max is 50 vars per call; chunk if needed
  const chunks = chunkArray(vars, 48);
  const results = {};

  for (const chunk of chunks) {
    const varStr = ['NAME', ...chunk].join(',');
    const url = `https://api.census.gov/data/${year}/acs/acs5?get=${varStr}&for=block%20group:*&in=state:${stateFips}%20county:${countyFips}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Census API error: ${res.status} - ${text.substring(0,200)}`);
    }
    const data = await res.json();
    const headers = data[0];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const geoid = `${row[headers.indexOf('state')]}${row[headers.indexOf('county')]}${row[headers.indexOf('tract')]}${row[headers.indexOf('block group')]}`;
      if (!results[geoid]) results[geoid] = {};
      headers.forEach((h, idx) => { results[geoid][h] = row[idx]; });
    }
  }
  return results;
}

// Fetch ACS data for a specific geography (county, state, place)
export async function fetchGeoACS(geoType, stateFips, geoId, year, apiKey) {
  const vars = getAllVarCodes();
  const chunks = chunkArray(vars, 48);
  const merged = {};

  for (const chunk of chunks) {
    const varStr = ['NAME', ...chunk].join(',');
    let url;
    if (geoType === 'county') {
      url = `https://api.census.gov/data/${year}/acs/acs5?get=${varStr}&for=county:${geoId}&in=state:${stateFips}&key=${apiKey}`;
    } else if (geoType === 'state') {
      url = `https://api.census.gov/data/${year}/acs/acs5?get=${varStr}&for=state:${stateFips}&key=${apiKey}`;
    } else if (geoType === 'place') {
      const placeId = geoId.slice(-5);
      url = `https://api.census.gov/data/${year}/acs/acs5?get=${varStr}&for=place:${placeId}&in=state:${stateFips}&key=${apiKey}`;
    }
    const res = await fetch(url);
    if (!res.ok) continue;
    const data = await res.json();
    if (data.length < 2) continue;
    const headers = data[0];
    const row = data[1];
    headers.forEach((h, idx) => { merged[h] = row[idx]; });
  }
  return merged;
}

// Aggregate block group values for block groups inside radius
// bgData: { geoid: { var: value, ... } }
// insideGeoids: Set of GEOIDs inside radius
export function aggregateBlockGroups(bgData, insideGeoids) {
  const totals = {};

  // First pass: sum all countable variables, skipping negatives (Census N/A = -666666666)
  for (const geoid of insideGeoids) {
    const row = bgData[geoid];
    if (!row) continue;
    for (const [k, v] of Object.entries(row)) {
      if (!k.match(/^B\d/)) continue;
      const num = parseFloat(v);
      if (isNaN(num) || num < 0) continue; // skip N/A and negative sentinel values
      totals[k] = (totals[k] || 0) + num;
    }
  }

  // Second pass: weighted median for income variables
  // Median household income (B19013) — weight by number of households (B19001_001E)
  // Per capita income (B19301) — weight by total population (B01001_001E)
  const medianVars = [
    { var: 'B19013_001E', weightVar: 'B19001_001E' }, // median HH income weighted by HH count
    { var: 'B19301_001E', weightVar: 'B01001_001E' },  // per capita income weighted by population
  ];

  for (const { var: mv, weightVar } of medianVars) {
    let weightSum = 0, valSum = 0;
    for (const geoid of insideGeoids) {
      const row = bgData[geoid];
      if (!row) continue;
      const val = parseFloat(row[mv]);
      const weight = parseFloat(row[weightVar]);
      // Skip any block group with missing/negative/zero values
      if (isNaN(val) || val <= 0 || isNaN(weight) || weight <= 0) continue;
      valSum += val * weight;
      weightSum += weight;
    }
    if (weightSum > 0) totals[mv] = Math.round(valSum / weightSum);
    else delete totals[mv]; // no valid data — show as N/A
  }

  return totals;
}

// Compute derived metrics from raw ACS values
export function computeMetrics(raw) {
  const CENSUS_NA = -666666666;
  const out = {};
  for (const [catKey, cat] of Object.entries(VARIABLES)) {
    out[catKey] = {};
    for (const [vKey, vDef] of Object.entries(cat.vars)) {
      if (vDef.table) {
        const val = parseFloat(raw[vDef.table]);
        // Treat missing, NaN, or Census N/A sentinel as null
        out[catKey][vKey] = (!isNaN(val) && val > CENSUS_NA) ? val : null;
      } else if (vDef.tables) {
        // Sum multiple columns, skipping any N/A sentinels
        let total = 0;
        let hasValid = false;
        for (const t of vDef.tables) {
          const val = parseFloat(raw[t]);
          if (!isNaN(val) && val > CENSUS_NA) {
            total += val;
            hasValid = true;
          }
        }
        out[catKey][vKey] = hasValid ? total : null;
      } else {
        out[catKey][vKey] = null;
      }
    }
  }
  return out;
}

// Build full results table
export function buildResultsTable(radiusMetrics, countyMetrics, stateMetrics, cityMetrics) {
  const rows = [];
  for (const [catKey, cat] of Object.entries(VARIABLES)) {
    const totalPopKey = catKey === 'race' ? 'total_pop' : catKey === 'age' ? 'age_total' : catKey === 'income' ? 'poverty_universe' : 'edu_total';
    for (const [vKey, vDef] of Object.entries(cat.vars)) {
      if (vDef.hidden) continue;
      const r = radiusMetrics[catKey][vKey];
      const c = countyMetrics[catKey][vKey];
      const s = stateMetrics[catKey][vKey];
      const ci = cityMetrics ? cityMetrics[catKey][vKey] : null;

      const rTotal = radiusMetrics[catKey][totalPopKey];
      const cTotal = countyMetrics[catKey][totalPopKey];
      const sTotal = stateMetrics[catKey][totalPopKey];
      const ciTotal = cityMetrics ? cityMetrics[catKey][totalPopKey] : null;

      rows.push({
        category: cat.label,
        catKey,
        label: vDef.label,
        isCurrency: !!vDef.isCurrency,
        isMedian: !!vDef.isMedian,
        radius: r,
        radiusPct: (!vDef.isCurrency && rTotal && r !== null) ? (r / rTotal * 100) : null,
        city: ci,
        cityPct: (!vDef.isCurrency && ciTotal && ci !== null) ? (ci / ciTotal * 100) : null,
        county: c,
        countyPct: (!vDef.isCurrency && cTotal && c !== null) ? (c / cTotal * 100) : null,
        state: s,
        statePct: (!vDef.isCurrency && sTotal && s !== null) ? (s / sTotal * 100) : null,
      });
    }
  }
  return rows;
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}
