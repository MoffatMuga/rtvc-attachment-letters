"use client";

import { useEffect, useMemo, useState } from "react";

type Opt = { value: string; label: string };

/**
 * A field that opens a bottom sheet (phones) or a small dialog (large screens) with the
 * options in a clean list. Long lists get a search box. Calmer than a wall of buttons,
 * and nicer than the phone's own dropdown.
 */
export default function Picker({
  title, placeholder, options, value, onChange, disabled = false,
}: {
  title: string;
  placeholder: string;
  options: Opt[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const current = options.find((o) => o.value === value);
  const searchable = options.length > 7;

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => o.label.toLowerCase().includes(s)) : options;
  }, [options, q]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  function close() { setOpen(false); setQ(""); }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-left text-base outline-none transition focus:border-blue-800 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100 disabled:text-slate-400"
      >
        <span className={current ? "text-slate-900" : "text-slate-400"}>{current?.label ?? placeholder}</span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 fill-slate-400" aria-hidden="true">
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center" role="dialog" aria-modal="true" aria-label={title}>
          <button type="button" aria-label="Close" onClick={close} className="absolute inset-0 bg-slate-900/50" />
          <div className="sheet-up relative flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-2xl lg:rounded-2xl">
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <h2 className="text-base font-semibold text-slate-800">{title}</h2>
              <button type="button" onClick={close} aria-label="Close" className="-mr-2 rounded-full p-2 text-2xl leading-none text-slate-400 hover:bg-slate-100">×</button>
            </div>
            {searchable && (
              <div className="px-5 pb-2">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-blue-800 focus:ring-2 focus:ring-blue-200" />
              </div>
            )}
            <ul className="overflow-y-auto px-2 pb-4" role="listbox">
              {shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-400">Nothing matches.</li>}
              {shown.map((o) => {
                const on = o.value === value;
                return (
                  <li key={o.value}>
                    <button type="button" role="option" aria-selected={on}
                      onClick={() => { onChange(o.value); close(); }}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-base ${on ? "bg-blue-50 font-semibold text-blue-900" : "text-slate-700 hover:bg-slate-50"}`}>
                      {o.label}
                      {on && (
                        <svg viewBox="0 0 20 20" className="h-5 w-5 fill-blue-900" aria-hidden="true">
                          <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0z" />
                        </svg>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
