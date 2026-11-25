"use client";

import ChatFab from "@/components/ChatFab";
import FeedbackCard from "@/components/FeedbackCard";
import Choice from "@/components/Choice";
import Picker from "@/components/Picker";
import PrivacyNotice from "@/components/PrivacyNotice";
import { useEffect, useMemo, useState } from "react";

// course -> section ("" when none) -> cycle -> level -> modules
type Rules = Record<string, Record<string, Record<string, Record<string, string[]>>>>;

const MONTHS = [
  "January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December",
];

const field =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none transition focus:border-blue-800 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100 disabled:text-slate-400";
const label = "mb-1 block text-sm font-medium text-slate-700";
const group = "text-xs font-semibold uppercase tracking-wider text-slate-400";

// Common mistakes in the part after the @, e.g. gmial.com
const DOMAIN_FIXES: Record<string, string> = {
  "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gmail.con": "gmail.com", "gmail.co": "gmail.com",
  "gmail.cm": "gmail.com", "gnail.com": "gmail.com", "gmail.om": "gmail.com", "gmaill.com": "gmail.com",
  "gamil.com": "gmail.com", "yaho.com": "yahoo.com", "yahoo.con": "yahoo.com", "yahooo.com": "yahoo.com",
  "hotmial.com": "hotmail.com", "hotmail.con": "hotmail.com", "outlook.con": "outlook.com",
};
function emailTypo(e: string): string | null {
  const at = e.lastIndexOf("@");
  if (at < 1) return null;
  const fix = DOMAIN_FIXES[e.slice(at + 1)];
  return fix ? `${e.slice(0, at)}@${fix}` : null;
}

const az = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base" });

const STEPS = [
  "Receive your attachment letter in your email",
  "Fill in your attachment details",
  "Know your assessor",
];
function Steps({ className, numClass }: { className: string; numClass: string }) {
  return (
    <ol className={className}>
      {STEPS.map((t, i) => (
        <li key={t} className="flex gap-3"><span className={numClass}>{i + 1}</span> {t}</li>
      ))}
    </ol>
  );
}

export default function Home() {
  const [rules, setRules] = useState<Rules | null>(null);
  const [name, setName] = useState("");
  const [adm, setAdm] = useState("");
  const [email, setEmail] = useState("");
  const [email2, setEmail2] = useState("");
  const [phone, setPhone] = useState("");
  const [course, setCourse] = useState("");
  const [section, setSection] = useState("");
  const [cycle, setCycle] = useState("");
  const [level, setLevel] = useState("");
  const [module, setModule] = useState("");
  const now = new Date();
  const startOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    return { value: `${d.getFullYear()}-${d.getMonth() + 1}`, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` };
  });
  const [month, setMonth] = useState(String(((now.getMonth() + 1) % 12) + 1));
  const [year, setYear] = useState(String(now.getFullYear() + (now.getMonth() === 11 ? 1 : 0)));
  const [website, setWebsite] = useState(""); // honeypot
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/rules").then((r) => r.json()).then(setRules);
  }, []);

  const courses = useMemo(() => Object.keys(rules ?? {}).sort(az), [rules]);
  const sections = useMemo(
    () => Object.keys(rules?.[course] ?? {}).filter((s) => s !== "").sort(az),
    [rules, course],
  );
  const hasSections = sections.length > 0;
  const tree = rules?.[course]?.[hasSections ? section : ""];
  const cycles = useMemo(() => Object.keys(tree ?? {}), [tree]);
  const levels = useMemo(() => Object.keys(tree?.[cycle] ?? {}), [tree, cycle]);
  const modules = useMemo(() => tree?.[cycle]?.[level] ?? [], [tree, cycle, level]);
  const ready = !!course && (!hasSections || !!section);
  const needsModule = modules.length > 0;

  const emailClean = email.trim().toLowerCase();
  const emailsMatch = emailClean === email2.trim().toLowerCase();
  const typo = emailTypo(emailClean);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!emailsMatch) { setError("The two email addresses are not the same."); return; }
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
    // Phones: blue header stays at the top and only the form scrolls.
    // Large screens: blue panel stays on the left and only the form side scrolls.
    <div className="flex min-h-dvh flex-col lg:grid lg:h-dvh lg:grid-cols-[5fr_6fr] lg:overflow-hidden">
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-blue-900 px-4 py-3 text-white shadow-md lg:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logo.png" alt="Rangwe TVC logo" className="h-12 w-auto shrink-0 rounded-md bg-white p-1" />
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-blue-200">
            Rangwe Technical &amp; Vocational College
          </p>
          <h1 className="text-lg font-bold leading-tight">ILO Connect</h1>
        </div>
      </header>

      <aside className="hidden flex-col items-center justify-center gap-8 bg-blue-900 px-12 text-white lg:flex">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logo.png" alt="Rangwe TVC logo" className="h-28 w-auto rounded-xl bg-white p-3" />
        <div className="max-w-sm text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">
            Rangwe Technical &amp; Vocational College
          </p>
          <h1 className="mt-2 text-4xl font-bold">ILO Connect</h1>
          <p className="mt-2 text-blue-100">Your one-stop Industrial Liaison Office</p>
        </div>
        <Steps className="max-w-xs space-y-3 text-sm text-blue-100" numClass="font-bold text-white" />
      </aside>

      <main className="flex-1 lg:overflow-y-auto">
        <div className="mx-auto w-full max-w-md px-5 pb-24 pt-6 lg:py-12">
          {done ? (
            <>
              <div className="rounded-xl bg-green-50 p-6 text-center ring-1 ring-green-200">
                <p className="text-lg font-semibold text-green-800">Request received</p>
                <p className="mt-2 text-sm text-green-900">
                  Your letter will be sent to <b>{emailClean}</b> after approval. Check your spam folder too.
                </p>
                <p className="mt-2 text-sm text-green-900">
                  That email will also carry a link to create your ILO Connect account.
                </p>
              </div>
              <FeedbackCard />
            </>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="lg:hidden">
                <p className="text-sm font-medium text-slate-700">Your one-stop Industrial Liaison Office</p>
                <Steps className="mt-2 space-y-1.5 text-sm text-slate-600" numClass="font-bold text-blue-900" />
              </div>
              <p className="hidden text-sm font-medium text-slate-700 lg:block">Request your attachment letter</p>

              <p className={group}>You</p>
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
                <label className={label}>Email</label>
                <input type="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com" required autoComplete="email" />
                {typo && (
                  <p className="mt-1 text-sm text-amber-700">
                    Did you mean{" "}
                    <button type="button" className="font-semibold underline" onClick={() => setEmail(typo)}>{typo}</button>?
                  </p>
                )}
              </div>
              <div>
                <label className={label}>Confirm email</label>
                <input type="email" className={field} value={email2} onChange={(e) => setEmail2(e.target.value)}
                  onPaste={(e) => e.preventDefault()} placeholder="Type it again" required autoComplete="off" />
                {email2 && !emailsMatch && <p className="mt-1 text-sm text-red-700">The emails do not match yet.</p>}
                {email2 && emailsMatch && <p className="mt-1 text-sm text-green-700">Emails match.</p>}
              </div>
              <div>
                <label className={label}>WhatsApp Number</label>
                <input type="tel" inputMode="tel" className={field} value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0712 345 678" required autoComplete="tel" />
              </div>

              <p className={`${group} pt-2`}>Your course</p>
              <div>
                <label className={label}>Course</label>
                <Picker title="Choose your course" placeholder="Select your course" value={course}
                  options={courses.map((c) => ({ value: c, label: c }))}
                  onChange={(v) => { setCourse(v); setSection(""); setCycle(""); setLevel(""); setModule(""); }} />
              </div>
              {hasSections && (
                <div>
                  <label className={label}>Section</label>
                  <Picker title="Choose your section" placeholder="Select your section" value={section}
                    options={sections.map((x) => ({ value: x, label: x }))}
                    onChange={(v) => { setSection(v); setCycle(""); setLevel(""); setModule(""); }} />
                </div>
              )}
              {ready && (
                <div>
                  <label className={label}>Cycle</label>
                  <Choice ariaLabel="Cycle" cols="grid-cols-3" value={cycle}
                    options={cycles.map((c) => ({ value: c, label: `Cycle ${c}` }))}
                    onChange={(v) => { setCycle(v); setLevel(""); setModule(""); }} />
                </div>
              )}
              {cycle && (
                <div>
                  <label className={label}>Level</label>
                  <Choice ariaLabel="Level" cols="grid-cols-3" value={level}
                    options={levels.map((l) => ({ value: l, label: `Level ${l}` }))}
                    onChange={(v) => { setLevel(v); setModule(""); }} />
                </div>
              )}
              {level && needsModule && (
                <div>
                  <label className={label}>Module</label>
                  <Choice ariaLabel="Module" cols="grid-cols-3" value={module}
                    options={modules.map((m) => ({ value: m, label: `Module ${m}` }))}
                    onChange={setModule} />
                </div>
              )}

              <p className={`${group} pt-2`}>Attachment</p>
              <div>
                <label className={label}>Starts in (runs for 3 months)</label>
                <Picker title="Attachment starts in" placeholder="Select month" value={`${year}-${month}`}
                  options={startOptions}
                  onChange={(v) => { const [y, m] = v.split("-"); setYear(y); setMonth(m); }} />
              </div>

              {/* Honeypot: hidden from people, bots fill it in */}
              <input className="hidden" tabIndex={-1} autoComplete="off" value={website}
                onChange={(e) => setWebsite(e.target.value)} aria-hidden="true" />
              {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
              <button disabled={busy || !level || (needsModule && !module) || !emailsMatch}
                className="w-full rounded-lg bg-blue-900 px-4 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:opacity-50">
                {busy ? "Sending..." : "Request my letter"}
              </button>
              <PrivacyNotice compact />
            </form>
          )}
          <p className="mt-8 text-center text-xs text-slate-500">
            <a href="/trainee" className="underline">Trainee login</a> ·{" "}
            <a href="/admin" className="underline">ILO sign in</a>
          </p>
        </div>
      </main>
      <ChatFab />
    </div>
  );
}
