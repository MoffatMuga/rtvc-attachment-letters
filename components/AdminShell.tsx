"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const I = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const NAV = [
  { href: "/admin", label: "Attachment requests", icon: I("M21 12.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l9-9a3.7 3.7 0 0 1 5.2 5.2l-9 9a1.8 1.8 0 0 1-2.6-2.6l8.3-8.3") },
  { href: "/admin/trainees", label: "Trainees & assessors", icon: I("M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8") },
  { href: "/admin/duelist", label: "Due list", icon: I("M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01") },
  { href: "/admin/insurance", label: "Insurance letters", icon: I("M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z") },
  { href: "/admin/feedback", label: "Feedback", icon: I("M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z") },
  { href: "/admin/settings", label: "Stamp & signature", icon: I("M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z") },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);

  const check = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/me", { cache: "no-store" });
      setAuthed(r.ok);
    } catch { setAuthed(false); }
  }, []);

  useEffect(() => { check(); }, [check, path]);
  useEffect(() => {
    window.addEventListener("admin-auth", check);
    return () => window.removeEventListener("admin-auth", check);
  }, [check]);
  useEffect(() => { setOpen(false); }, [path]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
    window.location.href = "/admin"; // back to the sign-in page
  }

  // Signed out (or still checking): show only the page, which has its own sign-in.
  if (!authed) return <>{children}</>;

  const active = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

  const panel = (
    <div className="flex h-full flex-col bg-[#0b2a6b] text-white">
      <div className="flex flex-col items-center px-4 pt-6 pb-4 text-center">
        <img src="/assets/logo.png" alt="Rangwe TVC logo" className="h-14 w-auto rounded-lg bg-white p-1.5" />
        <p className="mt-3 text-xl font-bold leading-tight">ILO <span className="text-amber-400">Connect</span></p>
        <p className="text-xs text-blue-200">Industrial Liaison Office</p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV.map((n) => (
          <a key={n.href} href={n.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] transition-colors ${active(n.href) ? "bg-blue-600 font-semibold shadow" : "text-blue-100 hover:bg-white/10"}`}>
            {n.icon}{n.label}
          </a>
        ))}
      </nav>
      <div className="m-3 rounded-2xl bg-white/10 p-4 text-center text-sm">
        <p className="font-semibold">Rangwe TVC</p>
        <p className="text-xs text-blue-200">Placing trainees, one letter at a time</p>
        <button onClick={logout} className="mt-3 w-full rounded-lg bg-white/15 px-3 py-2 text-sm font-medium hover:bg-white/25">Sign out</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{panel}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="admin-drawer absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl">{panel}</aside>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-2 hover:bg-slate-100">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <p className="font-bold text-blue-950">ILO <span className="text-amber-500">Connect</span></p>
        <span className="w-10" />
      </header>

      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col lg:min-h-screen">{children}</div>
    </div>
  );
}
