import { Printer } from "lucide-react";
import { trpc } from "../lib/trpc";
import { getTestDef, computeTest } from "../../../shared/testDefinitions";

/** Printable test report. */
export default function ReportPage({ id }: { id: string }) {
  const { data, isLoading } = trpc.entries.get.useQuery({ id: parseInt(id) });

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!data) return <p className="text-red-600">Record not found.</p>;

  const { entry, master, project } = data as any;
  const def = master?.code ? getTestDef(master.code) : undefined;
  const computed = def ? computeTest(def, entry.inputs || {}) : null;
  const results: Record<string, string> =
    (entry.results as any)?.values || computed?.formatted || {};

  const statusColor =
    entry.status === "Pass" ? "text-emerald-700" : entry.status === "Fail" ? "text-red-700" : entry.status === "Indicative" ? "text-sky-700" : "text-amber-700";

  return (
    <div className="space-y-3">
      <button className="qm-btn qm-btn-primary no-print w-full" onClick={() => window.print()}>
        <Printer size={18} /> Print Report
      </button>

      <div className="qm-card">
        {/* Header */}
        <div className="text-center border-b-2 border-[#1e3a5f] pb-3 mb-3">
          <h1 className="text-xl font-bold text-[#1e3a5f]">RDx Civil QM</h1>
          <p className="text-xs text-slate-500">Quality Control &amp; Lab Testing Report</p>
          <h2 className="text-base font-bold mt-2">{master?.name}</h2>
          <p className="text-xs text-slate-500">{master?.isCode}</p>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-3">
          <Meta label="Project" value={project?.name} />
          <Meta label="Date" value={entry.testDate} />
          <Meta label="Sample ID" value={entry.sampleId} />
          <Meta label="Chainage" value={entry.chainage} />
          <Meta label="Layer" value={entry.layer} />
          <Meta label="Material source" value={entry.materialSource} />
          <Meta label="Tested by" value={entry.testedBy} />
          <Meta label="Witnessed by" value={entry.witnessBy} />
        </div>

        {/* Inputs */}
        {def && (
          <>
            <h3 className="font-bold text-sm uppercase tracking-wide text-slate-600 mt-4 mb-1">
              Test readings
            </h3>
            <table className="w-full text-sm">
              <tbody>
                {def.fields.map((fld) => (
                  <tr key={fld.key} className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-600">
                      {fld.label}{fld.unit ? ` (${fld.unit})` : ""}
                    </td>
                    <td className="py-1.5 text-right font-mono font-semibold">
                      {entry.inputs?.[fld.key] || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className="font-bold text-sm uppercase tracking-wide text-slate-600 mt-4 mb-1">
              Calculated results
            </h3>
            <table className="w-full text-sm">
              <tbody>
                {def.calcs.map((c) => (
                  <tr key={c.key} className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-600">
                      {c.label}{c.unit ? ` (${c.unit})` : ""}
                    </td>
                    <td className="py-1.5 text-right font-mono font-bold">{results[c.key] ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {computed && computed.limits.length > 0 && (
              <>
                <h3 className="font-bold text-sm uppercase tracking-wide text-slate-600 mt-4 mb-1">
                  MoRTH / IS checks
                </h3>
                <table className="w-full text-sm">
                  <tbody>
                    {computed.limits.map((l, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-1.5 text-slate-600">{l.label}</td>
                        <td className={`py-1.5 text-right font-bold ${l.pass ? "text-emerald-600" : "text-red-600"}`}>
                          {l.pass ? "PASS" : "FAIL"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}

        {entry.remarks && (
          <div className="mt-3 text-sm">
            <span className="font-bold">Remarks: </span>{entry.remarks}
          </div>
        )}

        {/* Verdict */}
        <div className="mt-4 text-center border-t-2 border-[#1e3a5f] pt-3">
          <span className={`text-2xl font-black tracking-wide ${statusColor}`}>
            {entry.status.toUpperCase()}
          </span>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-4 mt-8 text-sm">
          <div className="border-t border-slate-400 pt-1 text-center text-slate-500">Tested by</div>
          <div className="border-t border-slate-400 pt-1 text-center text-slate-500">Verified by</div>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-slate-500 text-xs uppercase">{label}: </span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
