import type { ReactNode } from "react";

/**
 * Sign-in layout: a blue panel with the message on the left, the form on the right.
 * On phones the blue panel becomes a short header above the form.
 */
export default function AuthSplit({
  heading, tagline, points, children, footer,
}: { heading: string; tagline: string; points: string[]; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-screen flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
      <aside className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0b2a6b] via-[#0f3a8f] to-[#1d5fd6] px-6 py-8 text-white lg:px-14 lg:py-12">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-20 hidden h-80 w-80 rounded-full bg-amber-400/15 lg:block" />
        <div className="relative flex items-center gap-3">
          <img src="/assets/logo.png" alt="Rangwe TVC logo" className="h-12 w-auto rounded-lg bg-white p-1.5" />
          <div className="leading-tight">
            <p className="text-lg font-bold">ILO <span className="text-amber-400">Connect</span></p>
            <p className="text-xs text-blue-200">Rangwe Technical and Vocational College</p>
          </div>
        </div>
        <div className="relative my-8 lg:my-0">
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">{heading}</h1>
          <p className="mt-2 max-w-md text-blue-100 lg:mt-3 lg:text-lg">{tagline}</p>
          <ul className="mt-6 hidden max-w-md space-y-3 lg:block">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-blue-50">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-400 text-[#0b2a6b]">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative hidden text-xs text-blue-200 lg:block">Industrial Liaison Office · Homa Bay County</p>
      </aside>
      <section className="flex items-center justify-center bg-slate-50 px-4 py-10 lg:px-12">
        <div className="w-full max-w-sm">
          {children}
          {footer && <div className="mt-6 text-center text-sm">{footer}</div>}
        </div>
      </section>
    </div>
  );
}
