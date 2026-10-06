import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Printer, Trash2, Calculator } from "lucide-react";
import { trpc } from "../lib/trpc";
import {
  CATEGORIES,
  WORK_ITEMS,
  WORK_ITEM_UNITS,
  getPlannerRows,
  type WorkItem,
} from "../../../shared/testDefinitions";

const STATUS_STYLE: Record<string, string> = {
  Pass: "bg-emerald-100 text-emerald-800",
  Fail: "bg-red-100 text-red-800",
  Pending: "bg-amber-100 text-amber-800",
  Indicative: "bg-sky-100 text-sky-800",
};

export default function RegisterPage() {
  const { data: projects } = trpc.projects.list.useQuery();
  const [f, setF] = useState({ projectId: "", category: "", status: "", from: "", to: "" });

  const { data: rows, refetch, isLoading } = trpc.entries.list.useQuery({
    projectId: f.projectId ? parseInt(f.projectId) : undefined,
    status: (f.status || undefined) as any,
    from: f.from || undefined,
    to: f.to || undefined,
    limit: 300,
  });
  const remove = trpc.entries.delete.useMutation();

  const filtered = (rows || []).filter((r: any) =>
    !f.category || r.master?.category === f.category
  );

  // --- Test Planner summary strip ---
  const [plan, setPlan] = useState({ workItem: "Earthwork" as WorkItem, qty: "", unit: "cum" });
  const planUnits = WORK_ITEM_UNITS[plan.workItem];
  const planEffUnit = planUnits.includes(plan.unit as any) ? plan.unit : planUnits[0];
  const planRows = useMemo(
    () => getPlannerRows(plan.workItem, parseFloat(plan.qty) || 0, planEffUnit),
    [plan.workItem, plan.qty, planEffUnit]
  );
  const planStats = useMemo(() => {
    const doneByCode: Record<string, number> = {};
    for (const r of filtered) {
      const code = r.master?.code;
      if (code) doneByCode[code] = (doneByCode[code] || 0) + 1;
    }
    let req = 0, done = 0;
    for (const pr of planRows) {
      req += pr.required;
      done += Math.min(doneByCode[pr.code] || 0, pr.required);
    }
    return { req, done, pending: Math.max(0, req - done) };
  }, [planRows, filtered]);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">Test Register</h2>

      {/* Filters */}
      <div className="qm-card space-y-2 no-print">
        <div className="grid grid-cols-2 gap-2">
          <select className="qm-input !py-2 text-sm" value={f.projectId}
            onChange={(e) => setF({ ...f, projectId: e.target.value })}>
            <option value="">All projects</option>
            {(projects || []).map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select className="qm-input !py-2 text-sm" value={f.category}
            onChange={(e) => setF({ ...f, category: e.target.value })}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="qm-input !py-2 text-sm" value={f.status}
            onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="">All status</option>
            <option>Pass</option><option>Fail</option><option>Pending</option><option>Indicative</option>
          </select>
          <input type="date" className="qm-input !py-2 text-sm" value={f.from}
            onChange={(e) => setF({ ...f, from: e.target.value })} />
        </div>
        <div className="text-xs text-slate-500 text-right">{filtered.length} record(s)</div>
      </div>

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}

      {/* Planner summary */}
      <div className="qm-card no-print">
        <div className="flex items-center gap-2 mb-2">
          <Calculator size={16} className="text-[#1e3a5f]" />
          <h3 className="font-bold text-sm text-slate-700">Planned vs Done</h3>
          <Link href="/planner">
            <span className="ml-auto text-xs font-semibold text-[#1e3a5f] cursor-pointer">Full planner →</span>
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <select className="qm-input !py-2 text-sm" value={plan.workItem}
            onChange={(e) => setPlan({ ...plan, workItem: e.target.value as WorkItem, qty: "" })}>
            {WORK_ITEMS.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          <input type="number" className="qm-input !py-2 text-sm" value={plan.qty}
            onChange={(e) => setPlan({ ...plan, qty: e.target.value })} placeholder="Qty" />
          <select className="qm-input !py-2 text-sm" value={planEffUnit}
            onChange={(e) => setPlan({ ...plan, unit: e.target.value })}>
            {planUnits.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        {planRows.length > 0 ? (
          <div className="flex gap-2 text-center text-sm">
            <div className="flex-1 bg-slate-50 rounded-lg py-1.5">
              <span className="font-bold text-[#1e3a5f]">{planStats.req}</span>
              <span className="text-slate-500 text-xs"> Required</span>
            </div>
            <div className="flex-1 bg-emerald-50 rounded-lg py-1.5">
              <span className="font-bold text-emerald-700">{planStats.done}</span>
              <span className="text-slate-500 text-xs"> Done</span>
            </div>
            <div className="flex-1 bg-amber-50 rounded-lg py-1.5">
              <span className="font-bold text-amber-700">{planStats.pending}</span>
              <span className="text-slate-500 text-xs"> Pending</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400">Enter work quantity to compare planned vs done.</p>
        )}
      </div>

      <div className="space-y-2">
        {filtered.map((r: any) => (
          <div key={r.entry.id} className="qm-card">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{r.master?.name || "Test"}</div>
                <div className="text-xs text-slate-500">
                  {r.entry.testDate}
                  {r.entry.sampleId ? ` • ${r.entry.sampleId}` : ""}
                  {r.entry.chainage ? ` • CH ${r.entry.chainage}` : ""}
                </div>
                <div className="text-xs text-slate-400">{r.project?.name}</div>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 ${STATUS_STYLE[r.entry.status] || ""}`}>
                {r.entry.status}
              </span>
            </div>
            <div className="flex gap-2 mt-2 no-print">
              <Link href={`/report/${r.entry.id}`}>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1e3a5f] border border-slate-200 rounded-lg px-3 py-1.5 cursor-pointer">
                  <Printer size={14} /> Report
                </span>
              </Link>
              <button
                className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 border border-slate-200 rounded-lg px-3 py-1.5"
                onClick={async () => {
                  if (confirm("Delete this test entry?")) {
                    await remove.mutateAsync({ id: r.entry.id });
                    refetch();
                  }
                }}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && !isLoading && (
          <p className="text-sm text-slate-400 text-center py-6">No records found.</p>
        )}
      </div>
    </div>
  );
}
