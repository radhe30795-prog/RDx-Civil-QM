import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { trpc } from "../lib/trpc";

export default function ProjectsPage() {
  const { data: projects, refetch, isLoading } = trpc.projects.list.useQuery();
  const create = trpc.projects.create.useMutation();
  const remove = trpc.projects.delete.useMutation();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: "", packageNo: "", client: "", location: "" });

  const save = async () => {
    if (!form.name.trim()) return;
    await create.mutateAsync(form);
    setForm({ name: "", packageNo: "", client: "", location: "" });
    setShow(false);
    refetch();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Projects</h2>
        <button className="qm-btn qm-btn-primary !min-h-0 !py-2" onClick={() => setShow(true)}>
          <Plus size={18} /> New
        </button>
      </div>

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}

      <div className="space-y-2">
        {(projects || []).map((p: any) => (
          <div key={p.id} className="qm-card flex items-start justify-between gap-2">
            <div>
              <div className="font-bold">{p.name}</div>
              <div className="text-xs text-slate-500">
                {[p.packageNo, p.client, p.location].filter(Boolean).join(" • ")}
              </div>
            </div>
            <button
              className="text-red-500 p-2"
              onClick={async () => {
                if (confirm(`Delete project "${p.name}"?`)) {
                  await remove.mutateAsync({ id: p.id });
                  refetch();
                }
              }}
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        {(projects || []).length === 0 && !isLoading && (
          <p className="text-sm text-slate-400 text-center py-6">No projects yet.</p>
        )}
      </div>

      {show && (
        <div className="fixed inset-0 bg-black/50 z-20 flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-2xl p-4 space-y-3 pb-8">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">New Project</h3>
              <button onClick={() => setShow(false)} className="p-2"><X size={20} /></button>
            </div>
            <div>
              <label className="qm-label">Project name *</label>
              <input className="qm-input" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. PMGSY-IV Batch-I / CG16-201" />
            </div>
            <div>
              <label className="qm-label">Package No.</label>
              <input className="qm-input" value={form.packageNo}
                onChange={(e) => setForm({ ...form, packageNo: e.target.value })}
                placeholder="e.g. CG16-201" />
            </div>
            <div>
              <label className="qm-label">Client</label>
              <input className="qm-input" value={form.client}
                onChange={(e) => setForm({ ...form, client: e.target.value })}
                placeholder="e.g. PMGSY Ambikapur" />
            </div>
            <div>
              <label className="qm-label">Location</label>
              <input className="qm-input" value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Surguja, Chhattisgarh" />
            </div>
            <button className="qm-btn qm-btn-primary w-full" onClick={save}
              disabled={create.isPending}>
              {create.isPending ? "Saving…" : "Save Project"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
