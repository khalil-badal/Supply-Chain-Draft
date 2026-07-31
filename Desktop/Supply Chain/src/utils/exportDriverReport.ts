import { DeliveryRecord } from '../types';
import { AREA_HIERARCHY } from '../data';

// ─── Style constants (navy/gold — matches Microgenesis template) ──────────────

const NAVY    = 'FF1F3864';
const DARKER  = 'FF0D1B2A';
const GOLD    = 'FFFFC000';
const WHITE   = 'FFFFFFFF';
const LTGOLD  = 'FFFFF2CC'; // light gold for alt rows
const EVEN    = 'FFF8F9FA';

const thin = (argb = 'FFD0D5DD') => ({ style: 'thin' as const, color: { argb } });
const bdr  = (argb = 'FFD0D5DD') => ({ top: thin(argb), bottom: thin(argb), left: thin(argb), right: thin(argb) });
const fillSolid = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });

function sc(cell: any, opts: {
  bg?: string; color?: string; bold?: boolean; italic?: boolean; size?: number;
  h?: string; v?: string; fmt?: string; wrap?: boolean; bdrColor?: string;
}) {
  if (opts.bg) cell.fill = fillSolid(opts.bg);
  cell.font = {
    bold: opts.bold ?? false,
    italic: opts.italic ?? false,
    size: opts.size ?? 10,
    color: { argb: opts.color ?? DARKER },
  };
  cell.alignment = { horizontal: opts.h ?? 'left', vertical: opts.v ?? 'middle', wrapText: opts.wrap ?? false };
  if (opts.fmt) cell.numFmt = opts.fmt;
  cell.border = bdr(opts.bdrColor);
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

function depBucket(t: string | null | undefined): number | null {
  const m = parseMins(t);
  if (m === null || m < 480) return null;
  if (m < 510) return 0;
  if (m < 540) return 1;
  if (m < 570) return 2;
  return 3;
}

function arrBucket(t: string | null | undefined): number | null {
  const m = parseMins(t);
  if (m === null || m < 1080) return null;
  if (m < 1110) return 0;
  if (m < 1140) return 1;
  if (m < 1170) return 2;
  return 3;
}

function pct(n: number, total: number): number {
  return total > 0 ? n / total : 0;
}

function monthName(mo: number): string {
  return new Date(2000, mo - 1, 1).toLocaleString('en-US', { month: 'long' }).toUpperCase();
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
      acc:  recs.filter(r => r.status === 'Delivered').length,
      rh:   recs.filter(r => r.status === 'Rescheduled' || r.status === 'On-Hold').length,
      pend: recs.filter(r => r.status === 'Pending' || r.status === 'Scheduled').length,
      dep, arr, vehicles,
      lastRemark: lastRec?.remarks ?? '',
    });
  }
  return map;
}

// ─── Excel Sheet 1 ───────────────────────────────────────────────────────────
// Layout: 12 columns (A–L)
//   Performance section: cols A–E (5 cols)
//   Departure section:   cols A–F (6 cols, side-by-side with Arrival)
//   Arrival section:     cols G–L (6 cols, same rows as Departure)
//   Area coverage:       cols A–C detail + G–K summary + K–L total

function buildSheet1(
  ws: any,
  deliveries: DeliveryRecord[],
  assigned: DeliveryRecord[],
  drivers: string[],
  stats: Map<string, DriverStats>,
  month: string, year: number,
  byName: string, byRole: string,
) {
  const TOTAL_COLS = 12;

  // Column widths
  ws.getColumn(1).width = 24;  // A: driver / area names
  ws.getColumn(2).width = 15;  // B
  ws.getColumn(3).width = 15;  // C
  ws.getColumn(4).width = 15;  // D
  ws.getColumn(5).width = 15;  // E
  ws.getColumn(6).width = 12;  // F: dep total
  ws.getColumn(7).width = 24;  // G: arrival driver names
  ws.getColumn(8).width = 15;  // H
  ws.getColumn(9).width = 15;  // I
  ws.getColumn(10).width = 15; // J
  ws.getColumn(11).width = 15; // K
  ws.getColumn(12).width = 12; // L: arr total

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];

  let r = 1;

  // ── Title block (rows 1–3, full width A–L) ──────────────────────────────────
  for (let rr = 1; rr <= 3; rr++) {
    ws.mergeCells(rr, 1, rr, TOTAL_COLS);
    const cell = ws.getRow(rr).getCell(1);
    cell.fill = fillSolid(NAVY);
    cell.border = bdr('FF1F3864');
    ws.getRow(rr).height = rr === 1 ? 24 : 14;
  }

  const titleCell = ws.getRow(1).getCell(1);
  titleCell.value = `DELIVERY REPORT ${year}`;
  titleCell.font = { bold: true, size: 16, color: { argb: GOLD } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  const subCell = ws.getRow(2).getCell(1);
  subCell.value = 'Microgenesis Industrial and Commercial Products Corp.';
  subCell.font = { bold: true, size: 10, color: { argb: WHITE } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };

  const metaCell = ws.getRow(3).getCell(1);
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  metaCell.value = `Generated by: ${byName} (${byRole})  ·  ${dateStr}`;
  metaCell.font = { italic: true, size: 9, color: { argb: 'FFCCCCCC' } };
  metaCell.alignment = { vertical: 'middle', horizontal: 'center' };
  r = 4;

  // ── Performance section (cols A–E only) ─────────────────────────────────────

  // Month label row (A4:E4)
  ws.mergeCells(r, 1, r, 5);
  const moCell = ws.getRow(r).getCell(1);
  moCell.value = `${month}.${year}`;
  moCell.fill = fillSolid(WHITE);
  moCell.font = { bold: true, size: 11, color: { argb: NAVY } };
  moCell.alignment = { vertical: 'middle', horizontal: 'center' };
  moCell.border = bdr();
  ws.getRow(r).height = 16;
  r++;

  // "Deliveries [year]" subheader (A5:E5)
  ws.mergeCells(r, 1, r, 5);
  const dlvCell = ws.getRow(r).getCell(1);
  dlvCell.value = `Deliveries ${year}`;
  dlvCell.fill = fillSolid(NAVY);
  dlvCell.font = { bold: true, italic: true, size: 10, color: { argb: GOLD } };
  dlvCell.alignment = { vertical: 'middle', horizontal: 'center' };
  dlvCell.border = bdr(NAVY);
  ws.getRow(r).height = 16;
  r++;

  // TARGETS row
  ws.getRow(r).height = 16;
  const targVals = ['TARGETS', 0.98, 0.01, 0.01, 'Total # of Deliveries per Driver'];
  targVals.forEach((v, i) => {
    const c = ws.getRow(r).getCell(i + 1);
    c.value = v;
    sc(c, {
      bg: LTGOLD, bold: true, italic: true, color: DARKER,
      h: i === 0 ? 'left' : 'center',
      fmt: (i >= 1 && i <= 3) ? '0%' : undefined,
    });
  });
  r++;

  // Column headers
  ws.getRow(r).height = 18;
  ["Driver's Name", 'Accomplished', 'Resched / Hold', 'Pending', 'Total # of Deliveries'].forEach((v, i) => {
    const c = ws.getRow(r).getCell(i + 1);
    c.value = v;
    sc(c, { bg: NAVY, bold: true, color: WHITE, h: i === 0 ? 'left' : 'center', bdrColor: NAVY });
  });
  r++;

  // Driver rows
  drivers.forEach((d, idx) => {
    const s = stats.get(d)!;
    const total = s.acc + s.rh + s.pend;
    ws.getRow(r).height = 16;
    [d, s.acc, s.rh, s.pend, total].forEach((v, i) => {
      const c = ws.getRow(r).getCell(i + 1);
      c.value = v;
      sc(c, {
        bg: i === 0 ? GOLD : (idx % 2 === 1 ? EVEN : WHITE),
        bold: i === 0,
        color: DARKER,
        h: i === 0 ? 'left' : 'center',
      });
    });
    r++;
  });

  // TOTALS row
  const totAcc  = [...stats.values()].reduce((n, s) => n + s.acc, 0);
  const totRH   = [...stats.values()].reduce((n, s) => n + s.rh, 0);
  const totPend = [...stats.values()].reduce((n, s) => n + s.pend, 0);
  const grand   = totAcc + totRH + totPend;
  ws.getRow(r).height = 16;
  ['TOTALS', totAcc, totRH, totPend, grand].forEach((v, i) => {
    const c = ws.getRow(r).getCell(i + 1);
    c.value = v;
    sc(c, { bg: NAVY, bold: true, color: WHITE, h: i === 0 ? 'left' : 'center', bdrColor: NAVY });
  });
  r++;

  // PERCENTAGE row
  ws.getRow(r).height = 16;
  ['PERCENTAGE', pct(totAcc, grand), pct(totRH, grand), pct(totPend, grand), 1].forEach((v, i) => {
    const c = ws.getRow(r).getCell(i + 1);
    c.value = v;
    sc(c, { bg: DARKER, bold: true, color: GOLD, h: i === 0 ? 'left' : 'center', fmt: i >= 1 ? '0.00%' : undefined, bdrColor: DARKER });
  });
  r++;

  // Blank spacer
  ws.getRow(r).height = 8;
  r++;

  // ── DEPARTURE (A–F) + ARRIVAL (G–L) SIDE BY SIDE ────────────────────────────

  const DEP_SLOTS = ['8:00am – 8:30am', '8:30am – 9:00am', '9:00am – 9:30am', '9:30am and above'];
  const ARR_SLOTS = ['6:00pm – 6:30pm', '6:30pm – 7:00pm', '7:00pm – 7:30pm', '7:30pm and above'];
  const TIME_TARGETS = [0.50, 0.85, 0.95, 1.00];

  // Section label row: DEPARTURE merged A–F, ARRIVAL merged G–L
  ws.mergeCells(r, 1, r, 6);
  const depLbl = ws.getRow(r).getCell(1);
  depLbl.value = 'DEPARTURE';
  depLbl.fill = fillSolid(NAVY);
  depLbl.font = { bold: true, size: 12, color: { argb: GOLD } };
  depLbl.alignment = { vertical: 'middle', horizontal: 'center' };
  depLbl.border = bdr(NAVY);

  ws.mergeCells(r, 7, r, 12);
  const arrLbl = ws.getRow(r).getCell(7);
  arrLbl.value = 'ARRIVAL';
  arrLbl.fill = fillSolid(NAVY);
  arrLbl.font = { bold: true, size: 12, color: { argb: GOLD } };
  arrLbl.alignment = { vertical: 'middle', horizontal: 'center' };
  arrLbl.border = bdr(NAVY);
  ws.getRow(r).height = 20;
  r++;

  // Targets row (both sides)
  ws.getRow(r).height = 16;
  ['TARGETS', ...TIME_TARGETS, null].forEach((v, i) => {
    const c = ws.getRow(r).getCell(i + 1);
    if (v !== null) {
      c.value = v;
      sc(c, { bg: LTGOLD, bold: true, italic: true, color: DARKER, h: i === 0 ? 'left' : 'center', fmt: i >= 1 ? '0%' : undefined });
    } else {
      c.border = bdr();
    }
  });
  ['TARGETS', ...TIME_TARGETS, null].forEach((v, i) => {
    const c = ws.getRow(r).getCell(7 + i);
    if (v !== null) {
      c.value = v;
      sc(c, { bg: LTGOLD, bold: true, italic: true, color: DARKER, h: i === 0 ? 'left' : 'center', fmt: i >= 1 ? '0%' : undefined });
    } else {
      c.border = bdr();
    }
  });
  r++;

  // Column headers (both sides)
  ws.getRow(r).height = 18;
  ["Driver's Name", ...DEP_SLOTS, 'Total'].forEach((v, i) => {
    const c = ws.getRow(r).getCell(i + 1);
    c.value = v;
    sc(c, { bg: NAVY, bold: true, color: WHITE, h: i === 0 ? 'left' : 'center', bdrColor: NAVY });
  });
  ["Driver's Name", ...ARR_SLOTS, 'Total'].forEach((v, i) => {
    const c = ws.getRow(r).getCell(7 + i);
    c.value = v;
    sc(c, { bg: NAVY, bold: true, color: WHITE, h: i === 0 ? 'left' : 'center', bdrColor: NAVY });
  });
  r++;

  // Driver rows (both sides on same row)
  drivers.forEach((d, idx) => {
    const s = stats.get(d)!;
    const depTotal = s.dep.reduce((a, b) => a + b, 0);
    const arrTotal = s.arr.reduce((a, b) => a + b, 0);
    ws.getRow(r).height = 16;

    [d, ...s.dep, depTotal].forEach((v, i) => {
      const c = ws.getRow(r).getCell(i + 1);
      c.value = v;
      sc(c, { bg: i === 0 ? GOLD : (idx % 2 === 1 ? EVEN : WHITE), bold: i === 0, color: DARKER, h: i === 0 ? 'left' : 'center' });
    });
    [d, ...s.arr, arrTotal].forEach((v, i) => {
      const c = ws.getRow(r).getCell(7 + i);
      c.value = v;
      sc(c, { bg: i === 0 ? GOLD : (idx % 2 === 1 ? EVEN : WHITE), bold: i === 0, color: DARKER, h: i === 0 ? 'left' : 'center' });
    });
    r++;
  });

  // Totals row (both sides)
  const depTot  = [0, 1, 2, 3].map(i => [...stats.values()].reduce((n, s) => n + s.dep[i], 0));
  const arrTot  = [0, 1, 2, 3].map(i => [...stats.values()].reduce((n, s) => n + s.arr[i], 0));
  const depGrand = depTot.reduce((a, b) => a + b, 0);
  const arrGrand = arrTot.reduce((a, b) => a + b, 0);
  ws.getRow(r).height = 16;
  ['TOTALS', ...depTot, depGrand].forEach((v, i) => {
    const c = ws.getRow(r).getCell(i + 1);
    c.value = v;
    sc(c, { bg: NAVY, bold: true, color: WHITE, h: i === 0 ? 'left' : 'center', bdrColor: NAVY });
  });
  ['TOTALS', ...arrTot, arrGrand].forEach((v, i) => {
    const c = ws.getRow(r).getCell(7 + i);
    c.value = v;
    sc(c, { bg: NAVY, bold: true, color: WHITE, h: i === 0 ? 'left' : 'center', bdrColor: NAVY });
  });
  r++;

  // Cumulative Total Number row (both sides)
  const depCuml = depTot.map((_, i) => depTot.slice(0, i + 1).reduce((a, b) => a + b, 0));
  const arrCuml = arrTot.map((_, i) => arrTot.slice(0, i + 1).reduce((a, b) => a + b, 0));
  ws.getRow(r).height = 16;
  ['TOTAL NUMBER', ...depCuml, depGrand].forEach((v, i) => {
    const c = ws.getRow(r).getCell(i + 1);
    c.value = v;
    sc(c, { bg: 'FFDDEBF7', bold: true, color: DARKER, h: i === 0 ? 'left' : 'center' });
  });
  ['TOTAL NUMBER', ...arrCuml, arrGrand].forEach((v, i) => {
    const c = ws.getRow(r).getCell(7 + i);
    c.value = v;
    sc(c, { bg: 'FFDDEBF7', bold: true, color: DARKER, h: i === 0 ? 'left' : 'center' });
  });
  r++;

  // Percentage row (both sides)
  ws.getRow(r).height = 16;
  ['PERCENTAGE', ...depTot.map(t => pct(t, depGrand)), 1].forEach((v, i) => {
    const c = ws.getRow(r).getCell(i + 1);
    c.value = v;
    sc(c, { bg: DARKER, bold: true, color: GOLD, h: i === 0 ? 'left' : 'center', fmt: i >= 1 ? '0.00%' : undefined, bdrColor: DARKER });
  });
  ['PERCENTAGE', ...arrTot.map(t => pct(t, arrGrand)), 1].forEach((v, i) => {
    const c = ws.getRow(r).getCell(7 + i);
    c.value = v;
    sc(c, { bg: DARKER, bold: true, color: GOLD, h: i === 0 ? 'left' : 'center', fmt: i >= 1 ? '0.00%' : undefined, bdrColor: DARKER });
  });
  r++;

  // Blank spacer
  ws.getRow(r).height = 8;
  r++;

  // ── Area Coverage section ────────────────────────────────────────────────────
  // Left  (A–C): group detail tables
  // Right (G–K): area summary by group
  // Right extra: TOTAL AREA COVERED

  // Section label spanning full width
  ws.mergeCells(r, 1, r, TOTAL_COLS);
  const areaLbl = ws.getRow(r).getCell(1);
  areaLbl.value = `DELIVERY ${month} ${year}  —  AREA COVERAGE`;
  areaLbl.fill = fillSolid(NAVY);
  areaLbl.font = { bold: true, size: 11, color: { argb: GOLD } };
  areaLbl.alignment = { vertical: 'middle', horizontal: 'center' };
  areaLbl.border = bdr(NAVY);
  ws.getRow(r).height = 18;
  r++;

  // Detail header (A–C)
  ws.getRow(r).height = 16;
  ['Area Group / Location', 'Area / Subarea', 'Count'].forEach((v, i) => {
    const c = ws.getRow(r).getCell(i + 1);
    c.value = v;
    sc(c, { bg: NAVY, bold: true, color: WHITE, h: i <= 1 ? 'left' : 'center', bdrColor: NAVY });
  });

  // Summary header (G–K)
  ['Area Group', 'Total Deliveries', '% of All', 'Drivers Active', 'Avg/Driver'].forEach((v, i) => {
    const c = ws.getRow(r).getCell(7 + i);
    c.value = v;
    sc(c, { bg: NAVY, bold: true, color: WHITE, h: i === 0 ? 'left' : 'center', bdrColor: NAVY });
  });
  r++;

  const totalDeliveries = deliveries.length;
  const summaryStartRow = r;

  // Build summary data per group
  const groupSummary: { label: string; total: number; driverCount: number }[] = [];
  for (const group of AREA_GROUPS) {
    const groupAreas = group.areas.filter(a => deliveries.some(d => d.area === a));
    const groupTotal = groupAreas.reduce((n, a) => n + deliveries.filter(d => d.area === a).length, 0);
    if (groupTotal === 0) continue;

    const activeDrivers = new Set(deliveries.filter(d => groupAreas.includes(d.area ?? '')).map(d => d.driver).filter(Boolean)).size;
    groupSummary.push({ label: group.label, total: groupTotal, driverCount: activeDrivers });

    // Detail rows
    let first = true;
    for (const area of groupAreas) {
      const cnt = deliveries.filter(d => d.area === area).length;
      if (cnt === 0) continue;
      ws.getRow(r).height = 15;

      const labelCell = ws.getRow(r).getCell(1);
      labelCell.value = first ? group.label : '';
      sc(labelCell, { bg: first ? LTGOLD : WHITE, bold: first, color: DARKER, h: 'left' });

      const areaCell = ws.getRow(r).getCell(2);
      areaCell.value = area;
      sc(areaCell, { bg: WHITE, color: DARKER, h: 'left' });

      const cntCell = ws.getRow(r).getCell(3);
      cntCell.value = cnt;
      sc(cntCell, { bg: WHITE, color: DARKER, h: 'center' });

      first = false;
      r++;
    }

    // Group subtotal
    ws.getRow(r).height = 15;
    ws.mergeCells(r, 1, r, 2);
    const stLabel = ws.getRow(r).getCell(1);
    stLabel.value = `${group.label.split(' — ')[0]} SUBTOTAL`;
    sc(stLabel, { bg: GOLD, bold: true, color: DARKER, h: 'left' });

    const stCnt = ws.getRow(r).getCell(3);
    stCnt.value = groupTotal;
    sc(stCnt, { bg: GOLD, bold: true, color: DARKER, h: 'center' });
    r++;

    ws.getRow(r).height = 4;
    r++;
  }

  // Summary table on the right (G–K), starting at summaryStartRow
  let sr = summaryStartRow;
  for (const gs of groupSummary) {
    ws.getRow(sr).height = 15;
    const avgPerDriver = gs.driverCount > 0 ? Math.round(gs.total / gs.driverCount) : 0;
    [gs.label, gs.total, pct(gs.total, totalDeliveries), gs.driverCount, avgPerDriver].forEach((v, i) => {
      const c = ws.getRow(sr).getCell(7 + i);
      c.value = v;
      sc(c, { bg: i === 0 ? LTGOLD : WHITE, bold: i === 0, color: DARKER, h: i === 0 ? 'left' : 'center', fmt: i === 2 ? '0.00%' : undefined });
    });
    sr++;
  }

  // TOTAL AREA COVERED
  const allAreaCount = AREA_GROUPS.flatMap(g => g.areas).reduce((n, a) => n + deliveries.filter(d => d.area === a).length, 0);
  ws.getRow(sr).height = 16;
  ws.mergeCells(sr, 7, sr, 8);
  const totAreaLbl = ws.getRow(sr).getCell(7);
  totAreaLbl.value = 'TOTAL AREA COVERED';
  sc(totAreaLbl, { bg: NAVY, bold: true, color: GOLD, h: 'center', bdrColor: NAVY });

  const totAreaCnt = ws.getRow(sr).getCell(9);
  totAreaCnt.value = allAreaCount;
  sc(totAreaCnt, { bg: NAVY, bold: true, color: WHITE, h: 'center', bdrColor: NAVY });

  const totAreaPct = ws.getRow(sr).getCell(10);
  totAreaPct.value = pct(allAreaCount, totalDeliveries);
  sc(totAreaPct, { bg: NAVY, bold: true, color: WHITE, h: 'center', fmt: '0.00%', bdrColor: NAVY });

  const totAllCell = ws.getRow(sr).getCell(11);
  totAllCell.value = totalDeliveries;
  sc(totAllCell, { bg: DARKER, bold: true, color: GOLD, h: 'center', bdrColor: DARKER });
}

// ─── Excel Sheet 2: Summary ──────────────────────────────────────────────────

function buildSheet2(
  ws: any,
  deliveries: DeliveryRecord[],
  assigned: DeliveryRecord[],
  drivers: string[],
  stats: Map<string, DriverStats>,
  month: string, year: number,
  byName: string, byRole: string,
) {
  const MAIN_C  = 15;
  const VEH_START = 17;

  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 5 }];
  ws.getColumn(1).width  = 26;
  for (let c = 2; c <= 5; c++)  ws.getColumn(c).width = 13;
  for (let c = 6; c <= 10; c++) ws.getColumn(c).width = 14;
  for (let c = 11; c <= 15; c++) ws.getColumn(c).width = 14;
  ws.getColumn(16).width = 4;
  ws.getColumn(17).width = 22;
  for (let c = 18; c <= 20; c++) ws.getColumn(c).width = 13;

  let r = 1;

  // Title block (3 rows)
  for (let rr = 1; rr <= 3; rr++) {
    ws.mergeCells(rr, 1, rr, MAIN_C);
    ws.getRow(rr).getCell(1).fill = fillSolid(NAVY);
    ws.getRow(rr).getCell(1).border = bdr(NAVY);
    ws.getRow(rr).height = rr === 1 ? 24 : 14;
  }
  const t1 = ws.getRow(1).getCell(1);
  t1.value = `SUMMARY — DRIVER REPORT ${month} ${year}`;
  t1.font = { bold: true, size: 14, color: { argb: GOLD } };
  t1.alignment = { vertical: 'middle', horizontal: 'center' };

  const t2 = ws.getRow(2).getCell(1);
  t2.value = 'Microgenesis Industrial and Commercial Products Corp.';
  t2.font = { bold: true, size: 10, color: { argb: WHITE } };
  t2.alignment = { vertical: 'middle', horizontal: 'center' };

  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const t3 = ws.getRow(3).getCell(1);
  t3.value = `Generated by: ${byName} (${byRole})  ·  ${dateStr}`;
  t3.font = { italic: true, size: 9, color: { argb: 'FFCCCCCC' } };
  t3.alignment = { vertical: 'middle', horizontal: 'center' };
  r = 4;

  // Group header row (section spans)
  ws.getRow(r).height = 18;
  const grpSpans = [
    { label: "Driver's Name",       start: 1,  end: 1,  bg: NAVY,    color: WHITE },
    { label: 'Delivery Performance', start: 2,  end: 5,  bg: 'FF2E5496', color: WHITE },
    { label: 'Departure Time',       start: 6,  end: 10, bg: 'FF1F4E79', color: WHITE },
    { label: 'Arrival Time',         start: 11, end: 15, bg: 'FF833C00', color: WHITE },
  ];
  for (const g of grpSpans) {
    if (g.start < g.end) ws.mergeCells(r, g.start, r, g.end);
    const cell = ws.getRow(r).getCell(g.start);
    cell.value = g.label;
    cell.fill = fillSolid(g.bg);
    cell.font = { bold: true, size: 10, color: { argb: g.color } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = bdr(g.bg);
  }
  // Vehicle section group
  ws.mergeCells(r, VEH_START, r, VEH_START + 3);
  const vGrp = ws.getRow(r).getCell(VEH_START);
  vGrp.value = 'Vehicle Plate Breakdown';
  vGrp.fill = fillSolid('FF4D4D4D');
  vGrp.font = { bold: true, size: 10, color: { argb: WHITE } };
  vGrp.alignment = { vertical: 'middle', horizontal: 'center' };
  vGrp.border = bdr('FF4D4D4D');
  r++;

  // Column sub-headers
  const DEP_SLOTS = ['8:00–8:30', '8:30–9:00', '9:00–9:30', '9:30+', 'Total'];
  const ARR_SLOTS = ['6:00–6:30pm', '6:30–7:00pm', '7:00–7:30pm', '7:30pm+', 'Total'];
  ws.getRow(r).height = 18;

  ["Driver's Name", 'Accomplished', 'Resched/Hold', 'Pending', 'Total', ...DEP_SLOTS, ...ARR_SLOTS].forEach((v, i) => {
    const c = ws.getRow(r).getCell(i + 1);
    c.value = v;
    sc(c, { bg: NAVY, bold: true, color: WHITE, h: i === 0 ? 'left' : 'center', bdrColor: NAVY });
  });
  ['Vehicle', 'Accomplished', 'Resched/Hold', 'Pending'].forEach((v, i) => {
    const c = ws.getRow(r).getCell(VEH_START + i);
    c.value = v;
    sc(c, { bg: 'FF4D4D4D', bold: true, color: WHITE, h: i === 0 ? 'left' : 'center', bdrColor: '4D4D4D' });
  });
  r++;

  // Driver data rows
  drivers.forEach((d, idx) => {
    const s = stats.get(d)!;
    const perfTotal = s.acc + s.rh + s.pend;
    const depTotal  = s.dep.reduce((a, b) => a + b, 0);
    const arrTotal  = s.arr.reduce((a, b) => a + b, 0);
    ws.getRow(r).height = 16;
    [d, s.acc, s.rh, s.pend, perfTotal, ...s.dep, depTotal, ...s.arr, arrTotal].forEach((v, i) => {
      const c = ws.getRow(r).getCell(i + 1);
      c.value = v;
      sc(c, {
        bg: i === 0 ? GOLD : (idx % 2 === 1 ? EVEN : WHITE),
        bold: i === 0, color: DARKER,
        h: i === 0 ? 'left' : 'center',
      });
    });
    r++;
  });

  // TOTALS + PERCENTAGE
  const totAcc  = [...stats.values()].reduce((n, s) => n + s.acc, 0);
  const totRH   = [...stats.values()].reduce((n, s) => n + s.rh, 0);
  const totPend = [...stats.values()].reduce((n, s) => n + s.pend, 0);
  const grand   = totAcc + totRH + totPend;
  const depTot  = [0, 1, 2, 3].map(i => [...stats.values()].reduce((n, s) => n + s.dep[i], 0));
  const arrTot  = [0, 1, 2, 3].map(i => [...stats.values()].reduce((n, s) => n + s.arr[i], 0));
  const depGrand = depTot.reduce((a, b) => a + b, 0);
  const arrGrand = arrTot.reduce((a, b) => a + b, 0);

  ws.getRow(r).height = 16;
  ['TOTALS', totAcc, totRH, totPend, grand, ...depTot, depGrand, ...arrTot, arrGrand].forEach((v, i) => {
    const c = ws.getRow(r).getCell(i + 1);
    c.value = v;
    sc(c, { bg: NAVY, bold: true, color: WHITE, h: i === 0 ? 'left' : 'center', bdrColor: NAVY });
  });
  r++;

  ws.getRow(r).height = 16;
  const pctVals = [
    'PERCENTAGE',
    pct(totAcc, grand), pct(totRH, grand), pct(totPend, grand), 1,
    ...depTot.map(t => pct(t, depGrand)), 1,
    ...arrTot.map(t => pct(t, arrGrand)), 1,
  ];
  pctVals.forEach((v, i) => {
    const c = ws.getRow(r).getCell(i + 1);
    c.value = v;
    sc(c, { bg: DARKER, bold: true, color: GOLD, h: i === 0 ? 'left' : 'center', fmt: i >= 1 ? '0.00%' : undefined, bdrColor: DARKER });
  });
  r++;

  // Vehicle breakdown (right side, starting at data rows)
  const allVehicles = [...new Set(assigned.map(rec => rec.vehicle?.trim()).filter(Boolean) as string[])].sort();
  let vr = 6; // data starts at row 6 (after 3 title + 1 group hdr + 1 col hdr)
  for (const v of allVehicles) {
    const recs = assigned.filter(rec => rec.vehicle?.trim() === v);
    ws.getRow(vr).height = 15;
    const plateCell = ws.getRow(vr).getCell(VEH_START);
    plateCell.value = v;
    sc(plateCell, { bg: WHITE, color: DARKER, h: 'left' });
    const vAcc = ws.getRow(vr).getCell(VEH_START + 1);
    vAcc.value = recs.filter(rec => rec.status === 'Delivered').length;
    sc(vAcc, { bg: WHITE, color: DARKER, h: 'center' });
    const vRH = ws.getRow(vr).getCell(VEH_START + 2);
    vRH.value = recs.filter(rec => rec.status === 'Rescheduled' || rec.status === 'On-Hold').length;
    sc(vRH, { bg: WHITE, color: DARKER, h: 'center' });
    const vPend = ws.getRow(vr).getCell(VEH_START + 3);
    vPend.value = recs.filter(rec => rec.status === 'Pending' || rec.status === 'Scheduled').length;
    sc(vPend, { bg: WHITE, color: DARKER, h: 'center' });
    vr++;
  }

  // Driver remarks below main table
  r += 2;
  ws.mergeCells(r, 1, r, 5);
  const rmkHdr = ws.getRow(r).getCell(1);
  rmkHdr.value = 'DRIVER REMARKS (most recent per driver)';
  rmkHdr.fill = fillSolid(NAVY);
  rmkHdr.font = { bold: true, size: 10, color: { argb: GOLD } };
  rmkHdr.alignment = { vertical: 'middle', horizontal: 'left' };
  rmkHdr.border = bdr(NAVY);
  ws.getRow(r).height = 18;
  r++;

  ws.getRow(r).height = 16;
  ["Driver's Name", 'Last Remark', null, null, null].forEach((v, i) => {
    const c = ws.getRow(r).getCell(i + 1);
    if (v !== null) c.value = v;
    sc(c, { bg: NAVY, bold: true, color: WHITE, h: i === 0 ? 'left' : 'center', bdrColor: NAVY });
  });
  ws.mergeCells(r, 2, r, 5);
  r++;

  drivers.forEach((d, idx) => {
    const s = stats.get(d)!;
    ws.getRow(r).height = 20;
    const nameCell = ws.getRow(r).getCell(1);
    nameCell.value = d;
    sc(nameCell, { bg: idx % 2 === 1 ? EVEN : WHITE, color: DARKER, bold: true, h: 'left' });
    ws.mergeCells(r, 2, r, 5);
    const rmkCell = ws.getRow(r).getCell(2);
    rmkCell.value = s.lastRemark || '—';
    sc(rmkCell, { bg: idx % 2 === 1 ? EVEN : WHITE, color: DARKER, h: 'left', wrap: true, italic: !s.lastRemark });
    r++;
  });
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

async function exportPDF(
  deliveries: DeliveryRecord[],
  drivers: string[],
  stats: Map<string, DriverStats>,
  month: string, year: number,
  byName: string, byRole: string,
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const NAVY_RGB: [number, number, number] = [31, 56, 100];
  const GOLD_RGB: [number, number, number] = [255, 192, 0];
  const DARK_RGB: [number, number, number] = [13, 27, 42];
  const pageW = doc.internal.pageSize.getWidth();
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Header
  doc.setFillColor(...NAVY_RGB);
  doc.rect(0, 0, pageW, 20, 'F');
  doc.setTextColor(...GOLD_RGB);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`DELIVERY REPORT — ${month} ${year}`, pageW / 2, 9, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 200);
  doc.text(`Generated by: ${byName} (${byRole})  ·  ${dateStr}`, pageW / 2, 15, { align: 'center' });

  let y = 24;

  const headStyle = { fillColor: NAVY_RGB as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const };

  // Section 1: Delivery Performance
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY_RGB);
  doc.text('DELIVERY PERFORMANCE', 14, y);
  y += 3;

  const perfRows = drivers.map(d => {
    const s = stats.get(d)!;
    const total = s.acc + s.rh + s.pend;
    return [d, s.acc, s.rh, s.pend, total];
  });
  const totAcc  = [...stats.values()].reduce((n, s) => n + s.acc, 0);
  const totRH   = [...stats.values()].reduce((n, s) => n + s.rh, 0);
  const totPend = [...stats.values()].reduce((n, s) => n + s.pend, 0);
  const grand   = totAcc + totRH + totPend;
  perfRows.push(['TOTALS', totAcc, totRH, totPend, grand] as any);

  autoTable(doc, {
    startY: y,
    head: [["Driver's Name", 'Accomplished', 'Resched / Hold', 'Pending', 'Total Deliveries']],
    body: perfRows,
    headStyles: headStyle,
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { halign: 'left' } },
    didParseCell: (data: any) => {
      if (data.row.index === perfRows.length - 1) {
        data.cell.styles.fillColor = NAVY_RGB;
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Section 2: Departure Time
  if (y > 170) { doc.addPage(); y = 14; }
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY_RGB);
  doc.text('DEPARTURE TIME BREAKDOWN', 14, y);
  y += 3;

  const DEP_SLOTS = ['8:00–8:30am', '8:30–9:00am', '9:00–9:30am', '9:30am+'];
  const depRows = drivers.map(d => {
    const s = stats.get(d)!;
    return [d, ...s.dep, s.dep.reduce((a, b) => a + b, 0)];
  });
  const depTot = [0, 1, 2, 3].map(i => [...stats.values()].reduce((n, s) => n + s.dep[i], 0));
  depRows.push(['TOTALS', ...depTot, depTot.reduce((a, b) => a + b, 0)] as any);

  autoTable(doc, {
    startY: y,
    head: [["Driver's Name", ...DEP_SLOTS, 'Total']],
    body: depRows,
    headStyles: headStyle,
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { halign: 'left' } },
    didParseCell: (data: any) => {
      if (data.row.index === depRows.length - 1) {
        data.cell.styles.fillColor = NAVY_RGB;
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Section 3: Arrival Time
  if (y > 170) { doc.addPage(); y = 14; }
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY_RGB);
  doc.text('ARRIVAL TIME BREAKDOWN', 14, y);
  y += 3;

  const ARR_SLOTS = ['6:00–6:30pm', '6:30–7:00pm', '7:00–7:30pm', '7:30pm+'];
  const arrRows = drivers.map(d => {
    const s = stats.get(d)!;
    return [d, ...s.arr, s.arr.reduce((a, b) => a + b, 0)];
  });
  const arrTot = [0, 1, 2, 3].map(i => [...stats.values()].reduce((n, s) => n + s.arr[i], 0));
  arrRows.push(['TOTALS', ...arrTot, arrTot.reduce((a, b) => a + b, 0)] as any);

  autoTable(doc, {
    startY: y,
    head: [["Driver's Name", ...ARR_SLOTS, 'Total']],
    body: arrRows,
    headStyles: headStyle,
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { halign: 'left' } },
    didParseCell: (data: any) => {
      if (data.row.index === arrRows.length - 1) {
        data.cell.styles.fillColor = NAVY_RGB;
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  doc.save(`Microgenesis_Driver_Report_${month}_${year}.pdf`);
}

// ─── DOCX Export ──────────────────────────────────────────────────────────────

async function exportDOCX(
  drivers: string[],
  stats: Map<string, DriverStats>,
  month: string, year: number,
  byName: string, byRole: string,
): Promise<void> {
  const {
    Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
    AlignmentType, WidthType, PageOrientation,
  } = await import('docx');

  const CONTENT_W = 15398;
  const navyFill = '1F3864';
  const goldColor = 'FFC000';
  const darkColor = '0D1B2A';
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  function bSet(color = 'E2E8F0', size = 4) {
    return { style: 'single' as const, size, color };
  }
  function cBorders(color?: string, size?: number) {
    const b = bSet(color, size);
    return { top: b, bottom: b, left: b, right: b };
  }

  function makeHdrCell(text: string, w: number) {
    return new TableCell({
      shading: { fill: navyFill },
      borders: cBorders(navyFill, 2),
      width: { size: w, type: WidthType.DXA },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 18 })],
      })],
    });
  }

  function makeDataCell(text: string, w: number, isName = false) {
    return new TableCell({
      shading: isName ? { fill: 'FFF2CC' } : undefined,
      borders: cBorders(),
      width: { size: w, type: WidthType.DXA },
      children: [new Paragraph({
        alignment: isName ? AlignmentType.LEFT : AlignmentType.CENTER,
        children: [new TextRun({ text, size: 17, bold: isName })],
      })],
    });
  }

  function buildTable(headers: string[], rows: (string | number)[][]): InstanceType<typeof Table> {
    const colW = Math.floor(CONTENT_W / headers.length);
    const lastW = CONTENT_W - colW * (headers.length - 1);

    const hdrRow = new TableRow({
      tableHeader: true,
      children: headers.map((h, i) => makeHdrCell(h, i === headers.length - 1 ? lastW : colW)),
    });

    const dataRows = rows.map(row =>
      new TableRow({
        children: row.map((v, i) => makeDataCell(String(v), i === row.length - 1 ? lastW : colW, i === 0)),
      }),
    );

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [hdrRow, ...dataRows],
    });
  }

  const perfHeaders = ["Driver's Name", 'Accomplished', 'Resched / Hold', 'Pending', 'Total'];
  const perfRows = drivers.map(d => {
    const s = stats.get(d)!;
    return [d, s.acc, s.rh, s.pend, s.acc + s.rh + s.pend];
  });
  const tA = [...stats.values()].reduce((n, s) => n + s.acc, 0);
  const tR = [...stats.values()].reduce((n, s) => n + s.rh, 0);
  const tP = [...stats.values()].reduce((n, s) => n + s.pend, 0);
  perfRows.push(['TOTALS', tA, tR, tP, tA + tR + tP]);

  const depHeaders = ["Driver's Name", '8:00–8:30am', '8:30–9:00am', '9:00–9:30am', '9:30am+', 'Total'];
  const depRows = drivers.map(d => {
    const s = stats.get(d)!;
    return [d, ...s.dep, s.dep.reduce((a, b) => a + b, 0)];
  });
  const depTot = [0, 1, 2, 3].map(i => [...stats.values()].reduce((n, s) => n + s.dep[i], 0));
  depRows.push(['TOTALS', ...depTot, depTot.reduce((a, b) => a + b, 0)]);

  const arrHeaders = ["Driver's Name", '6:00–6:30pm', '6:30–7:00pm', '7:00–7:30pm', '7:30pm+', 'Total'];
  const arrRows = drivers.map(d => {
    const s = stats.get(d)!;
    return [d, ...s.arr, s.arr.reduce((a, b) => a + b, 0)];
  });
  const arrTot = [0, 1, 2, 3].map(i => [...stats.values()].reduce((n, s) => n + s.arr[i], 0));
  arrRows.push(['TOTALS', ...arrTot, arrTot.reduce((a, b) => a + b, 0)]);

  function sectionPara(text: string) {
    return new Paragraph({
      children: [new TextRun({ text, bold: true, size: 22, color: navyFill })],
      spacing: { before: 240, after: 80 },
    });
  }

  const doc = new Document({
    creator: 'Microgenesis Business Systems',
    title: `Driver Report ${month} ${year}`,
    sections: [{
      properties: {
        page: {
          size: { orientation: PageOrientation.LANDSCAPE, width: 16838, height: 11906 },
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `DELIVERY REPORT — ${month} ${year}`, bold: true, size: 32, color: navyFill })],
          spacing: { after: 40 },
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'Microgenesis Industrial and Commercial Products Corp.', bold: true, size: 20, color: navyFill })],
          spacing: { after: 40 },
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `Generated by: ${byName} (${byRole})  ·  ${dateStr}`, size: 17, color: '64748B' })],
          spacing: { after: 200 },
        }),

        sectionPara('SECTION 1 — DELIVERY PERFORMANCE'),
        buildTable(perfHeaders, perfRows),

        sectionPara('SECTION 2 — DEPARTURE TIME BREAKDOWN'),
        buildTable(depHeaders, depRows),

        sectionPara('SECTION 3 — ARRIVAL TIME BREAKDOWN'),
        buildTable(arrHeaders, arrRows),

        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: `Microgenesis Business Systems — Confidential`, size: 16, color: '94A3B8' })],
          spacing: { before: 200 },
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `Microgenesis_Driver_Report_${month}_${year}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCSV(
  drivers: string[],
  stats: Map<string, DriverStats>,
  month: string, year: number,
  byName: string, byRole: string,
): void {
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const rows: string[][] = [
    ['Microgenesis Business Systems'],
    [`Monthly Driver Report — ${month} ${year}`],
    [`Generated by: ${byName} (${byRole}) on ${dateStr}`],
    [],
    ["Driver's Name", 'Accomplished', 'Resched / Hold', 'Pending', 'Total Deliveries'],
  ];

  for (const d of drivers) {
    const s = stats.get(d)!;
    rows.push([d, String(s.acc), String(s.rh), String(s.pend), String(s.acc + s.rh + s.pend)]);
  }

  const totAcc  = [...stats.values()].reduce((n, s) => n + s.acc, 0);
  const totRH   = [...stats.values()].reduce((n, s) => n + s.rh, 0);
  const totPend = [...stats.values()].reduce((n, s) => n + s.pend, 0);
  rows.push(['TOTALS', String(totAcc), String(totRH), String(totPend), String(totAcc + totRH + totPend)]);

  const csv = rows
    .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
  const a   = document.createElement('a');
  a.href     = url;
  a.download = `Microgenesis_Driver_Report_${month}_${year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function downloadDriverReport(
  records: DeliveryRecord[],
  month: number,
  year: number,
  format: 'excel' | 'pdf' | 'docx' | 'csv',
  generatedByName: string,
  generatedByRole: string,
): Promise<void> {
  const mo = monthName(month);

  const deliveries = records.filter(r => {
    if (!r.delivery_date) return false;
    const d = new Date(r.delivery_date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  const assigned = deliveries.filter(r => r.driver?.trim());
  const drivers  = [...new Set(assigned.map(r => r.driver!.trim()))].sort();
  const stats    = buildDriverStats(drivers, assigned);

  if (format === 'csv') {
    exportCSV(drivers, stats, mo, year, generatedByName, generatedByRole);
    return;
  }

  if (format === 'pdf') {
    await exportPDF(deliveries, drivers, stats, mo, year, generatedByName, generatedByRole);
    return;
  }

  if (format === 'docx') {
    await exportDOCX(drivers, stats, mo, year, generatedByName, generatedByRole);
    return;
  }

  // Excel
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = generatedByName;
  wb.created = new Date();

  buildSheet1(wb.addWorksheet('Monthly Report'), deliveries, assigned, drivers, stats, mo, year, generatedByName, generatedByRole);
  buildSheet2(wb.addWorksheet('Summary'),        deliveries, assigned, drivers, stats, mo, year, generatedByName, generatedByRole);

  const buf  = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `Microgenesis_Driver_Report_${mo}_${year}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
