"use client";

type Opt = { value: string; label: string };

/** Tap-to-choose buttons. Easier than a dropdown on a phone. */
export default function Choice({
  options, value, onChange, cols = "grid-cols-3", ariaLabel,
}: {
  options: Opt[];
  value: string;
  onChange: (v: string) => void;
  cols?: string;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`grid gap-2 ${cols}`}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-medium transition active:scale-[0.98] ${
              on
                ? "border-blue-900 bg-blue-900 text-white shadow-sm"
                : "border-slate-300 bg-white text-slate-700 hover:border-blue-700"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
