"use client";

import { useEffect, useState } from "react";

type Data = {
  count: number; average: number | null; counts: Record<string, number>;
  items: { id: number; created_at: string; rating: number; comment: string }[];
};

const Stars = ({ n }: { n: number }) => (
  <span aria-label={`${n} stars`} className="text-amber-400">{"★".repeat(n)}<span className="text-slate-200">{"★".repeat(5 - n)}</span></span>
);

export default function FeedbackAdmin() {
  const [d, setD] = useState<Data | null | undefined>(undefined);
  useEffect(() => {
    fetch("/api/admin/feedback").then(async (r) => (r.ok ? setD(await r.json()) : setD(null))).catch(() => setD(null));
  }, []);

  if (d === undefined) return <main className="p-8 text-center text-slate-500">Loading...</main>;
  if (d === null) return <main className="p-8 text-center">Please <a className="underline" href="/admin">sign in</a> first.</main>;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Trainee feedback</h1>
      </div>
      <section className="mb-4 flex items-center gap-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="text-center">
          <p className="text-4xl font-bold text-slate-800">{d.average ?? "-"}</p>
          <p className="text-sm text-slate-500">{d.count} rating{d.count === 1 ? "" : "s"}</p>
        </div>
        <div className="flex-1 space-y-1 text-sm">
          {[5, 4, 3, 2, 1].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <span className="w-3 text-slate-500">{n}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${d.count ? (d.counts[String(n)] / d.count) * 100 : 0}%` }} />
              </div>
              <span className="w-6 text-right text-slate-500">{d.counts[String(n)]}</span>
            </div>
          ))}
        </div>
      </section>
      {d.items.length === 0 && <p className="py-10 text-center text-slate-500">No feedback yet.</p>}
      <ul className="space-y-3">
        {d.items.map((f) => (
          <li key={f.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between text-sm">
              <Stars n={f.rating} />
              <span className="text-slate-400">{f.created_at.slice(0, 10)}</span>
            </div>
            {f.comment && <p className="mt-1 text-slate-700">{f.comment}</p>}
          </li>
        ))}
      </ul>
    </main>
  );
}
