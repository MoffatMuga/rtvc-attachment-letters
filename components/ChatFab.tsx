"use client";

import { useEffect, useState } from "react";

const TOPICS = ["Attachment letter", "My assessor", "My firm details", "Something else"];

/**
 * Floating chat button. Opens a small panel; "Send" opens WhatsApp with the message
 * already typed, addressed to the ILO. (WhatsApp always asks the person to press send.)
 */
export default function ChatFab() {
  const [wa, setWa] = useState("");
  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const [topic, setTopic] = useState(TOPICS[0]);
  const [name, setName] = useState("");
  const [adm, setAdm] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/public-config").then((r) => r.json()).then((d) => setWa(d.whatsapp || "")).catch(() => {});
  }, []);

  // A small "Need help?" bubble pops up once, a few seconds after the page loads.
  useEffect(() => {
    if (!wa) return;
    let seen = false;
    try { seen = sessionStorage.getItem("chat-teaser") === "1"; } catch {}
    if (seen) return;
    const on = setTimeout(() => setTeaser(true), 4000);
    const off = setTimeout(() => setTeaser(false), 12000);
    return () => { clearTimeout(on); clearTimeout(off); };
  }, [wa]);

  if (!wa) return null;

  function dismissTeaser() {
    setTeaser(false);
    try { sessionStorage.setItem("chat-teaser", "1"); } catch {}
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const who = name.trim() ? `${name.trim()}${adm.trim() ? ` (${adm.trim().toUpperCase()})` : ""}` : "a trainee";
    const text = `Hello ILO, this is ${who} from Rangwe TVC.\nTopic: ${topic}\n${msg.trim()}`;
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    setOpen(false);
    setMsg("");
  }

  const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200";

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 print:hidden">
      {open && (
        <form onSubmit={send} className="chat-pop w-[min(21rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
          <div className="flex items-center justify-between bg-green-600 px-4 py-3 text-white">
            <div>
              <p className="font-semibold leading-tight">Chat with the ILO</p>
              <p className="text-xs text-green-100">Your message opens in WhatsApp</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="rounded-full p-1 text-xl leading-none hover:bg-green-700">×</button>
          </div>
          <div className="space-y-3 p-4">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Topic">
              {TOPICS.map((t) => (
                <button key={t} type="button" role="radio" aria-checked={t === topic} onClick={() => setTopic(t)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${t === topic ? "border-green-600 bg-green-600 text-white" : "border-slate-300 text-slate-600"}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className={field} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
              <input className={`${field} uppercase`} placeholder="Admission no." value={adm} onChange={(e) => setAdm(e.target.value)} maxLength={30} />
            </div>
            <textarea className={field} rows={3} required placeholder="Type your message..." value={msg}
              onChange={(e) => setMsg(e.target.value)} maxLength={500} />
            <button className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700">
              Send on WhatsApp
            </button>
          </div>
        </form>
      )}

      {!open && teaser && (
        <button onClick={() => { dismissTeaser(); setOpen(true); }}
          className="chat-pop rounded-2xl rounded-br-sm bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-lg ring-1 ring-slate-200">
          Need help? Chat with the ILO 👋
        </button>
      )}

      <button onClick={() => { dismissTeaser(); setOpen((o) => !o); }} aria-label={open ? "Close chat" : "Chat with the ILO on WhatsApp"}
        className="relative grid h-14 w-14 place-items-center rounded-full bg-green-600 text-white shadow-xl hover:bg-green-700">
        {!open && <span className="chat-ring absolute inset-0 animate-ping rounded-full bg-green-500 opacity-40" aria-hidden="true" />}
        <svg viewBox="0 0 24 24" className={`relative h-7 w-7 fill-current ${open ? "" : "chat-wiggle"}`} aria-hidden="true">
          {open
            ? <path d="M18.3 5.7a1 1 0 0 0-1.4 0L12 10.6 7.1 5.7a1 1 0 0 0-1.4 1.4L10.6 12l-4.9 4.9a1 1 0 1 0 1.4 1.4L12 13.4l4.9 4.9a1 1 0 0 0 1.4-1.4L13.4 12l4.9-4.9a1 1 0 0 0 0-1.4z" />
            : <path d="M12 2C6.5 2 2 6 2 11c0 2.4 1 4.5 2.7 6.1L4 22l4.6-2.2c1 .3 2.2.4 3.4.4 5.5 0 10-4 10-9S17.5 2 12 2zm-4 10.5a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm4 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm4 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6z" />}
        </svg>
      </button>
    </div>
  );
}
