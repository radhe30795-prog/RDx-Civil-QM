import { Link } from "wouter";
import { FlaskConical, CheckCircle2, XCircle, Clock, Plus, RefreshCw } from "lucide-react";
import { trpc } from "../lib/trpc";
import { getPendingEntries, removePendingEntry } from "../lib/offlineDb";
import { useState } from "react";

export default function Dashboard() {
  const { data: stats, refetch, isLoading } = trpc.dashboard.stats.useQuery({});
  const { data: projects } = trpc.projects.list.useQuery();
  const createEntry = trpc.entries.create.useMutation();
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const syncOffline = async () => {
    setSyncing(true);
    setSyncMsg("");
    try {
      const pending = await getPendingEntries();
      let ok = 0, fail = 0;
      for (const p of pending) {
        try {
          await createEntry.mutateAsync(p.payload as any);
          await removePendingEntry(p.id!);
          ok++;
        } catch {
          fail++;
        }
      }
      setSyncMsg(`Synced ${ok}, failed ${fail}`);
      refetch();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="qm-card">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase">
            <FlaskConical size={14} /> Total tests
          </div>
          <div className="text-3xl font-bold mt-1">{isLoading ? "…" : stats?.total ?? 0}</div>
        </div>
        <div className="qm-card">
          <div className="text-slate-500 text-xs font-semibold uppercase">Pass %</div>
          <div className="text-3xl font-bold mt-1 text-emerald-600">
            {isLoading ? "…" : `${stats?.passPct ?? 0}%`}
          </div>
        </div>
        <div className="qm-card">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase">
            <CheckCircle2 size={14} /> Passed
          </div>
          <div className="text-3xl font-bold mt-1 text-emerald-600">{stats?.pass ?? 0}</div>
        </div>
        <div className="qm-card">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase">
            <XCircle size={14} /> Failed
          </div>
          <div className="text-3xl font-bold mt-1 text-red-600">{stats?.fail ?? 0}</div>
        </div>
      </div>

      {(stats?.pending ?? 0) > 0 && (
        <div className="qm-card flex items-center gap-2 text-amber-800 bg-amber-50 border border-amber-200">
          <Clock size={18} />
          <span className="text-sm font-semibold">{stats?.pending} test(s) pending completion</span>
        </div>
      )}

      {/* Sync offline queue */}
      <button
        className="qm-btn w-full bg-white border-2 border-slate-200 text-slate-700"
        onClick={syncOffline}
        disabled={syncing}
      >
        <RefreshCw size={18} className={syncing ? "animate-spin" : ""} />
        {syncing ? "Syncing…" : "Sync offline entries"}
      </button>
      {syncMsg && <p className="text-center text-sm text-slate-600">{syncMsg}</p>}

      {/* Category breakdown */}
      <div className="qm-card">
        <h3 className="font-bold text-sm uppercase tracking-wide text-slate-600 mb-2">
          By category
        </h3>
        <div className="space-y-2">
          {(stats?.byCategory || []).map((c: any) => (
            <div key={c.category} className="flex items-center justify-between text-sm">
              <span className="font-medium">{c.category}</span>
              <span className="text-slate-500">
                <span className="text-emerald-600 font-bold">{c.pass}</span>
                {" / "}
                <span className="text-red-600 font-bold">{c.fail}</span>
                <span className="text-slate-400"> / {c.total}</span>
              </span>
            </div>
          ))}
          {(stats?.byCategory || []).length === 0 && (
            <p className="text-sm text-slate-400">No tests recorded yet.</p>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <Link href="/tests">
        <span className="qm-btn qm-btn-accent w-full cursor-pointer">
          <Plus size={20} /> New Test Entry
        </span>
      </Link>

      {(projects || []).length === 0 && (
        <div className="qm-card border-2 border-dashed border-slate-300 text-center">
          <p className="text-sm text-slate-600 mb-2">No projects yet — create one to start testing.</p>
          <Link href="/projects">
            <span className="qm-btn qm-btn-primary cursor-pointer">Add Project</span>
          </Link>
        </div>
      )}
    </div>
  );
}
