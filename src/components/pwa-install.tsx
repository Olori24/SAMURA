"use client";
import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }> };

export default function PwaInstall() {
  const [promptEvent, setPromptEvent] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & {standalone?: boolean}).standalone === true;
    setInstalled(isStandalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const capture = (event: Event) => { event.preventDefault(); setPromptEvent(event as InstallPrompt); };
    const done = () => { setInstalled(true); setPromptEvent(null); };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", done);
    if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => { window.removeEventListener("beforeinstallprompt", capture); window.removeEventListener("appinstalled", done); };
  }, []);
  if (installed) return <span className="inline-flex items-center gap-2 text-sm text-[var(--accent)]"><Smartphone size={16}/> App installed</span>;
  async function install() {
    if (promptEvent) { await promptEvent.prompt(); const result = await promptEvent.userChoice; if (result.outcome === "accepted") setPromptEvent(null); }
    else setHelp(v => !v);
  }
  return <div className="flex flex-col items-center gap-2">
    <button onClick={install} className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--accent)]/40 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/10" aria-label="Install SAMURA AI app"><Download size={17}/>{promptEvent ? "Install SAMURA AI" : "Get the app"}</button>
    {help && <p role="status" className="max-w-sm text-center text-xs leading-5 text-slate-400">{ios ? "On iPhone/iPad: tap Share, then Add to Home Screen." : "If installation isn't offered yet, open your browser menu and choose Install app or Add to Home screen. Use HTTPS and open this page directly in your browser."}</p>}
  </div>;
}
