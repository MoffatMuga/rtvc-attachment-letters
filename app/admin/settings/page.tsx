"use client";

import { useCallback, useEffect, useState } from "react";

type Placement = {
  stamp_width: number; date_x: number; date_y: number; date_size: number;
  sig_x: number; sig_y: number; sig_w: number;
};

const SCALE = 1.6; // preview px per pt

function Slider(props: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="flex justify-between text-slate-700">
        {props.label}<span className="text-slate-500">{props.value}</span>
      </span>
      <input type="range" className="w-full" min={props.min} max={props.max}
        step={props.step ?? 1} value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))} />
    </label>
  );
}

export default function Settings() {
  const [stamp, setStamp] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [pl, setPl] = useState<Placement | null>(null);
  const [nita, setNita] = useState<{ name: string; kb: number } | null>(null);
  const [msg, setMsg] = useState("");
  const [wa, setWa] = useState("");
  const [waActive, setWaActive] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/settings");
    if (res.status === 401) { window.location.href = "/admin"; return; }
    const d = await res.json();
    fetch("/api/admin/settings/whatsapp").then((r) => r.json()).then((w) => {
      setWa(w.saved || w.active || ""); setWaActive(w.active || "");
    }).catch(() => {});
    setStamp(d.stamp); setSignature(d.signature); setPl(d.placement); setNita(d.nita ?? null);
  }, []);
  useEffect(() => { load(); }, [load]);

  // Phone photos can be several MB, and hosts like Vercel reject uploads over 4.5 MB.
  // Shrink big images in the browser first (stamp detail is unaffected at this size).
  async function shrink(file: File): Promise<File> {
    if (file.size <= 1.5 * 1024 * 1024) return file;
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
      return blob ? new File([blob], "scan.jpg", { type: "image/jpeg" }) : file;
    } catch {
      return file;
    }
  }

  async function upload(kind: "stamp" | "signature", file: File | undefined) {
    if (!file) return;
    setBusy(true); setMsg("");
    try {
      const small = await shrink(file);
      if (small.size > 4 * 1024 * 1024) {
        setMsg("That image is too large. Use a smaller photo (under 4 MB).");
        return;
      }
      const form = new FormData();
      form.append("kind", kind);
      form.append("file", small);
      const res = await fetch("/api/admin/settings/image", { method: "POST", body: form });
      const d = await res.json().catch(() => ({ error: "Upload failed. Try a smaller image." }));
      setMsg(res.ok ? `${kind === "stamp" ? "Stamp" : "Signature"} saved.` : d.error);
    } catch {
      setMsg("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
      load();
    }
  }

  async function uploadNita(file: File | undefined) {
    if (!file) return;
    setMsg("");
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      setMsg("Please choose a PDF file.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setMsg("That PDF is too large (max 4 MB). Compress it and try again.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/settings/nita", { method: "POST", body: form });
      const d = await res.json().catch(() => ({ error: "Upload failed. Try again." }));
      setMsg(res.ok ? "NITA form saved." : d.error);
    } catch {
      setMsg("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
      load();
    }
  }

  async function removeNita() {
    if (!confirm("Remove the NITA form? Letters will then be sent without it.")) return;
    await fetch("/api/admin/settings/nita", { method: "DELETE" });
    load();
  }

  async function remove(kind: "stamp" | "signature") {
    if (!confirm(`Remove the ${kind}?`)) return;
    await fetch(`/api/admin/settings/image?kind=${kind}`, { method: "DELETE" });
    load();
  }

  async function savePlacement() {
    const res = await fetch("/api/admin/settings/placement", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pl),
    });
    setMsg(res.ok ? "Placement saved." : "Could not save.");
  }

  async function saveWa() {
    setMsg("");
    const res = await fetch("/api/admin/settings/whatsapp", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ number: wa }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { setWaActive(d.active || ""); setMsg(d.active ? "WhatsApp number saved. The chat button is now on." : "WhatsApp number cleared. The chat button is hidden."); }
    else setMsg(d.error ?? "Could not save.");
  }

  if (!pl) return <main className="p-8 text-center text-slate-500">Loading...</main>;
  const set = (k: keyof Placement) => (v: number) => setPl({ ...pl, [k]: v });
  const today = new Date();
  const dd = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getFullYear()).slice(2)}`;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <h1 className="mb-1 text-xl font-bold">Stamp &amp; signature</h1>
      <p className="mb-4 text-sm text-slate-600">
        Scan or photograph your stamp on plain white paper, with the date box left empty. The white
        background is removed automatically and today&apos;s date is printed in the date box on every letter.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {(["stamp", "signature"] as const).map((kind) => (
          <div key={kind} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="mb-2 font-semibold capitalize">{kind}</p>
            <input type="file" accept="image/*" disabled={busy}
              onChange={(e) => { upload(kind, e.target.files?.[0]); e.target.value = ""; }}
              className="block w-full text-sm" />
            {(kind === "stamp" ? stamp : signature) && (
              <button onClick={() => remove(kind)} className="mt-2 text-sm text-red-700 underline">Remove</button>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="mb-1 font-semibold">WhatsApp number</p>
        <p className="mb-2 text-sm text-slate-600">
          Trainees reach you through the chat button on the home page and their account. Leave empty to hide it.
        </p>
        <div className="flex gap-2">
          <input value={wa} onChange={(e) => setWa(e.target.value)} inputMode="tel" placeholder="0712 345 678"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-base" />
          <button onClick={saveWa} className="rounded-lg bg-blue-900 px-4 py-2 font-semibold text-white">Save</button>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          {waActive ? <>Chat button is <b className="text-green-700">ON</b> (sending to +{waActive}).</> : <>Chat button is <b>OFF</b> (no number set).</>}
        </p>
      </div>
      <div className="mt-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="mb-1 font-semibold">NITA form (PDF)</p>
        <p className="mb-2 text-sm text-slate-600">
          This PDF is emailed to each trainee together with their letter. Without one, only the letter is sent.
        </p>
        <input type="file" accept="application/pdf,.pdf" disabled={busy}
          onChange={(e) => { uploadNita(e.target.files?.[0]); e.target.value = ""; }}
          className="block w-full text-sm" />
        {nita ? (
          <p className="mt-2 text-sm text-slate-700">
            Current: <b>{nita.name}</b> ({nita.kb} KB) ·{" "}
            <a href="/api/admin/settings/nita" target="_blank" className="underline">View</a> ·{" "}
            <button onClick={removeNita} className="text-red-700 underline">Remove</button>
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No NITA form uploaded yet.</p>
        )}
      </div>
      {msg && <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{msg}</p>}

      {stamp && (
        <section className="mt-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="mb-3 font-semibold">Placement preview</p>
          <div className="mb-4 overflow-x-auto rounded-lg bg-slate-50 p-4">
            <div className="relative" style={{ width: pl.stamp_width * SCALE }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={stamp} alt="Stamp" className="block w-full" />
              <span className="absolute font-bold leading-none"
                style={{
                  left: `${pl.date_x}%`, top: `${pl.date_y}%`, transform: "translateY(-85%)",
                  fontSize: pl.date_size * SCALE, color: "#1f3b99",
                }}>{dd}</span>
              {signature && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={signature} alt="Signature" className="absolute"
                  style={{ left: `${pl.sig_x}%`, top: `${pl.sig_y}%`, width: `${pl.sig_w}%` }} />
              )}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Slider label="Stamp size" value={pl.stamp_width} min={100} max={260} onChange={set("stamp_width")} />
            <Slider label="Date size" value={pl.date_size} min={6} max={16} step={0.5} onChange={set("date_size")} />
            <Slider label="Date: left to right" value={pl.date_x} min={0} max={100} onChange={set("date_x")} />
            <Slider label="Date: top to bottom" value={pl.date_y} min={0} max={100} onChange={set("date_y")} />
            {signature && (
              <>
                <Slider label="Signature: left to right" value={pl.sig_x} min={0} max={100} onChange={set("sig_x")} />
                <Slider label="Signature: top to bottom" value={pl.sig_y} min={0} max={100} onChange={set("sig_y")} />
                <Slider label="Signature size" value={pl.sig_w} min={10} max={100} onChange={set("sig_w")} />
              </>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <button onClick={savePlacement} className="rounded-lg bg-blue-900 px-4 py-2 font-semibold text-white">
              Save placement
            </button>
            <a href="/api/admin/sample?level=4" target="_blank" className="rounded-lg px-4 py-2 ring-1 ring-slate-300">
              Test letter (Level 4)
            </a>
            <a href="/api/admin/sample?level=6" target="_blank" className="rounded-lg px-4 py-2 ring-1 ring-slate-300">
              Test letter (Level 6)
            </a>
          </div>
          <p className="mt-2 text-xs text-slate-500">Save placement first, then open a test letter to check it.</p>
        </section>
      )}
    </main>
  );
}
