import { useState } from "react";
import { FlaskConical, User, Lock, UserPlus, LogIn, ShieldCheck } from "lucide-react";
import { trpc } from "../lib/trpc";
import { useAuth } from "../lib/auth";

export default function LoginPage() {
  const { login, registerAdmin } = useAuth();
  const { data: needsSetup, isLoading: checkingSetup } = trpc.auth.needsSetup.useQuery();

  const [mode, setMode] = useState<"login" | "setup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isSetup = needsSetup || mode === "setup";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!username.trim()) return setError("Please enter your username.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (isSetup && !name.trim()) return setError("Please enter your name.");
    setBusy(true);
    try {
      if (isSetup) {
        await registerAdmin(username.trim(), password, name.trim());
      } else {
        await login(username.trim(), password);
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full border border-slate-300 rounded-xl px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-[#1e3a5f] bg-white";

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-slate-100">
      <div className="flex-1 flex flex-col justify-center px-6 py-10">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1e3a5f] text-white mb-4 shadow-lg">
            <FlaskConical size={32} />
          </div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">RDx Civil QM</h1>
          <p className="text-sm text-slate-500 mt-1">Quality Control &amp; Lab Testing</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-1">
            {isSetup ? <UserPlus size={20} className="text-[#1e3a5f]" /> : <LogIn size={20} className="text-[#1e3a5f]" />}
            {isSetup ? "Create Admin Account" : "Sign In"}
          </h2>
          <p className="text-[13px] text-slate-500 mb-5">
            {isSetup
              ? "First-time setup — this account will manage all users."
              : "Enter your credentials to access your workspace."}
          </p>

          {checkingSetup ? (
            <p className="text-sm text-slate-400 text-center py-6">Checking…</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSetup && (
                <div>
                  <label className="text-[13px] font-semibold text-slate-600 block mb-1.5">Full Name</label>
                  <div className="relative">
                    <ShieldCheck size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Radheshyam Tripathi"
                      className={`${inputCls} pl-11`}
                      autoComplete="name"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="text-[13px] font-semibold text-slate-600 block mb-1.5">Username</label>
                <div className="relative">
                  <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="username"
                    className={`${inputCls} pl-11`}
                    autoComplete="username"
                    autoCapitalize="none"
                  />
                </div>
              </div>
              <div>
                <label className="text-[13px] font-semibold text-slate-600 block mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isSetup ? "Min 6 characters" : "Your password"}
                    className={`${inputCls} pl-11`}
                    autoComplete={isSetup ? "new-password" : "current-password"}
                  />
                </div>
              </div>

              {error && (
                <div className="text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full bg-[#1e3a5f] text-white font-bold rounded-xl py-3.5 text-[15px] disabled:opacity-50 active:scale-[0.99] transition"
              >
                {busy ? "Please wait…" : isSetup ? "Create Admin Account" : "Sign In"}
              </button>

              {!needsSetup && (
                <button
                  type="button"
                  onClick={() => { setMode(mode === "setup" ? "login" : "setup"); setError(""); }}
                  className="w-full text-[13px] text-slate-500 underline underline-offset-2"
                >
                  {mode === "setup" ? "Back to sign in" : "First time? Set up admin account"}
                </button>
              )}
            </form>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-6">
          Your data is private — each user sees only their own projects and records.
        </p>
      </div>
    </div>
  );
}
