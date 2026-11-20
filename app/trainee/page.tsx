"use client";

import { useCallback, useEffect, useState } from "react";
import AuthSplit from "@/components/AuthSplit";
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

const input = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

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

const ico = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const ICONS = {
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8",
  pin: "M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
};

function Card({ icon, title, children, action }: { icon: keyof typeof ICONS; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-700">{ico(ICONS[icon])}</span>{title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Chip({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${ok ? "bg-green-400/20 text-green-100 ring-1 ring-green-300/40" : "bg-white/10 text-blue-100 ring-1 ring-white/20"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-green-300" : "bg-amber-300"}`} />{ok ? yes : no}
    </span>
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
      <AuthSplit
        heading="Your attachment, all in one place"
        tagline="Log in to get your letters, meet your assessor and reach the ILO."
        points={["Download your attachment letter any time", "See the assessor assigned to you", "Save your firm and supervisor details", "Message the ILO on WhatsApp"]}
        footer={<a href="/" className="text-slate-500 underline">Request an attachment letter</a>}
      >
        <h2 className="mb-1 text-2xl font-bold text-slate-900">Trainee login</h2>
        <p className="mb-5 text-sm text-slate-500">
          For trainees whose letter has been approved. Use the email you gave when you requested it.
        </p>
        {step === "email" ? (
          <form onSubmit={sendCode} className="space-y-4 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
            <label className="block text-sm font-medium text-slate-700">Email
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" autoFocus className={`${input} mt-1 py-3`} />
            </label>
            {err && <p className="text-sm text-red-700">{err}</p>}
            <button disabled={busy} className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-50">
              {busy ? "Sending..." : "Send me a code"}
            </button>
            <p className="text-center text-xs text-slate-400">We email you a 6-digit code. No password needed.</p>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-4 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
            <p className="text-sm text-slate-600">
              If <strong>{email}</strong> belongs to an approved trainee, a 6-digit code is on its way. Check Spam too.
            </p>
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000" autoFocus className={`${input} py-3 text-center text-xl tracking-[0.5em]`} />
            {err && <p className="text-sm text-red-700">{err}</p>}
            <button disabled={busy || code.length !== 6} className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-50">
              {busy ? "Checking..." : "Log in"}
            </button>
            <button type="button" onClick={() => { setStep("email"); setErr(""); setCode(""); }} className="w-full text-sm text-slate-500 underline">
              Use a different email
            </button>
          </form>
        )}
      </AuthSplit>
    );
  }

  const t = me.trainee;
  const hasProfile = !!t.profile_updated_at;
  const initials = t.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  const details = hasProfile && !editing ? (
    <Card icon="pin" title="Where you are attached" action={
      <button onClick={() => { setSaved(""); setErr(""); setEditing(true); }} className="rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-slate-300 hover:bg-slate-50">Edit</button>
    }>
      <div className="space-y-5">
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
      </div>
    </Card>
  ) : (
    <Card icon="pin" title="Where you are attached">
      <form onSubmit={save} className="space-y-3">
        <p className="text-sm text-slate-600">Fill this in once you have been accepted by a firm. Fields marked * are required.</p>
        <label className="block text-sm">Your phone
          <input className={`${input} mt-1`} value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map(([k, label, ph]) => (
            <label key={k} className="block text-sm">{label}
              <input className={`${input} mt-1`} placeholder={ph}
                type={k.endsWith("_date") ? "date" : k === "supervisor_email" ? "email" : "text"}
                value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </label>
          ))}
        </div>
        <PrivacyNotice compact />
        {!t.consent_at && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I have read the data notice and agree.</span>
          </label>
        )}
        {err && <p className="text-sm text-red-700">{err}</p>}
        {saved && <p className="text-sm text-green-700">{saved}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-50">
          {busy ? "Saving..." : "Save details"}
        </button>
        {hasProfile && (
          <button type="button" onClick={() => { setEditing(false); setErr(""); load(); }}
            className="w-full text-sm text-slate-500 underline">Cancel</button>
        )}
      </form>
    </Card>
  );

  return (
    <div className="min-h-screen flex-1 bg-slate-50">
      <header className="bg-gradient-to-br from-[#0b2a6b] via-[#0f3a8f] to-[#1d5fd6] pb-16 pt-4 text-white">
        <div className="mx-auto w-full max-w-5xl px-4 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src="/assets/logo.png" alt="Rangwe TVC logo" className="h-9 w-auto rounded-md bg-white p-1" />
              <p className="font-bold">ILO <span className="text-amber-400">Connect</span></p>
            </div>
            <button onClick={logout} className="rounded-lg bg-white/15 px-3 py-2 text-sm font-medium hover:bg-white/25">Log out</button>
          </div>
          <div className="mt-6 flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-amber-400 text-xl font-bold text-[#0b2a6b]">{initials}</span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold sm:text-2xl">{t.name}</h1>
              <p className="truncate text-sm text-blue-100">{t.adm_no} · {t.email}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip ok={me.letters.length > 0} yes="Letter approved" no="No letter yet" />
            <Chip ok={!!me.assessor} yes="Assessor assigned" no="Assessor pending" />
            <Chip ok={!!me.insurance} yes="Insurance letter ready" no="Insurance pending" />
            <Chip ok={hasProfile} yes="Placement saved" no="Add placement details" />
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-10 grid w-full max-w-5xl gap-5 px-4 pb-10 lg:grid-cols-5 lg:px-8">
        <div className="space-y-5 lg:col-span-2">
          {me.whatsapp && (
            <a
              href={`https://wa.me/${me.whatsapp}?text=${encodeURIComponent(
                `Hello ILO, this is ${t.name} (${t.adm_no}) from Rangwe TVC. I need help with my attachment: `,
              )}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-2xl bg-green-600 px-4 py-3.5 font-semibold text-white shadow-md hover:bg-green-700"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.5 7.3L3 20l1.3-5.3A8.4 8.4 0 1 1 21 11.5z" /></svg>
              Contact the ILO on WhatsApp
            </a>
          )}

          <Card icon="user" title="Your assessor">
            {me.assessor ? (
              <div className="text-sm text-slate-700">
                <p className="font-medium">{me.assessor.name}{me.assessor.department ? ` · ${me.assessor.department}` : ""}</p>
                {me.assessor.phone && <p><a className="underline" href={`tel:${me.assessor.phone}`}>{me.assessor.phone}</a></p>}
                {me.assessor.email && <p>{me.assessor.email}</p>}
              </div>
            ) : (
              <p className="text-sm text-slate-600">Not assigned yet. The ILO will assign one and you will get an email.</p>
            )}
          </Card>

          <Card icon="shield" title="Insurance letter">
            {me.insurance ? (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{me.insurance.name}<br /><span className="text-slate-500">Uploaded {me.insurance.date}</span></span>
                <a href="/api/trainee/insurance" className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-700">Download</a>
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                Not uploaded yet. The ILO uploads insurance letters as soon as the insurer sends them. Check back later.
              </p>
            )}
          </Card>

          <Card icon="file" title="Your letters">
            {me.letters.length === 0 && <p className="text-sm text-slate-600">None yet.</p>}
            <ul className="space-y-3">
              {me.letters.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0">{l.ref}<br /><span className="text-slate-500">{l.course}, Level {l.level} · {l.period}</span></span>
                  <a href={`/api/trainee/letters/${l.id}`} className="shrink-0 rounded-lg px-3 py-2 ring-1 ring-slate-300 hover:bg-slate-50">Download</a>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="lg:col-span-3">{details}</div>
      </main>
    </div>
  );
}
