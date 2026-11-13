import * as XLSX from 'xlsx';
import type { HandoverReport } from '../types/handover';
import { formatDateTimeId, getTodayDateString } from './handoverLogic';

function computeColumnWidths(rows: (string | number)[][], minWidth = 12, maxWidth = 52) {
  if (rows.length === 0) return [];
  const colCount = rows[0].length;
  const widths: { wch: number }[] = [];

  for (let colIdx = 0; colIdx < colCount; colIdx += 1) {
    let maxLen = minWidth;
    for (const row of rows) {
      const cell = row[colIdx];
      const text = cell === null || cell === undefined ? '' : String(cell);
      const longestLine = text
        .split('\n')
        .reduce((acc, line) => Math.max(acc, line.length), 0);
      if (longestLine + 3 > maxLen) {
        maxLen = longestLine + 3;
      }
    }
    widths.push({ wch: Math.min(maxLen, maxWidth) });
  }

  return widths;
}

function sortForHandoverSheet(reports: HandoverReport[]): HandoverReport[] {
  return [...reports].sort((a, b) => {
    if (a.reportDate !== b.reportDate) {
      return b.reportDate.localeCompare(a.reportDate);
    }
    if (a.shift !== b.shift) {
      return a.shift.localeCompare(b.shift);
    }
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return (a.machine ?? '').localeCompare(b.machine ?? '');
  });
}

function applyHeaderFormatting(ws: XLSX.WorkSheet, columnCount: number, rowCount: number) {
  for (let c = 0; c < columnCount; c += 1) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) {
      ws[addr].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '0F294A' } },
        alignment: { vertical: 'center', horizontal: 'left' },
      };
    }
  }

  const lastCol = XLSX.utils.encode_col(Math.max(0, columnCount - 1));
  const lastRow = Math.max(1, rowCount);
  ws['!autofilter'] = { ref: `A1:${lastCol}${lastRow}` };
  ws['!rows'] = [{ hpt: 24 }];
  (ws as Record<string, unknown>)['!views'] = [
    { state: 'frozen', ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' },
  ];
}

export function buildHandoverFilename(dateStr: string = getTodayDateString()): string {
  return `HANDOVER_${dateStr}.xlsx`;
}

export function buildHandoverWorkbook(reports: HandoverReport[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const sortedHandover = sortForHandoverSheet(reports);

  // Sheet 1: HANDOVER (ringkas & terkelompok rapi)
  const handoverHeader = [
    'Tanggal',
    'Shift',
    'Kategori',
    'Mesin',
    'Informasi',
    'Masalah',
    'Tindak Lanjut',
  ];

  const handoverRows: (string | number)[][] = [
    handoverHeader,
    ...sortedHandover.map((r) => [
      r.reportDate,
      r.shift,
      r.category,
      r.machine ?? '-',
      r.information,
      r.issue || '-',
      r.followUp || '-',
    ]),
  ];

  const wsHandover = XLSX.utils.aoa_to_sheet(handoverRows);
  wsHandover['!cols'] = computeColumnWidths(handoverRows, 14, 54);
  applyHeaderFormatting(wsHandover, handoverHeader.length, handoverRows.length);
  XLSX.utils.book_append_sheet(wb, wsHandover, 'HANDOVER');

  // Sheet 2: DETAIL DATA (data mentah lengkap + audit trail)
  const detailHeader = [
    'ID',
    'Tanggal',
    'Shift',
    'Kategori',
    'Mesin',
    'Informasi',
    'Masalah',
    'Tindak Lanjut',
    'Pembuat',
    'Waktu Dibuat',
    'Waktu Diperbarui',
  ];

  const detailRows: (string | number)[][] = [
    detailHeader,
    ...reports.map((r) => [
      r.id,
      r.reportDate,
      r.shift,
      r.category,
      r.machine ?? '-',
      r.information,
      r.issue || '-',
      r.followUp || '-',
      r.createdByName,
      formatDateTimeId(r.createdAt),
      formatDateTimeId(r.updatedAt),
    ]),
  ];

  const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
  wsDetail['!cols'] = computeColumnWidths(detailRows, 14, 54);
  applyHeaderFormatting(wsDetail, detailHeader.length, detailRows.length);
  XLSX.utils.book_append_sheet(wb, wsDetail, 'DETAIL DATA');

  return wb;
}

export function downloadHandoverExcel(
  reports: HandoverReport[],
  filename: string = buildHandoverFilename()
): { filename: string; rowCount: number } {
  const wb = buildHandoverWorkbook(reports);
  XLSX.writeFile(wb, filename);
  return { filename, rowCount: reports.length };
}
