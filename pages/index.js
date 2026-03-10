// pages/index.js
import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { ACS_YEARS } from '../lib/census';
import { exportCSV, exportExcel } from '../lib/export';
import DataTable from '../components/DataTable';

// Dynamically import map to avoid SSR issues with Leaflet
const DemographicsMap = dynamic(() => import('../components/DemographicsMap'), { ssr: false });

const RADIUS_OPTIONS = [1, 5, 10];

export default function Home() {
  const [address, setAddress] = useState('');
  const [radius, setRadius] = useState(5);
  const [year, setYear] = useState(ACS_YEARS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [tableRows, setTableRows] = useState(null);

  const handleSearch = useCallback(async () => {
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setTableRows(null);

    try {
      const res = await fetch('/api/demographics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({ address: address.trim(), radiusMiles: radius, year }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch data');

      setResult(data);
      setTableRows(data.tableRows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [address, radius, year]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleExportCSV = () => {
    if (!tableRows || !result) return;
    exportCSV(tableRows, {
      address: result.matchedAddress,
      radiusMiles: radius,
      year,
      countyName: result.countyName,
      stateName: result.stateName,
      cityName: result.cityName,
    });
  };

  const handleExportExcel = async () => {
    if (!tableRows || !result) return;
    await exportExcel(tableRows, {
      address: result.matchedAddress,
      radiusMiles: radius,
      year,
      countyName: result.countyName,
      stateName: result.stateName,
      cityName: result.cityName,
    });
  };

  const handlePrint = () => window.print();

  const hasResults = !!tableRows && !!result;

  return (
    <>
      <Head>
        <title>Demographics Radius Tool</title>
        <meta name="description" content="Explore U.S. Census demographic data for any address and radius" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="app-shell">
        {/* Header */}
        <header className="header">
          <div>
            <div className="header-logo">Demographics <span>Radius</span> Tool</div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <div className="header-sub">U.S. Census ACS · American Community Survey</div>
          </div>
        </header>

        {/* Main layout */}
        <div className="main-layout">
          {/* Sidebar */}
          <aside className="sidebar">
            <div className="sidebar-inner">
              <div className="sidebar-title">Search Parameters</div>

              {/* Address */}
              <div className="field-group">
                <label className="field-label" htmlFor="address-input">Address</label>
                <div className="address-input-wrap">
                  <input
                    id="address-input"
                    type="text"
                    className="address-input"
                    placeholder="123 King St, Charleston, SC"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    onKeyDown={handleKeyDown}
                    aria-label="Enter an address"
                  />
                </div>
              </div>

              {/* Radius */}
              <div className="field-group">
                <label className="field-label">Radius</label>
                <div className="radius-toggle" role="group" aria-label="Select radius">
                  {RADIUS_OPTIONS.map(r => (
                    <button
                      key={r}
                      className={`radius-btn ${radius === r ? 'active' : ''}`}
                      onClick={() => setRadius(r)}
                      aria-pressed={radius === r}
                    >
                      {r} {r === 1 ? 'mile' : 'miles'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Year */}
              <div className="field-group">
                <label className="field-label" htmlFor="year-select">
                  ACS Survey Year
                </label>
                <select
                  id="year-select"
                  className="year-select"
                  value={year}
                  onChange={e => setYear(Number(e.target.value))}
                  aria-label="Select ACS survey year"
                >
                  {ACS_YEARS.map(y => (
                    <option key={y} value={y}>{y} (5-Year Estimates)</option>
                  ))}
                </select>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.5, marginTop: '0.2rem' }}>
                  ACS 5-year estimates represent an average over a 5-year period ending in the selected year.
                </p>
              </div>

              {/* Error */}
              {error && <div className="error-banner" role="alert">⚠️ {error}</div>}

              {/* Submit */}
              <button
                className="search-btn"
                onClick={handleSearch}
                disabled={loading || !address.trim()}
                aria-busy={loading}
              >
                {loading ? (
                  <>
                    <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    Fetching data…
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                    Get Demographics
                  </>
                )}
              </button>

              {/* Result summary */}
              {hasResults && (
                <div className="result-meta">
                  <div className="result-meta-address">📍 {result.matchedAddress}</div>
                  <div className="result-meta-detail">
                  <span className="result-meta-badge">{radius} mi</span>
                  <span className="result-meta-badge" style={{ background: 'var(--teal)' }}>{year}</span>
                  {result.cityName && <div style={{ marginTop: '0.3rem' }}>City: {result.cityName}</div>}
                  <div>County: {result.countyName}</div>
                  <div>State: {result.stateName}</div>
                  <div style={{ marginTop: '0.3rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {result.blockGroupsInRadius} of {result.blockGroupsTotal} block groups in radius
                  </div>
                </div>
                </div>
              )}

              {/* Export */}
              <div>
                <div className="sidebar-title" style={{ marginBottom: '0.5rem' }}>Export Results</div>
                <div className="export-row">
                  <button className="export-btn" onClick={handleExportCSV} disabled={!hasResults} title="Download as CSV">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    CSV
                  </button>
                  <button className="export-btn" onClick={handleExportExcel} disabled={!hasResults} title="Download as Excel">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Excel
                  </button>
                  <button className="export-btn" onClick={handlePrint} disabled={!hasResults} title="Print view">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                    Print
                  </button>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="disclaimer">
                Data sourced from the U.S. Census Bureau American Community Survey (ACS) 5-Year Estimates.
                Radius figures are approximations based on Census block group boundaries.
                Not for use in official legal or governmental filings.
              </div>
            </div>
          </aside>

          {/* Right panel: Map + Table */}
          <div className="right-panel">
            {/* Map */}
            <div className="map-container" style={{ position: 'relative' }}>
              <DemographicsMap
                lat={result?.lat}
                lng={result?.lng}
                radiusMiles={radius}
              />
              {loading && (
                <div className="loading-overlay">
                  <div className="spinner" />
                  <div className="loading-text">Fetching Census data…</div>
                </div>
              )}
            </div>

            {/* Data table or empty state */}
            {hasResults ? (
              <DataTable
                rows={tableRows}
                cityName={result.cityName}
                countyName={result.countyName}
                stateName={result.stateName}
                year={year}
              />
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">🗺️</div>
                <h3>Enter an address to get started</h3>
                <p>
                  Search any U.S. address to explore demographic data for a 1, 5, or 10-mile radius, with county, city, and state comparisons.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
