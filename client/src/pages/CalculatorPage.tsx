import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Calculator, Plus, Printer, Save, Settings2, Trash2, X } from "lucide-react";
import { trpc } from "../lib/trpc";
import {
  STMT_ITEMS,
  MAT_COLUMNS,
  DEFAULT_NORMS,
  computeStatement,
  computeRoyalty,
  loadNorms,
  saveNorms,
  type StmtItem,
  type StmtNorm,
  type StmtRowInput,
  type RoyaltyItem,
  type MatCol,
} from "../../../shared/consumption";

/** Consumption Statement (RA Bill format) + Royalty Statement. */
export default function CalculatorPage() {
  const [raBillNo, setRaBillNo] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<StmtRowInput[]>([{ item: "M-15", qty: 0 }]);
  const [norms, setNorms] = useState<Record<StmtItem, StmtNorm>>(loadNorms);
  const [showSettings, setShowSettings] = useState(false);
  const [rates, setRates] = useState<Record<RoyaltyItem, number>>({ Moorum: 0, Sand: 0, Metal: 0 });
  const [remarks, setRemarks] = useState("");
  const [msg, setMsg] = useState("");

  const { data: history, refetch } = trpc.statements.list.useQuery({ limit: 100 });
  const saveStmt = trpc.statements.create.useMutation();
  const delStmt = trpc.statements.delete.useMutation();

  const validRows = useMemo(
    () => rows.filter((r) => r.qty > 0),
    [rows]
  );
  const stmt = useMemo(() => computeStatement(validRows, norms), [validRows, norms]);
  const royalty = useMemo(() => computeRoyalty(stmt.totals, rates), [stmt.totals, rates]);
  const royaltyTotal = royalty.reduce((a, r) => a + r.amount, 0);

  const setRow = (i: number, patch: Partial<StmtRowInput>) =>
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, { item: "M-15", qty: 0 }]);
  const delRow = (i: number) => setRows((rs) => rs.filter((_, k) => k !== i));

  const setRatio = (item: StmtItem, col: MatCol, v: string) => {
    const n = parseFloat(v);
    setNorms((ns) => ({
      ...ns,
      [item]: { ...ns[item], ratios: { ...ns[item].ratios, [col]: isFinite(n) ? n : 0 } },
    }));
  };
  const persistNorms = () => {
    saveNorms(norms);
    setMsg("Ratios saved.");
    setTimeout(() => setMsg(""), 2000);
  };
  const resetNorms = () => {
    const d = structuredClone(DEFAULT_NORMS);
    setNorms(d);
    saveNorms(d);
  };

  const save = async () => {
    if (!raBillNo.trim()) { setMsg("Enter RA Bill No. first."); return; }
    if (validRows.length === 0) { setMsg("Add at least one row with quantity."); return; }
    try {
      await saveStmt.mutateAsync({
        date,
        raBillNo: raBillNo.trim(),
        rows: validRows.map((r) => ({ item: r.item, qty: r.qty })),
        norms: norms as any,
        royaltyRates: rates as any,
        remarks: remarks || undefined,
      });
      setMsg(`Saved — ${raBillNo.trim()}`);
      refetch();
    } catch {
      setMsg("Save failed — check connection.");
    }
  };

  const loadHistory = (h: any) => {
    setRaBillNo(h.raBillNo || "");
    setDate(h.date || new Date().toISOString().slice(0, 10));
    setRows(((h.rows as any[]) || []).map((r: any) => ({ item: r.item as StmtItem, qty: r.qty })));
    if (h.norms && Object.keys(h.norms).length) {
      const merged = loadNorms();
      for (const k of Object.keys(h.norms) as StmtItem[]) {
        if (merged[k]) merged[k] = { ...merged[k], ratios: { ...h.norms[k].ratios } };
      }
      setNorms(merged);
    }
    if (h.royaltyRates) setRates({ Moorum: 0, Sand: 0, Metal: 0, ...(h.royaltyRates as any) });
    setRemarks(h.remarks || "");
    window.scrollTo({ top: 0 });
  };

  const fmt = (v: number) => (v === 0 ? "—" : v.toLocaleString("en-IN", { maximumFractionDigits: 2 }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Calculator size={20} /> Consumption Statement
        </h2>
        <button className="qm-btn !py-2 text-sm bg-white border-2 border-slate-200" onClick={() => setShowSettings(!showSettings)}>
          <Settings2 size={16} /> Ratios
        </button>
      </div>

      {/* Header inputs */}
      <div className="qm-card space-y-3 no-print">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="qm-label">RA Bill No. *</label>
            <input className="qm-input" value={raBillNo} onChange={(e) => setRaBillNo(e.target.value)} placeholder="e.g. RA-03" />
          </div>
          <div>
            <label className="qm-label">Date</label>
            <input type="date" className="qm-input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="qm-label">Work rows</label>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_110px_36px] gap-2 items-center">
                <select className="qm-input !py-2 text-sm" value={r.item}
                  onChange={(e) => setRow(i, { item: e.target.value as StmtItem })}>
                  {STMT_ITEMS.map((it) => {
                    const n = norms[it];
                    return <option key={it} value={it}>{it} ({n.unit})</option>;
                  })}
                </select>
                <input type="number" className="qm-input !py-2 text-sm" value={r.qty || ""}
                  onChange={(e) => setRow(i, { qty: parseFloat(e.target.value) || 0 })}
                  placeholder="Qty" />
                <button className="text-red-500 p-1" onClick={() => delRow(i)} aria-label="Remove row">
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
          <button className="qm-btn w-full mt-2 bg-white border-2 border-slate-200 text-slate-700" onClick={addRow}>
            <Plus size={18} /> Add row
          </button>
        </div>
      </div>

      {/* Settings — editable ratios */}
      {showSettings && (
        <div className="qm-card no-print">
          <h3 className="font-bold text-sm mb-2">Material ratios (per unit qty) — editable</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {STMT_ITEMS.map((it) => (
              <div key={it} className="border-b border-slate-100 pb-2">
                <div className="font-semibold text-sm">{it} <span className="text-slate-400 font-normal">({norms[it].unit})</span></div>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {MAT_COLUMNS.map((c) => (
                    <div key={c.key}>
                      <label className="text-[11px] text-slate-500">{c.label} ({c.unit})</label>
                      <input type="number" step="any" className="qm-input !py-1.5 text-sm"
                        value={norms[it].ratios[c.key] ?? ""}
                        onChange={(e) => setRatio(it, c.key, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button className="qm-btn qm-btn-primary flex-1" onClick={persistNorms}>Save ratios</button>
            <button className="qm-btn bg-white border-2 border-slate-200" onClick={resetNorms}>Reset</button>
          </div>
        </div>
      )}

      {/* Consumption Statement */}
      {stmt.rows.length > 0 && (
        <div className="qm-card overflow-hidden !p-0">
          <div className="px-3 pt-3 pb-1 text-center border-b-2 border-[#1e3a5f]">
            <h3 className="font-bold text-[#1e3a5f]">Consumption Statement</h3>
            <p className="text-xs text-slate-500">{raBillNo ? `RA Bill: ${raBillNo} • ` : ""}{date}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase text-slate-500">
                  <th className="px-2 py-2 text-left">S.No</th>
                  <th className="px-2 py-2 text-left">Item</th>
                  <th className="px-2 py-2 text-right">Net Qty</th>
                  {MAT_COLUMNS.map((c) => (
                    <th key={c.key} className="px-2 py-2 text-right">{c.label} ({c.unit})</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stmt.rows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-2 py-2">{i + 1}</td>
                    <td className="px-2 py-2 font-semibold">{r.item}</td>
                    <td className="px-2 py-2 text-right font-mono">{r.qty.toLocaleString("en-IN")} {r.unit}</td>
                    {MAT_COLUMNS.map((c) => (
                      <td key={c.key} className="px-2 py-2 text-right font-mono">{fmt(r.vals[c.key])}</td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t-2 border-[#1e3a5f] bg-slate-50 font-bold">
                  <td className="px-2 py-2" colSpan={3}>Total</td>
                  {MAT_COLUMNS.map((c) => (
                    <td key={c.key} className="px-2 py-2 text-right font-mono">{fmt(stmt.totals[c.key])}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Royalty Statement */}
      {stmt.rows.length > 0 && (
        <div className="qm-card overflow-hidden !p-0">
          <div className="px-3 pt-3 pb-1 text-center border-b-2 border-[#1e3a5f]">
            <h3 className="font-bold text-[#1e3a5f]">Royalty Statement</h3>
            <p className="text-xs text-slate-500">{raBillNo ? `RA Bill: ${raBillNo} • ` : ""}{date}</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase text-slate-500">
                <th className="px-3 py-2 text-left">S.No</th>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-right">Quantity (cum)</th>
                <th className="px-3 py-2 text-right">Rate (₹)</th>
                <th className="px-3 py-2 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {royalty.map((r, i) => (
                <tr key={r.item} className="border-t border-slate-100">
                  <td className="px-3 py-2">{i + 1}</td>
                  <td className="px-3 py-2 font-semibold">{r.item}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.qty)}</td>
                  <td className="px-3 py-2">
                    <input type="number" className="qm-input !py-1.5 text-sm text-right no-print" value={rates[r.item] || ""}
                      onChange={(e) => setRates((p) => ({ ...p, [r.item]: parseFloat(e.target.value) || 0 }))}
                      placeholder="₹/cum" />
                    <span className="hidden print:inline font-mono">{fmt(r.rate)}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-bold">₹{fmt(r.amount)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-[#1e3a5f] bg-slate-50 font-bold">
                <td className="px-3 py-2" colSpan={4}>Total Royalty</td>
                <td className="px-3 py-2 text-right font-mono">₹{fmt(royaltyTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Actions */}
      {stmt.rows.length > 0 && (
        <div className="space-y-2 no-print">
          <input className="qm-input" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Remarks" />
          <div className="grid grid-cols-2 gap-2">
            <button className="qm-btn qm-btn-primary" onClick={save} disabled={saveStmt.isPending}>
              <Save size={18} /> {saveStmt.isPending ? "Saving…" : "Save"}
            </button>
            <button className="qm-btn bg-white border-2 border-slate-200" onClick={() => window.print()}>
              <Printer size={18} /> Print
            </button>
          </div>
          {msg && <p className="text-center text-sm font-semibold text-slate-700">{msg}</p>}
        </div>
      )}

      {/* History */}
      {(history || []).length > 0 && (
        <div className="space-y-2 no-print">
          <h3 className="font-bold text-sm text-slate-700 uppercase tracking-wide">Saved statements</h3>
          {(history || []).map((h: any) => (
            <div key={h.id} className="qm-card">
              <div className="flex items-start justify-between gap-2">
                <button className="text-left min-w-0" onClick={() => loadHistory(h)}>
                  <div className="font-semibold text-sm text-[#1e3a5f]">{h.raBillNo}</div>
                  <div className="text-xs text-slate-500">
                    {h.date} • {((h.rows as any[]) || []).length} item(s)
                    {h.remarks ? ` • ${h.remarks}` : ""}
                  </div>
                </button>
                <button
                  className="text-red-500 shrink-0 p-1"
                  onClick={async () => {
                    if (confirm(`Delete statement ${h.raBillNo}?`)) {
                      await delStmt.mutateAsync({ id: h.id });
                      refetch();
                    }
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
