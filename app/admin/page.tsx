"use client";

import { useCallback, useEffect, useState } from "react";
import AuthSplit from "@/components/AuthSplit";

type Row = {
  id: number; created_at: string; status: string; name: string; adm_no: string;
  email: string; phone: string; course: string; section: string; cycle: string; level: string; module: string;
  start_month: number; start_year: number; ref: string | null; reject_reason: string | null; due?: boolean | null; label?: string;
};

/** Kenyan phone to WhatsApp format (254...), or "" if it does not look valid. */
function waPhone(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (/^0[17]\d{8}$/.test(d)) d = "254" + d.slice(1);
  if (/^[17]\d{8}$/.test(d)) d = "254" + d;
  return /^254[17]\d{8}$/.test(d) ? d : "";
}

function waLink(r: { name: string; phone: string; status?: string; reject_reason?: string | null }): string {
  const n = waPhone(r.phone);
  const first = (r.name.trim().split(/\s+/)[0] || "").toLowerCase().replace(/^./, (c) => c.toUpperCase());
  const text = r.status === "rejected"
    ? `Hello ${first}, about your attachment letter request at RTVC: ${(r.reject_reason || "please check your details").replace(/^Withdrawn: /, "")}. Please apply again with the correct details: ${window.location.origin}`
    : `Hello ${first}, your attachment letter from the RTVC ILO has been emailed to you. Check your inbox (and spam), or log in to download it: ${window.location.origin}/trainee`;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

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
  const [waNext, setWaNext] = useState<{ name: string; phone: string; href: string } | null>(null);
  const [wd, setWd] = useState<{ id: number; text: string } | null>(null);

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
    if (res.ok) { setPassword(""); window.dispatchEvent(new Event("admin-auth")); load(); } else setLoginError("Wrong password");
  }

  useEffect(() => {
    const out = () => setAuthed(false);
    window.addEventListener("admin-signed-out", out);
    return () => window.removeEventListener("admin-signed-out", out);
  }, []);

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

  async function withdraw(r: Row) {
    if (!wd || wd.id !== r.id) return;
    if (!confirm(`Withdraw the letter for ${r.name} and email them the reason?`)) return;
    setBusyId(r.id); setMessage("");
    const res = await fetch(`/api/admin/requests/${r.id}/revoke`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: wd.text }),
    });
    const data = await res.json();
    setMessage(res.ok ? `Withdrawn ${r.ref ?? ""} for ${r.name}${data.emailed ? " and emailed" : " (email could not be sent)"}. ` : data.error);
    if (res.ok) {
      setWaNext(waPhone(r.phone) ? { name: r.name, phone: r.phone, href: waLink({ name: r.name, phone: r.phone, status: "rejected", reject_reason: wd.text }) } : null);
      setWd(null);
    }
    setBusyId(null);
    load();
  }

  if (authed === null) return <main className="p-8 text-center text-slate-500">Loading...</main>;

  if (!authed) {
    return (
      <AuthSplit
        heading="Welcome back, ILO"
        tagline="Review requests, approve letters and keep every trainee on track."
        points={["Approve attachment letters in one tap", "See who is on the due list", "Assign assessors and share insurance letters"]}
      >
        <h2 className="mb-1 text-2xl font-bold text-slate-900">Sign in</h2>
        <p className="mb-5 text-sm text-slate-500">Industrial Liaison Office dashboard</p>
        <form onSubmit={login} className="space-y-4 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
          <label className="block text-sm font-medium text-slate-700">Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password" autoFocus
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
          </label>
          {loginError && <p className="text-sm text-red-700">{loginError}</p>}
          <button className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white shadow hover:bg-blue-700">Sign in</button>
        </form>
      </AuthSplit>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 lg:px-8">
      <section className="mb-5 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-50 via-white to-blue-50 p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue-600 text-white">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l9-9a3.7 3.7 0 0 1 5.2 5.2l-9 9a1.8 1.8 0 0 1-2.6-2.6l8.3-8.3" /></svg>
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Attachment requests</h1>
              <p className="text-sm text-slate-500">Review, approve and track letters. Next ref: <span className="font-semibold text-blue-900">{nextRef}</span></p>
            </div>
          </div>
          <a href="/api/admin/log" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" /></svg>
            Download Excel log
          </a>
        </div>
      </section>
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 text-sm">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-2.5 capitalize transition-colors ${tab === t ? "bg-blue-600 font-semibold text-white shadow" : "text-slate-600 hover:bg-white"}`}>
            {t}
          </button>
        ))}
      </div>
      {message && <p className="mb-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{message}</p>}
      {waNext && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-900">
          <span>Also tell {waNext.name.split(" ")[0]} on WhatsApp?</span>
          <span className="flex shrink-0 gap-2">
            <a href={waNext.href} target="_blank" rel="noopener noreferrer" onClick={() => setWaNext(null)}
              className="rounded-lg bg-green-600 px-3 py-2 font-medium text-white">WhatsApp 0{waPhone(waNext.phone).slice(3)}</a>
            <button onClick={() => setWaNext(null)} className="text-slate-500 underline">Skip</button>
          </span>
        </div>
      )}
      {rows.length === 0 && (
        <div className="rounded-2xl bg-white py-14 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-lg font-semibold text-slate-800">Nothing here.</p>
          <p className="mb-4 text-sm text-slate-500">No {tab} requests at the moment.</p>
          <button onClick={load} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Refresh</button>
        </div>
      )}
      <ul className="grid gap-4 md:grid-cols-2">
        {rows.map((r) => (
          <li key={r.id} className="self-start rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="font-semibold">{r.name}
              {r.due === false && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 align-middle text-xs font-medium text-red-700">Not on due list</span>}
              {r.due === true && <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 align-middle text-xs font-medium text-green-700">On due list</span>}
            </p>
            <p className="text-sm text-slate-600">{r.adm_no} · {r.email}</p>
            {r.phone && <p className="text-sm text-slate-600">{r.phone}</p>}
            <p className="text-sm text-slate-600">
              {r.label ?? r.course}, Cycle {r.cycle}, Level {r.level}{r.module ? `, Module ${r.module}` : ""}
            </p>
            <p className="text-sm text-slate-600">
              Starts {MONTHS[r.start_month - 1]} {r.start_year}
              {r.ref ? ` · ${r.ref}` : ""}
            </p>
            {r.reject_reason && <p className="mt-1 text-sm text-red-700">Reason: {r.reject_reason}</p>}
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <a href={`/api/admin/requests/${r.id}/preview`} target="_blank"
                className="rounded-lg px-3 py-2 ring-1 ring-slate-300">Preview PDF</a>
              {r.status === "approved" && (waPhone(r.phone) ? (
                <a href={waLink(r)} target="_blank" rel="noopener noreferrer"
                  className="rounded-lg bg-green-600 px-3 py-2 font-medium text-white">
                  WhatsApp 0{waPhone(r.phone).slice(3)}
                </a>
              ) : (
                <span className="rounded-lg px-3 py-2 text-slate-400 ring-1 ring-slate-200">Check phone number</span>
              ))}
              {r.status === "approved" && (
                <button onClick={() => setWd(wd?.id === r.id ? null : { id: r.id, text: "Your start month was entered wrongly. Please apply again with the correct details." })}
                  className="rounded-lg px-3 py-2 text-red-700 ring-1 ring-red-300">Withdraw</button>
              )}
              {r.status === "rejected" && (waPhone(r.phone) ? (
                <a href={waLink(r)} target="_blank" rel="noopener noreferrer"
                  className="rounded-lg bg-green-600 px-3 py-2 font-medium text-white">WhatsApp 0{waPhone(r.phone).slice(3)}</a>
              ) : (
                <span className="rounded-lg px-3 py-2 text-slate-400 ring-1 ring-slate-200">Check phone number</span>
              ))}
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
            {wd?.id === r.id && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm">
                <p className="mb-1 font-medium text-red-800">Message to {r.name.split(" ")[0]} (sent by email)</p>
                <textarea value={wd.text} onChange={(e) => setWd({ id: r.id, text: e.target.value })} rows={3} maxLength={400}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base" />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button disabled={busyId === r.id || !wd.text.trim()} onClick={() => withdraw(r)}
                    className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Withdraw &amp; email</button>
                  <button onClick={() => setWd(null)} className="rounded-lg px-4 py-2 ring-1 ring-slate-300">Cancel</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
