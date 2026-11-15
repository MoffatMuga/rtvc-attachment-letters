"use client";

import { useCallback, useEffect, useState } from "react";

type T = {
  id: number; name: string; adm_no: string; email: string; phone: string; assessor_id: number | null;
  assessor_name: string | null; firm_name: string; firm_location: string; supervisor_name: string;
  supervisor_phone: string; start_date: string; end_date: string; profile_updated_at: string | null;
};
type A = { id: number; name: string; email: string; phone: string; department: string; load: number };

const input = "rounded-lg border border-slate-300 px-3 py-2 text-sm";

export default function TraineesAdmin() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [trainees, setTrainees] = useState<T[]>([]);
  const [assessors, setAssessors] = useState<A[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "unassigned" | "nofirm">("all");
  const [msg, setMsg] = useState("");
  const [na, setNa] = useState({ name: "", email: "", phone: "", department: "" });

  const load = useCallback(async () => {
    const [a, t] = await Promise.all([fetch("/api/admin/assessors"), fetch("/api/admin/trainees")]);
    if (a.status === 401 || t.status === 401) { setAuthed(false); return; }
    setAssessors((await a.json()).assessors);
    setTrainees((await t.json()).trainees);
    setAuthed(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function assign(t: T, value: string) {
    setMsg("");
    const res = await fetch(`/api/admin/trainees/${t.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assessor_id: value === "" ? null : Number(value) }),
    });
    const d = await res.json();
    setMsg(res.ok ? `Updated ${t.name}${d.emailed ? " and emailed them" : ""}` : d.error);
    load();
  }

  async function addAssessor(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const res = await fetch("/api/admin/assessors", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(na),
    });
    const d = await res.json();
    if (res.ok) { setNa({ name: "", email: "", phone: "", department: "" }); load(); } else setMsg(d.error);
  }

  async function removeAssessor(a: A) {
    if (!confirm(`Remove ${a.name}? ${a.load} trainee(s) will go back to "not assigned".`)) return;
    await fetch(`/api/admin/assessors/${a.id}`, { method: "DELETE" });
    load();
  }

  if (authed === null) return <main className="p-8 text-center text-slate-500">Loading...</main>;
  if (!authed) return <main className="p-8 text-center">Please <a className="underline" href="/admin">sign in</a> first.</main>;

  const shown = trainees.filter((t) => {
    if (filter === "unassigned" && t.assessor_id != null) return false;
    if (filter === "nofirm" && t.firm_name) return false;
    const s = q.trim().toLowerCase();
    return !s || [t.name, t.adm_no, t.firm_name, t.firm_location].some((x) => x.toLowerCase().includes(s));
  });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Trainees and assessors</h1>
        <a href="/admin" className="text-sm text-slate-500 underline">Back to requests</a>
      </div>

      <section className="mb-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-2 font-semibold">Assessors</h2>
        <ul className="mb-3 space-y-1 text-sm">
          {assessors.length === 0 && <li className="text-slate-500">None yet. Add one below.</li>}
          {assessors.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2">
              <span>{a.name}{a.department ? ` · ${a.department}` : ""}{a.phone ? ` · ${a.phone}` : ""}
                <span className="text-slate-500"> ({a.load} trainee{a.load === 1 ? "" : "s"})</span></span>
              <button onClick={() => removeAssessor(a)} className="text-red-700 underline">Remove</button>
            </li>
          ))}
        </ul>
        <form onSubmit={addAssessor} className="grid grid-cols-2 gap-2">
          <input className={input} placeholder="Name *" value={na.name} onChange={(e) => setNa({ ...na, name: e.target.value })} />
          <input className={input} placeholder="Department" value={na.department} onChange={(e) => setNa({ ...na, department: e.target.value })} />
          <input className={input} placeholder="Phone" value={na.phone} onChange={(e) => setNa({ ...na, phone: e.target.value })} />
          <input className={input} placeholder="Email" value={na.email} onChange={(e) => setNa({ ...na, email: e.target.value })} />
          <button className="col-span-2 rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white">Add assessor</button>
        </form>
      </section>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <input className={`${input} flex-1`} placeholder="Search name, admission no, firm, place" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={input} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">All</option>
          <option value="unassigned">No assessor yet</option>
          <option value="nofirm">No firm details yet</option>
        </select>
        <a href="/api/admin/trainees/export" className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">Download Excel</a>
      </div>
      {msg && <p className="mb-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{msg}</p>}
      {shown.length === 0 && <p className="py-10 text-center text-slate-500">Nobody here. Trainees appear once you approve their letter.</p>}
      <ul className="space-y-3">
        {shown.map((t) => (
          <li key={t.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="font-semibold">{t.name}</p>
            <p className="text-sm text-slate-600">{t.adm_no} · {t.phone || "no phone"} · {t.email}</p>
            <p className="mt-1 text-sm text-slate-700">
              {t.firm_name ? <>{t.firm_name}, {t.firm_location}. Supervisor: {t.supervisor_name} ({t.supervisor_phone})
                {t.start_date ? ` · ${t.start_date}${t.end_date ? " to " + t.end_date : ""}` : ""}</>
                : <span className="text-slate-500">Has not added firm details yet.</span>}
            </p>
            <label className="mt-2 flex items-center gap-2 text-sm">Assessor
              <select className={`${input} flex-1`} value={t.assessor_id ?? ""} onChange={(e) => assign(t, e.target.value)}>
                <option value="">Not assigned</option>
                {assessors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
          </li>
        ))}
      </ul>
    </main>
  );
}
