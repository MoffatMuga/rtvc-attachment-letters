"use client";

import JSZip from "jszip";
import { useCallback, useEffect, useState } from "react";

type T = { id: number; name: string; adm_no: string; email: string; file_name: string | null; size: number | null; uploaded_at: string | null };
type Item = { key: string; name: string; blob: Blob; traineeId: number | ""; guess: string; status: "ready" | "sending" | "done" | "error"; msg?: string };

const MAX = 4 * 1024 * 1024;
const MIME: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const words = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2);

/** Best guess: admission number inside the file name, else a trainee whose name words all appear. */
function guess(file: string, ts: T[]): { id: number | ""; how: string } {
  const f = norm(file);
  const byAdm = ts.filter((t) => t.adm_no && f.includes(norm(t.adm_no)));
  if (byAdm.length === 1) return { id: byAdm[0].id, how: "admission no." };
  const fw = new Set(words(file));
  const byName = ts.filter((t) => { const w = words(t.name); return w.length >= 2 && w.filter((x) => fw.has(x)).length >= 2; });
  if (byName.length === 1) return { id: byName[0].id, how: "name" };
  return { id: "", how: "" };
}

export default function InsuranceAdmin() {
  const [ts, setTs] = useState<T[] | null | undefined>(undefined);
  const [items, setItems] = useState<Item[]>([]);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/insurance");
    if (!r.ok) return setTs(null);
    setTs((await r.json()).trainees);
  }, []);
  useEffect(() => { load().catch(() => setTs(null)); }, [load]);

  if (ts === undefined) return <main className="p-8 text-center text-slate-500">Loading...</main>;
  if (ts === null) return <main className="p-8 text-center">Please <a className="underline" href="/admin">sign in</a> first.</main>;

  async function onZip(file: File | undefined) {
    if (!file) return;
    setNote("");
    try {
      const zip = await JSZip.loadAsync(file);
      const out: Item[] = [];
      let skipped = 0;
      for (const e of Object.values(zip.files)) {
        const base = e.name.split("/").pop() ?? "";
        if (e.dir || e.name.startsWith("__MACOSX") || base.startsWith(".")) continue;
        const ext = (base.split(".").pop() ?? "").toLowerCase();
        if (!MIME[ext]) { skipped++; continue; }
        const data = await e.async("uint8array");
        if (data.length > MAX) { skipped++; continue; }
        const g = guess(base, ts!);
        out.push({ key: e.name, name: base, blob: new Blob([data.buffer as ArrayBuffer], { type: MIME[ext] }), traineeId: g.id, guess: g.how, status: "ready" });
      }
      out.sort((a, b) => a.name.localeCompare(b.name));
      setItems(out);
      setNote(`${out.length} file(s) found${skipped ? `, ${skipped} skipped (not PDF/JPG/PNG, or over 4 MB)` : ""}. Check the matches, then upload.`);
    } catch {
      setNote("That does not look like a valid zip file.");
    }
  }

  const upd = (key: string, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)));

  async function uploadAll() {
    setBusy(true);
    for (const it of items) {
      if (it.status === "done" || it.traineeId === "") continue;
      upd(it.key, { status: "sending", msg: undefined });
      const fd = new FormData();
      fd.set("file", new File([it.blob], it.name, { type: it.blob.type }));
      fd.set("trainee_id", String(it.traineeId));
      if (notify) fd.set("notify", "1");
      try {
        const r = await fetch("/api/admin/insurance", { method: "POST", body: fd });
        const j = await r.json().catch(() => ({}));
        upd(it.key, r.ok ? { status: "done" } : { status: "error", msg: j.error || "Failed" });
      } catch {
        upd(it.key, { status: "error", msg: "Network error" });
      }
    }
    setBusy(false);
    await load();
  }

  async function remove(id: number) {
    if (!confirm("Remove this insurance letter?")) return;
    await fetch(`/api/admin/insurance?trainee_id=${id}`, { method: "DELETE" });
    await load();
  }

  const matched = items.filter((i) => i.traineeId !== "" && i.status !== "done").length;
  const unmatched = items.filter((i) => i.traineeId === "").length;
  const have = ts.filter((t) => t.file_name).length;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Insurance letters</h1>
        <a href="/admin" className="text-sm text-slate-500 underline">Back to requests</a>
      </div>

      <section className="mb-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-semibold">Upload the insurer&apos;s zip</h2>
        <p className="mb-3 text-sm text-slate-500">
          Name each file with the trainee&apos;s admission number or full name and it is matched automatically. Anything unmatched can be assigned by hand.
        </p>
        <input type="file" accept=".zip,application/zip" onChange={(e) => onZip(e.target.files?.[0])}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-900 file:px-3 file:py-2 file:text-white" />
        {note && <p className="mt-2 text-sm text-slate-600">{note}</p>}

        {items.length > 0 && (
          <>
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {items.map((it) => (
                <li key={it.key} className="py-2">
                  <p className="truncate font-medium">{it.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <select value={it.traineeId} disabled={it.status === "done" || busy}
                      onChange={(e) => upd(it.key, { traineeId: e.target.value ? Number(e.target.value) : "", guess: "" })}
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-base">
                      <option value="">Choose trainee...</option>
                      {ts.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.adm_no})</option>)}
                    </select>
                    <span className={"w-20 shrink-0 text-right text-xs " + (it.status === "done" ? "text-green-700" : it.status === "error" ? "text-red-600" : "text-slate-400")}>
                      {it.status === "done" ? "Uploaded" : it.status === "sending" ? "Sending..." : it.status === "error" ? it.msg : it.guess ? `by ${it.guess}` : ""}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
              Email each trainee that their letter is ready
            </label>
            <button onClick={uploadAll} disabled={busy || matched === 0}
              className="mt-3 w-full rounded-lg bg-blue-900 px-4 py-3 font-medium text-white disabled:opacity-40">
              {busy ? "Uploading..." : `Upload ${matched} letter${matched === 1 ? "" : "s"}`}
            </button>
            {unmatched > 0 && <p className="mt-2 text-xs text-amber-700">{unmatched} file(s) still need a trainee; they are skipped until you choose one.</p>}
          </>
        )}
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-2 font-semibold">Status <span className="font-normal text-slate-500">({have} of {ts.length} uploaded)</span></h2>
        {ts.length === 0 ? <p className="text-sm text-slate-500">No trainees yet.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {ts.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0"><span className="block truncate">{t.name}</span><span className="text-xs text-slate-500">{t.adm_no}</span></span>
                {t.file_name ? (
                  <span className="flex shrink-0 items-center gap-2 text-xs text-green-700">Uploaded
                    <button onClick={() => remove(t.id)} className="text-slate-400 underline">remove</button></span>
                ) : <span className="shrink-0 text-xs text-slate-400">Not yet</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
