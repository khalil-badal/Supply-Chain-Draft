import { DeliveryRecord } from '../types';
import { AREA_HIERARCHY } from '../data';

// ─── Style constants (match Microgenesis export palette) ──────────────────────

const NAVY   = 'FF1F3864';
const WHITE  = 'FFFFFFFF';
const CHDR   = 'FFD6DCE4'; // column header fill
const SECT   = 'FF2F5496'; // section header fill
const TARG   = 'FFEDEDED'; // targets row fill
const TOTL   = 'FFE2EFDA'; // totals row fill
const CUML   = 'FFDDEBF7'; // cumulative total row fill
const PCTF   = 'FFFCE4D6'; // percentage row fill
const EVEN   = 'FFF8F9FA'; // alternating data row fill
const DARK   = 'FF1F2937';

const thin = (argb = 'FFD0D5DD') => ({ style: 'thin' as const, color: { argb } });
const bdr  = () => ({ top: thin(), bottom: thin(), left: thin(), right: thin() });
const fillSolid = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });

function sc(cell: any, opts: {
  bg?: string; color?: string; bold?: boolean; italic?: boolean; size?: number;
  h?: string; v?: string; fmt?: string; wrap?: boolean;
}) {
  if (opts.bg) cell.fill = fillSolid(opts.bg);
  cell.font = {
    bold: opts.bold ?? false,
    italic: opts.italic ?? false,
    size: opts.size ?? 10,
    color: { argb: opts.color ?? DARK },
  };
  cell.alignment = { horizontal: opts.h ?? 'left', vertical: opts.v ?? 'middle', wrapText: opts.wrap ?? false };
  if (opts.fmt) cell.numFmt = opts.fmt;
  cell.border = bdr();
}

// ─── Area groups ──────────────────────────────────────────────────────────────

const _NCR     = AREA_HIERARCHY.find(r => r.region === 'Metro Manila (NCR)')!;
const _CENTRAL = AREA_HIERARCHY.find(r => r.region === 'Luzon — Central & North')!;
const _CALA    = AREA_HIERARCHY.find(r => r.region === 'Luzon — CALABARZON')!;
const _ZAMB    = AREA_HIERARCHY.find(r => r.region === 'Luzon — Zambales')!;
const _VIS     = AREA_HIERARCHY.find(r => r.region === 'Visayas')!;
const _MIN     = AREA_HIERARCHY.find(r => r.region === 'Mindanao')!;

const AREA_GROUPS: { label: string; areas: string[] }[] = [
  {
    label: 'AREA 1 — Metro Manila South',
    areas: [
      ...(_NCR.subregions.find(s => s.name === 'South Manila Belt')?.areas ?? []),
      ...(_NCR.subregions.find(s => s.name === 'Ortigas Corridor')?.areas ?? []),
    ],
  },
  {
    label: 'AREA 2 — Metro Manila Central / East',
    areas: [
      ...(_NCR.subregions.find(s => s.name === 'North QC')?.areas ?? []),
      ...(_NCR.subregions.find(s => s.name === 'Central QC / Manila')?.areas ?? []),
      ...(_NCR.subregions.find(s => s.name === 'East Metro')?.areas ?? []),
      ...(_NCR.subregions.find(s => s.name === 'North Metro')?.areas ?? []),
    ],
  },
  {
    label: 'AREA 3 — Cavite / South Luzon',
    areas: [
      ..._CALA.subregions.flatMap(s => s.areas),
      ..._ZAMB.subregions.flatMap(s => s.areas),
    ],
  },
  {
    label: 'AREA 4 — North / Pampanga / Clark / Bulacan',
    areas: _CENTRAL.subregions.flatMap(s => s.areas),
  },
  {
    label: 'AREA 5 — Visayas & Mindanao',
    areas: [
      ..._VIS.subregions.flatMap(s => s.areas),
      ..._MIN.subregions.flatMap(s => s.areas),
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseMins(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = t.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3]?.toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

// Departure buckets: 8:00–8:30 / 8:30–9:00 / 9:00–9:30 / 9:30+
function depBucket(t: string | null | undefined): number | null {
  const m = parseMins(t);
  if (m === null || m < 480) return null;
  if (m < 510) return 0;
  if (m < 540) return 1;
  if (m < 570) return 2;
  return 3;
}

// Arrival buckets: 6:00–6:30pm / 6:30–7:00pm / 7:00–7:30pm / 7:30pm+
function arrBucket(t: string | null | undefined): number | null {
  const m = parseMins(t);
  if (m === null || m < 1080) return null;
  if (m < 1110) return 0;
  if (m < 1140) return 1;
  if (m < 1170) return 2;
  return 3;
}

function deriveMonthYear(recs: DeliveryRecord[]): { month: string; year: number } {
  const dates = recs.map(r => r.delivery_date).filter(Boolean) as string[];
  if (!dates.length) {
    const d = new Date();
    return { month: d.toLocaleString('en-US', { month: 'long' }).toUpperCase(), year: d.getFullYear() };
  }
  const counts: Record<string, number> = {};
  for (const d of dates) counts[d.slice(0, 7)] = (counts[d.slice(0, 7)] ?? 0) + 1;
  const [key] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const [yr, mo] = key.split('-').map(Number);
  return {
    month: new Date(yr, mo - 1, 1).toLocaleString('en-US', { month: 'long' }).toUpperCase(),
    year: yr,
  };
}

function pct(n: number, total: number): number {
  return total > 0 ? n / total : 0;
}

// ─── Row writers ──────────────────────────────────────────────────────────────

function writeTitleRow(ws: any, rowNum: number, text: string, colSpan: number) {
  const row = ws.getRow(rowNum);
  row.height = 26;
  ws.mergeCells(rowNum, 1, rowNum, colSpan);
  const cell = row.getCell(1);
  cell.value = text;
  cell.fill = fillSolid(NAVY);
  cell.font = { bold: true, size: 14, color: { argb: WHITE } };
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
}

function writeMetaRow(ws: any, rowNum: number, text: string, colSpan: number) {
  const row = ws.getRow(rowNum);
  row.height = 14;
  ws.mergeCells(rowNum, 1, rowNum, colSpan);
  const cell = row.getCell(1);
  cell.value = text;
  cell.fill = fillSolid('FFF1F5FB');
  cell.font = { italic: true, size: 9, color: { argb: '64748B' } };
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
}

function writeSectionRow(ws: any, rowNum: number, text: string, colSpan: number) {
  const row = ws.getRow(rowNum);
  row.height = 18;
  ws.mergeCells(rowNum, 1, rowNum, colSpan);
  const cell = row.getCell(1);
  cell.value = text;
  cell.fill = fillSolid(SECT);
  cell.font = { bold: true, size: 10, color: { argb: WHITE } };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
  cell.border = bdr();
}

function writeHdrRow(ws: any, rowNum: number, vals: (string | null)[]) {
  const row = ws.getRow(rowNum);
  row.height = 18;
  vals.forEach((v, i) => {
    const c = row.getCell(i + 1);
    if (v !== null) c.value = v;
    sc(c, { bg: CHDR, bold: true, h: i === 0 ? 'left' : 'center' });
  });
}

function writeTargRow(ws: any, rowNum: number, vals: (string | number | null)[], pctIdxs: number[]) {
  const row = ws.getRow(rowNum);
  row.height = 16;
  vals.forEach((v, i) => {
    const c = row.getCell(i + 1);
    if (v !== null) c.value = v;
    sc(c, {
      bg: TARG, bold: true, italic: true,
      h: i === 0 ? 'left' : 'center',
      fmt: pctIdxs.includes(i) ? '0.00%' : undefined,
    });
  });
}

function writeDataRow(ws: any, rowNum: number, vals: (string | number | null)[], even: boolean) {
  const row = ws.getRow(rowNum);
  row.height = 16;
  vals.forEach((v, i) => {
    const c = row.getCell(i + 1);
    if (v !== null) c.value = v;
    sc(c, { bg: even ? EVEN : WHITE, h: i === 0 ? 'left' : 'center' });
  });
}

function writeTotlRow(ws: any, rowNum: number, vals: (string | number | null)[]) {
  const row = ws.getRow(rowNum);
  row.height = 16;
  vals.forEach((v, i) => {
    const c = row.getCell(i + 1);
    if (v !== null) c.value = v;
    sc(c, { bg: TOTL, bold: true, h: i === 0 ? 'left' : 'center' });
  });
}

function writeCumlRow(ws: any, rowNum: number, vals: (string | number | null)[]) {
  const row = ws.getRow(rowNum);
  row.height = 16;
  vals.forEach((v, i) => {
    const c = row.getCell(i + 1);
    if (v !== null) c.value = v;
    sc(c, { bg: CUML, bold: true, h: i === 0 ? 'left' : 'center' });
  });
}

function writePctRow(ws: any, rowNum: number, vals: (string | number | null)[], pctIdxs: number[]) {
  const row = ws.getRow(rowNum);
  row.height = 16;
  vals.forEach((v, i) => {
    const c = row.getCell(i + 1);
    if (v !== null) c.value = v;
    sc(c, {
      bg: PCTF, bold: true,
      h: i === 0 ? 'left' : 'center',
      fmt: pctIdxs.includes(i) ? '0.00%' : undefined,
    });
  });
}

// ─── Driver statistics ────────────────────────────────────────────────────────

interface DriverStats {
  acc: number;
  rh: number;
  pend: number;
  dep: [number, number, number, number];
  arr: [number, number, number, number];
  vehicles: Set<string>;
  lastRemark: string;
}

function buildDriverStats(drivers: string[], assigned: DeliveryRecord[]): Map<string, DriverStats> {
  const map = new Map<string, DriverStats>();
  for (const d of drivers) {
    const recs = assigned.filter(r => r.driver!.trim() === d);
    const dep: [number, number, number, number] = [0, 0, 0, 0];
    const arr: [number, number, number, number] = [0, 0, 0, 0];
    for (const r of recs) {
      const db = depBucket(r.time_in);
      if (db !== null) dep[db]++;
      const ab = arrBucket(r.time_out);
      if (ab !== null) arr[ab]++;
    }
    const vehicles = new Set<string>();
    for (const r of recs) { if (r.vehicle?.trim()) vehicles.add(r.vehicle.trim()); }
    const lastRec = recs
      .filter(r => r.remarks?.trim())
      .sort((a, b) => new Date(b.modified_at ?? b.created_at).getTime() - new Date(a.modified_at ?? a.created_at).getTime())[0];
    map.set(d, {
      acc: recs.filter(r => r.status === 'Delivered').length,
      rh:  recs.filter(r => r.status === 'Rescheduled' || r.status === 'On-Hold').length,
      pend: recs.filter(r => r.status === 'Pending' || r.status === 'Scheduled').length,
      dep, arr, vehicles,
      lastRemark: lastRec?.remarks ?? '',
    });
  }
  return map;
}

// ─── Sheet 1: Monthly Report ──────────────────────────────────────────────────

function buildSheet1(
  ws: any,
  deliveries: DeliveryRecord[],
  assigned: DeliveryRecord[],
  drivers: string[],
  stats: Map<string, DriverStats>,
  month: string, year: number,
  byName: string, byRole: string,
) {
  const C = 6; // total columns used
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 3 }];
  ws.getColumn(1).width = 28;
  for (let c = 2; c <= C; c++) ws.getColumn(c).width = 15;

  let r = 1;

  writeTitleRow(ws, r++, `DELIVERY REPORT — ${month} ${year}`, C);
  writeMetaRow(ws, r++,
    `Microgenesis Industrial and Commercial Products Corp.  |  Generated by: ${byName} (${byRole})  |  ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
    C,
  );
  ws.getRow(r++).height = 8; // spacer

  // ── Section 1: Delivery Performance ────────────────────────────────────────

  writeSectionRow(ws, r++, '  SECTION 1 — DELIVERY PERFORMANCE PER DRIVER', C);
  writeTargRow(ws, r++, ['TARGETS', 0.98, 0.01, 0.01, null, null], [1, 2, 3]);
  writeHdrRow(ws, r++, ["Driver's Name", 'Accomplished', 'Resched / Hold', 'Pending', 'Total # of Deliveries', null]);

  drivers.forEach((d, idx) => {
    const s = stats.get(d)!;
    const total = s.acc + s.rh + s.pend;
    writeDataRow(ws, r++, [d, s.acc, s.rh, s.pend, total, null], idx % 2 === 1);
  });

  const totAcc  = [...stats.values()].reduce((n, s) => n + s.acc, 0);
  const totRH   = [...stats.values()].reduce((n, s) => n + s.rh, 0);
  const totPend = [...stats.values()].reduce((n, s) => n + s.pend, 0);
  const grand   = totAcc + totRH + totPend;

  writeTotlRow(ws, r++, ['TOTALS', totAcc, totRH, totPend, grand, null]);
  writePctRow(ws, r++, ['PERCENTAGE', pct(totAcc, grand), pct(totRH, grand), pct(totPend, grand), null, null], [1, 2, 3]);

  ws.getRow(r++).height = 8;

  // ── Section 2: Departure Time ───────────────────────────────────────────────

  const DEP_SLOTS = ['8:00am – 8:30am', '8:30am – 9:00am', '9:00am – 9:30am', '9:30am and above'];
  const DEP_TARGETS = [0.50, 0.85, 0.95, 1.00];

  writeSectionRow(ws, r++, '  SECTION 2 — DEPARTURE TIME BREAKDOWN PER DRIVER', C);
  writeTargRow(ws, r++, ['TARGETS', ...DEP_TARGETS, null], [1, 2, 3, 4]);
  writeHdrRow(ws, r++, ["Driver's Name", ...DEP_SLOTS, null]);

  drivers.forEach((d, idx) => {
    const s = stats.get(d)!;
    writeDataRow(ws, r++, [d, ...s.dep, null], idx % 2 === 1);
  });

  const depTot = [0, 1, 2, 3].map(i => [...stats.values()].reduce((n, s) => n + s.dep[i], 0));
  const depGrand = depTot.reduce((a, b) => a + b, 0);
  const depCuml = depTot.map((_, i) => depTot.slice(0, i + 1).reduce((a, b) => a + b, 0));

  writeTotlRow(ws, r++, ['TOTALS', ...depTot, null]);
  writeCumlRow(ws, r++, ['TOTAL NUMBER (cumulative)', ...depCuml, null]);
  writePctRow(ws, r++, ['PERCENTAGE', ...depTot.map(t => pct(t, depGrand)), null], [1, 2, 3, 4]);

  ws.getRow(r++).height = 8;

  // ── Section 3: Arrival Time ─────────────────────────────────────────────────

  const ARR_SLOTS = ['6:00pm – 6:30pm', '6:30pm – 7:00pm', '7:00pm – 7:30pm', '8:30pm and above'];
  const ARR_TARGETS = [0.50, 0.85, 0.95, 1.00];

  writeSectionRow(ws, r++, '  SECTION 3 — ARRIVAL TIME BREAKDOWN PER DRIVER', C);
  writeTargRow(ws, r++, ['TARGETS', ...ARR_TARGETS, null], [1, 2, 3, 4]);
  writeHdrRow(ws, r++, ["Driver's Name", ...ARR_SLOTS, null]);

  drivers.forEach((d, idx) => {
    const s = stats.get(d)!;
    writeDataRow(ws, r++, [d, ...s.arr, null], idx % 2 === 1);
  });

  const arrTot = [0, 1, 2, 3].map(i => [...stats.values()].reduce((n, s) => n + s.arr[i], 0));
  const arrGrand = arrTot.reduce((a, b) => a + b, 0);
  const arrCuml = arrTot.map((_, i) => arrTot.slice(0, i + 1).reduce((a, b) => a + b, 0));

  writeTotlRow(ws, r++, ['TOTALS', ...arrTot, null]);
  writeCumlRow(ws, r++, ['TOTAL NUMBER (cumulative)', ...arrCuml, null]);
  writePctRow(ws, r++, ['PERCENTAGE', ...arrTot.map(t => pct(t, arrGrand)), null], [1, 2, 3, 4]);

  ws.getRow(r++).height = 8;

  // ── Section 4: Area Coverage ────────────────────────────────────────────────

  writeSectionRow(ws, r++, '  SECTION 4 — AREA COVERAGE', C);

  // Area coverage header
  const aHdrRow = ws.getRow(r++);
  aHdrRow.height = 18;
  ['Area Group', 'Area / Location', 'Count', '% of Group', null, 'Group Total'].forEach((v, i) => {
    const cell = aHdrRow.getCell(i + 1);
    if (v !== null) cell.value = v;
    sc(cell, { bg: i === 5 ? NAVY : CHDR, bold: true, color: i === 5 ? WHITE : DARK, h: i <= 1 ? 'left' : 'center' });
  });

  const totalDeliveries = deliveries.length;

  for (const group of AREA_GROUPS) {
    const groupAreas = group.areas.filter(a => deliveries.some(d => d.area === a));
    const groupTotal = groupAreas.reduce((n, a) => n + deliveries.filter(d => d.area === a).length, 0);
    if (groupTotal === 0) continue;

    let first = true;
    for (const area of groupAreas) {
      const cnt = deliveries.filter(d => d.area === area).length;
      if (cnt === 0) continue;
      const aRow = ws.getRow(r++);
      aRow.height = 16;

      const labelCell = aRow.getCell(1);
      labelCell.value = first ? group.label : '';
      sc(labelCell, { bg: first ? 'FFF0F4FF' : WHITE, bold: first, h: 'left' });

      const areaCell = aRow.getCell(2);
      areaCell.value = area;
      sc(areaCell, { bg: WHITE, h: 'left' });

      const cntCell = aRow.getCell(3);
      cntCell.value = cnt;
      sc(cntCell, { bg: WHITE, h: 'center' });

      const pctCell = aRow.getCell(4);
      pctCell.value = pct(cnt, groupTotal);
      sc(pctCell, { bg: WHITE, h: 'center', fmt: '0.00%' });

      // Blank col 5, group total in col 6 on first row only
      aRow.getCell(5).border = bdr();
      if (first) {
        const gtCell = aRow.getCell(6);
        gtCell.value = groupTotal;
        sc(gtCell, { bg: TOTL, bold: true, h: 'center' });
      } else {
        aRow.getCell(6).border = bdr();
      }

      first = false;
    }

    // Group subtotal row
    const subRow = ws.getRow(r++);
    subRow.height = 16;
    const subLabel = subRow.getCell(1);
    subLabel.value = `${group.label.split(' — ')[0]} SUBTOTAL`;
    sc(subLabel, { bg: TOTL, bold: true, h: 'left' });
    subRow.getCell(2).border = bdr();
    subRow.getCell(2).fill = fillSolid(TOTL);
    const subCnt = subRow.getCell(3);
    subCnt.value = groupTotal;
    sc(subCnt, { bg: TOTL, bold: true, h: 'center' });
    const subPct = subRow.getCell(4);
    subPct.value = pct(groupTotal, totalDeliveries);
    sc(subPct, { bg: TOTL, bold: true, h: 'center', fmt: '0.00%' });
    subRow.getCell(5).border = bdr();
    subRow.getCell(5).fill = fillSolid(TOTL);
    subRow.getCell(6).border = bdr();
    subRow.getCell(6).fill = fillSolid(TOTL);

    ws.getRow(r++).height = 5;
  }

  // Grand total area row
  const allAreaCount = AREA_GROUPS.flatMap(g => g.areas).reduce(
    (n, a) => n + deliveries.filter(d => d.area === a).length, 0,
  );
  writeTotlRow(ws, r++, ['TOTAL AREA COVERED', null, allAreaCount, pct(allAreaCount, totalDeliveries), null, totalDeliveries]);
  const gtRow = ws.getRow(r - 1);
  gtRow.getCell(4).numFmt = '0.00%';
}

// ─── Sheet 2: Summary ─────────────────────────────────────────────────────────

function buildSheet2(
  ws: any,
  deliveries: DeliveryRecord[],
  assigned: DeliveryRecord[],
  drivers: string[],
  stats: Map<string, DriverStats>,
  month: string, year: number,
  byName: string, byRole: string,
) {
  // Main table: cols A–O (15 cols)
  // Vehicle breakdown: cols Q–T (17–20)
  const MAIN_C = 15;
  const VEH_START = 17;

  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 3 }];
  ws.getColumn(1).width = 28;
  // Perf cols B-E
  for (let c = 2; c <= 5; c++) ws.getColumn(c).width = 13;
  // Dep cols F-J
  for (let c = 6; c <= 10; c++) ws.getColumn(c).width = 14;
  // Arr cols K-O
  for (let c = 11; c <= 15; c++) ws.getColumn(c).width = 14;
  // Spacer P
  ws.getColumn(16).width = 4;
  // Vehicle cols Q-T
  ws.getColumn(17).width = 20;
  for (let c = 18; c <= 20; c++) ws.getColumn(c).width = 13;

  let r = 1;

  writeTitleRow(ws, r++, `SUMMARY — DRIVER REPORT ${month} ${year}`, MAIN_C);
  writeMetaRow(ws, r++,
    `Microgenesis Industrial and Commercial Products Corp.  |  Generated by: ${byName} (${byRole})  |  ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
    MAIN_C,
  );
  ws.getRow(r++).height = 8;

  // ── Group headers (section spans) ──────────────────────────────────────────

  const grpRow = ws.getRow(r++);
  grpRow.height = 18;

  const groups: { label: string; start: number; end: number; bg: string }[] = [
    { label: "Driver's Name",       start: 1,  end: 1,  bg: CHDR },
    { label: 'Delivery Performance', start: 2,  end: 5,  bg: 'FFD6E4BC' },
    { label: 'Departure Time',       start: 6,  end: 10, bg: 'FFDCE6F1' },
    { label: 'Arrival Time',         start: 11, end: 15, bg: 'FFFCE4D6' },
  ];

  for (const g of groups) {
    ws.mergeCells(r - 1, g.start, r - 1, g.end);
    const cell = grpRow.getCell(g.start);
    cell.value = g.label;
    cell.fill = fillSolid(g.bg);
    cell.font = { bold: true, size: 10, color: { argb: DARK } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = bdr();
  }

  // Vehicle section group header
  ws.mergeCells(r - 1, VEH_START, r - 1, VEH_START + 3);
  const vGrpCell = grpRow.getCell(VEH_START);
  vGrpCell.value = 'Vehicle Plate Breakdown';
  vGrpCell.fill = fillSolid('FFEDEDED');
  vGrpCell.font = { bold: true, size: 10, color: { argb: DARK } };
  vGrpCell.alignment = { vertical: 'middle', horizontal: 'center' };
  vGrpCell.border = bdr();

  // ── Column sub-headers ──────────────────────────────────────────────────────

  const DEP_SLOTS = ['8:00–8:30', '8:30–9:00', '9:00–9:30', '9:30+', 'Total'];
  const ARR_SLOTS = ['6:00–6:30pm', '6:30–7:00pm', '7:00–7:30pm', '7:30pm+', 'Total'];

  writeHdrRow(ws, r++, [
    "Driver's Name",
    'Accomplished', 'Resched/Hold', 'Pending', 'Total',
    ...DEP_SLOTS,
    ...ARR_SLOTS,
  ]);

  // Also write vehicle header cols
  const vHdrRow = ws.getRow(r - 1);
  ['Vehicle', 'Accomplished', 'Resched/Hold', 'Pending'].forEach((v, i) => {
    const c = vHdrRow.getCell(VEH_START + i);
    c.value = v;
    sc(c, { bg: CHDR, bold: true, h: i === 0 ? 'left' : 'center' });
  });

  // ── Data rows ───────────────────────────────────────────────────────────────

  drivers.forEach((d, idx) => {
    const s = stats.get(d)!;
    const perfTotal = s.acc + s.rh + s.pend;
    const depTotal = s.dep.reduce((a, b) => a + b, 0);
    const arrTotal = s.arr.reduce((a, b) => a + b, 0);
    writeDataRow(ws, r++, [
      d,
      s.acc, s.rh, s.pend, perfTotal,
      ...s.dep, depTotal,
      ...s.arr, arrTotal,
    ], idx % 2 === 1);
  });

  // ── Summary totals ──────────────────────────────────────────────────────────

  const totAcc  = [...stats.values()].reduce((n, s) => n + s.acc, 0);
  const totRH   = [...stats.values()].reduce((n, s) => n + s.rh, 0);
  const totPend = [...stats.values()].reduce((n, s) => n + s.pend, 0);
  const grand   = totAcc + totRH + totPend;
  const depTot  = [0, 1, 2, 3].map(i => [...stats.values()].reduce((n, s) => n + s.dep[i], 0));
  const arrTot  = [0, 1, 2, 3].map(i => [...stats.values()].reduce((n, s) => n + s.arr[i], 0));

  writeTotlRow(ws, r++, [
    'TOTALS',
    totAcc, totRH, totPend, grand,
    ...depTot, depTot.reduce((a, b) => a + b, 0),
    ...arrTot, arrTot.reduce((a, b) => a + b, 0),
  ]);

  writePctRow(ws, r++, [
    'PERCENTAGE',
    pct(totAcc, grand), pct(totRH, grand), pct(totPend, grand), null,
    ...depTot.map(t => pct(t, depTot.reduce((a, b) => a + b, 0))), null,
    ...arrTot.map(t => pct(t, arrTot.reduce((a, b) => a + b, 0))), null,
  ], [1, 2, 3, 5, 6, 7, 8, 10, 11, 12, 13]);

  // ── Vehicle plate breakdown (off to the right) ──────────────────────────────

  const allVehicles = [...new Set(
    assigned.map(r => r.vehicle?.trim()).filter(Boolean) as string[]
  )].sort();

  let vr = 4; // same starting data row as driver table

  for (const v of allVehicles) {
    const recs = assigned.filter(r => r.vehicle?.trim() === v);
    const vRow = ws.getRow(vr++);
    const plateCell = vRow.getCell(VEH_START);
    plateCell.value = v;
    sc(plateCell, { bg: WHITE, h: 'left' });

    const vAcc = vRow.getCell(VEH_START + 1);
    vAcc.value = recs.filter(r => r.status === 'Delivered').length;
    sc(vAcc, { bg: WHITE, h: 'center' });

    const vRH = vRow.getCell(VEH_START + 2);
    vRH.value = recs.filter(r => r.status === 'Rescheduled' || r.status === 'On-Hold').length;
    sc(vRH, { bg: WHITE, h: 'center' });

    const vPend = vRow.getCell(VEH_START + 3);
    vPend.value = recs.filter(r => r.status === 'Pending' || r.status === 'Scheduled').length;
    sc(vPend, { bg: WHITE, h: 'center' });
  }

  // ── Driver remarks (below main table) ──────────────────────────────────────

  r += 2; // gap
  writeSectionRow(ws, r++, '  DRIVER REMARKS (most recent per driver)', 5);
  writeHdrRow(ws, r++, ["Driver's Name", 'Last Remark', null, null, null]);
  ws.mergeCells(r - 1, 2, r - 1, 5);

  drivers.forEach((d, idx) => {
    const s = stats.get(d)!;
    const rmkRow = ws.getRow(r++);
    rmkRow.height = 20;
    const nameCell = rmkRow.getCell(1);
    nameCell.value = d;
    sc(nameCell, { bg: idx % 2 === 1 ? EVEN : WHITE, h: 'left' });

    ws.mergeCells(r - 1, 2, r - 1, 5);
    const rmkCell = rmkRow.getCell(2);
    rmkCell.value = s.lastRemark || '—';
    sc(rmkCell, { bg: idx % 2 === 1 ? EVEN : WHITE, h: 'left', wrap: true, italic: !s.lastRemark });
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function downloadDriverReport(
  records: DeliveryRecord[],
  generatedByName: string,
  generatedByRole: string,
): Promise<void> {
  const deliveries = records.filter(r => r.category === 'Deliveries');
  const { month, year } = deriveMonthYear(deliveries);

  const assigned = deliveries.filter(r => r.driver?.trim());
  const drivers  = [...new Set(assigned.map(r => r.driver!.trim()))].sort();
  const stats    = buildDriverStats(drivers, assigned);

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = generatedByName;
  wb.created = new Date();

  buildSheet1(wb.addWorksheet('Monthly Report'), deliveries, assigned, drivers, stats, month, year, generatedByName, generatedByRole);
  buildSheet2(wb.addWorksheet('Summary'),        deliveries, assigned, drivers, stats, month, year, generatedByName, generatedByRole);

  const buf  = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `Microgenesis_Driver_Report_${month}_${year}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
