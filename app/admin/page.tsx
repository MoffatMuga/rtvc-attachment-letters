"use client";

import { useCallback, useEffect, useState } from "react";

type Row = {
  id: number; created_at: string; status: string; name: string; adm_no: string;
  email: string; phone: string; course: string; section: string; cycle: string; level: string; module: string;
  start_month: number; start_year: number; ref: string | null; reject_reason: string | null;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TABS = ["pending", "approved", "rejected"] as const;

export default function Admin() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]>("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [nextRef, setNextRef] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/requests?status=${tab}`);
    if (res.status === 401) { setAuthed(false); return; }
    const data = await res.json();
    setRows(data.requests);
    setNextRef(data.nextRef);
    setAuthed(true);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    const res = await fetch("/api/admin/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) { setPassword(""); load(); } else setLoginError("Wrong password");
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
  }

  async function approve(r: Row) {
    if (!confirm(`Approve and email the letter to ${r.name}?`)) return;
    setBusyId(r.id); setMessage("");
    const res = await fetch(`/api/admin/requests/${r.id}/approve`, { method: "POST" });
    const data = await res.json();
    setMessage(res.ok ? `Sent ${data.ref}${data.nita ? " with the NITA form" : ""} to ${r.email}${data.sms === "sent" ? " and an SMS to " + r.phone : data.sms === "failed" ? " (the SMS could not be sent)" : ""}` : data.error);
    setBusyId(null);
    load();
  }

  async function reject(r: Row) {
    const reason = prompt(`Reason for rejecting ${r.name}? (sent to the trainee)`);
    if (reason === null) return;
    setBusyId(r.id); setMessage("");
    const res = await fetch(`/api/admin/requests/${r.id}/reject`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    setMessage(res.ok ? `Rejected ${r.name}` : data.error);
    setBusyId(null);
    load();
  }

  if (authed === null) return <main className="p-8 text-center text-slate-500">Loading...</main>;

  if (!authed) {
    return (
      <main className="mx-auto w-full max-w-sm flex-1 px-4 py-16">
        <h1 className="mb-4 text-center text-xl font-bold">ILO sign in</h1>
        <form onSubmit={login} className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Password" autoFocus
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base" />
          {loginError && <p className="text-sm text-red-700">{loginError}</p>}
          <button className="w-full rounded-lg bg-blue-900 px-4 py-3 font-semibold text-white">Sign in</button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Attachment requests</h1>
        <button onClick={logout} className="text-sm text-slate-500 underline">Sign out</button>
      </div>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <a href="/api/admin/log" className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">Download Excel log</a>
        <a href="/admin/trainees" className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">Trainees &amp; assessors</a>
        <a href="/admin/settings" className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">Stamp &amp; signature</a>
        <span className="px-1 py-2 text-slate-500">Next ref: {nextRef}</span>
      </div>
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-200 p-1 text-sm">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-2 capitalize ${tab === t ? "bg-white font-semibold shadow-sm" : "text-slate-600"}`}>
            {t}
          </button>
        ))}
      </div>
      {message && <p className="mb-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{message}</p>}
      {rows.length === 0 && <p className="py-10 text-center text-slate-500">Nothing here.</p>}
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="font-semibold">{r.name}</p>
            <p className="text-sm text-slate-600">{r.adm_no} · {r.email}</p>
            {r.phone && <p className="text-sm text-slate-600">{r.phone}</p>}
            <p className="text-sm text-slate-600">
              {r.course}{r.section ? ` (${r.section})` : ""}, Cycle {r.cycle}, Level {r.level}{r.module ? `, Module ${r.module}` : ""}
            </p>
            <p className="text-sm text-slate-600">
              Starts {MONTHS[r.start_month - 1]} {r.start_year}
              {r.ref ? ` · ${r.ref}` : ""}
            </p>
            {r.reject_reason && <p className="mt-1 text-sm text-red-700">Reason: {r.reject_reason}</p>}
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <a href={`/api/admin/requests/${r.id}/preview`} target="_blank"
                className="rounded-lg px-3 py-2 ring-1 ring-slate-300">Preview PDF</a>
              {r.status === "pending" && (
                <>
                  <button disabled={busyId === r.id} onClick={() => approve(r)}
                    className="rounded-lg bg-green-700 px-4 py-2 font-semibold text-white disabled:opacity-50">
                    {busyId === r.id ? "Sending..." : "Approve"}
                  </button>
                  <button disabled={busyId === r.id} onClick={() => reject(r)}
                    className="rounded-lg px-4 py-2 text-red-700 ring-1 ring-red-300 disabled:opacity-50">
                    Reject
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
