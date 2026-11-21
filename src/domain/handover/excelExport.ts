import XLSX, { type CellStyle, type WorkBook, type WorkSheet } from 'xlsx-js-style';
import type { CategoryType, HandoverReport, ShiftType } from '../../shared/types/handover';
import {
  computeCaseDurations,
  countMilitaryInReport,
  countStabilityInReport,
  formatDateTimeId,
  formatStabilityPhaseLabel,
  type CaseDurationItem,
} from './handoverLogic';

const THIN_BORDER = {
  top: { style: 'thin' as const, color: { rgb: 'CBD5E1' } },
  bottom: { style: 'thin' as const, color: { rgb: 'CBD5E1' } },
  left: { style: 'thin' as const, color: { rgb: 'CBD5E1' } },
  right: { style: 'thin' as const, color: { rgb: 'CBD5E1' } },
};

const HEADER_BORDER = {
  top: { style: 'thin' as const, color: { rgb: '115E59' } },
  bottom: { style: 'medium' as const, color: { rgb: '115E59' } },
  left: { style: 'thin' as const, color: { rgb: '0D9488' } },
  right: { style: 'thin' as const, color: { rgb: '0D9488' } },
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

export function buildHandoverFilename(): string {
  return 'Data Military & Stability.xlsx';
}

export function buildHandoverWorkbook(
  reports: HandoverReport[],
  allReportsForDuration?: HandoverReport[]
): WorkBook {
  const wb = XLSX.utils.book_new();
  const durations = computeCaseDurations(allReportsForDuration ?? reports);
  const durationByCountedReportId = new Map<string, CaseDurationItem>();
  for (const item of durations) {
    for (const repId of item.countedReportIds) {
      durationByCountedReportId.set(repId, item);
    }
  }

  const title = 'DATA MILITARY & STABILITY';

  const headers = [
    'No',
    'Tanggal',
    'Shift',
    'Mesin',
    'Kategori',
    'Tahap & Hasil Uji',
    'LINE BOCOR',
    'Update Shift / Keterangan',
    'Tindak Lanjut',
    'Lokasi Palet',
    'Status',
    'Total Durasi',
    'Total Military',
    'Total Stability',
    'PIC',
    'Waktu Dibuat',
  ];

  const dataRows: (string | number)[][] = reports.map((r, idx) => {
    const dur = durationByCountedReportId.get(r.id);
    const durLabel =
      dur && dur.durationShifts > 0 ? `${dur.durationShifts} Shift` : '0 Shift';
    const militaryCount = countMilitaryInReport(r);
    const stabilityCount = countStabilityInReport(r);

    let stageDetail = 'Perbaikan / Setting';
    if (r.activityStage === 'OH') {
      stageDetail = 'OH (Belum Perbaikan)';
    } else if (r.activityStage === 'MILITARY') {
      const roundStr = r.militaryRound ? ` #${r.militaryRound}` : '';
      const statusStr =
        r.militaryStatus === 'PENDING'
          ? 'Belum Diuji'
          : r.militaryStatus === 'OK'
            ? 'Nihil 0% (OK)'
            : `Bocor ${r.militaryLeakBoxes ?? 0} Box`;
      stageDetail = `Military${roundStr} [${statusStr}]`;
    } else if (r.activityStage === 'STABILITY') {
      const phaseStr = formatStabilityPhaseLabel(r.stabilityPhase);
      const statusStr =
        r.stabilityStatus === 'PENDING'
          ? 'Belum Diuji'
          : r.stabilityStatus === 'OK'
            ? 'Nihil 0% (OK)'
            : 'Bocor / Deviasi';
      stageDetail = `Stability ${phaseStr} [${statusStr}]`;
    } else if (militaryCount > 0) {
      stageDetail = 'Ambil Military';
    } else if (stabilityCount > 0) {
      stageDetail = 'Ambil Stability';
    }

    return [
      idx + 1,
      r.reportDate,
      r.shift,
      r.machine ?? '-',
      r.category,
      stageDetail,
      r.leakLine?.trim() || '-',
      r.information,
      r.followUp || '-',
      r.palletLocation || '-',
      r.isCompleted ? 'OK (Selesai)' : 'Berlanjut',
      durLabel,
      militaryCount,
      stabilityCount,
      r.createdByName,
      formatDateTimeId(r.createdAt),
    ];
  });

  const colCount = headers.length;
  const allRows: (string | number)[][] = [
    [title, ...Array(colCount - 1).fill('')],
    headers,
    ...dataRows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(allRows);
  const colWidths = computeColumnWidths([headers, ...dataRows], [
    { min: 6, max: 8 }, // 0: No
    { min: 13, max: 15 }, // 1: Tanggal
    { min: 10, max: 12 }, // 2: Shift
    { min: 14, max: 20 }, // 3: Mesin
    { min: 24, max: 34 }, // 4: Kategori
    { min: 20, max: 32 }, // 5: Tahap & Hasil Uji
    { min: 16, max: 28 }, // 6: LINE BOCOR
    { min: 32, max: 48 }, // 7: Update Shift / Keterangan
    { min: 22, max: 38 }, // 8: Tindak Lanjut
    { min: 18, max: 28 }, // 9: Lokasi Palet
    { min: 14, max: 16 }, // 10: Status
    { min: 14, max: 16 }, // 11: Total Durasi
    { min: 14, max: 16 }, // 12: Total Military
    { min: 14, max: 16 }, // 13: Total Stability
    { min: 16, max: 24 }, // 14: PIC
    { min: 18, max: 22 }, // 15: Waktu Dibuat
  ]);
  ws['!cols'] = colWidths;

  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } }];

  const titleStyle: CellStyle = {
    font: { name: 'Calibri', sz: 13, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: '115E59' } },
    alignment: { vertical: 'center', horizontal: 'left' },
    border: {
      bottom: { style: 'thin' as const, color: { rgb: '0D9488' } },
    },
  };

  for (let c = 0; c < colCount; c += 1) {
    ensureStyledCell(ws, 0, c, titleStyle);
  }

  const centeredCols = new Set([0, 1, 2, 5, 6, 10, 11, 12, 13]);
  for (let c = 0; c < colCount; c += 1) {
    ensureStyledCell(ws, 1, c, {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: '0F766E' } },
      alignment: {
        vertical: 'center',
        horizontal: centeredCols.has(c) ? 'center' : 'left',
        wrapText: true,
      },
      border: HEADER_BORDER,
    });
  }

  const rowHeights: { hpt: number }[] = [{ hpt: 30 }, { hpt: 26 }];

  for (let i = 0; i < reports.length; i += 1) {
    const r = 2 + i;
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
        horizontal = 'center';
        bold = true;
        fontColor = '475569';
      } else if (c === 1) {
        horizontal = 'center';
        bold = true;
      } else if (c === 2) {
        const sc = SHIFT_COLORS[report.shift] ?? { bg: 'F1F5F9', fg: '334155' };
        fillRgb = sc.bg;
        fontColor = sc.fg;
        bold = true;
        horizontal = 'center';
      } else if (c === 3) {
        bold = true;
      } else if (c === 4) {
        const cc = CATEGORY_COLORS[report.category] ?? { bg: 'F1F5F9', fg: '334155' };
        fillRgb = cc.bg;
        fontColor = cc.fg;
        bold = true;
      } else if (c === 5) {
        horizontal = 'center';
        bold = true;
        if (report.activityStage === 'OH') {
          fillRgb = 'F1F5F9';
          fontColor = '475569';
        } else if (report.activityStage === 'MILITARY') {
          if (report.militaryStatus === 'PENDING') {
            fillRgb = 'F1F5F9';
            fontColor = '334155';
          } else {
            fillRgb = report.militaryStatus === 'OK' ? 'DCFCE7' : 'FFE4E6';
            fontColor = report.militaryStatus === 'OK' ? '14532D' : '9F1239';
          }
        } else if (report.activityStage === 'STABILITY') {
          if (report.stabilityStatus === 'PENDING') {
            fillRgb = 'F1F5F9';
            fontColor = '334155';
          } else {
            fillRgb = report.stabilityStatus === 'OK' ? 'CCFBF1' : 'FFE4E6';
            fontColor = report.stabilityStatus === 'OK' ? '115E59' : '9F1239';
          }
        } else {
          fillRgb = 'FEF3C7';
          fontColor = '92400E';
        }
      } else if (c === 6) {
        horizontal = 'center';
        if (!isMutedDash) {
          fillRgb = 'FFE4E6';
          fontColor = '9F1239';
          bold = true;
        }
      } else if (c === 10) {
        horizontal = 'center';
        bold = true;
        if (isCompleted) {
          fillRgb = 'BBF7D0';
          fontColor = '14532D';
        } else {
          fillRgb = 'FEF3C7';
          fontColor = '92400E';
        }
      } else if (c === 11) {
        horizontal = 'center';
        bold = hasStartedDur;
        if (!hasStartedDur) {
          fillRgb = baseBg;
          fontColor = '64748B';
        } else {
          fillRgb = caseCompleted ? 'DCFCE7' : 'CCFBF1';
          fontColor = caseCompleted ? '14532D' : '115E59';
        }
      } else if (c === 12) {
        horizontal = 'center';
        bold = numVal > 0;
        fillRgb = numVal > 0 ? 'E0E7FF' : baseBg;
        fontColor = numVal > 0 ? '3730A3' : '94A3B8';
      } else if (c === 13) {
        horizontal = 'center';
        bold = numVal > 0;
        fillRgb = numVal > 0 ? 'CCFBF1' : baseBg;
        fontColor = numVal > 0 ? '115E59' : '94A3B8';
      } else if (c === 15) {
        fontColor = '475569';
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

  const lastCol = XLSX.utils.encode_col(Math.max(0, colCount - 1));
  const lastDataRowExcel = Math.max(2, 2 + reports.length);
  ws['!autofilter'] = { ref: `A2:${lastCol}${lastDataRowExcel}` };
  ws['!rows'] = rowHeights;
  (ws as Record<string, unknown>)['!views'] = [
    { state: 'frozen', ySplit: 2, topLeftCell: 'A3', activePane: 'bottomLeft' },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'DETAIL DATA');
  return wb;
}

export function downloadHandoverExcel(
  reports: HandoverReport[],
  filename: string = buildHandoverFilename(),
  allReportsForDuration?: HandoverReport[]
): { filename: string; rowCount: number } {
  const wb = buildHandoverWorkbook(reports, allReportsForDuration);
  XLSX.writeFile(wb, filename);
  return { filename, rowCount: reports.length };
}
