// components/DataTable.js
import { useState } from 'react';
import { VARIABLES } from '../lib/census';

const CATEGORY_KEYS = Object.keys(VARIABLES);
const CATEGORY_LABELS = Object.fromEntries(
  Object.entries(VARIABLES).map(([k, v]) => [k, v.label])
);

function fmt(val, isCurrency, isMedian) {
  if (val === null || val === undefined || isNaN(val)) return '—';
  if (isCurrency) return '$' + Math.round(val).toLocaleString();
  return Math.round(val).toLocaleString();
}

function fmtPct(val) {
  if (val === null || val === undefined || isNaN(val)) return null;
  return val.toFixed(1) + '%';
}

export default function DataTable({ rows, cityName, countyName, stateName, year }) {
  const [activeTab, setActiveTab] = useState(CATEGORY_KEYS[0]);

  const visibleRows = rows.filter(r => r.catKey === activeTab);

  return (
    <div className="results-panel">
      <div className="category-tabs">
        {CATEGORY_KEYS.map(k => (
          <button
            key={k}
            className={`cat-tab ${activeTab === k ? 'active' : ''}`}
            onClick={() => setActiveTab(k)}
          >
            {CATEGORY_LABELS[k]}
          </button>
        ))}
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '28%' }}>Variable</th>
              <th>
                <div className="col-header-geo">
                  <span className="geo-dot" style={{ background: '#2563eb' }} />
                  Radius Area
                </div>
              </th>
              {cityName && (
                <th>
                  <div className="col-header-geo">
                    <span className="geo-dot" style={{ background: '#7c3aed' }} />
                    {cityName.length > 14 ? cityName.split(',')[0] : cityName}
                  </div>
                </th>
              )}
              <th>
                <div className="col-header-geo">
                  <span className="geo-dot" style={{ background: '#0d9488' }} />
                  {countyName?.replace(' County', '') || 'County'}
                </div>
              </th>
              <th>
                <div className="col-header-geo">
                  <span className="geo-dot" style={{ background: '#d97706' }} />
                  {stateName || 'State'}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => (
              <tr key={i} className={row.label.includes('Total') ? 'total-row' : ''}>
                <td className="td-label">{row.label}</td>

                {/* Radius */}
                <td>
                  <div className="td-value col-radius">{fmt(row.radius, row.isCurrency)}</div>
                  {!row.isCurrency && fmtPct(row.radiusPct) && (
                    <div className="td-pct">{fmtPct(row.radiusPct)}</div>
                  )}
                </td>

                {/* City */}
                {cityName && (
                  <td>
                    <div className="td-value col-city">{fmt(row.city, row.isCurrency)}</div>
                    {!row.isCurrency && fmtPct(row.cityPct) && (
                      <div className="td-pct">{fmtPct(row.cityPct)}</div>
                    )}
                  </td>
                )}

                {/* County */}
                <td>
                  <div className="td-value col-county">{fmt(row.county, row.isCurrency)}</div>
                  {!row.isCurrency && fmtPct(row.countyPct) && (
                    <div className="td-pct">{fmtPct(row.countyPct)}</div>
                  )}
                </td>

                {/* State */}
                <td>
                  <div className="td-value col-state">{fmt(row.state, row.isCurrency)}</div>
                  {!row.isCurrency && fmtPct(row.statePct) && (
                    <div className="td-pct">{fmtPct(row.statePct)}</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.75rem', lineHeight: 1.6 }}>
          ACS {year} 5-Year Estimates. Radius figures are approximations based on Census block groups whose centroids fall within the selected radius. Values of — indicate data unavailable for that geography.
        </p>
      </div>
    </div>
  );
}
