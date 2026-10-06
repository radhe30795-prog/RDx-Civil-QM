import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, Clock, Info } from "lucide-react";
import {
  TestDefinition,
  computeTest,
} from "../../../shared/testDefinitions";

interface Props {
  def: TestDefinition;
  initialInputs?: Record<string, string>;
  onSubmit: (inputs: Record<string, string>) => Promise<void> | void;
  submitLabel?: string;
  submitting?: boolean;
}

/** Dynamic test entry form: renders fields from definition, live calcs + pass/fail. */
export default function TestForm({ def, initialInputs, onSubmit, submitLabel, submitting }: Props) {
  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    for (const f of def.fields) {
      base[f.key] = initialInputs?.[f.key] ?? f.defaultValue ?? "";
    }
    return base;
  });

  const result = useMemo(() => computeTest(def, inputs), [def, inputs]);

  const set = (key: string, val: string) =>
    setInputs((p) => ({ ...p, [key]: val }));

  const statusColor =
    result.status === "Pass"
      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
      : result.status === "Fail"
      ? "bg-red-100 text-red-800 border-red-300"
      : result.status === "Indicative"
      ? "bg-sky-100 text-sky-800 border-sky-300"
      : "bg-amber-100 text-amber-800 border-amber-300";

  return (
    <div className="space-y-4">
      {/* Live status */}
      <div className={`qm-card border-2 ${statusColor} flex items-center gap-3`}>
        {result.status === "Pass" ? (
          <CheckCircle2 size={28} />
        ) : result.status === "Fail" ? (
          <XCircle size={28} />
        ) : result.status === "Indicative" ? (
          <Info size={28} />
        ) : (
          <Clock size={28} />
        )}
        <div>
          <div className="font-bold text-lg">{result.status.toUpperCase()}</div>
          <div className="text-xs opacity-80">{def.isCode}</div>
        </div>
      </div>

      {/* Input fields */}
      <div className="qm-card space-y-3">
        <h3 className="font-bold text-sm text-slate-700 uppercase tracking-wide">Test readings</h3>
        {def.fields.map((f) => (
          <div key={f.key}>
            <label className="qm-label">
              {f.label}
              {f.unit ? <span className="text-slate-400"> ({f.unit})</span> : null}
              {f.required ? <span className="text-red-500"> *</span> : null}
            </label>
            {f.type === "select" ? (
              <select
                className="qm-input"
                value={inputs[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
              >
                {(f.options || []).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                className="qm-input"
                type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                inputMode={f.type === "number" ? "decimal" : undefined}
                step="any"
                value={inputs[f.key] ?? ""}
                placeholder={f.placeholder}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>

      {/* Calculated results */}
      <div className="qm-card space-y-2">
        <h3 className="font-bold text-sm text-slate-700 uppercase tracking-wide">Calculated results</h3>
        <div className="divide-y divide-slate-100">
          {def.calcs.map((c) => (
            <div key={c.key} className="flex justify-between py-2 text-sm">
              <span className="text-slate-600">
                {c.label}
                {c.unit ? <span className="text-slate-400"> ({c.unit})</span> : null}
              </span>
              <span className="font-bold font-mono">{result.formatted[c.key] ?? "—"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Limits */}
      {result.limits.length > 0 && (
        <div className="qm-card space-y-2">
          <h3 className="font-bold text-sm text-slate-700 uppercase tracking-wide">MoRTH / IS checks</h3>
          <div className="space-y-2">
            {result.limits.map((l, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 p-2 rounded-lg text-sm ${
                  l.pass ? "bg-emerald-50" : "bg-red-50"
                }`}
              >
                {l.pass ? (
                  <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 shrink-0" />
                ) : (
                  <XCircle size={18} className="text-red-600 mt-0.5 shrink-0" />
                )}
                <div>
                  <div className="font-semibold">{l.label}</div>
                  {l.note && <div className="text-xs text-slate-500">{l.note}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        className="qm-btn qm-btn-primary w-full"
        disabled={submitting || result.status === "Pending"}
        onClick={() => onSubmit(inputs)}
      >
        {submitting ? "Saving…" : submitLabel || "Save Test Result"}
      </button>
      {result.status === "Pending" && (
        <p className="text-center text-xs text-amber-700">
          Fill all required readings to enable saving.
        </p>
      )}
    </div>
  );
}
