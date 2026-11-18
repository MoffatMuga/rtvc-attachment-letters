"use client";

import { useCallback, useEffect, useState } from "react";
import PrivacyNotice from "@/components/PrivacyNotice";

type Me = {
  whatsapp: string;
  trainee: Record<string, string | null> & { name: string; adm_no: string; email: string; consent_at: string | null };
  assessor: { name: string; phone: string; email: string; department: string } | null;
  insurance: { name: string; date: string } | null;
  letters: { id: number; ref: string; course: string; level: string; period: string; date: string }[];
};

const FIELDS = [
  ["firm_name", "Name of firm *", "e.g. Kenya Power and Lighting Co."],
  ["firm_location", "Town / county of the firm *", "e.g. Kisumu"],
  ["firm_address", "Firm address or directions", "Building, street, landmark"],
  ["firm_phone", "Firm phone", "0712345678"],
  ["department_at_firm", "Department you work in", "e.g. Maintenance"],
  ["supervisor_name", "Supervisor's name *", ""],
  ["supervisor_title", "Supervisor's job title", "e.g. Technician"],
  ["supervisor_phone", "Supervisor's phone *", "0712345678"],
  ["supervisor_email", "Supervisor's email", ""],
  ["start_date", "Date you started", ""],
  ["end_date", "Expected end date", ""],
] as const;

const input = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base";

function Block({ title, rows }: { title: string; rows: [string, string | null][] }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
      <dl className="divide-y divide-slate-100 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-1.5">
            <dt className="text-slate-500">{k}</dt>
            <dd className="text-right font-medium text-slate-800">
              {v ? (k.includes("hone") ? <a href={`tel:${v}`} className="underline">{v}</a> : v) : <span className="font-normal text-slate-300">-</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function TraineePage() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [saved, setSaved] = useState("");
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/trainee/me");
    if (!res.ok) { setMe(null); return; }
    const data: Me = await res.json();
    setMe(data);
    const f: Record<string, string> = {};
    for (const [k] of FIELDS) f[k] = (data.trainee[k] as string) ?? "";
    f.phone = (data.trainee.phone as string) ?? "";
    setForm(f);
    setConsent(!!data.trainee.consent_at);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function post(url: string, body: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    const r = await post("/api/trainee/code", { email });
    setBusy(false);
    if (r.ok) setStep("code"); else setErr(r.data.error ?? "Something went wrong.");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    const r = await post("/api/trainee/login", { email, code });
    setBusy(false);
    if (r.ok) { setCode(""); load(); } else setErr(r.data.error ?? "Something went wrong.");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setSaved(""); setBusy(true);
    const res = await fetch("/api/trainee/me", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, consent }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setSaved("Your details were saved."); setEditing(false); await load(); window.scrollTo({ top: 0, behavior: "smooth" }); } else setErr(data.error ?? "Could not save.");
  }

  async function logout() {
    await fetch("/api/trainee/logout", { method: "POST" });
    setMe(null); setStep("email"); setEmail("");
  }

  if (me === undefined) return <main className="p-8 text-center text-slate-500">Loading...</main>;

  if (me === null) {
    return (
      <main className="mx-auto w-full max-w-sm flex-1 px-4 py-12">
        <h1 className="mb-1 text-center text-xl font-bold">ILO Connect login</h1>
        <p className="mb-4 text-center text-sm text-slate-600">
          For trainees whose attachment letter has been approved. Use the email you gave when you requested your letter.
        </p>
        {step === "email" ? (
          <form onSubmit={sendCode} className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email" autoFocus className={input} />
            {err && <p className="text-sm text-red-700">{err}</p>}
            <button disabled={busy} className="w-full rounded-lg bg-blue-900 px-4 py-3 font-semibold text-white disabled:opacity-50">
              {busy ? "Sending..." : "Send me a code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-600">
              If <strong>{email}</strong> belongs to an approved trainee, a 6-digit code is on its way. Check Spam too.
            </p>
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="6-digit code" autoFocus className={`${input} text-center tracking-widest`} />
            {err && <p className="text-sm text-red-700">{err}</p>}
            <button disabled={busy || code.length !== 6} className="w-full rounded-lg bg-blue-900 px-4 py-3 font-semibold text-white disabled:opacity-50">
              {busy ? "Checking..." : "Log in"}
            </button>
            <button type="button" onClick={() => { setStep("email"); setErr(""); setCode(""); }} className="w-full text-sm text-slate-500 underline">
              Use a different email
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-sm"><a href="/" className="text-slate-500 underline">Request an attachment letter</a></p>
      </main>
    );
  }

  const t = me.trainee;
  const hasProfile = !!t.profile_updated_at;
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t.name}</h1>
          <p className="text-sm text-slate-600">{t.adm_no} · {t.email}</p>
        </div>
        <button onClick={logout} className="text-sm text-slate-500 underline">Log out</button>
      </div>

      {me.whatsapp && (
        <a
          href={`https://wa.me/${me.whatsapp}?text=${encodeURIComponent(
            `Hello ILO, this is ${t.name} (${t.adm_no}) from Rangwe TVC. I need help with my attachment: `,
          )}`}
          target="_blank" rel="noopener noreferrer"
          className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 font-semibold text-white shadow-sm hover:bg-green-700"
        >
          Contact the ILO on WhatsApp
        </a>
      )}

      <section className="mb-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-2 font-semibold">Your assessor</h2>
        {me.assessor ? (
          <div className="text-sm text-slate-700">
            <p className="font-medium">{me.assessor.name}{me.assessor.department ? ` · ${me.assessor.department}` : ""}</p>
            {me.assessor.phone && <p><a className="underline" href={`tel:${me.assessor.phone}`}>{me.assessor.phone}</a></p>}
            {me.assessor.email && <p>{me.assessor.email}</p>}
          </div>
        ) : (
          <p className="text-sm text-slate-600">Not assigned yet. The ILO will assign one and you will get an email.</p>
        )}
      </section>

      <section className="mb-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-2 font-semibold">Your insurance letter</h2>
        {me.insurance ? (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span>{me.insurance.name}<br /><span className="text-slate-500">Uploaded {me.insurance.date}</span></span>
            <a href="/api/trainee/insurance" className="shrink-0 rounded-lg bg-blue-900 px-3 py-2 font-medium text-white">Download</a>
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            Not uploaded yet. The ILO uploads insurance letters as soon as the insurer sends them. Check back later.
          </p>
        )}
      </section>

      <section className="mb-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-2 font-semibold">Your letters</h2>
        {me.letters.length === 0 && <p className="text-sm text-slate-600">None yet.</p>}
        <ul className="space-y-2">
          {me.letters.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{l.ref}<br /><span className="text-slate-500">{l.course}, Level {l.level} · {l.period}</span></span>
              <a href={`/api/trainee/letters/${l.id}`} className="shrink-0 rounded-lg px-3 py-2 ring-1 ring-slate-300">Download</a>
            </li>
          ))}
        </ul>
      </section>

      {hasProfile && !editing ? (
        <section className="space-y-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Where you are attached</h2>
            <button onClick={() => { setSaved(""); setErr(""); setEditing(true); }}
              className="rounded-lg px-3 py-1.5 text-sm ring-1 ring-slate-300">Edit</button>
          </div>
          {saved && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{saved}</p>}
          <Block title="Firm" rows={[
            ["Name", t.firm_name], ["Town / county", t.firm_location], ["Address", t.firm_address],
            ["Phone", t.firm_phone], ["Department", t.department_at_firm],
          ]} />
          <Block title="Supervisor" rows={[
            ["Name", t.supervisor_name], ["Job title", t.supervisor_title],
            ["Phone", t.supervisor_phone], ["Email", t.supervisor_email],
          ]} />
          <Block title="Attachment" rows={[
            ["Started", t.start_date], ["Expected end", t.end_date], ["Your phone", t.phone],
          ]} />
          <p className="text-xs text-slate-400">Last updated {(t.profile_updated_at ?? "").slice(0, 10)}</p>
        </section>
      ) : (
      <form onSubmit={save} className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-semibold">Where you are attached</h2>
        <p className="text-sm text-slate-600">Fill this in once you have been accepted by a firm. Fields marked * are required.</p>
        <label className="block text-sm">Your phone
          <input className={`${input} mt-1`} value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        {FIELDS.map(([k, label, ph]) => (
          <label key={k} className="block text-sm">{label}
            <input className={`${input} mt-1`} placeholder={ph}
              type={k.endsWith("_date") ? "date" : k === "supervisor_email" ? "email" : "text"}
              value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </label>
        ))}
        <PrivacyNotice compact />
        {!t.consent_at && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I have read the data notice and agree.</span>
          </label>
        )}
        {err && <p className="text-sm text-red-700">{err}</p>}
        {saved && <p className="text-sm text-green-700">{saved}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-blue-900 px-4 py-3 font-semibold text-white disabled:opacity-50">
          {busy ? "Saving..." : "Save details"}
        </button>
        {hasProfile && (
          <button type="button" onClick={() => { setEditing(false); setErr(""); load(); }}
            className="w-full text-sm text-slate-500 underline">Cancel</button>
        )}
      </form>
      )}
    </main>
  );
}
