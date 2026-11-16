import XLSX, { type CellStyle, type WorkBook, type WorkSheet } from 'xlsx-js-style';
import type { CategoryType, HandoverReport, ShiftType } from '../types/handover';
import {
  computeCaseDurations,
  countMilitaryInReport,
  countStabilityInReport,
  formatDateTimeId,
  getTodayDateString,
  type CaseDurationItem,
} from './handoverLogic';

const THIN_BORDER = {
  top: { style: 'thin' as const, color: { rgb: 'CBD5E1' } },
  bottom: { style: 'thin' as const, color: { rgb: 'CBD5E1' } },
  left: { style: 'thin' as const, color: { rgb: 'CBD5E1' } },
  right: { style: 'thin' as const, color: { rgb: 'CBD5E1' } },
};

const HEADER_BORDER = {
  top: { style: 'thin' as const, color: { rgb: '0F294A' } },
  bottom: { style: 'medium' as const, color: { rgb: '0F294A' } },
  left: { style: 'thin' as const, color: { rgb: '334155' } },
  right: { style: 'thin' as const, color: { rgb: '334155' } },
};

const TOTAL_BORDER = {
  top: { style: 'medium' as const, color: { rgb: '0F294A' } },
  bottom: { style: 'medium' as const, color: { rgb: '0F294A' } },
  left: { style: 'thin' as const, color: { rgb: 'CBD5E1' } },
  right: { style: 'thin' as const, color: { rgb: 'CBD5E1' } },
};

const SHIFT_COLORS: Record<ShiftType, { bg: string; fg: string }> = {
  'Shift 1': { bg: 'E0F2FE', fg: '075985' },
  'Shift 2': { bg: 'E0E7FF', fg: '3730A3' },
  'Shift 3': { bg: 'F3E8FF', fg: '6B21A8' },
};

const CATEGORY_COLORS: Record<CategoryType, { bg: string; fg: string }> = {
  OVERHAUL: { bg: 'FEF3C7', fg: '92400E' },
  'STABILITY TINGGI': { bg: 'DBEAFE', fg: '1E40AF' },
  'CASE PERBAIKAN PART': { bg: 'FFE4E6', fg: '9F1239' },
  'COMMISSIONING / TRIAL / CHANGE OVER': { bg: 'EDE9FE', fg: '5B21B6' },
};

function computeColumnWidths(
  dataRows: (string | number)[][],
  limits: { min: number; max: number }[]
): { wch: number }[] {
  if (dataRows.length === 0) return limits.map((l) => ({ wch: l.min }));
  return limits.map((limit, colIdx) => {
    let maxLen = limit.min;
    for (const row of dataRows) {
      const cell = row[colIdx];
      const text = cell === null || cell === undefined ? '' : String(cell);
      const longestLine = text
        .split('\n')
        .reduce((acc, line) => Math.max(acc, line.length), 0);
      if (longestLine + 3 > maxLen) {
        maxLen = longestLine + 3;
      }
    }
    return { wch: Math.min(maxLen, limit.max) };
  });
}

function estimateRowHeight(row: (string | number)[], colWidths: { wch: number }[]): number {
  let maxVisualLines = 1;
  for (let c = 0; c < row.length; c += 1) {
    const text = row[c] === null || row[c] === undefined ? '' : String(row[c]);
    const usableWidth = Math.max(8, (colWidths[c]?.wch ?? 16) - 2);
    const paragraphs = text.split('\n');
    let totalLines = 0;
    for (const p of paragraphs) {
      totalLines += Math.max(1, Math.ceil(p.length / usableWidth));
    }
    if (totalLines > maxVisualLines) {
      maxVisualLines = totalLines;
    }
  }
  return Math.max(22, Math.min(180, maxVisualLines * 15 + 8));
}

function ensureStyledCell(ws: WorkSheet, r: number, c: number, style: CellStyle) {
  const addr = XLSX.utils.encode_cell({ r, c });
  if (!ws[addr]) {
    ws[addr] = { t: 's', v: '' };
  }
  ws[addr].s = style;
}

export function buildHandoverFilename(dateStr: string = getTodayDateString()): string {
  return `HANDOVER_${dateStr}.xlsx`;
}

export function buildHandoverWorkbook(reports: HandoverReport[]): WorkBook {
  const wb = XLSX.utils.book_new();
  const durations = computeCaseDurations(reports);
  const durationByCountedReportId = new Map<string, CaseDurationItem>();
  for (const item of durations) {
    for (const repId of item.countedReportIds) {
      durationByCountedReportId.set(repId, item);
    }
  }

  let grandTotalMilitary = 0;
  let grandTotalStability = 0;
  for (const r of reports) {
    grandTotalMilitary += countMilitaryInReport(r);
    grandTotalStability += countStabilityInReport(r);
  }

  const completedCount = reports.filter((r) => r.isCompleted).length;
  const openCount = reports.length - completedCount;
  const exportedAt = formatDateTimeId(new Date().toISOString());

  const title = 'DETAIL DATA SHIFT HANDOVER — MILITARY & STABILITY';
  const subtitle = `Ringkasan: ${reports.length} Laporan • ${durations.length} Case (${completedCount} OK / ${openCount} Berlanjut) • Total Military: ${grandTotalMilitary} • Total Stability: ${grandTotalStability}  |  Diekspor: ${exportedAt}`;

  const headers = [
    'ID',
    'Tanggal',
    'Shift',
    'Kategori',
    'Mesin',
    'Update Shift / Informasi / Keterangan',
    'Masalah',
    'Tindak Lanjut',
    'Lokasi Palet',
    'Status',
    'Total Durasi',
    'Total Military',
    'Total Stability',
    'Pembuat',
    'Waktu Dibuat',
    'Waktu Diperbarui',
  ];

  const dataRows: (string | number)[][] = reports.map((r) => {
    const dur = durationByCountedReportId.get(r.id);
    const durLabel =
      dur && dur.durationShifts > 0 ? `${dur.durationShifts} Shift` : '0 Shift';
    const militaryCount = countMilitaryInReport(r);
    const stabilityCount = countStabilityInReport(r);

    return [
      r.id,
      r.reportDate,
      r.shift,
      r.category,
      r.machine ?? '-',
      r.information,
      r.issue || '-',
      r.followUp || '-',
      r.palletLocation || '-',
      r.isCompleted ? 'OK (Selesai)' : 'Berlanjut',
      durLabel,
      militaryCount,
      stabilityCount,
      r.createdByName,
      formatDateTimeId(r.createdAt),
      formatDateTimeId(r.updatedAt),
    ];
  });

  const colCount = headers.length;
  const totalRow: (string | number)[] = [
    '',
    '',
    '',
    '',
    'TOTAL KESELURUHAN',
    '',
    '',
    '',
    '',
    `${reports.length} Laporan`,
    '',
    grandTotalMilitary,
    grandTotalStability,
    '',
    '',
    '',
  ];

  const allRows: (string | number)[][] = [
    [title, ...Array(colCount - 1).fill('')],
    [subtitle, ...Array(colCount - 1).fill('')],
    Array(colCount).fill(''),
    headers,
    ...dataRows,
    totalRow,
  ];

  const ws = XLSX.utils.aoa_to_sheet(allRows);
  const colWidths = computeColumnWidths([headers, ...dataRows, totalRow], [
    { min: 14, max: 24 }, // 0: ID
    { min: 13, max: 15 }, // 1: Tanggal
    { min: 10, max: 12 }, // 2: Shift
    { min: 24, max: 34 }, // 3: Kategori
    { min: 14, max: 20 }, // 4: Mesin
    { min: 32, max: 46 }, // 5: Update Shift / Informasi / Keterangan
    { min: 22, max: 38 }, // 6: Masalah
    { min: 22, max: 38 }, // 7: Tindak Lanjut
    { min: 18, max: 28 }, // 8: Lokasi Palet
    { min: 14, max: 16 }, // 9: Status
    { min: 14, max: 16 }, // 10: Total Durasi
    { min: 14, max: 16 }, // 11: Total Military
    { min: 14, max: 16 }, // 12: Total Stability
    { min: 16, max: 24 }, // 13: Pembuat
    { min: 18, max: 22 }, // 14: Waktu Dibuat
    { min: 18, max: 22 }, // 15: Waktu Diperbarui
  ]);
  ws['!cols'] = colWidths;

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
  ];

  const titleStyle: CellStyle = {
    font: { name: 'Calibri', sz: 13, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: '0F294A' } },
    alignment: { vertical: 'center', horizontal: 'left' },
  };
  const subtitleStyle: CellStyle = {
    font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: '1E293B' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'E2E8F0' } },
    alignment: { vertical: 'center', horizontal: 'left' },
    border: {
      bottom: { style: 'thin', color: { rgb: '94A3B8' } },
    },
  };

  for (let c = 0; c < colCount; c += 1) {
    ensureStyledCell(ws, 0, c, titleStyle);
    ensureStyledCell(ws, 1, c, subtitleStyle);
  }

  const centeredCols = new Set([1, 2, 9, 10, 11, 12]);
  for (let c = 0; c < colCount; c += 1) {
    ensureStyledCell(ws, 3, c, {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: '1E3A5F' } },
      alignment: {
        vertical: 'center',
        horizontal: centeredCols.has(c) ? 'center' : 'left',
        wrapText: true,
      },
      border: HEADER_BORDER,
    });
  }

  const rowHeights: { hpt: number }[] = [
    { hpt: 30 },
    { hpt: 20 },
    { hpt: 8 },
    { hpt: 28 },
  ];

  for (let i = 0; i < reports.length; i += 1) {
    const r = 4 + i;
    const report = reports[i];
    const rowData = dataRows[i];
    const durItem = durationByCountedReportId.get(report.id);
    const isCompleted = Boolean(report.isCompleted);
    const caseCompleted = durItem ? durItem.isCompleted : isCompleted;
    const hasStartedDur = Boolean(durItem && durItem.durationShifts > 0);
    const baseBg = isCompleted ? 'F0FDF4' : i % 2 === 0 ? 'FFFFFF' : 'F8FAFC';

    for (let c = 0; c < colCount; c += 1) {
      const rawVal = String(rowData[c] ?? '');
      const numVal = typeof rowData[c] === 'number' ? (rowData[c] as number) : 0;
      const isMutedDash = rawVal === '-';

      let fillRgb = baseBg;
      let fontColor = isMutedDash ? '64748B' : '0F172A';
      let bold = false;
      let horizontal: 'left' | 'center' | 'right' = 'left';

      if (c === 0) {
        fontColor = '475569';
      } else if (c === 1) {
        horizontal = 'center';
        bold = true;
      } else if (c === 2) {
        const sc = SHIFT_COLORS[report.shift];
        fillRgb = sc.bg;
        fontColor = sc.fg;
        bold = true;
        horizontal = 'center';
      } else if (c === 3) {
        const cc = CATEGORY_COLORS[report.category];
        fillRgb = cc.bg;
        fontColor = cc.fg;
        bold = true;
      } else if (c === 4) {
        bold = true;
      } else if (c === 9) {
        horizontal = 'center';
        bold = true;
        if (isCompleted) {
          fillRgb = 'BBF7D0';
          fontColor = '14532D';
        } else {
          fillRgb = 'FEF3C7';
          fontColor = '92400E';
        }
      } else if (c === 10) {
        horizontal = 'center';
        bold = hasStartedDur;
        if (!hasStartedDur) {
          fillRgb = baseBg;
          fontColor = '64748B';
        } else {
          fillRgb = caseCompleted ? 'DCFCE7' : 'DBEAFE';
          fontColor = caseCompleted ? '14532D' : '0F294A';
        }
      } else if (c === 11) {
        horizontal = 'center';
        bold = numVal > 0;
        fillRgb = numVal > 0 ? 'E0E7FF' : baseBg;
        fontColor = numVal > 0 ? '3730A3' : '94A3B8';
      } else if (c === 12) {
        horizontal = 'center';
        bold = numVal > 0;
        fillRgb = numVal > 0 ? 'CCFBF1' : baseBg;
        fontColor = numVal > 0 ? '115E59' : '94A3B8';
      }

      ensureStyledCell(ws, r, c, {
        font: {
          name: 'Calibri',
          sz: 10,
          bold,
          color: { rgb: fontColor },
        },
        fill: {
          patternType: 'solid',
          fgColor: { rgb: fillRgb },
        },
        alignment: {
          vertical: 'top',
          horizontal,
          wrapText: true,
        },
        border: THIN_BORDER,
      });
    }

    rowHeights.push({ hpt: estimateRowHeight(rowData, colWidths) });
  }

  // Baris TOTAL KESELURUHAN di bawah tabel
  const totalRowIdx = 4 + reports.length;
  for (let c = 0; c < colCount; c += 1) {
    const isCentered = c === 9 || c === 11 || c === 12;
    ensureStyledCell(ws, totalRowIdx, c, {
      font: {
        name: 'Calibri',
        sz: 10,
        bold: true,
        color: { rgb: c === 11 ? '3730A3' : c === 12 ? '115E59' : '0F294A' },
      },
      fill: {
        patternType: 'solid',
        fgColor: { rgb: c === 11 ? 'E0E7FF' : c === 12 ? 'CCFBF1' : 'F1F5F9' },
      },
      alignment: {
        vertical: 'center',
        horizontal: isCentered ? 'center' : 'left',
      },
      border: TOTAL_BORDER,
    });
  }
  rowHeights.push({ hpt: 26 });

  const lastCol = XLSX.utils.encode_col(Math.max(0, colCount - 1));
  const lastDataRowExcel = Math.max(4, 4 + reports.length);
  ws['!autofilter'] = { ref: `A4:${lastCol}${lastDataRowExcel}` };
  ws['!rows'] = rowHeights;
  (ws as Record<string, unknown>)['!views'] = [
    { state: 'frozen', ySplit: 4, topLeftCell: 'A5', activePane: 'bottomLeft' },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'DETAIL DATA');
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
