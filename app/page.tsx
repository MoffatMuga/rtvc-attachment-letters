"use client";

import { useEffect, useMemo, useState } from "react";

// course -> section ("" when none) -> cycle -> level -> modules
type Rules = Record<string, Record<string, Record<string, Record<string, string[]>>>>;

const MONTHS = [
  "January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December",
];

const field =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200";
const label = "mb-1 block text-sm font-medium text-slate-700";

export default function Home() {
  const [rules, setRules] = useState<Rules | null>(null);
  const [name, setName] = useState("");
  const [adm, setAdm] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [course, setCourse] = useState("");
  const [section, setSection] = useState("");
  const [cycle, setCycle] = useState("");
  const [level, setLevel] = useState("");
  const [module, setModule] = useState("");
  const now = new Date();
  const [month, setMonth] = useState(String(((now.getMonth() + 1) % 12) + 1));
  const [year, setYear] = useState(String(now.getFullYear() + (now.getMonth() === 11 ? 1 : 0)));
  const [website, setWebsite] = useState(""); // honeypot
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/rules").then((r) => r.json()).then(setRules);
  }, []);

  const courses = useMemo(() => Object.keys(rules ?? {}), [rules]);
  const sections = useMemo(
    () => Object.keys(rules?.[course] ?? {}).filter((s) => s !== ""),
    [rules, course],
  );
  const hasSections = sections.length > 0;
  const tree = rules?.[course]?.[hasSections ? section : ""];
  const cycles = useMemo(() => Object.keys(tree ?? {}), [tree]);
  const levels = useMemo(() => Object.keys(tree?.[cycle] ?? {}), [tree, cycle]);
  const modules = useMemo(() => tree?.[cycle]?.[level] ?? [], [tree, cycle, level]);
  const ready = !!course && (!hasSections || !!section);
  const needsModule = modules.length > 0;
  const showModule = !level || needsModule; // hidden for levels that have no modules

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, adm_no: adm, email, phone, course, section, cycle, level, module,
          start_month: Number(month), start_year: Number(year), website,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Something went wrong.");
      else setDone(true);
    } catch {
      setError("Network problem. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Left panel: large screens only */}
      <aside className="hidden flex-col items-center justify-center gap-10 bg-gradient-to-br from-blue-950 to-blue-800 px-12 text-white lg:flex">
        <div className="flex items-center gap-6 rounded-2xl bg-white p-6 shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo.png" alt="Rangwe TVC logo" className="h-32 w-auto" />
        </div>
        <div className="max-w-sm">
          <h2 className="text-center text-3xl font-bold">Industrial Attachment Letters</h2>
          <ol className="mt-6 space-y-3 text-blue-100">
            <li className="flex gap-3"><span className="font-bold text-white">1.</span> Fill in your details and pick your module.</li>
            <li className="flex gap-3"><span className="font-bold text-white">2.</span> The Industrial Liaison Officer reviews your request.</li>
            <li className="flex gap-3"><span className="font-bold text-white">3.</span> Your letter arrives by email as a PDF.</li>
          </ol>
        </div>
      </aside>
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8 lg:flex lg:flex-col lg:justify-center">
      <header className="mb-6 text-center">
        {/* Logos on top for phones and tablets */}
        <div className="mb-3 flex items-center justify-center gap-4 lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo.png" alt="Rangwe TVC logo" className="h-16 w-auto" />
        </div>
        <p className="text-sm font-semibold tracking-wide text-blue-900">
          RANGWE TECHNICAL &amp; VOCATIONAL COLLEGE
        </p>
        <h1 className="mt-1 text-2xl font-bold">Industrial Attachment Letter</h1>
        <p className="mt-1 text-sm text-slate-600">
          Fill in your details. Your letter is emailed to you once the Industrial Liaison Officer approves.
        </p>
      </header>

      {done ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
          <p className="text-lg font-semibold text-green-800">Request received</p>
          <p className="mt-2 text-sm text-green-900">
            You will get your letter at <b>{email}</b> after approval. Check your spam folder too.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div>
            <label className={label}>Full name</label>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Job Opiyo" required autoComplete="name" />
          </div>
          <div>
            <label className={label}>Admission number (in full)</label>
            <input className={`${field} uppercase`} value={adm} onChange={(e) => setAdm(e.target.value)}
              placeholder="EEPL6/1592/24M" required />
          </div>
          <div>
            <label className={label}>Your email</label>
            <input type="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@gmail.com" required autoComplete="email" />
          </div>
          <div>
            <label className={label}>Phone number</label>
            <input type="tel" inputMode="tel" className={field} value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0712 345 678" required autoComplete="tel" />
          </div>
          <div>
            <label className={label}>Course</label>
            <select className={field} value={course} required
              onChange={(e) => { setCourse(e.target.value); setSection(""); setCycle(""); setLevel(""); setModule(""); }}>
              <option value="">Select course</option>
              {courses.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          {hasSections && (
            <div>
              <label className={label}>Section</label>
              <select className={field} value={section} required
                onChange={(e) => { setSection(e.target.value); setCycle(""); setLevel(""); setModule(""); }}>
                <option value="">Select section</option>
                {sections.map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
          )}
          <div className={`grid gap-3 ${showModule ? "grid-cols-3" : "grid-cols-2"}`}>
            <div>
              <label className={label}>Cycle</label>
              <select className={field} value={cycle} required disabled={!ready}
                onChange={(e) => { setCycle(e.target.value); setLevel(""); setModule(""); }}>
                <option value="">-</option>
                {cycles.map((c) => <option key={c} value={c}>Cycle {c}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Level</label>
              <select className={field} value={level} required disabled={!cycle}
                onChange={(e) => { setLevel(e.target.value); setModule(""); }}>
                <option value="">-</option>
                {levels.map((l) => <option key={l} value={l}>Level {l}</option>)}
              </select>
            </div>
            {showModule && (
              <div>
                <label className={label}>Module</label>
                <select className={field} value={module} required={needsModule} disabled={!level}
                  onChange={(e) => setModule(e.target.value)}>
                  <option value="">-</option>
                  {modules.map((m) => <option key={m} value={m}>Module {m}</option>)}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className={label}>Attachment starts (three months)</label>
            <div className="grid grid-cols-2 gap-3">
              <select className={field} value={month} onChange={(e) => setMonth(e.target.value)}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <select className={field} value={year} onChange={(e) => setYear(e.target.value)}>
                {[now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y}>{y}</option>)}
              </select>
            </div>
          </div>
          {/* Honeypot: hidden from people, bots fill it in */}
          <input className="hidden" tabIndex={-1} autoComplete="off" value={website}
            onChange={(e) => setWebsite(e.target.value)} aria-hidden="true" />
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <button disabled={busy || !level || (needsModule && !module)}
            className="w-full rounded-lg bg-blue-900 px-4 py-3 font-semibold text-white disabled:opacity-50">
            {busy ? "Sending..." : "Request my letter"}
          </button>
        </form>
      )}
      <p className="mt-6 text-center text-xs text-slate-500">
        Industrial Liaison Office, RTVC ·{" "}
        <a href="/admin" className="underline">ILO sign in</a>
      </p>
    </main>
    </div>
  );
}
