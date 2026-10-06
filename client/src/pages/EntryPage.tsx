import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { getTestDef } from "../../../shared/testDefinitions";
import TestForm from "../components/TestForm";
import { queueOfflineEntry } from "../lib/offlineDb";

export default function EntryPage({ code }: { code: string }) {
  const [, nav] = useLocation();
  const def = getTestDef(code);
  const { data: projects } = trpc.projects.list.useQuery();
  const create = trpc.entries.create.useMutation();
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [ctx, setCtx] = useState({
    projectId: "",
    testDate: new Date().toISOString().slice(0, 10),
    sampleId: "",
    chainage: "",
    layer: "",
    materialSource: "",
    testedBy: "",
    witnessBy: "",
    remarks: "",
  });

  if (!def) return <p className="text-red-600">Unknown test: {code}</p>;

  const submit = async (inputs: Record<string, string>) => {
    if (!ctx.projectId) {
      setMsg("Select a project first.");
      return;
    }
    setSaving(true);
    setMsg("");
    const payload = {
      projectId: parseInt(ctx.projectId),
      testCode: def.code,
      testDate: ctx.testDate,
      sampleId: ctx.sampleId || undefined,
      chainage: ctx.chainage || undefined,
      layer: ctx.layer || undefined,
      materialSource: ctx.materialSource || undefined,
      testedBy: ctx.testedBy || undefined,
      witnessBy: ctx.witnessBy || undefined,
      inputs,
      remarks: ctx.remarks || undefined,
    };
    try {
      if (!navigator.onLine) throw new Error("offline");
      const r = await create.mutateAsync(payload as any);
      setMsg(`Saved — ${r.status}`);
      setTimeout(() => nav("/register"), 800);
    } catch {
      // Offline or server error → queue locally
      await queueOfflineEntry(payload);
      setMsg("Offline — saved to queue, will sync later.");
      setTimeout(() => nav("/"), 1200);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">{def.name}</h2>
        <p className="text-xs text-slate-500">{def.category} • {def.isCode}</p>
        <p className="text-xs text-slate-500 mt-1">{def.description}</p>
      </div>

      {/* Context */}
      <div className="qm-card space-y-3">
        <h3 className="font-bold text-sm text-slate-700 uppercase tracking-wide">Sample info</h3>
        <div>
          <label className="qm-label">Project *</label>
          <select
            className="qm-input"
            value={ctx.projectId}
            onChange={(e) => setCtx({ ...ctx, projectId: e.target.value })}
          >
            <option value="">Select project…</option>
            {(projects || []).map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="qm-label">Test date *</label>
            <input type="date" className="qm-input" value={ctx.testDate}
              onChange={(e) => setCtx({ ...ctx, testDate: e.target.value })} />
          </div>
          <div>
            <label className="qm-label">Sample ID</label>
            <input className="qm-input" value={ctx.sampleId}
              onChange={(e) => setCtx({ ...ctx, sampleId: e.target.value })}
              placeholder="e.g. S-102" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="qm-label">Chainage</label>
            <input className="qm-input" value={ctx.chainage}
              onChange={(e) => setCtx({ ...ctx, chainage: e.target.value })}
              placeholder="e.g. 1+250" />
          </div>
          <div>
            <label className="qm-label">Layer</label>
            <input className="qm-input" value={ctx.layer}
              onChange={(e) => setCtx({ ...ctx, layer: e.target.value })}
              placeholder="e.g. GSB" />
          </div>
        </div>
        <div>
          <label className="qm-label">Material source</label>
          <input className="qm-input" value={ctx.materialSource}
            onChange={(e) => setCtx({ ...ctx, materialSource: e.target.value })}
            placeholder="e.g. Quarry — Mainpat" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="qm-label">Tested by</label>
            <input className="qm-input" value={ctx.testedBy}
              onChange={(e) => setCtx({ ...ctx, testedBy: e.target.value })} />
          </div>
          <div>
            <label className="qm-label">Witnessed by</label>
            <input className="qm-input" value={ctx.witnessBy}
              onChange={(e) => setCtx({ ...ctx, witnessBy: e.target.value })} />
          </div>
        </div>
      </div>

      <TestForm def={def} onSubmit={submit} submitting={saving} />

      <div>
        <label className="qm-label">Remarks</label>
        <textarea className="qm-input" rows={2} value={ctx.remarks}
          onChange={(e) => setCtx({ ...ctx, remarks: e.target.value })} />
      </div>

      {msg && <p className="text-center text-sm font-semibold text-slate-700">{msg}</p>}
    </div>
  );
}
