/**
 * Utility functions for exporting data to CSV and generating formatted PDF printable reports.
 * Includes robust multi-method fallbacks for sandboxed iFrames and popup blockers.
 */

export interface ExportColumn {
  key: string;
  label: string;
}

/**
 * Converts array of objects to a downloadable CSV file.
 * Multi-layer fallback for iFrame sandboxes (Blob -> Data URI -> Clipboard fail-safe).
 */
export function exportToCSV(filename: string, rows: Record<string, any>[], columns: ExportColumn[]) {
  if (!rows || rows.length === 0) {
    alert('No data available to export.');
    return;
  }

  const cols = columns && columns.length > 0 
    ? columns 
    : Object.keys(rows[0]).map(key => ({ key, label: key.toUpperCase() }));

  const headers = cols.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');
  const rowData = rows.map(row => {
    return cols.map(c => {
      let val = row[c.key];
      if (val === null || val === undefined) val = '';
      if (typeof val === 'object') val = JSON.stringify(val);
      const strVal = String(val).replace(/"/g, '""');
      return `"${strVal}"`;
    }).join(',');
  });

  const csvContent = [headers, ...rowData].join('\n');
  const cleanFilename = `${filename.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;

  let success = false;

  // Method 1: Standard Blob with <a download>
  try {
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', cleanFilename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1500);
    success = true;
  } catch (err) {
    console.warn('Blob URL download failed:', err);
  }

  // Method 2: Data URI Fallback (Only if Method 1 failed)
  if (!success) {
    try {
      const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent('\uFEFF' + csvContent);
      const link = document.createElement('a');
      link.href = encodedUri;
      link.setAttribute('download', cleanFilename);
      link.setAttribute('target', '_blank');
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) document.body.removeChild(link);
      }, 1500);
      success = true;
    } catch (fallbackErr) {
      console.warn('Data URI download failed:', fallbackErr);
    }
  }

  // Fail-safe: Copy CSV content to user clipboard if all methods fail
  if (!success && navigator.clipboard) {
    navigator.clipboard.writeText(csvContent).catch(() => {});
  }
}

/**
 * Generates an executive PDF / Printable Report with Aperture branding,
 * formatted tables, timestamp, summary statistics, and triggers standard print/PDF save.
 * Uses print iFrame fallback if popup windows are blocked.
 */
export function generatePDFReport(
  title: string,
  subtitle: string,
  columns: ExportColumn[],
  rows: Record<string, any>[],
  summaryMetrics?: { label: string; value: string | number }[]
) {
  if (!rows || rows.length === 0) {
    alert('No data available to generate report.');
    return;
  }

  const cols = columns && columns.length > 0 
    ? columns 
    : Object.keys(rows[0]).map(key => ({ key, label: key.toUpperCase() }));

  const dateStr = new Date().toLocaleString();

  const metricsHtml = summaryMetrics && summaryMetrics.length > 0 ? `
    <div style="display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap;">
      ${summaryMetrics.map(m => `
        <div style="flex: 1; min-width: 140px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 16px; border-radius: 8px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">${m.label}</div>
          <div style="font-size: 20px; font-weight: 800; color: #0f172a;">${m.value}</div>
        </div>
      `).join('')}
    </div>
  ` : '';

  const tableHeadersHtml = cols.map(c => `
    <th style="background-color: #f1f5f9; color: #334155; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 10px 12px; text-align: left; border-bottom: 2px solid #cbd5e1;">${c.label}</th>
  `).join('');

  const tableRowsHtml = rows.map((row, idx) => `
    <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      ${cols.map(c => {
        let val = row[c.key];
        if (val === null || val === undefined) val = '-';
        if (typeof val === 'boolean') val = val ? 'Yes' : 'No';
        if (typeof val === 'object') val = JSON.stringify(val);
        return `<td style="padding: 10px 12px; font-size: 12px; color: #334155; border-bottom: 1px solid #e2e8f0;">${val}</td>`;
      }).join('')}
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title} - Official Aperture RFID Report</title>
        <style>
          @page { size: A4 landscape; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 24px; color: #0f172a; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #007BC4; padding-bottom: 16px; margin-bottom: 20px; }
          .logo-title { display: flex; align-items: center; gap: 12px; }
          .brand-badge { background-color: #007BC4; color: white; font-weight: 900; font-size: 16px; padding: 6px 12px; border-radius: 6px; letter-spacing: 1px; }
          .title-area h1 { margin: 0; font-size: 22px; font-weight: 800; color: #0f172a; }
          .title-area p { margin: 4px 0 0 0; font-size: 13px; color: #64748b; font-weight: 500; }
          .meta-info { text-align: right; font-size: 11px; color: #64748b; line-height: 1.5; }
          .meta-info strong { color: #334155; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
          .no-print { margin-bottom: 20px; padding: 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
          .btn-print { background: #007BC4; color: white; border: none; font-weight: 700; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; }
          .btn-print:hover { background: #006aa9; }
          @media print { .no-print { display: none !important; } }
        </style>
      </head>
      <body>
        <div class="no-print">
          <div>
            <strong style="color: #1e40af;">Aperture RFID System - Ready to Export PDF</strong>
            <span style="font-size: 12px; color: #3b82f6; margin-left: 8px;">Click Print to save directly as PDF or send to printer.</span>
          </div>
          <button class="btn-print" onclick="window.print()">Print / Save PDF</button>
        </div>

        <div class="header">
          <div class="logo-title">
            <div class="brand-badge">Aperture RFID</div>
            <div class="title-area">
              <h1>${title}</h1>
              <p>${subtitle}</p>
            </div>
          </div>
          <div class="meta-info">
            <div>Generated On: <strong>${dateStr}</strong></div>
            <div>Total Records: <strong>${rows.length}</strong></div>
            <div>Security Domain: <strong>Aperture Security Domain</strong></div>
          </div>
        </div>

        ${metricsHtml}

        <table>
          <thead>
            <tr>${tableHeadersHtml}</tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>

        <div class="footer">
          <span>Confidential - Aperture RFID System Generated Compliance Audit Report</span>
          <span>Page 1 of 1</span>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `;

  let reportWindow: Window | null = null;
  try {
    reportWindow = window.open('', '_blank');
  } catch (e) {
    reportWindow = null;
  }

  if (reportWindow) {
    reportWindow.document.write(html);
    reportWindow.document.close();
  } else {
    // Popup was blocked: Fallback to hidden iFrame print trigger
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 3000);
      }, 500);
    }
  }
}
