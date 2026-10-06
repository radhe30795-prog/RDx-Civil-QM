import { Link, useLocation } from "wouter";
import { LayoutDashboard, FlaskConical, ClipboardList, FolderKanban, WifiOff, Calculator, Package } from "lucide-react";
import { useEffect, useState } from "react";
import { pendingCount } from "../lib/offlineDb";

const TABS = [
  { path: "/", label: "Home", icon: LayoutDashboard },
  { path: "/tests", label: "Tests", icon: FlaskConical },
  { path: "/planner", label: "Planner", icon: Calculator },
  { path: "/calculator", label: "Calc", icon: Package },
  { path: "/register", label: "Register", icon: ClipboardList },
  { path: "/projects", label: "Projects", icon: FolderKanban },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [loc] = useLocation();
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const upd = () => {
      setOnline(navigator.onLine);
      pendingCount().then(setPending).catch(() => {});
    };
    upd();
    window.addEventListener("online", upd);
    window.addEventListener("offline", upd);
    const t = setInterval(upd, 10000);
    return () => {
      window.removeEventListener("online", upd);
      window.removeEventListener("offline", upd);
      clearInterval(t);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-slate-100">
      {/* Header */}
      <header className="no-print sticky top-0 z-10 bg-[#1e3a5f] text-white px-4 py-3 shadow">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg leading-tight">RDx Civil QM</h1>
            <p className="text-[11px] text-slate-300">Quality Control &amp; Lab Testing</p>
          </div>
          <div className="flex items-center gap-2">
            {!online && (
              <span className="flex items-center gap-1 text-xs bg-amber-500 text-black px-2 py-1 rounded-full font-semibold">
                <WifiOff size={12} /> Offline
              </span>
            )}
            {pending > 0 && (
              <span className="text-xs bg-white text-[#1e3a5f] px-2 py-1 rounded-full font-bold">
                {pending} queued
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-3 py-3 pb-24">{children}</main>

      {/* Bottom nav */}
      <nav className="no-print fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] z-10">
        <div className="grid grid-cols-6">
          {TABS.map(({ path, label, icon: Icon }) => {
            const active = loc === path || (path !== "/" && loc.startsWith(path));
            return (
              <Link key={path} href={path}>
                <span
                  className={`flex flex-col items-center py-2.5 text-[11px] font-medium cursor-pointer ${
                    active ? "text-[#1e3a5f]" : "text-slate-400"
                  }`}
                >
                  <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                  {label}
                  {active && <span className="mt-0.5 h-1 w-8 rounded-full bg-amber-500" />}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
