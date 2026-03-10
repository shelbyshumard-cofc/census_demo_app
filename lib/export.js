// lib/export.js

export function exportCSV(rows, meta) {
  const { address, radiusMiles, year, countyName, stateName, cityName } = meta;

  const headers = ['Category', 'Variable', 'Radius Count', 'Radius %'];
  if (cityName) { headers.push('City Count', 'City %'); }
  headers.push('County Count', 'County %', 'State Count', 'State %');

  const csvRows = [headers.join(',')];
  for (const row of rows) {
    const vals = [
      `"${row.category}"`,
      `"${row.label}"`,
      row.radius ?? '',
      row.radiusPct !== null && row.radiusPct !== undefined ? row.radiusPct.toFixed(1) : '',
    ];
    if (cityName) {
      vals.push(row.city ?? '', row.cityPct !== null && row.cityPct !== undefined ? row.cityPct.toFixed(1) : '');
    }
    vals.push(
      row.county ?? '', row.countyPct !== null && row.countyPct !== undefined ? row.countyPct.toFixed(1) : '',
      row.state ?? '', row.statePct !== null && row.statePct !== undefined ? row.statePct.toFixed(1) : '',
    );
    csvRows.push(vals.join(','));
  }

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `demographics_${year}_${radiusMiles}mi.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportExcel(rows, meta) {
  const XLSX = await import('xlsx');
  const { address, radiusMiles, year, countyName, stateName, cityName } = meta;

  const wb = XLSX.utils.book_new();

  // Group rows by category
  const categories = [...new Set(rows.map(r => r.category))];
  for (const cat of categories) {
    const catRows = rows.filter(r => r.category === cat);
    const headers = ['Variable', 'Radius'];
    if (cityName) headers.push(cityName.split(',')[0]);
    headers.push(countyName || 'County', stateName || 'State');

    const sheetData = [
      [`ACS ${year} — ${cat}`],
      [`Address: ${address} | Radius: ${radiusMiles} mile(s)`],
      [],
      headers,
      ...catRows.map(r => {
        const vals = [
          r.label,
          r.isCurrency ? (r.radius ? `$${Math.round(r.radius).toLocaleString()}` : '—') : (r.radius ?? '—'),
        ];
        if (cityName) {
          vals.push(r.isCurrency ? (r.city ? `$${Math.round(r.city).toLocaleString()}` : '—') : (r.city ?? '—'));
        }
        vals.push(
          r.isCurrency ? (r.county ? `$${Math.round(r.county).toLocaleString()}` : '—') : (r.county ?? '—'),
          r.isCurrency ? (r.state ? `$${Math.round(r.state).toLocaleString()}` : '—') : (r.state ?? '—'),
        );
        return vals;
      })
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!cols'] = [{ wch: 32 }, { wch: 16 }, ...(cityName ? [{ wch: 16 }] : []), { wch: 20 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, cat.substring(0, 31));
  }

  XLSX.writeFile(wb, `demographics_${year}_${radiusMiles}mi.xlsx`);
}
