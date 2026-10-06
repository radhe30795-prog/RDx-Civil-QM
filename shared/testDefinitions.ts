// ============================================================
// RDx Civil QM — Test Definitions (single source of truth)
// Each test: input fields -> auto calculations -> MoRTH/IS pass/fail
// Used by BOTH client (live form) and server (authoritative compute)
// ============================================================

export type FieldType = "number" | "text" | "select" | "date";

export interface TestField {
  key: string;
  label: string;
  unit?: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}

export interface TestCalc {
  key: string;
  label: string;
  unit?: string;
  decimals: number;
  formula: (g: CalcGetter) => number | null;
}

export interface CalcGetter {
  /** numeric value of a field or earlier calc (NaN if missing/invalid) */
  num: (key: string) => number;
  /** raw string value of a field */
  str: (key: string) => string;
}

export interface TestLimit {
  targetKey: string; // calc key (or field key)
  label: string;
  min?: number;
  max?: number;
  /** custom message shown on fail */
  note?: string;
  /** only apply this limit when field == equals (e.g. grade-dependent limits) */
  when?: { field: string; equals: string };
}

export type TestCategory =
  | "Soil"
  | "Aggregate"
  | "Bitumen"
  | "Bituminous Mix"
  | "Concrete"
  | "Cement"
  | "Steel";

export type WorkItem =
  | "Earthwork"
  | "GSB"
  | "WMM"
  | "DBM"
  | "BC"
  | "Prime Coat"
  | "Tack Coat"
  | "Concrete"
  | "Steel"
  | "Cement"
  | "Bitumen";

export const WORK_ITEMS: WorkItem[] = [
  "Earthwork", "GSB", "WMM", "DBM", "BC",
  "Prime Coat", "Tack Coat", "Concrete", "Steel", "Cement", "Bitumen",
];

export type FrequencyUnit = "cum" | "sqm" | "tonne" | "tanker" | "pour";

export const WORK_ITEM_UNITS: Record<WorkItem, FrequencyUnit[]> = {
  Earthwork: ["cum", "sqm"],
  GSB: ["cum", "sqm"],
  WMM: ["cum", "sqm"],
  DBM: ["cum", "tonne", "sqm"],
  BC: ["cum", "tonne", "sqm"],
  "Prime Coat": ["sqm"],
  "Tack Coat": ["sqm"],
  Concrete: ["cum"],
  Steel: ["tonne"],
  Cement: ["tonne"],
  Bitumen: ["tanker"],
};

export interface TestFrequency {
  qty: number;
  unit: FrequencyUnit;
  workItem: WorkItem;
  note?: string;
}

export interface TestDefinition {
  code: string;
  name: string;
  category: TestCategory;
  isCode: string;
  description: string;
  /** true → result is informational (NDT / record-only); status = "Indicative" when complete */
  indicative?: boolean;
  /** MoRTH test frequencies per work item (for Test Planner) */
  frequency?: TestFrequency[];
  fields: TestField[];
  calcs: TestCalc[];
  limits: TestLimit[];
}

const n = (
  key: string,
  label: string,
  unit?: string,
  required = true,
  placeholder?: string
): TestField => ({ key, label, unit, type: "number", required, placeholder });

const t = (key: string, label: string, required = false, placeholder?: string): TestField => ({
  key,
  label,
  type: "text",
  required,
  placeholder,
});

const sel = (key: string, label: string, options: string[], def?: string): TestField => ({
  key,
  label,
  type: "select",
  options,
  required: true,
  defaultValue: def,
});

// ============================================================
// SOIL
// ============================================================

const soilGSA: TestDefinition = {
  code: "SOIL-GSA",
  name: "Grain Size Analysis",
  category: "Soil",
  isCode: "IS 2720 (Part 4)",
  description: "Sieve analysis of soil — % passing each sieve, fines content.",
  frequency: [
    { qty: 3000, unit: "cum", workItem: "Earthwork" },
    { qty: 1000, unit: "cum", workItem: "GSB" },
  ],
  fields: [
    n("wt_total", "Total dry weight of sample", "g"),
    n("r_475", "Retained on 4.75 mm", "g"),
    n("r_236", "Retained on 2.36 mm", "g"),
    n("r_118", "Retained on 1.18 mm", "g"),
    n("r_600", "Retained on 600 micron", "g"),
    n("r_300", "Retained on 300 micron", "g"),
    n("r_150", "Retained on 150 micron", "g"),
    n("r_075", "Retained on 75 micron", "g"),
  ],
  calcs: [
    { key: "p_475", label: "% Passing 4.75 mm", unit: "%", decimals: 1, formula: g => { const t=g.num("wt_total"); return t>0 ? (t-g.num("r_475"))/t*100 : null; } },
    { key: "p_236", label: "% Passing 2.36 mm", unit: "%", decimals: 1, formula: g => { const t=g.num("wt_total"); return t>0 ? (t-g.num("r_475")-g.num("r_236"))/t*100 : null; } },
    { key: "p_600", label: "% Passing 600 micron", unit: "%", decimals: 1, formula: g => { const t=g.num("wt_total"); return t>0 ? (t-g.num("r_475")-g.num("r_236")-g.num("r_118")-g.num("r_600"))/t*100 : null; } },
    { key: "p_075", label: "% Passing 75 micron (fines)", unit: "%", decimals: 1, formula: g => { const t=g.num("wt_total"); const s=g.num("r_475")+g.num("r_236")+g.num("r_118")+g.num("r_600")+g.num("r_300")+g.num("r_150")+g.num("r_075"); return t>0 ? (t-s)/t*100 : null; } },
    { key: "gravel", label: "Gravel fraction (>4.75mm)", unit: "%", decimals: 1, formula: g => { const t=g.num("wt_total"); return t>0 ? g.num("r_475")/t*100 : null; } },
  ],
  limits: [
    { targetKey: "p_075", label: "Fines passing 75µ (GSB ref.)", max: 10, note: "MoRTH GSB: fines passing 75 micron should be within grading envelope (typ. ≤ 10%)" },
  ],
};

const soilLL: TestDefinition = {
  code: "SOIL-LL",
  name: "Liquid Limit (Casagrande)",
  category: "Soil",
  isCode: "IS 2720 (Part 5)",
  description: "One-point method: LL = w × (N/25)^0.121",
  frequency: [
    { qty: 3000, unit: "cum", workItem: "Earthwork" },
    { qty: 1000, unit: "cum", workItem: "GSB" },
  ],
  fields: [
    n("blows", "Number of blows (N)", "nos"),
    n("c_wet", "Container + wet soil", "g"),
    n("c_dry", "Container + dry soil", "g"),
    n("c_wt", "Container weight", "g"),
  ],
  calcs: [
    { key: "w_pct", label: "Water content at N blows", unit: "%", decimals: 2, formula: g => { const d=g.num("c_dry")-g.num("c_wt"); return d>0 ? (g.num("c_wet")-g.num("c_dry"))/d*100 : null; } },
    { key: "ll", label: "Liquid Limit", unit: "%", decimals: 1, formula: g => { const w=g.num("w_pct"); const nn=g.num("blows"); return (w>0&&nn>0) ? w*Math.pow(nn/25,0.121) : null; } },
  ],
  limits: [
    { targetKey: "ll", label: "Liquid Limit", max: 50, note: "MoRTH embankment/subgrade: LL ≤ 50%" },
  ],
};

const soilPLPI: TestDefinition = {
  code: "SOIL-PLPI",
  name: "Plastic Limit & Plasticity Index",
  category: "Soil",
  isCode: "IS 2720 (Part 5)",
  description: "PL from thread-rolling test; PI = LL − PL.",
  frequency: [
    { qty: 3000, unit: "cum", workItem: "Earthwork" },
    { qty: 1000, unit: "cum", workItem: "GSB" },
  ],
  fields: [
    n("ll_in", "Liquid Limit (from LL test)", "%"),
    n("p_wet", "Container + wet soil", "g"),
    n("p_dry", "Container + dry soil", "g"),
    n("p_wt", "Container weight", "g"),
  ],
  calcs: [
    { key: "pl", label: "Plastic Limit", unit: "%", decimals: 1, formula: g => { const d=g.num("p_dry")-g.num("p_wt"); return d>0 ? (g.num("p_wet")-g.num("p_dry"))/d*100 : null; } },
    { key: "pi", label: "Plasticity Index (PI)", unit: "%", decimals: 1, formula: g => g.num("ll_in")-g.num("pl") },
  ],
  limits: [
    { targetKey: "pi", label: "Plasticity Index", max: 25, note: "MoRTH subgrade: PI ≤ 25%" },
  ],
};

const proctorFields = (prefix: string): TestField[] => [
  n("mould_vol", "Volume of mould", "cc"),
  n("mould_wt", "Weight of mould", "g"),
  ...[1, 2, 3, 4, 5].flatMap(i => [
    n(`w${i}`, `Trial ${i} — water content`, "%"),
    n(`g${i}`, `Trial ${i} — wet soil + mould`, "g"),
  ]),
];

const proctorCalcs = (): TestCalc[] => {
  const calcs: TestCalc[] = [];
  for (let i = 1; i <= 5; i++) {
    calcs.push({
      key: `dd${i}`,
      label: `Trial ${i} — dry density`,
      unit: "g/cc",
      decimals: 3,
      formula: ((idx) => (g) => {
        const v = g.num("mould_vol");
        if (v <= 0) return null;
        const bulk = (g.num(`g${idx}`) - g.num("mould_wt")) / v;
        const w = g.num(`w${idx}`) / 100;
        return bulk > 0 ? bulk / (1 + w) : null;
      })(i),
    });
  }
  calcs.push({
    key: "mdd",
    label: "Maximum Dry Density (MDD)",
    unit: "g/cc",
    decimals: 3,
    formula: (g) => {
      const dds = [1, 2, 3, 4, 5].map(i => g.num(`dd${i}`)).filter(x => x > 0);
      return dds.length ? Math.max(...dds) : null;
    },
  });
  calcs.push({
    key: "omc",
    label: "Optimum Moisture Content (OMC)",
    unit: "%",
    decimals: 1,
    formula: (g) => {
      let best = -1, bestW = NaN;
      for (let i = 1; i <= 5; i++) {
        const d = g.num(`dd${i}`);
        if (d > best) { best = d; bestW = g.num(`w${i}`); }
      }
      return best > 0 ? bestW : null;
    },
  });
  return calcs;
};

const soilStdProctor: TestDefinition = {
  code: "SOIL-SP",
  name: "Standard Proctor (MDD/OMC)",
  category: "Soil",
  isCode: "IS 2720 (Part 7)",
  description: "Light compaction — 5-point moisture-density curve.",
  frequency: [
    { qty: 3000, unit: "cum", workItem: "Earthwork" },
    { qty: 1000, unit: "cum", workItem: "GSB" },
    { qty: 1000, unit: "cum", workItem: "WMM" },
  ],
  fields: proctorFields("sp"),
  calcs: proctorCalcs(),
  limits: [],
};

const soilModProctor: TestDefinition = {
  code: "SOIL-MP",
  name: "Modified Proctor (MDD/OMC)",
  category: "Soil",
  isCode: "IS 2720 (Part 8)",
  description: "Heavy compaction — 5-point moisture-density curve.",
  fields: proctorFields("mp"),
  calcs: proctorCalcs(),
  limits: [],
};

const soilSandRepl: TestDefinition = {
  code: "SOIL-SR",
  name: "Field Density — Sand Replacement",
  category: "Soil",
  isCode: "IS 2720 (Part 28)",
  description: "In-situ dry density by sand replacement; degree of compaction vs MDD.",
  frequency: [
    { qty: 1000, unit: "sqm", workItem: "Earthwork" },
    { qty: 500, unit: "sqm", workItem: "GSB" },
    { qty: 500, unit: "sqm", workItem: "WMM" },
  ],
  fields: [
    n("mdd_in", "Lab MDD (from Proctor)", "g/cc"),
    n("sand_before", "Sand + cylinder before", "g"),
    n("sand_after", "Sand + cylinder after", "g"),
    n("sand_cone", "Sand in cone (calibration)", "g"),
    n("sand_bd", "Bulk density of sand", "g/cc"),
    n("soil_wet", "Wet soil from hole", "g"),
    n("moist", "Moisture content", "%"),
  ],
  calcs: [
    { key: "sand_hole", label: "Sand in hole", unit: "g", decimals: 1, formula: g => g.num("sand_before")-g.num("sand_after")-g.num("sand_cone") },
    { key: "hole_vol", label: "Volume of hole", unit: "cc", decimals: 1, formula: g => { const bd=g.num("sand_bd"); const s=g.num("sand_hole"); return bd>0 ? s/bd : null; } },
    { key: "wet_d", label: "Wet density", unit: "g/cc", decimals: 3, formula: g => { const v=g.num("hole_vol"); return v>0 ? g.num("soil_wet")/v : null; } },
    { key: "dry_d", label: "Field dry density", unit: "g/cc", decimals: 3, formula: g => { const w=g.num("wet_d"); return w>0 ? w/(1+g.num("moist")/100) : null; } },
    { key: "compaction", label: "Degree of compaction", unit: "%", decimals: 1, formula: g => { const m=g.num("mdd_in"); const d=g.num("dry_d"); return m>0 ? d/m*100 : null; } },
  ],
  limits: [
    { targetKey: "compaction", label: "Compaction", min: 97, note: "MoRTH embankment/subgrade: ≥ 97% of MDD" },
  ],
};

const soilCoreCutter: TestDefinition = {
  code: "SOIL-CC",
  name: "Field Density — Core Cutter",
  category: "Soil",
  isCode: "IS 2720 (Part 29)",
  description: "In-situ dry density by core cutter; degree of compaction vs MDD.",
  fields: [
    n("mdd_in", "Lab MDD (from Proctor)", "g/cc"),
    n("cutter_vol", "Volume of core cutter", "cc"),
    n("cutter_soil", "Cutter + wet soil", "g"),
    n("cutter_wt", "Weight of cutter", "g"),
    n("moist", "Moisture content", "%"),
  ],
  calcs: [
    { key: "wet_d", label: "Wet density", unit: "g/cc", decimals: 3, formula: g => { const v=g.num("cutter_vol"); return v>0 ? (g.num("cutter_soil")-g.num("cutter_wt"))/v : null; } },
    { key: "dry_d", label: "Field dry density", unit: "g/cc", decimals: 3, formula: g => { const w=g.num("wet_d"); return w>0 ? w/(1+g.num("moist")/100) : null; } },
    { key: "compaction", label: "Degree of compaction", unit: "%", decimals: 1, formula: g => { const m=g.num("mdd_in"); const d=g.num("dry_d"); return m>0 ? d/m*100 : null; } },
  ],
  limits: [
    { targetKey: "compaction", label: "Compaction", min: 97, note: "MoRTH: ≥ 97% of MDD" },
  ],
};

const soilCBR: TestDefinition = {
  code: "SOIL-CBR",
  name: "Laboratory CBR",
  category: "Soil",
  isCode: "IS 2720 (Part 16)",
  description: "CBR at 2.5mm & 5.0mm penetration (soaked).",
  frequency: [
    { qty: 3000, unit: "cum", workItem: "Earthwork" },
    { qty: 1000, unit: "cum", workItem: "GSB" },
  ],
  fields: [
    n("load_25", "Load at 2.5 mm penetration", "kg"),
    n("load_50", "Load at 5.0 mm penetration", "kg"),
  ],
  calcs: [
    { key: "cbr_25", label: "CBR @ 2.5 mm", unit: "%", decimals: 1, formula: g => g.num("load_25")/1370*100 },
    { key: "cbr_50", label: "CBR @ 5.0 mm", unit: "%", decimals: 1, formula: g => g.num("load_50")/2055*100 },
    { key: "cbr", label: "CBR value", unit: "%", decimals: 1, formula: g => Math.max(g.num("cbr_25"), g.num("cbr_50")) },
  ],
  limits: [
    { targetKey: "cbr", label: "CBR", min: 8, note: "Subgrade design CBR (project-specific, typ. ≥ 8%)" },
  ],
};

const soilFSI: TestDefinition = {
  code: "SOIL-FSI",
  name: "Free Swell Index",
  category: "Soil",
  isCode: "IS 2720 (Part 40)",
  description: "Swelling potential of soil.",
  fields: [
    n("v_water", "Volume in distilled water", "cc"),
    n("v_kero", "Volume in kerosene", "cc"),
  ],
  calcs: [
    { key: "fsi", label: "Free Swell Index", unit: "%", decimals: 1, formula: g => { const k=g.num("v_kero"); return k>0 ? (g.num("v_water")-k)/k*100 : null; } },
  ],
  limits: [
    { targetKey: "fsi", label: "Free Swell Index", max: 50, note: "MoRTH embankment: FSI ≤ 50%" },
  ],
};

// ============================================================
// AGGREGATE
// ============================================================

const aggSieve: TestDefinition = {
  code: "AGG-SIEVE",
  name: "Sieve Analysis",
  category: "Aggregate",
  isCode: "IS 2386 (Part 1)",
  description: "Gradation of coarse/fine aggregate.",
  frequency: [
    { qty: 500, unit: "cum", workItem: "WMM" },
  ],
  fields: [
    n("wt_total", "Total dry weight", "g"),
    n("r_40", "Retained on 40 mm", "g"),
    n("r_20", "Retained on 20 mm", "g"),
    n("r_10", "Retained on 10 mm", "g"),
    n("r_475", "Retained on 4.75 mm", "g"),
    n("r_236", "Retained on 2.36 mm", "g"),
    n("r_075", "Retained on 75 micron", "g"),
  ],
  calcs: [
    { key: "p_20", label: "% Passing 20 mm", unit: "%", decimals: 1, formula: g => { const t=g.num("wt_total"); return t>0 ? (t-g.num("r_40")-g.num("r_20"))/t*100 : null; } },
    { key: "p_10", label: "% Passing 10 mm", unit: "%", decimals: 1, formula: g => { const t=g.num("wt_total"); return t>0 ? (t-g.num("r_40")-g.num("r_20")-g.num("r_10"))/t*100 : null; } },
    { key: "p_475", label: "% Passing 4.75 mm", unit: "%", decimals: 1, formula: g => { const t=g.num("wt_total"); return t>0 ? (t-g.num("r_40")-g.num("r_20")-g.num("r_10")-g.num("r_475"))/t*100 : null; } },
    { key: "p_075", label: "% Passing 75 micron", unit: "%", decimals: 1, formula: g => { const t=g.num("wt_total"); const s=g.num("r_40")+g.num("r_20")+g.num("r_10")+g.num("r_475")+g.num("r_236")+g.num("r_075"); return t>0 ? (t-s)/t*100 : null; } },
  ],
  limits: [
    { targetKey: "p_075", label: "Fines passing 75µ", max: 2, note: "Coarse agg. for concrete/BC: fines ≤ 2%" },
  ],
};

const aggImpact: TestDefinition = {
  code: "AGG-AIV",
  name: "Aggregate Impact Value",
  category: "Aggregate",
  isCode: "IS 2386 (Part 4)",
  description: "Resistance to sudden impact.",
  frequency: [
    { qty: 1000, unit: "cum", workItem: "WMM" },
    { qty: 500, unit: "cum", workItem: "DBM" },
    { qty: 500, unit: "cum", workItem: "BC" },
  ],
  fields: [
    n("w1", "Weight of sample (W1)", "g"),
    n("w2", "Weight passing 2.36 mm (W2)", "g"),
  ],
  calcs: [
    { key: "aiv", label: "Aggregate Impact Value", unit: "%", decimals: 1, formula: g => { const w=g.num("w1"); return w>0 ? g.num("w2")/w*100 : null; } },
  ],
  limits: [
    { targetKey: "aiv", label: "Impact Value", max: 30, note: "MoRTH wearing course: ≤ 30%" },
  ],
};

const aggCrushing: TestDefinition = {
  code: "AGG-ACV",
  name: "Aggregate Crushing Value",
  category: "Aggregate",
  isCode: "IS 2386 (Part 4)",
  description: "Resistance to crushing under gradually applied load.",
  fields: [
    n("w1", "Weight of sample (W1)", "g"),
    n("w2", "Weight passing 2.36 mm (W2)", "g"),
  ],
  calcs: [
    { key: "acv", label: "Aggregate Crushing Value", unit: "%", decimals: 1, formula: g => { const w=g.num("w1"); return w>0 ? g.num("w2")/w*100 : null; } },
  ],
  limits: [
    { targetKey: "acv", label: "Crushing Value", max: 30, note: "MoRTH: ≤ 30%" },
  ],
};

const aggLA: TestDefinition = {
  code: "AGG-LAA",
  name: "Los Angeles Abrasion Value",
  category: "Aggregate",
  isCode: "IS 2386 (Part 4)",
  description: "Resistance to abrasion.",
  fields: [
    n("w1", "Original weight (W1)", "g"),
    n("w2", "Weight retained on 1.70 mm (W2)", "g"),
  ],
  calcs: [
    { key: "laa", label: "LA Abrasion Value", unit: "%", decimals: 1, formula: g => { const w=g.num("w1"); return w>0 ? (w-g.num("w2"))/w*100 : null; } },
  ],
  limits: [
    { targetKey: "laa", label: "LA Abrasion", max: 35, note: "MoRTH BC: ≤ 35%" },
  ],
};

const aggFlakiness: TestDefinition = {
  code: "AGG-FI",
  name: "Flakiness Index",
  category: "Aggregate",
  isCode: "IS 2386 (Part 1)",
  description: "Shape test — flaky particles.",
  frequency: [
    { qty: 500, unit: "cum", workItem: "WMM" },
  ],
  fields: [
    n("w1", "Total weight (W1)", "g"),
    n("w2", "Weight passing flakiness sieves (W2)", "g"),
  ],
  calcs: [
    { key: "fi", label: "Flakiness Index", unit: "%", decimals: 1, formula: g => { const w=g.num("w1"); return w>0 ? g.num("w2")/w*100 : null; } },
  ],
  limits: [
    { targetKey: "fi", label: "Flakiness Index", max: 25, note: "MoRTH: ≤ 25%" },
  ],
};

const aggElongation: TestDefinition = {
  code: "AGG-EI",
  name: "Elongation Index",
  category: "Aggregate",
  isCode: "IS 2386 (Part 1)",
  description: "Shape test — elongated particles.",
  fields: [
    n("w1", "Total weight (W1)", "g"),
    n("w2", "Weight retained on elongation sieves (W2)", "g"),
  ],
  calcs: [
    { key: "ei", label: "Elongation Index", unit: "%", decimals: 1, formula: g => { const w=g.num("w1"); return w>0 ? g.num("w2")/w*100 : null; } },
  ],
  limits: [
    { targetKey: "ei", label: "Elongation Index", max: 25, note: "MoRTH: ≤ 25%" },
  ],
};

const aggWA: TestDefinition = {
  code: "AGG-WA",
  name: "Water Absorption",
  category: "Aggregate",
  isCode: "IS 2386 (Part 3)",
  description: "Water absorption of aggregate.",
  fields: [
    n("w_ssd", "SSD weight", "g"),
    n("w_od", "Oven-dry weight", "g"),
  ],
  calcs: [
    { key: "wa", label: "Water Absorption", unit: "%", decimals: 2, formula: g => { const w=g.num("w_od"); return w>0 ? (g.num("w_ssd")-w)/w*100 : null; } },
  ],
  limits: [
    { targetKey: "wa", label: "Water Absorption", max: 2, note: "MoRTH: ≤ 2%" },
  ],
};

const aggSG: TestDefinition = {
  code: "AGG-SG",
  name: "Specific Gravity",
  category: "Aggregate",
  isCode: "IS 2386 (Part 3)",
  description: "Specific gravity & water absorption (pycnometer/wire basket).",
  fields: [
    n("w1", "Basket + agg. in water", "g"),
    n("w2", "Basket in water", "g"),
    n("w3", "SSD weight in air", "g"),
    n("w4", "Oven-dry weight", "g"),
  ],
  calcs: [
    { key: "sg", label: "Specific Gravity", unit: "", decimals: 3, formula: g => { const d=g.num("w3")-(g.num("w1")-g.num("w2")); return d>0 ? g.num("w4")/d : null; } },
    { key: "wa", label: "Water Absorption", unit: "%", decimals: 2, formula: g => { const w=g.num("w4"); return w>0 ? (g.num("w3")-w)/w*100 : null; } },
  ],
  limits: [
    { targetKey: "sg", label: "Specific Gravity", min: 2.6, max: 2.9, note: "Typical range 2.6 – 2.9" },
    { targetKey: "wa", label: "Water Absorption", max: 2, note: "MoRTH: ≤ 2%" },
  ],
};

// ============================================================
// BITUMEN
// ============================================================

const BITUMEN_GRADES = ["VG-10", "VG-20", "VG-30", "VG-40"];

const bitPenetration: TestDefinition = {
  code: "BIT-PEN",
  name: "Penetration Test",
  category: "Bitumen",
  isCode: "IS 1203",
  description: "Penetration at 25°C (0.1 mm units).",
  frequency: [
    { qty: 1, unit: "tanker", workItem: "Bitumen", note: "per tanker/lot" },
  ],
  fields: [
    sel("grade", "Bitumen grade", BITUMEN_GRADES, "VG-30"),
    n("p1", "Reading 1", "0.1mm"),
    n("p2", "Reading 2", "0.1mm"),
    n("p3", "Reading 3", "0.1mm"),
  ],
  calcs: [
    { key: "pen", label: "Mean Penetration", unit: "0.1mm", decimals: 0, formula: g => (g.num("p1")+g.num("p2")+g.num("p3"))/3 },
  ],
  limits: [
    { targetKey: "pen", label: "Penetration (VG-10)", min: 80, max: 100, when: { field: "grade", equals: "VG-10" } },
    { targetKey: "pen", label: "Penetration (VG-20)", min: 60, max: 80, when: { field: "grade", equals: "VG-20" } },
    { targetKey: "pen", label: "Penetration (VG-30)", min: 50, max: 70, when: { field: "grade", equals: "VG-30" } },
    { targetKey: "pen", label: "Penetration (VG-40)", min: 40, max: 60, when: { field: "grade", equals: "VG-40" } },
  ],
};

const bitSoftening: TestDefinition = {
  code: "BIT-SP",
  name: "Softening Point (Ring & Ball)",
  category: "Bitumen",
  isCode: "IS 1205",
  description: "Softening point temperature.",
  fields: [
    sel("grade", "Bitumen grade", BITUMEN_GRADES, "VG-30"),
    n("t1", "Reading 1", "°C"),
    n("t2", "Reading 2", "°C"),
  ],
  calcs: [
    { key: "sp", label: "Mean Softening Point", unit: "°C", decimals: 1, formula: g => (g.num("t1")+g.num("t2"))/2 },
  ],
  limits: [
    { targetKey: "sp", label: "Softening Point (VG-10)", min: 40, when: { field: "grade", equals: "VG-10" } },
    { targetKey: "sp", label: "Softening Point (VG-20)", min: 45, when: { field: "grade", equals: "VG-20" } },
    { targetKey: "sp", label: "Softening Point (VG-30)", min: 47, when: { field: "grade", equals: "VG-30" } },
    { targetKey: "sp", label: "Softening Point (VG-40)", min: 50, when: { field: "grade", equals: "VG-40" } },
  ],
};

const bitDuctility: TestDefinition = {
  code: "BIT-DUC",
  name: "Ductility Test",
  category: "Bitumen",
  isCode: "IS 1208",
  description: "Ductility at 27°C.",
  fields: [
    sel("grade", "Bitumen grade", BITUMEN_GRADES, "VG-30"),
    n("d1", "Reading 1", "cm"),
    n("d2", "Reading 2", "cm"),
    n("d3", "Reading 3", "cm"),
  ],
  calcs: [
    { key: "duc", label: "Mean Ductility", unit: "cm", decimals: 0, formula: g => (g.num("d1")+g.num("d2")+g.num("d3"))/3 },
  ],
  limits: [
    { targetKey: "duc", label: "Ductility (VG-10)", min: 75, when: { field: "grade", equals: "VG-10" } },
    { targetKey: "duc", label: "Ductility (VG-20)", min: 50, when: { field: "grade", equals: "VG-20" } },
    { targetKey: "duc", label: "Ductility (VG-30)", min: 50, when: { field: "grade", equals: "VG-30" } },
    { targetKey: "duc", label: "Ductility (VG-40)", min: 25, when: { field: "grade", equals: "VG-40" } },
  ],
};

const bitViscosity: TestDefinition = {
  code: "BIT-VIS",
  name: "Viscosity Test",
  category: "Bitumen",
  isCode: "IS 1206",
  description: "Absolute viscosity at 60°C (poise).",
  fields: [
    sel("grade", "Bitumen grade", BITUMEN_GRADES, "VG-30"),
    n("visc", "Absolute viscosity @ 60°C", "poise"),
  ],
  calcs: [
    { key: "visc_out", label: "Viscosity", unit: "poise", decimals: 0, formula: g => g.num("visc") },
  ],
  limits: [
    { targetKey: "visc_out", label: "Viscosity (VG-10)", min: 800, max: 1200, when: { field: "grade", equals: "VG-10" } },
    { targetKey: "visc_out", label: "Viscosity (VG-20)", min: 1600, max: 2400, when: { field: "grade", equals: "VG-20" } },
    { targetKey: "visc_out", label: "Viscosity (VG-30)", min: 2400, max: 3600, when: { field: "grade", equals: "VG-30" } },
    { targetKey: "visc_out", label: "Viscosity (VG-40)", min: 3200, max: 4800, when: { field: "grade", equals: "VG-40" } },
  ],
};

const bitFlashFire: TestDefinition = {
  code: "BIT-FF",
  name: "Flash & Fire Point",
  category: "Bitumen",
  isCode: "IS 1209",
  description: "Flash and fire point (Cleveland open cup).",
  fields: [
    n("flash", "Flash point", "°C"),
    n("fire", "Fire point", "°C"),
  ],
  calcs: [
    { key: "flash_out", label: "Flash Point", unit: "°C", decimals: 0, formula: g => g.num("flash") },
    { key: "fire_out", label: "Fire Point", unit: "°C", decimals: 0, formula: g => g.num("fire") },
  ],
  limits: [
    { targetKey: "flash_out", label: "Flash Point", min: 220, note: "MoRTH: flash point ≥ 220°C" },
  ],
};

const bitSG: TestDefinition = {
  code: "BIT-SG",
  name: "Specific Gravity (Bitumen)",
  category: "Bitumen",
  isCode: "IS 1202",
  description: "Specific gravity at 27°C (pycnometer).",
  fields: [
    n("w1", "Wt. of pycnometer (W1)", "g"),
    n("w2", "Pycnometer + bitumen (W2)", "g"),
    n("w3", "Pycnometer + bitumen + water (W3)", "g"),
    n("w4", "Pycnometer + water (W4)", "g"),
  ],
  calcs: [
    { key: "sg", label: "Specific Gravity", unit: "", decimals: 3, formula: g => { const d=(g.num("w4")-g.num("w1"))-((g.num("w3")-g.num("w2"))); return d>0 ? (g.num("w2")-g.num("w1"))/d : null; } },
  ],
  limits: [
    { targetKey: "sg", label: "Specific Gravity", min: 0.99, note: "IS 73: ≥ 0.99" },
  ],
};

// ============================================================
// BITUMINOUS MIX
// ============================================================

const mixMarshall: TestDefinition = {
  code: "MIX-MARSHALL",
  name: "Marshall Stability & Flow",
  category: "Bituminous Mix",
  isCode: "MS-2 (Asphalt Institute)",
  description: "Stability (kN) and flow (mm) of compacted specimens.",
  frequency: [
    { qty: 500, unit: "tonne", workItem: "DBM" },
    { qty: 500, unit: "tonne", workItem: "BC" },
  ],
  fields: [
    sel("mix", "Mix type", ["BC", "DBM", "SDBC", "BM"], "BC"),
    n("ht", "Specimen height", "mm"),
    n("stab_dial", "Stability dial reading", "div"),
    n("corr_factor", "Correlation ratio (dial → kg)", "", true, "e.g. 4.2"),
    n("flow_dial", "Flow dial reading", "0.25mm"),
  ],
  calcs: [
    { key: "stab_kg", label: "Measured stability", unit: "kg", decimals: 0, formula: g => g.num("stab_dial")*g.num("corr_factor") },
    { key: "ht_corr", label: "Height correction factor", unit: "", decimals: 3, formula: g => { const h=g.num("ht"); if(h<=0) return null; const tbl:[number,number][]=[[57.2,1.19],[59.0,1.14],[60.8,1.09],[62.6,1.04],[63.5,1.00],[64.4,0.96],[66.2,0.91],[68.0,0.86],[69.8,0.81]]; let best=tbl[0]; for(const r of tbl){ if(Math.abs(h-r[0])<Math.abs(h-best[0])) best=r; } return best[1]; } },
    { key: "stab_kn", label: "Corrected stability", unit: "kN", decimals: 2, formula: g => g.num("stab_kg")*g.num("ht_corr")*9.81/1000 },
    { key: "flow", label: "Flow value", unit: "mm", decimals: 2, formula: g => g.num("flow_dial")*0.25 },
  ],
  limits: [
    { targetKey: "stab_kn", label: "Stability (BC/DBM)", min: 9, note: "MoRTH: ≥ 9 kN" },
    { targetKey: "flow", label: "Flow", min: 2, max: 4, note: "MoRTH: 2 – 4 mm" },
  ],
};

const mixBinder: TestDefinition = {
  code: "MIX-BINDER",
  name: "Binder Content (Extraction)",
  category: "Bituminous Mix",
  isCode: "ASTM D2172",
  description: "Bitumen content by centrifuge extraction.",
  frequency: [
    { qty: 500, unit: "tonne", workItem: "DBM" },
    { qty: 500, unit: "tonne", workItem: "BC" },
  ],
  fields: [
    n("jmf_bc", "JMF design binder content", "%"),
    n("w_mix", "Weight of mix sample", "g"),
    n("w_agg", "Weight of extracted aggregate", "g"),
    n("f_before", "Filter paper before", "g"),
    n("f_after", "Filter paper after", "g"),
  ],
  calcs: [
    { key: "bc", label: "Binder Content", unit: "%", decimals: 2, formula: g => { const w=g.num("w_mix"); if(w<=0) return null; const fines=g.num("f_after")-g.num("f_before"); return (w-g.num("w_agg")-fines)/w*100; } },
    { key: "bc_diff", label: "Deviation from JMF", unit: "%", decimals: 2, formula: g => g.num("bc")-g.num("jmf_bc") },
  ],
  limits: [
    { targetKey: "bc_diff", label: "|Deviation| from JMF", min: -0.3, max: 0.3, note: "MoRTH tolerance: ± 0.3%" },
  ],
};

const mixVoids: TestDefinition = {
  code: "MIX-VOIDS",
  name: "Air Voids / VMA / VFB",
  category: "Bituminous Mix",
  isCode: "MS-2",
  description: "Volumetrics from Gmb, Gmm, aggregate & binder gravities.",
  fields: [
    n("gmb", "Bulk specific gravity of mix (Gmb)", ""),
    n("gmm", "Theoretical max gravity (Gmm)", ""),
    n("ps", "Aggregate % by total mass (Ps)", "%"),
    n("gsb", "Bulk SG of aggregate (Gsb)", ""),
    n("gb", "SG of binder (Gb)", ""),
  ],
  calcs: [
    { key: "va", label: "Air Voids (Va)", unit: "%", decimals: 2, formula: g => { const m=g.num("gmm"); return m>0 ? (m-g.num("gmb"))/m*100 : null; } },
    { key: "vma", label: "VMA", unit: "%", decimals: 2, formula: g => 100-(g.num("gmb")*g.num("ps")/g.num("gsb")) },
    { key: "vfb", label: "VFB", unit: "%", decimals: 1, formula: g => { const vma=g.num("vma"); return vma>0 ? (vma-g.num("va"))/vma*100 : null; } },
  ],
  limits: [
    { targetKey: "va", label: "Air Voids", min: 3, max: 5, note: "MoRTH BC: 3 – 5%" },
    { targetKey: "vfb", label: "VFB", min: 65, max: 75, note: "MoRTH BC: 65 – 75%" },
  ],
};

const mixCore: TestDefinition = {
  code: "MIX-CORE",
  name: "Field Density — Core (Bituminous)",
  category: "Bituminous Mix",
  isCode: "ASTM D2726",
  description: "Core bulk density vs lab (Marshall) density — degree of compaction.",
  fields: [
    n("w_air", "Core weight in air", "g"),
    n("w_water", "Core weight in water", "g"),
    n("gmm_lab", "Lab (Marshall) density", "g/cc", true, "e.g. 2.450"),
  ],
  calcs: [
    { key: "gmb", label: "Bulk density (Gmb)", unit: "g/cc", decimals: 3, formula: g => { const d = g.num("w_air") - g.num("w_water"); return d > 0 ? g.num("w_air") / d : null; } },
    { key: "comp", label: "Compaction", unit: "%", decimals: 1, formula: g => { const l = g.num("gmm_lab"); return l > 0 ? g.num("gmb") / l * 100 : null; } },
  ],
  limits: [
    { targetKey: "comp", label: "Degree of compaction", min: 98, note: "Typical MoRTH requirement ≥ 98% of lab density (verify project spec)" },
  ],
  frequency: [
    { qty: 500, unit: "sqm", workItem: "DBM" },
    { qty: 500, unit: "sqm", workItem: "BC" },
  ],
};

// ============================================================
// CONCRETE
// ============================================================
const CONC_GRADES = ["M20", "M25", "M30", "M35", "M40"];
const concGradeFck = (grade: string): number => {
  const m: Record<string, number> = { M20: 20, M25: 25, M30: 30, M35: 35, M40: 40 };
  return m[grade] ?? 0;
};

const concCube: TestDefinition = {
  code: "CONC-CUBE",
  name: "Cube Compressive Strength (7/28 day)",
  category: "Concrete",
  isCode: "IS 516 (Part 1)",
  description: "150 mm cubes — individual & mean strength.",
  frequency: [
    { qty: 15, unit: "cum", workItem: "Concrete", note: "1 set = 3 cubes" },
    { qty: 1, unit: "pour", workItem: "Concrete", note: "per pour/day" },
  ],
  fields: [
    sel("grade", "Concrete grade", CONC_GRADES, "M25"),
    sel("age", "Age at testing", ["7 days", "28 days"], "28 days"),
    n("load1", "Cube 1 — failure load", "kN"),
    n("load2", "Cube 2 — failure load", "kN"),
    n("load3", "Cube 3 — failure load", "kN"),
  ],
  calcs: [
    { key: "s1", label: "Cube 1 strength", unit: "N/mm²", decimals: 2, formula: g => g.num("load1")*1000/22500 },
    { key: "s2", label: "Cube 2 strength", unit: "N/mm²", decimals: 2, formula: g => g.num("load2")*1000/22500 },
    { key: "s3", label: "Cube 3 strength", unit: "N/mm²", decimals: 2, formula: g => g.num("load3")*1000/22500 },
    { key: "smean", label: "Mean strength", unit: "N/mm²", decimals: 2, formula: g => (g.num("s1")+g.num("s2")+g.num("s3"))/3 },
    { key: "fck_req", label: "Required (fck / 0.65·fck)", unit: "N/mm²", decimals: 1, formula: g => { const f=concGradeFck(g.str("grade")); return g.str("age")==="7 days" ? f*0.65 : f; } },
  ],
  limits: [
    { targetKey: "smean", label: "Mean ≥ required", min: 0, note: "" }, // placeholder replaced below
  ],
};

// Custom limit evaluation for cube: mean >= fck_req (dynamic). We encode via a ratio calc.
(concCube.calcs as TestCalc[]).push({
  key: "pass_ratio",
  label: "Mean / Required",
  unit: "",
  decimals: 2,
  formula: (g) => { const r = g.num("fck_req"); return r > 0 ? g.num("smean") / r : null; },
});
concCube.limits = [
  { targetKey: "pass_ratio", label: "Strength adequacy", min: 1, note: "Mean strength must be ≥ fck (28d) or ≥ 0.65·fck (7d)" },
];

const concSlump: TestDefinition = {
  code: "CONC-SLUMP",
  name: "Slump Test",
  category: "Concrete",
  isCode: "IS 1199 (Part 2)",
  description: "Workability — measured slump vs specified range.",
  frequency: [
    { qty: 1, unit: "pour", workItem: "Concrete", note: "per pour" },
  ],
  fields: [
    n("slump", "Measured slump", "mm"),
    n("slump_min", "Specified min slump", "mm", true, "e.g. 50"),
    n("slump_max", "Specified max slump", "mm", true, "e.g. 100"),
  ],
  calcs: [
    { key: "slump_out", label: "Slump", unit: "mm", decimals: 0, formula: g => g.num("slump") },
  ],
  limits: [
    // dynamic range handled in evaluator via special-case below
    { targetKey: "slump_out", label: "Within specified range", min: -1e9, max: 1e9, note: "" },
  ],
};
// Replace with dynamic check: slump_min <= slump <= slump_max
concSlump.limits = [];
(concSlump.calcs as TestCalc[]).push({
  key: "slump_ok",
  label: "In range (1=yes)",
  unit: "",
  decimals: 0,
  formula: (g) => {
    const s = g.num("slump"), lo = g.num("slump_min"), hi = g.num("slump_max");
    if (!(s >= 0) || !(lo >= 0) || !(hi > 0)) return null;
    return s >= lo && s <= hi ? 1 : 0;
  },
});
concSlump.limits = [
  { targetKey: "slump_ok", label: "Slump within specified range", min: 1, note: "Measured slump must be within specified min–max" },
];

// ============================================================
// CEMENT
// ============================================================

const cemFineness: TestDefinition = {
  code: "CEM-FIN",
  name: "Fineness (Dry Sieving)",
  category: "Cement",
  isCode: "IS 4031 (Part 1)",
  description: "Residue on 90 micron sieve.",
  fields: [
    n("w_sample", "Weight of sample", "g"),
    n("w_res", "Residue on 90µ sieve", "g"),
  ],
  calcs: [
    { key: "fin", label: "Fineness (residue)", unit: "%", decimals: 1, formula: g => { const w=g.num("w_sample"); return w>0 ? g.num("w_res")/w*100 : null; } },
  ],
  limits: [
    { targetKey: "fin", label: "Residue on 90µ", max: 10, note: "IS 269 (OPC): ≤ 10%" },
  ],
};

const cemConsistency: TestDefinition = {
  code: "CEM-CONS",
  name: "Standard Consistency",
  category: "Cement",
  isCode: "IS 4031 (Part 4)",
  description: "Water % for 33–35 mm Vicat plunger penetration (2-trial interpolation).",
  fields: [
    n("w1", "Trial 1 — water", "%"),
    n("p1", "Trial 1 — penetration", "mm"),
    n("w2", "Trial 2 — water", "%"),
    n("p2", "Trial 2 — penetration", "mm"),
  ],
  calcs: [
    { key: "cons", label: "Standard consistency (P)", unit: "%", decimals: 1, formula: g => {
      const w1=g.num("w1"),p1=g.num("p1"),w2=g.num("w2"),p2=g.num("p2");
      if (p2===p1) return null;
      return w1+(33.5-p1)*(w2-w1)/(p2-p1);
    } },
  ],
  limits: [],
};

const cemSetting: TestDefinition = {
  code: "CEM-SET",
  name: "Initial & Final Setting Time",
  category: "Cement",
  isCode: "IS 4031 (Part 5)",
  description: "Vicat apparatus — time from adding water.",
  fields: [
    t("t_water", "Time of adding water (HH:MM)", true, "10:00"),
    t("t_ist", "Initial set observed (HH:MM)", true, "10:45"),
    t("t_fst", "Final set observed (HH:MM)", true, "16:00"),
  ],
  calcs: [
    { key: "ist", label: "Initial setting time", unit: "min", decimals: 0, formula: g => {
      const toMin=(s:string)=>{ const m=s.match(/(\d+):(\d+)/); return m? (+m[1])*60+(+m[2]) : NaN; };
      const a=toMin(g.str("t_water")), b=toMin(g.str("t_ist"));
      let d=b-a; if(d<0) d+=1440; return d>=0?d:null;
    } },
    { key: "fst", label: "Final setting time", unit: "min", decimals: 0, formula: g => {
      const toMin=(s:string)=>{ const m=s.match(/(\d+):(\d+)/); return m? (+m[1])*60+(+m[2]) : NaN; };
      const a=toMin(g.str("t_water")), b=toMin(g.str("t_fst"));
      let d=b-a; if(d<0) d+=1440; return d>=0?d:null;
    } },
  ],
  limits: [
    { targetKey: "ist", label: "Initial setting time", min: 30, note: "IS 269: ≥ 30 min" },
    { targetKey: "fst", label: "Final setting time", max: 600, note: "IS 269: ≤ 600 min" },
  ],
};

const cemSoundness: TestDefinition = {
  code: "CEM-SND",
  name: "Soundness (Le Chatelier)",
  category: "Cement",
  isCode: "IS 4031 (Part 3)",
  description: "Expansion of cement paste.",
  fields: [
    n("l1", "Distance before boiling (L1)", "mm"),
    n("l2", "Distance after boiling (L2)", "mm"),
  ],
  calcs: [
    { key: "exp", label: "Expansion", unit: "mm", decimals: 1, formula: g => g.num("l2")-g.num("l1") },
  ],
  limits: [
    { targetKey: "exp", label: "Expansion", max: 10, note: "IS 269 (OPC): ≤ 10 mm" },
  ],
};

const CEM_TYPES = ["OPC 33", "OPC 43", "OPC 53", "PPC"];
const cemStrength: TestDefinition = {
  code: "CEM-STR",
  name: "Compressive Strength (Mortar Cubes)",
  category: "Cement",
  isCode: "IS 4031 (Part 6)",
  description: "70.6 mm mortar cubes at 28 days.",
  frequency: [
    { qty: 50, unit: "tonne", workItem: "Cement" },
  ],
  fields: [
    sel("ctype", "Cement type", CEM_TYPES, "OPC 43"),
    n("load1", "Cube 1 — failure load", "kN"),
    n("load2", "Cube 2 — failure load", "kN"),
    n("load3", "Cube 3 — failure load", "kN"),
  ],
  calcs: [
    { key: "smean", label: "Mean strength", unit: "N/mm²", decimals: 1, formula: g => (g.num("load1")+g.num("load2")+g.num("load3"))*1000/3/5000 },
    { key: "req", label: "Required strength", unit: "N/mm²", decimals: 0, formula: g => ({ "OPC 33": 33, "OPC 43": 43, "OPC 53": 53, "PPC": 33 }[g.str("ctype")] ?? 0) },
    { key: "pass_ratio", label: "Mean / Required", unit: "", decimals: 2, formula: g => { const r=g.num("req"); return r>0 ? g.num("smean")/r : null; } },
  ],
  limits: [
    { targetKey: "pass_ratio", label: "Strength adequacy", min: 1, note: "28-day strength ≥ grade value" },
  ],
};

// ============================================================
// STEEL
// ============================================================

const STEEL_GRADES = ["Fe 415", "Fe 500", "Fe 550"];
const steelSpec = (grade: string) => ({
  "Fe 415": { ys: 415, ts: 485, el: 14.5 },
  "Fe 500": { ys: 500, ts: 545, el: 12 },
  "Fe 550": { ys: 550, ts: 600, el: 10 },
}[grade] ?? { ys: 0, ts: 0, el: 0 });

const NOMINAL_WT: Record<string, number> = {
  "6": 0.222, "8": 0.395, "10": 0.617, "12": 0.888,
  "16": 1.579, "20": 2.466, "25": 3.853, "28": 4.834, "32": 6.313,
};

const steelTensile: TestDefinition = {
  code: "STL-TEN",
  name: "Tensile / Yield / Elongation",
  category: "Steel",
  isCode: "IS 1608 / IS 1786",
  description: "Yield stress, tensile strength, % elongation.",
  frequency: [
    { qty: 20, unit: "tonne", workItem: "Steel", note: "per diameter" },
  ],
  fields: [
    sel("grade", "Steel grade", STEEL_GRADES, "Fe 500"),
    n("dia", "Nominal diameter", "mm"),
    n("load_y", "Yield load", "kN"),
    n("load_u", "Ultimate load", "kN"),
    n("l0", "Original gauge length", "mm"),
    n("l1", "Final gauge length", "mm"),
  ],
  calcs: [
    { key: "area", label: "Cross-sectional area", unit: "mm²", decimals: 2, formula: g => { const d=g.num("dia"); return d>0 ? Math.PI*d*d/4 : null; } },
    { key: "ys", label: "Yield stress", unit: "N/mm²", decimals: 1, formula: g => { const a=g.num("area"); return a>0 ? g.num("load_y")*1000/a : null; } },
    { key: "ts", label: "Tensile strength", unit: "N/mm²", decimals: 1, formula: g => { const a=g.num("area"); return a>0 ? g.num("load_u")*1000/a : null; } },
    { key: "el", label: "Elongation", unit: "%", decimals: 1, formula: g => { const l=g.num("l0"); return l>0 ? (g.num("l1")-l)/l*100 : null; } },
    { key: "ys_req", label: "Required yield", unit: "N/mm²", decimals: 0, formula: g => steelSpec(g.str("grade")).ys },
    { key: "ts_req", label: "Required tensile", unit: "N/mm²", decimals: 0, formula: g => steelSpec(g.str("grade")).ts },
    { key: "el_req", label: "Required elongation", unit: "%", decimals: 1, formula: g => steelSpec(g.str("grade")).el },
    { key: "ys_ok", label: "Yield OK (1=yes)", unit: "", decimals: 0, formula: g => g.num("ys") >= g.num("ys_req") && g.num("ys_req") > 0 ? 1 : 0 },
    { key: "ts_ok", label: "Tensile OK (1=yes)", unit: "", decimals: 0, formula: g => g.num("ts") >= g.num("ts_req") && g.num("ts_req") > 0 ? 1 : 0 },
    { key: "el_ok", label: "Elongation OK (1=yes)", unit: "", decimals: 0, formula: g => g.num("el") >= g.num("el_req") && g.num("el_req") > 0 ? 1 : 0 },
  ],
  limits: [
    { targetKey: "ys_ok", label: "Yield stress", min: 1, note: "Must meet IS 1786 grade minimum" },
    { targetKey: "ts_ok", label: "Tensile strength", min: 1, note: "Must meet IS 1786 grade minimum" },
    { targetKey: "el_ok", label: "Elongation", min: 1, note: "Must meet IS 1786 grade minimum" },
  ],
};

const steelBend: TestDefinition = {
  code: "STL-BEND",
  name: "Bend Test",
  category: "Steel",
  isCode: "IS 1599",
  description: "180° bend around specified mandrel — visual check for cracks.",
  fields: [
    n("dia", "Bar diameter", "mm"),
    n("mandrel", "Mandrel diameter used", "mm"),
    sel("cracks", "Cracks observed?", ["No", "Yes"], "No"),
  ],
  calcs: [
    { key: "bend_ok", label: "Bend OK (1=yes)", unit: "", decimals: 0, formula: g => g.str("cracks") === "No" ? 1 : 0 },
  ],
  limits: [
    { targetKey: "bend_ok", label: "No cracks after bending", min: 1, note: "IS 1599: bar must bend 180° without cracks" },
  ],
};

const steelWt: TestDefinition = {
  code: "STL-WT",
  name: "Weight per Metre",
  category: "Steel",
  isCode: "IS 1786",
  description: "Unit weight vs nominal (tolerance check).",
  fields: [
    sel("dia", "Nominal diameter", Object.keys(NOMINAL_WT), "12"),
    n("len", "Length of bar", "m"),
    n("wt", "Weight of bar", "kg"),
  ],
  calcs: [
    { key: "wpm", label: "Weight per metre", unit: "kg/m", decimals: 3, formula: g => { const l=g.num("len"); return l>0 ? g.num("wt")/l : null; } },
    { key: "nom", label: "Nominal weight", unit: "kg/m", decimals: 3, formula: g => NOMINAL_WT[g.str("dia")] ?? NaN },
    { key: "dev", label: "Deviation", unit: "%", decimals: 2, formula: g => { const nn=g.num("nom"); return nn>0 ? (g.num("wpm")-nn)/nn*100 : null; } },
  ],
  limits: [
    { targetKey: "dev", label: "Deviation from nominal", min: -8, max: 8, note: "Practical tolerance ±8% (verify project spec)" },
  ],
};

// ============================================================
// SPECIALIZED TESTS — Field / NDT / Bitumen / Moisture / Spread
// ============================================================

// ---------- Field CBR (IS 2720 Part 31) ----------
const soilFieldCBR: TestDefinition = {
  code: "SOIL-FCBR",
  name: "Field CBR",
  category: "Soil",
  isCode: "IS 2720 (Part 31)",
  description: "In-situ CBR from proving-ring loads at 2.5 mm & 5.0 mm penetration. Standard loads: 1370 kg @ 2.5mm, 2055 kg @ 5.0mm.",
  fields: [
    n("pr_const", "Proving ring constant", "kg/div", true, "e.g. 2.4"),
    n("dial_25", "Dial reading @ 2.5 mm penetration", "div"),
    n("dial_50", "Dial reading @ 5.0 mm penetration", "div"),
    n("design_cbr", "Design CBR", "%", true, "e.g. 8"),
  ],
  calcs: [
    { key: "load_25", label: "Load @ 2.5 mm", unit: "kg", decimals: 1, formula: g => g.num("dial_25") * g.num("pr_const") },
    { key: "load_50", label: "Load @ 5.0 mm", unit: "kg", decimals: 1, formula: g => g.num("dial_50") * g.num("pr_const") },
    { key: "cbr_25", label: "CBR @ 2.5 mm", unit: "%", decimals: 1, formula: g => g.num("load_25") / 1370 * 100 },
    { key: "cbr_50", label: "CBR @ 5.0 mm", unit: "%", decimals: 1, formula: g => g.num("load_50") / 2055 * 100 },
    { key: "adequacy", label: "CBR / Design CBR", unit: "", decimals: 2, formula: g => { const d = g.num("design_cbr"); return d > 0 ? g.num("cbr_25") / d : null; } },
  ],
  limits: [
    { targetKey: "adequacy", label: "Field CBR adequacy", min: 1, note: "CBR @ 2.5 mm must be ≥ design CBR. If CBR @ 5.0 mm > CBR @ 2.5 mm, repeat test per IS 2720 (Part 31)." },
  ],
};

// ---------- Plate Load Test (IS 1888) ----------
const soilPLT: TestDefinition = {
  code: "SOIL-PLT",
  name: "Plate Load Test",
  category: "Soil",
  isCode: "IS 1888",
  description: "Safe bearing capacity from load at 25 mm settlement (FS = 3); modulus of subgrade reaction k = pressure ÷ settlement.",
  fields: [
    n("plate_dia", "Plate diameter", "mm", true, "e.g. 750"),
    n("load_25", "Load at 25 mm settlement", "kN"),
    n("sbc_req", "Required safe bearing capacity", "kPa", true, "e.g. 150"),
  ],
  calcs: [
    { key: "area", label: "Plate area", unit: "m²", decimals: 4, formula: g => { const d = g.num("plate_dia"); return d > 0 ? Math.PI / 4 * Math.pow(d / 1000, 2) : null; } },
    { key: "q_25", label: "Bearing pressure @ 25 mm", unit: "kPa", decimals: 0, formula: g => { const a = g.num("area"); return a > 0 ? g.num("load_25") / a : null; } },
    { key: "sbc", label: "Safe bearing capacity (FS=3)", unit: "kPa", decimals: 0, formula: g => g.num("q_25") / 3 },
    { key: "k_val", label: "Modulus of subgrade reaction k", unit: "MN/m³", decimals: 1, formula: g => g.num("q_25") / 25 },
    { key: "adequacy", label: "SBC / Required", unit: "", decimals: 2, formula: g => { const r = g.num("sbc_req"); return r > 0 ? g.num("sbc") / r : null; } },
  ],
  limits: [
    { targetKey: "adequacy", label: "Bearing adequacy", min: 1, note: "SBC (load @ 25 mm ÷ 3) must be ≥ required SBC" },
  ],
};

// ---------- Benkelman Beam Deflection (IRC 81) ----------
const soilBB: TestDefinition = {
  code: "SOIL-BB",
  name: "Benkelman Beam Deflection",
  category: "Soil",
  isCode: "IRC 81",
  description: "Rebound deflection per point = 2 × (initial − final) × LC. Characteristic deflection Dc = mean + 2σ. Min 10 points per section per IRC 81 — repeat form as needed.",
  fields: [
    n("lc", "Dial gauge least count", "mm/div", true, "e.g. 0.01"),
    ...[1, 2, 3, 4, 5].flatMap(i => [
      n(`di_${i}`, `Point ${i} — initial dial`, "div"),
      n(`df_${i}`, `Point ${i} — final dial`, "div"),
    ]),
  ],
  calcs: [
    ...[1, 2, 3, 4, 5].map(i => ({
      key: `def_${i}`,
      label: `Point ${i} — rebound deflection`,
      unit: "mm",
      decimals: 2,
      formula: ((idx: number) => (g: CalcGetter) => {
        const r = g.num(`di_${idx}`) - g.num(`df_${idx}`);
        return r > 0 ? r * 2 * g.num("lc") : null;
      })(i),
    })),
    { key: "d_mean", label: "Mean deflection", unit: "mm", decimals: 2, formula: g => { const ds = [1, 2, 3, 4, 5].map(i => g.num(`def_${i}`)).filter(x => x > 0); return ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : null; } },
    { key: "d_sd", label: "Std. deviation", unit: "mm", decimals: 3, formula: g => { const ds = [1, 2, 3, 4, 5].map(i => g.num(`def_${i}`)).filter(x => x > 0); if (ds.length < 2) return null; const m = ds.reduce((a, b) => a + b, 0) / ds.length; return Math.sqrt(ds.reduce((a, b) => a + Math.pow(b - m, 2), 0) / (ds.length - 1)); } },
    { key: "d_char", label: "Characteristic deflection Dc", unit: "mm", decimals: 2, formula: g => g.num("d_mean") + 2 * g.num("d_sd") },
  ],
  limits: [
    { targetKey: "d_char", label: "Characteristic deflection", max: 1.25, note: "IRC 81: Dc ≤ 1.25 mm typical for DBM/BC overlay evaluation (confirm project spec)" },
  ],
};

// ---------- Natural Moisture Content (IS 2720 Part 2) — record only ----------
const soilNMC: TestDefinition = {
  code: "SOIL-NMC",
  name: "Natural Moisture Content",
  category: "Soil",
  isCode: "IS 2720 (Part 2)",
  description: "Oven-dry method — record value (indicative, no pass/fail).",
  indicative: true,
  fields: [
    n("c_wt", "Container weight", "g"),
    n("c_wet", "Container + wet soil", "g"),
    n("c_dry", "Container + dry soil", "g"),
  ],
  calcs: [
    { key: "mc", label: "Moisture content", unit: "%", decimals: 2, formula: g => { const d = g.num("c_dry") - g.num("c_wt"); return d > 0 ? (g.num("c_wet") - g.num("c_dry")) / d * 100 : null; } },
  ],
  limits: [],
};

// ---------- Moisture Content at Compaction (IS 2720 Part 2) ----------
const soilMCC: TestDefinition = {
  code: "SOIL-MCC",
  name: "Moisture Content at Compaction",
  category: "Soil",
  isCode: "IS 2720 (Part 2)",
  description: "Field MC vs OMC from Proctor — compaction moisture control.",
  fields: [
    n("mc_field", "Field moisture content", "%"),
    n("omc", "OMC (from Proctor test)", "%"),
  ],
  calcs: [
    { key: "dev", label: "Deviation from OMC", unit: "%", decimals: 2, formula: g => g.num("mc_field") - g.num("omc") },
  ],
  limits: [
    { targetKey: "dev", label: "Deviation from OMC", min: -2, max: 2, note: "MoRTH: field MC within OMC ± 2%" },
  ],
};

// ---------- Layer Thickness Check (MoRTH field check) ----------
const LAYERS = ["Subgrade", "GSB", "WMM", "DBM", "BC", "PQC"];
const soilThk: TestDefinition = {
  code: "SOIL-THK",
  name: "Layer Thickness Check",
  category: "Soil",
  isCode: "MoRTH (field check)",
  description: "Depth measurements at 5 points — mean ≥ design thickness, no point more than 5 mm below design.",
  fields: [
    sel("layer", "Layer", LAYERS, "GSB"),
    n("design", "Design thickness", "mm"),
    ...[1, 2, 3, 4, 5].map(i => n(`d${i}`, `Point ${i} — measured depth`, "mm")),
  ],
  calcs: [
    { key: "d_mean", label: "Mean thickness", unit: "mm", decimals: 1, formula: g => { const ds = [1, 2, 3, 4, 5].map(i => g.num(`d${i}`)).filter(x => x > 0); return ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : null; } },
    { key: "d_min", label: "Minimum thickness", unit: "mm", decimals: 1, formula: g => { const ds = [1, 2, 3, 4, 5].map(i => g.num(`d${i}`)).filter(x => x > 0); return ds.length ? Math.min(...ds) : null; } },
    { key: "mean_ratio", label: "Mean / Design", unit: "", decimals: 2, formula: g => { const d = g.num("design"); return d > 0 ? g.num("d_mean") / d : null; } },
    { key: "shortfall", label: "Max shortfall below design", unit: "mm", decimals: 1, formula: g => g.num("design") - g.num("d_min") },
  ],
  limits: [
    { targetKey: "mean_ratio", label: "Mean thickness", min: 1, note: "Mean of 5 points must be ≥ design thickness" },
    { targetKey: "shortfall", label: "Point shortfall", max: 5, note: "No point more than 5 mm below design (MoRTH tolerance)" },
  ],
};

// ---------- Sand Equivalent (IS 2720 / ASTM D2419) ----------
const aggSE: TestDefinition = {
  code: "AGG-SE",
  name: "Sand Equivalent Test",
  category: "Aggregate",
  isCode: "IS 2720 / ASTM D2419",
  description: "Cleanliness of fine aggregate — sand reading vs clay reading after sedimentation.",
  fields: [
    n("sand", "Sand reading", "mm"),
    n("clay", "Clay reading", "mm"),
  ],
  calcs: [
    { key: "se", label: "Sand Equivalent", unit: "%", decimals: 1, formula: g => { const c = g.num("clay"); return c > 0 ? g.num("sand") / c * 100 : null; } },
  ],
  limits: [
    { targetKey: "se", label: "Sand Equivalent", min: 50, note: "≥ 50% for fine aggregate in concrete/bituminous mixes" },
  ],
};

// ---------- Stripping Test (IS 6241) ----------
const bitStrip: TestDefinition = {
  code: "BIT-STRIP",
  name: "Stripping Test",
  category: "Bitumen",
  isCode: "IS 6241",
  description: "Visual stripping of bitumen coating from aggregate after 24 h water immersion.",
  fields: [
    n("strip", "Stripped (uncoated) area", "%"),
  ],
  calcs: [
    { key: "retained", label: "Coating retained", unit: "%", decimals: 1, formula: g => 100 - g.num("strip") },
  ],
  limits: [
    { targetKey: "strip", label: "Stripping", max: 5, note: "IS 6241: stripping ≤ 5% (≥ 95% coating retained)" },
  ],
};

// ---------- Elastic Recovery (IRC SP 53) ----------
const bitER: TestDefinition = {
  code: "BIT-ER",
  name: "Elastic Recovery",
  category: "Bitumen",
  isCode: "IRC SP 53",
  description: "Ductilometer specimen elongated (usually 100 mm) at 15°C, cut at centre, residual gap measured after 60 min. For PMB/CRMB.",
  fields: [
    n("elong", "Elongation", "mm", true, "100"),
    n("resid", "Residual gap after 60 min", "mm"),
  ],
  calcs: [
    { key: "er", label: "Elastic recovery", unit: "%", decimals: 1, formula: g => { const e = g.num("elong"); return e > 0 ? (e - g.num("resid")) / e * 100 : null; } },
  ],
  limits: [
    { targetKey: "er", label: "Elastic recovery", min: 50, note: "IRC SP 53: ≥ 50% for PMB/CRMB (verify grade specification)" },
  ],
};

// ---------- Bitumen Emulsion — Residue by Evaporation (IS 8887) ----------
const EMUL_GRADES = ["RS-1", "RS-2", "RS-3", "MS", "SS-1", "SS-2"];
const bitEmRes: TestDefinition = {
  code: "BIT-EMR",
  name: "Emulsion — Residue by Evaporation",
  category: "Bitumen",
  isCode: "IS 8887",
  description: "Residue after evaporation — binder content of bitumen emulsion.",
  fields: [
    sel("grade", "Emulsion grade", EMUL_GRADES, "RS-1"),
    n("w_samp", "Weight of emulsion sample", "g"),
    n("w_res", "Weight of residue", "g"),
  ],
  calcs: [
    { key: "res", label: "Residue", unit: "%", decimals: 1, formula: g => { const w = g.num("w_samp"); return w > 0 ? g.num("w_res") / w * 100 : null; } },
  ],
  limits: [
    { targetKey: "res", label: "Residue (RS-1)", min: 60, when: { field: "grade", equals: "RS-1" }, note: "IS 8887: RS-1 ≥ 60%" },
  ],
};

// ---------- Bitumen Emulsion — Viscosity, Saybolt Furol (IS 8887) ----------
const bitEmVis: TestDefinition = {
  code: "BIT-EMV",
  name: "Emulsion — Viscosity (Saybolt Furol)",
  category: "Bitumen",
  isCode: "IS 8887",
  description: "Saybolt Furol flow time at 50°C.",
  fields: [
    sel("grade", "Emulsion grade", EMUL_GRADES, "RS-1"),
    n("flow", "Flow time @ 50°C", "sec"),
  ],
  calcs: [
    { key: "visc", label: "Viscosity", unit: "sec", decimals: 0, formula: g => g.num("flow") },
  ],
  limits: [
    { targetKey: "visc", label: "Viscosity (RS-1)", min: 20, max: 100, when: { field: "grade", equals: "RS-1" }, note: "IS 8887 RS grades: 20–100 sec" },
    { targetKey: "visc", label: "Viscosity (RS-2)", min: 20, max: 100, when: { field: "grade", equals: "RS-2" }, note: "IS 8887 RS grades: 20–100 sec" },
    { targetKey: "visc", label: "Viscosity (RS-3)", min: 20, max: 100, when: { field: "grade", equals: "RS-3" }, note: "IS 8887 RS grades: 20–100 sec" },
  ],
};

// ---------- Rate of Spread — Prime Coat (MoRTH 502) ----------
const bitPrime: TestDefinition = {
  code: "BIT-PRIME",
  name: "Rate of Spread — Prime Coat",
  category: "Bitumen",
  isCode: "MoRTH 502",
  description: "Tray test — binder collected over a known area.",
  fields: [
    sel("binder", "Binder type", ["MC-30", "SS-1"], "MC-30"),
    n("area", "Tray area", "sqm"),
    n("wt", "Binder collected", "kg"),
  ],
  calcs: [
    { key: "spread", label: "Rate of spread", unit: "kg/sqm", decimals: 2, formula: g => { const a = g.num("area"); return a > 0 ? g.num("wt") / a : null; } },
  ],
  limits: [
    { targetKey: "spread", label: "Spread (MC-30)", min: 0.6, max: 0.9, when: { field: "binder", equals: "MC-30" }, note: "MoRTH 502: 0.6–0.9 kg/sqm" },
    { targetKey: "spread", label: "Spread (SS-1)", min: 0.9, max: 1.2, when: { field: "binder", equals: "SS-1" }, note: "MoRTH 502: 0.9–1.2 kg/sqm" },
  ],
};

// ---------- Rate of Spread — Tack Coat (MoRTH 503) ----------
const bitTack: TestDefinition = {
  code: "BIT-TACK",
  name: "Rate of Spread — Tack Coat",
  category: "Bitumen",
  isCode: "MoRTH 503",
  description: "Tray test — binder collected over a known area.",
  fields: [
    sel("surface", "Surface type", ["Primed granular base", "Bituminous surface"], "Primed granular base"),
    n("area", "Tray area", "sqm"),
    n("wt", "Binder collected", "kg"),
  ],
  calcs: [
    { key: "spread", label: "Rate of spread", unit: "kg/sqm", decimals: 2, formula: g => { const a = g.num("area"); return a > 0 ? g.num("wt") / a : null; } },
  ],
  limits: [
    { targetKey: "spread", label: "Spread (primed granular)", min: 0.20, max: 0.30, when: { field: "surface", equals: "Primed granular base" }, note: "MoRTH 503: 0.20–0.30 kg/sqm" },
    { targetKey: "spread", label: "Spread (bituminous)", min: 0.25, max: 0.35, when: { field: "surface", equals: "Bituminous surface" }, note: "MoRTH 503: 0.25–0.35 kg/sqm" },
  ],
};

// ---------- Beam Flexural Strength (IS 516 Part 2) ----------
const concFB: TestDefinition = {
  code: "CONC-FB",
  name: "Beam Flexural Strength",
  category: "Concrete",
  isCode: "IS 516 (Part 2)",
  description: "Third-point loading on 150×150×700 beam: fb = P·L / (b·d²). Valid when fracture lies within middle third of span.",
  fields: [
    n("b", "Beam width (b)", "mm", true, "150"),
    n("d", "Beam depth (d)", "mm", true, "150"),
    n("span", "Span length (L)", "mm", true, "600"),
    n("load", "Breaking load (P)", "kN"),
  ],
  calcs: [
    { key: "fb", label: "Flexural strength", unit: "N/mm²", decimals: 2, formula: g => { const b = g.num("b"), d = g.num("d"); return b > 0 && d > 0 ? g.num("load") * 1000 * g.num("span") / (b * d * d) : null; } },
  ],
  limits: [
    { targetKey: "fb", label: "Flexural strength", min: 4.5, note: "MoRTH PQC: ≥ 4.5 MPa at 28 days" },
  ],
};

// Approximate generic Schmidt-hammer correlation (rebound number → MPa).
// INDICATIVE ONLY — project-specific calibration against cubes is required.
const RH_CURVE: [number, number][] = [[15, 10], [20, 15], [25, 20], [30, 26], [35, 32], [40, 39], [45, 46], [50, 54], [55, 62], [60, 70]];
const reboundToMpa = (r: number): number | null => {
  if (!(r >= 15 && r <= 60)) return null;
  for (let i = 0; i < RH_CURVE.length - 1; i++) {
    const [x0, y0] = RH_CURVE[i], [x1, y1] = RH_CURVE[i + 1];
    if (r >= x0 && r <= x1) return y0 + (y1 - y0) * (r - x0) / (x1 - x0);
  }
  return null;
};

// ---------- Rebound Hammer NDT (IS 13311 Part 2) — indicative ----------
const concRH: TestDefinition = {
  code: "CONC-RH",
  name: "Rebound Hammer (NDT)",
  category: "Concrete",
  isCode: "IS 13311 (Part 2)",
  description: "12 readings; outliers beyond ±20% of mean discarded. Strength from generic correlation curve — INDICATIVE ONLY, not for acceptance.",
  indicative: true,
  fields: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => n(`r${i}`, `Reading ${i}`, "")),
  calcs: [
    { key: "r_mean", label: "Mean rebound number", unit: "", decimals: 1, formula: g => { const rs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(k => g.num(`r${k}`)).filter(x => x > 0); return rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null; } },
    { key: "r_corr", label: "Corrected mean (outliers removed)", unit: "", decimals: 1, formula: g => { const m = g.num("r_mean"); if (!(m > 0)) return null; const rs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(k => g.num(`r${k}`)).filter(x => x >= 0.8 * m && x <= 1.2 * m); return rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null; } },
    { key: "est_mpa", label: "Estimated strength (indicative)", unit: "N/mm²", decimals: 1, formula: g => reboundToMpa(g.num("r_corr")) },
  ],
  limits: [],
};

// ---------- Ultrasonic Pulse Velocity NDT (IS 13311 Part 1) — indicative ----------
const concUPV: TestDefinition = {
  code: "CONC-UPV",
  name: "Ultrasonic Pulse Velocity (NDT)",
  category: "Concrete",
  isCode: "IS 13311 (Part 1)",
  description: "Pulse velocity = path length ÷ transit time. Quality grading per IS 13311: >4.5 Excellent, 3.5–4.5 Good, 3.0–3.5 Medium, <3.0 Doubtful. INDICATIVE ONLY.",
  indicative: true,
  fields: [
    n("path", "Path length", "mm"),
    n("time", "Transit time", "µs"),
  ],
  calcs: [
    { key: "vel", label: "Pulse velocity", unit: "km/s", decimals: 2, formula: g => { const t = g.num("time"); return t > 0 ? g.num("path") / t : null; } },
    { key: "grade", label: "Quality grade (4=Excellent, 3=Good, 2=Medium, 1=Doubtful)", unit: "", decimals: 0, formula: g => { const v = g.num("vel"); if (!(v > 0)) return null; return v > 4.5 ? 4 : v >= 3.5 ? 3 : v >= 3.0 ? 2 : 1; } },
  ],
  limits: [],
};

// ---------- Water Quality for Concrete (IS 456) ----------
const concWQ: TestDefinition = {
  code: "CONC-WQ",
  name: "Water Quality for Concrete",
  category: "Concrete",
  isCode: "IS 456",
  description: "Mixing & curing water — chemical limits per IS 456.",
  fields: [
    n("ph", "pH value", ""),
    n("chlor", "Chlorides (as Cl)", "mg/L"),
    n("sulph", "Sulphates (as SO₃)", "mg/L"),
    n("tss", "Suspended solids", "mg/L"),
  ],
  calcs: [
    { key: "ph_v", label: "pH", unit: "", decimals: 1, formula: g => g.num("ph") },
    { key: "cl_v", label: "Chlorides", unit: "mg/L", decimals: 0, formula: g => g.num("chlor") },
    { key: "so4_v", label: "Sulphates", unit: "mg/L", decimals: 0, formula: g => g.num("sulph") },
    { key: "tss_v", label: "Suspended solids", unit: "mg/L", decimals: 0, formula: g => g.num("tss") },
  ],
  limits: [
    { targetKey: "ph_v", label: "pH", min: 6, note: "IS 456: pH shall not be less than 6" },
    { targetKey: "cl_v", label: "Chlorides (RCC)", max: 500, note: "IS 456: ≤ 500 mg/L for reinforced concrete" },
    { targetKey: "so4_v", label: "Sulphates", max: 400, note: "IS 456: ≤ 400 mg/L (as SO₃)" },
    { targetKey: "tss_v", label: "Suspended solids", max: 2000, note: "IS 456: ≤ 2000 mg/L" },
  ],
};

// ============================================================
// REGISTRY + COMPUTE ENGINE
// ============================================================

export const TEST_DEFINITIONS: TestDefinition[] = [
  soilGSA, soilLL, soilPLPI, soilStdProctor, soilModProctor,
  soilSandRepl, soilCoreCutter, soilCBR, soilFSI,
  soilFieldCBR, soilPLT, soilBB, soilNMC, soilMCC, soilThk,
  aggSieve, aggImpact, aggCrushing, aggLA, aggFlakiness, aggElongation, aggWA, aggSG,
  aggSE,
  bitPenetration, bitSoftening, bitDuctility, bitViscosity, bitFlashFire, bitSG,
  bitStrip, bitER, bitEmRes, bitEmVis, bitPrime, bitTack,
  mixMarshall, mixBinder, mixVoids, mixCore,
  concCube, concSlump, concFB, concRH, concUPV, concWQ,
  cemFineness, cemConsistency, cemSetting, cemSoundness, cemStrength,
  steelTensile, steelBend, steelWt,
];

export const CATEGORIES: TestCategory[] = [
  "Soil", "Aggregate", "Bitumen", "Bituminous Mix", "Concrete", "Cement", "Steel",
];

export function getTestDef(code: string): TestDefinition | undefined {
  return TEST_DEFINITIONS.find(d => d.code === code);
}

export function getTestsByCategory(cat: TestCategory): TestDefinition[] {
  return TEST_DEFINITIONS.filter(d => d.category === cat);
}

export interface LimitResult {
  label: string;
  value: number | null;
  pass: boolean;
  note?: string;
}

export interface ComputeResult {
  values: Record<string, number | null>;
  formatted: Record<string, string>;
  limits: LimitResult[];
  status: "Pass" | "Fail" | "Pending" | "Indicative";
}

/** Evaluate all calcs + limits for a test given raw string inputs. */
export function computeTest(def: TestDefinition, inputs: Record<string, string>): ComputeResult {
  const num = (key: string): number => {
    if (key in values && values[key] !== null && values[key] !== undefined) {
      const v = values[key] as number;
      return typeof v === "number" && isFinite(v) ? v : NaN;
    }
    const raw = inputs[key];
    if (raw === undefined || raw === null || raw === "") return NaN;
    const v = parseFloat(String(raw));
    return isFinite(v) ? v : NaN;
  };
  const str = (key: string): string => {
    const raw = inputs[key];
    return raw === undefined || raw === null ? "" : String(raw);
  };
  const values: Record<string, number | null> = {};
  const getter: CalcGetter = { num, str };

  let missing = false;
  for (const c of def.calcs) {
    try {
      const v = c.formula(getter);
      values[c.key] = v === null || v === undefined || !isFinite(v as number) ? null : (v as number);
    } catch {
      values[c.key] = null;
    }
  }

  // required-field completeness
  for (const f of def.fields) {
    if (f.required) {
      const raw = inputs[f.key];
      if (raw === undefined || raw === null || String(raw).trim() === "") missing = true;
      else if (f.type === "number" && !isFinite(parseFloat(String(raw)))) missing = true;
    }
  }

  const formatted: Record<string, string> = {};
  for (const c of def.calcs) {
    const v = values[c.key];
    formatted[c.key] = v === null || v === undefined ? "—" : v.toFixed(c.decimals);
  }

  const limits: LimitResult[] = [];
  let anyFail = false;
  for (const lim of def.limits) {
    if (lim.when && str(lim.when.field) !== lim.when.equals) continue; // not applicable
    const v = values[lim.targetKey];
    const val = v === null || v === undefined || !isFinite(v) ? null : v;
    let pass = true;
    if (val === null) pass = false;
    else {
      if (lim.min !== undefined && val < lim.min) pass = false;
      if (lim.max !== undefined && val > lim.max) pass = false;
    }
    if (!pass) anyFail = false || true;
    if (!pass) anyFail = true;
    limits.push({ label: lim.label, value: val, pass, note: lim.note });
  }

  const status = missing
    ? "Pending"
    : def.indicative
    ? "Indicative"
    : limits.length === 0
    ? "Pending"
    : anyFail
    ? "Fail"
    : "Pass";
  // If all limits pass but some calc is null (shouldn't happen when inputs complete), stay Pending
  return { values, formatted, limits, status };
}

// ============================================================
// TEST PLANNER — MoRTH frequency calculator
// ============================================================

export interface PlannerRow {
  code: string;
  name: string;
  frequency: string;
  required: number;
  note?: string;
}

/**
 * For a work item + quantity, compute required test numbers per MoRTH frequency.
 * `pours` = number of concrete pours/days (for pour-based frequencies).
 */
export function getPlannerRows(
  workItem: WorkItem,
  qty: number,
  unit: string,
  pours?: number
): PlannerRow[] {
  const rows: PlannerRow[] = [];
  if (!(qty > 0) && !(pours && pours > 0)) return rows;
  for (const def of TEST_DEFINITIONS) {
    for (const f of def.frequency || []) {
      if (f.workItem !== workItem) continue;
      let required: number | null = null;
      if (f.unit === "pour") {
        if (pours && pours > 0) required = Math.ceil(pours / f.qty);
      } else if (f.unit === unit && qty > 0) {
        required = Math.ceil(qty / f.qty);
      }
      if (required === null || required <= 0) continue;
      rows.push({
        code: def.code,
        name: def.name,
        frequency: `1 per ${f.qty} ${f.unit}`,
        required,
        note: f.note,
      });
    }
  }
  return rows;
}
