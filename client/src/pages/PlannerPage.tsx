import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Calculator, ClipboardList } from "lucide-react";
import { trpc } from "../lib/trpc";
import {
  WORK_ITEMS,
  WORK_ITEM_UNITS,
  getPlannerRows,
  type WorkItem,
} from "../../../shared/testDefinitions";

/** Test Planner — MoRTH frequency calculator: work item + quantity → required tests. */
export default function PlannerPage() {
  const { data: projects } = trpc.projects.list.useQuery();
  const [workItem, setWorkItem] = useState<WorkItem>("Earthwork");
  const [projectId, setProjectId] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("cum");
  const [pours, setPours] = useState("");

  const units = WORK_ITEM_UNITS[workItem];
  const effUnit = units.includes(unit as any) ? unit : units[0];

  const rows = useMemo(
    () => getPlannerRows(workItem, parseFloat(qty) || 0, effUnit, parseFloat(pours) || 0),
    [workItem, qty, effUnit, pours]
  );

  // Done counts per test code (for Required | Done | Pending)
  const { data: entries } = trpc.entries.list.useQuery(
    { projectId: projectId ? parseInt(projectId) : undefined, limit: 500 },
    { enabled: rows.length > 0 }
  );
  const doneByCode = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of entries || []) {
      const code = (r as any).master?.code;
      if (code) m[code] = (m[code] || 0) + 1;
    }
    return m;
  }, [entries]);

  const totalReq = rows.reduce((a, r) => a + r.required, 0);
  const totalDone = rows.reduce((a, r) => a + Math.min(doneByCode[r.code] || 0, r.required), 0);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Calculator size={20} /> Test Planner
      </h2>
      <p className="text-xs text-slate-500 -mt-2">
        MoRTH frequency calculator — enter work quantity to see required tests.
      </p>

      {/* Inputs */}
      <div className="qm-card space-y-3 no-print">
        <div>
          <label className="qm-label">Project (for Done count)</label>
          <select className="qm-input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">All projects</option>
            {(projects || []).map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="qm-label">Work item</label>
          <select
            className="qm-input"
            value={workItem}
            onChange={(e) => { setWorkItem(e.target.value as WorkItem); setQty(""); setPours(""); }}
          >
            {WORK_ITEMS.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="qm-label">Quantity</label>
            <input
              type="number" className="qm-input" value={qty}
              onChange={(e) => setQty(e.target.value)} placeholder="e.g. 5000"
            />
          </div>
          <div>
            <label className="qm-label">Unit</label>
            <select className="qm-input" value={effUnit} onChange={(e) => setUnit(e.target.value)}>
              {units.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>
        {workItem === "Concrete" && (
          <div>
            <label className="qm-label">No. of pours / days</label>
            <input
              type="number" className="qm-input" value={pours}
              onChange={(e) => setPours(e.target.value)} placeholder="e.g. 6"
            />
          </div>
        )}
      </div>

      {/* Summary */}
      {rows.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="qm-card text-center">
            <div className="text-2xl font-bold text-[#1e3a5f]">{totalReq}</div>
            <div className="text-xs text-slate-500 font-semibold">REQUIRED</div>
          </div>
          <div className="qm-card text-center">
            <div className="text-2xl font-bold text-emerald-600">{totalDone}</div>
            <div className="text-xs text-slate-500 font-semibold">DONE</div>
          </div>
          <div className="qm-card text-center">
            <div className="text-2xl font-bold text-amber-600">{Math.max(0, totalReq - totalDone)}</div>
            <div className="text-xs text-slate-500 font-semibold">PENDING</div>
          </div>
        </div>
      )}

      {/* Result table */}
      {rows.length > 0 ? (
        <div className="qm-card overflow-hidden !p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="px-3 py-2">Test</th>
                <th className="px-3 py-2">Frequency</th>
                <th className="px-3 py-2 text-center">Req.</th>
                <th className="px-3 py-2 text-center">Done</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const done = doneByCode[r.code] || 0;
                const pending = Math.max(0, r.required - done);
                return (
                  <tr key={r.code + r.frequency} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <Link href={`/entry/${r.code}`}>
                        <span className="font-semibold text-[#1e3a5f] cursor-pointer">{r.name}</span>
                      </Link>
                      {r.note && <div className="text-xs text-slate-400">{r.note}</div>}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{r.frequency}</td>
                    <td className="px-3 py-2 text-center font-bold">{r.required}</td>
                    <td className={`px-3 py-2 text-center font-bold ${pending === 0 ? "text-emerald-600" : "text-amber-600"}`}>
                      {done}{pending > 0 ? ` (${pending} left)` : " ✓"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-400 text-center py-6">
          Enter quantity above to calculate required tests.
        </p>
      )}

      <Link href="/register">
        <span className="qm-btn w-full bg-white border-2 border-slate-200 text-slate-700 cursor-pointer">
          <ClipboardList size={18} /> Open Test Register
        </span>
      </Link>
    </div>
  );
}
