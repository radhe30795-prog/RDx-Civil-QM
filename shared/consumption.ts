// ============================================================
// RDx Civil QM — Consumption Statement (RA Bill format)
// Package CG 16-M-47 style: work item + net qty → material-wise
// theoretical consumption. All ratios editable in settings.
// ============================================================

export type StmtItem =
  | "M-10" | "M-15" | "M-25" | "M-30"
  | "Back Filling" | "WMM" | "GSB" | "WBM"
  | "Prime Coat" | "Tack Coat" | "Seal Coat"
  | "PMC" | "DBM" | "BC" | "Pot Holes" | "Filter Media";

export const STMT_ITEMS: StmtItem[] = [
  "M-10", "M-15", "M-25", "M-30",
  "Back Filling", "WMM", "GSB", "WBM",
  "Prime Coat", "Tack Coat", "Seal Coat",
  "PMC", "DBM", "BC", "Pot Holes", "Filter Media",
];

export type MatCol = "metal" | "moorum" | "sand" | "ss1" | "rs1" | "vg30";

export const MAT_COLUMNS: { key: MatCol; label: string; unit: string }[] = [
  { key: "metal", label: "Metal", unit: "cum" },
  { key: "moorum", label: "Moorum", unit: "cum" },
  { key: "sand", label: "Sand/Dust", unit: "cum" },
  { key: "ss1", label: "SS-1", unit: "MT" },
  { key: "rs1", label: "RS-1", unit: "MT" },
  { key: "vg30", label: "VG-30", unit: "MT" },
];

export interface StmtNorm {
  item: StmtItem;
  unit: "cum" | "sqm";
  /** material qty per 1 unit of work (cum→cum or MT as per column) */
  ratios: Partial<Record<MatCol, number>>;
}

export const DEFAULT_NORMS: Record<StmtItem, StmtNorm> = {
  "M-10": { item: "M-10", unit: "cum", ratios: { metal: 0.89, sand: 0.445 } },
  "M-15": { item: "M-15", unit: "cum", ratios: { metal: 0.89, sand: 0.445 } },
  "M-25": { item: "M-25", unit: "cum", ratios: { metal: 0.89, sand: 0.445 } },
  "M-30": { item: "M-30", unit: "cum", ratios: { metal: 0.89, sand: 0.445 } },
  "Back Filling": { item: "Back Filling", unit: "cum", ratios: { moorum: 1.0 } },
  WMM: { item: "WMM", unit: "cum", ratios: { metal: 1.0 } },
  GSB: { item: "GSB", unit: "cum", ratios: { metal: 1.0 } },
  WBM: { item: "WBM", unit: "cum", ratios: { metal: 1.0, moorum: 0.15 } },
  "Prime Coat": { item: "Prime Coat", unit: "sqm", ratios: { ss1: 0.001 } }, // 1.0 kg/sqm → MT
  "Tack Coat": { item: "Tack Coat", unit: "sqm", ratios: { rs1: 0.0003 } }, // 0.30 kg/sqm → MT
  "Seal Coat": { item: "Seal Coat", unit: "sqm", ratios: { metal: 0.009, ss1: 0.0009 } },
  PMC: { item: "PMC", unit: "cum", ratios: { metal: 1.0, vg30: 0.05 } },
  DBM: { item: "DBM", unit: "cum", ratios: { metal: 2.2, vg30: 0.10575 } }, // 2.35 t/cum × 4.5%
  BC: { item: "BC", unit: "cum", ratios: { metal: 2.2, vg30: 0.1269 } }, // 2.35 t/cum × 5.4%
  "Pot Holes": { item: "Pot Holes", unit: "cum", ratios: { metal: 1.0, vg30: 0.1269 } },
  "Filter Media": { item: "Filter Media", unit: "cum", ratios: { metal: 0.4, moorum: 0.2, sand: 0.4 } },
};

export interface StmtRowInput {
  item: StmtItem;
  qty: number;
}

export interface StmtRowResult extends StmtRowInput {
  unit: string;
  vals: Record<MatCol, number>;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

/** Compute consumption statement rows + column totals. */
export function computeStatement(
  rows: StmtRowInput[],
  norms: Record<StmtItem, StmtNorm>
): { rows: StmtRowResult[]; totals: Record<MatCol, number> } {
  const out: StmtRowResult[] = [];
  const totals: Record<MatCol, number> = { metal: 0, moorum: 0, sand: 0, ss1: 0, rs1: 0, vg30: 0 };
  for (const r of rows) {
    const norm = norms[r.item];
    const vals: Record<MatCol, number> = { metal: 0, moorum: 0, sand: 0, ss1: 0, rs1: 0, vg30: 0 };
    if (norm && r.qty > 0) {
      (Object.keys(norm.ratios) as MatCol[]).forEach((m) => {
        const v = r2(r.qty * (norm.ratios[m] || 0));
        vals[m] = v;
        totals[m] = r2(totals[m] + v);
      });
    }
    out.push({ ...r, unit: norm?.unit || "cum", vals });
  }
  return { rows: out, totals };
}

// ---------------- Royalty ----------------

export type RoyaltyItem = "Moorum" | "Sand" | "Metal";

export interface RoyaltyRow {
  item: RoyaltyItem;
  qty: number;
  rate: number;
  amount: number;
}

export function computeRoyalty(
  totals: Record<MatCol, number>,
  rates: Record<RoyaltyItem, number>
): RoyaltyRow[] {
  const map: [RoyaltyItem, MatCol][] = [
    ["Moorum", "moorum"],
    ["Sand", "sand"],
    ["Metal", "metal"],
  ];
  return map.map(([item, col]) => ({
    item,
    qty: totals[col],
    rate: rates[item] || 0,
    amount: r2(totals[col] * (rates[item] || 0)),
  }));
}

// ---------------- Settings persistence ----------------

const NORMS_KEY = "rdx-qm-stmt-norms";

export function loadNorms(): Record<StmtItem, StmtNorm> {
  try {
    const raw = localStorage.getItem(NORMS_KEY);
    if (!raw) return structuredClone(DEFAULT_NORMS);
    const parsed = JSON.parse(raw);
    // merge over defaults so new items always exist
    const merged = structuredClone(DEFAULT_NORMS) as Record<StmtItem, StmtNorm>;
    for (const k of Object.keys(parsed) as StmtItem[]) {
      if (merged[k] && parsed[k]) {
        merged[k] = { ...merged[k], unit: parsed[k].unit || merged[k].unit, ratios: { ...parsed[k].ratios } };
      }
    }
    return merged;
  } catch {
    return structuredClone(DEFAULT_NORMS);
  }
}

export function saveNorms(norms: Record<StmtItem, StmtNorm>) {
  try {
    localStorage.setItem(NORMS_KEY, JSON.stringify(norms));
  } catch {
    /* ignore */
  }
}
