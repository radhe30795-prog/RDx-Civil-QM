import { useState } from "react";
import { Link } from "wouter";
import { ChevronRight, FlaskConical } from "lucide-react";
import { trpc } from "../lib/trpc";
import { CATEGORIES, getTestsByCategory, type TestCategory } from "../../../shared/testDefinitions";

const CAT_ICONS: Record<string, string> = {
  Soil: "🟤",
  Aggregate: "🪨",
  Bitumen: "🛢️",
  "Bituminous Mix": "🛣️",
  Concrete: "🧱",
  Cement: "🏗️",
  Steel: "🔩",
};

export default function TestsPage() {
  const [cat, setCat] = useState<TestCategory | "All">("All");
  const { data: masters, isLoading } = trpc.testMasters.list.useQuery(
    cat === "All" ? {} : { category: cat }
  );

  const shown =
    masters && masters.length > 0
      ? masters
      : cat === "All"
      ? CATEGORIES.flatMap((c) => getTestsByCategory(c)).map((d) => ({
          code: d.code, name: d.name, category: d.category, isCode: d.isCode,
        }))
      : getTestsByCategory(cat as TestCategory).map((d) => ({
          code: d.code, name: d.name, category: d.category, isCode: d.isCode,
        }));

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <FlaskConical size={20} /> Select Test
      </h2>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-print">
        {(["All", ...CATEGORIES] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCat(c as any)}
            className={`px-3 py-2 rounded-full text-sm font-semibold whitespace-nowrap border-2 ${
              cat === c
                ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                : "bg-white text-slate-600 border-slate-200"
            }`}
          >
            {c === "All" ? "All" : `${CAT_ICONS[c] || ""} ${c}`}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}

      <div className="space-y-2">
        {shown.map((t: any) => (
          <Link key={t.code} href={`/entry/${t.code}`}>
            <div className="qm-card flex items-center justify-between cursor-pointer active:bg-slate-50">
              <div>
                <div className="font-semibold text-sm">{t.name}</div>
                <div className="text-xs text-slate-500">
                  {t.category} • {t.isCode}
                </div>
              </div>
              <ChevronRight size={20} className="text-slate-400" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
