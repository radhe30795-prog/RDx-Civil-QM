import { useState } from "react";
import { Users, UserPlus, ShieldCheck, Shield, Ban, CheckCircle, KeyRound } from "lucide-react";
import { trpc } from "../lib/trpc";
import { useAuth } from "../lib/auth";

export default function UsersPage() {
  const { user: me } = useAuth();
  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.auth.listUsers.useQuery();

  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [resetFor, setResetFor] = useState<number | null>(null);
  const [newPass, setNewPass] = useState("");

  const createUser = trpc.auth.createUser.useMutation({
    onSuccess: () => {
      utils.auth.listUsers.invalidate();
      setShowForm(false);
      setUsername(""); setPassword(""); setName(""); setRole("user"); setError("");
    },
    onError: (e) => setError(e.message),
  });
  const toggleActive = trpc.auth.toggleActive.useMutation({
    onSuccess: () => utils.auth.listUsers.invalidate(),
    onError: (e) => alert(e.message),
  });
  const resetPassword = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      utils.auth.listUsers.invalidate();
      setResetFor(null); setNewPass(""); setError("");
      alert("Password reset. The user must sign in again.");
    },
    onError: (e) => setError(e.message),
  });

  if (me?.role !== "admin") {
    return <div className="text-center py-10 text-slate-500">Admin access required.</div>;
  }

  const inputCls = "w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] bg-white";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Users size={20} className="text-[#1e3a5f]" /> Users
        </h2>
        <button
          onClick={() => { setShowForm(!showForm); setError(""); }}
          className="flex items-center gap-1.5 bg-[#1e3a5f] text-white text-sm font-semibold px-4 py-2 rounded-xl"
        >
          <UserPlus size={16} /> Add User
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <h3 className="font-bold text-slate-700 text-sm">New User</h3>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={inputCls} />
          <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))} placeholder="username" className={inputCls} autoCapitalize="none" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 6 chars)" className={inputCls} />
          <div className="flex gap-2">
            {(["user", "admin"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold border ${role === r ? "bg-[#1e3a5f] text-white border-[#1e3a5f]" : "bg-white text-slate-500 border-slate-300"}`}
              >
                {r === "admin" ? <ShieldCheck size={15} /> : <Shield size={15} />}
                {r === "admin" ? "Admin" : "User"}
              </button>
            ))}
          </div>
          {error && <div className="text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>}
          <button
            disabled={busy}
            onClick={async () => {
              setError("");
              if (!name.trim()) return setError("Please enter the full name.");
              if (username.trim().length < 3) return setError("Username must be at least 3 characters.");
              if (password.length < 6) return setError("Password must be at least 6 characters.");
              setBusy(true);
              try {
                await createUser.mutateAsync({ username: username.trim(), password, name: name.trim(), role });
              } finally {
                setBusy(false);
              }
            }}
            className="w-full bg-[#1e3a5f] text-white font-bold rounded-xl py-2.5 text-sm disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create User"}
          </button>
          <p className="text-[11px] text-slate-400">Each user gets a fully private workspace — no one sees another user's data.</p>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-400 text-center py-8">Loading users…</p>
      ) : (
        <div className="space-y-2.5">
          {(users || []).map((u: any) => (
            <div key={u.id} className={`bg-white rounded-2xl border p-4 ${u.isActive ? "border-slate-200" : "border-red-200 opacity-70"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    {u.name}
                    {u.role === "admin" && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-bold">ADMIN</span>}
                    {!u.isActive && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">INACTIVE</span>}
                  </div>
                  <div className="text-[13px] text-slate-500">@{u.username}</div>
                </div>
                {u.id !== me?.id && (
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      title="Reset password"
                      onClick={() => { setResetFor(u.id); setNewPass(""); setError(""); }}
                      className="p-2 rounded-lg bg-slate-100 text-slate-600"
                    >
                      <KeyRound size={15} />
                    </button>
                    <button
                      title={u.isActive ? "Deactivate" : "Activate"}
                      onClick={() => {
                        if (!u.isActive || confirm(`Deactivate ${u.name}? They will be signed out immediately.`)) {
                          toggleActive.mutate({ id: u.id, isActive: !u.isActive });
                        }
                      }}
                      className={`p-2 rounded-lg ${u.isActive ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}
                    >
                      {u.isActive ? <Ban size={15} /> : <CheckCircle size={15} />}
                    </button>
                  </div>
                )}
              </div>
              {resetFor === u.id && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                  <input
                    type="password"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="New password (min 6 chars)"
                    className={inputCls}
                  />
                  {error && <div className="text-[13px] text-red-700">{error}</div>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (newPass.length < 6) return setError("Password must be at least 6 characters.");
                        if (confirm(`Reset password for ${u.name}? They will be signed out.`)) {
                          resetPassword.mutate({ id: u.id, password: newPass });
                        }
                      }}
                      className="flex-1 bg-[#1e3a5f] text-white text-sm font-bold rounded-xl py-2"
                    >
                      Set Password
                    </button>
                    <button onClick={() => setResetFor(null)} className="px-4 text-sm text-slate-500">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
