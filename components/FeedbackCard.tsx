"use client";

import { useState } from "react";

const WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

/** Shown after a request is submitted: star rating + optional comment. */
export default function FeedbackCard() {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) { setError("Tap a star first."); return; }
    setError(""); setState("sending");
    const res = await fetch("/api/feedback", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment, website }),
    }).catch(() => null);
    if (res?.ok) setState("done");
    else { setState("idle"); setError("Could not send. Please try again."); }
  }

  if (state === "done") {
    return (
      <div className="mt-4 rounded-xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-200">
        <p className="text-2xl">🙏</p>
        <p className="mt-1 font-semibold text-slate-800">Thank you for your feedback!</p>
        <p className="text-sm text-slate-500">It helps the ILO improve this service.</p>
      </div>
    );
  }

  const shown = hover || rating;
  return (
    <form onSubmit={send} className="mt-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p className="text-center font-semibold text-slate-800">How was your experience?</p>
      <p className="text-center text-sm text-slate-500">Rate ILO Connect from 1 to 5 stars</p>
      <div className="mt-3 flex justify-center gap-1" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => setRating(n)} onMouseEnter={() => setHover(n)}
            className="p-1 transition active:scale-90">
            <svg viewBox="0 0 24 24" className={`h-9 w-9 ${n <= shown ? "fill-amber-400" : "fill-slate-200"}`} aria-hidden="true">
              <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" />
            </svg>
          </button>
        ))}
      </div>
      <p className="mt-1 h-5 text-center text-sm font-medium text-amber-600">{WORDS[shown]}</p>
      {rating > 0 && (
        <>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={3}
            placeholder="Tell us more (optional)" 
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-blue-800 focus:ring-2 focus:ring-blue-200" />
          <input className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </>
      )}
      {error && <p className="mt-2 text-center text-sm text-red-700">{error}</p>}
      <button disabled={state === "sending"} className="mt-3 w-full rounded-lg bg-blue-900 px-4 py-2.5 font-semibold text-white disabled:opacity-50">
        {state === "sending" ? "Sending..." : "Send feedback"}
      </button>
    </form>
  );
}
