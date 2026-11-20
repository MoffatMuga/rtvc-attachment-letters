"use client";

import { useCallback, useEffect, useState } from "react";

type Data = { count: number; rows: { adm_no: string; name: string; department: string }[] };

export default function DueList() {
  const [d, setD] = useState<Data | null | undefined>(undefined);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/duelist");
    setD(r.ok ? await r.json() : null);
  }, []);
  useEffect(() => { load().catch(() => setD(null)); }, [load]);

  if (d === undefined) return <main className="p-8 text-center text-slate-500">Loading...</main>;
  if (d === null) return <main className="p-8 text-center">Please <a className="underline" href="/admin">sign in</a> first.</main>;

  async function upload(f: File | undefined) {
    if (!f) return;
    if (d!.count > 0 && !confirm("This replaces the current list. Continue?")) return;
    setBusy(true); setMsg("");
    const fd = new FormData(); fd.set("file", f);
    const r = await fetch("/api/admin/duelist", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? `Loaded ${j.count} admission numbers.` : j.error || "Upload failed.");
    setBusy(false);
    await load();
  }
  async function clear() {
    if (!confirm("Clear the due list? Requests will no longer be flagged.")) return;
    await fetch("/api/admin/duelist", { method: "DELETE" });
    await load();
  }
  const shown = d.rows.filter((x) => (x.name + x.adm_no + x.department).toLowerCase().includes(q.toLowerCase())).slice(0, 100);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Due list</h1>
      </div>
      <section className="mb-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="mb-3 text-sm text-slate-600">
          Upload the trainees due for attachment. Requests from an admission number that is not on the list get a red
          &quot;Not on due list&quot; badge. Nothing is blocked; you still decide. With no list, nothing is flagged.
        </p>
        <a href="/api/admin/duelist/template" className="mb-3 inline-block text-sm text-blue-900 underline">Download the Excel template</a>
        <input type="file" accept=".xlsx,.csv" disabled={busy} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-900 file:px-3 file:py-2 file:text-white" />
        {msg && <p className="mt-2 text-sm text-slate-700">{msg}</p>}
      </section>
      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">On the list <span className="font-normal text-slate-500">({d.count})</span></h2>
          {d.count > 0 && <button onClick={clear} className="text-xs text-slate-400 underline">clear list</button>}
        </div>
        {d.count === 0 ? <p className="text-sm text-slate-500">No list uploaded yet.</p> : (
          <>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or admission no."
              className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-base" />
            <ul className="divide-y divide-slate-100 text-sm">
              {shown.map((x) => (
                <li key={x.adm_no} className="py-2"><span className="block">{x.name}</span>
                  <span className="text-xs text-slate-500">{x.adm_no}{x.department ? ` · ${x.department}` : ""}</span></li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
