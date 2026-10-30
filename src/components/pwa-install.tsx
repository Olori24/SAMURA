"use client";
import { useEffect, useRef, useState } from "react";
import { Download, Smartphone, ExternalLink } from "lucide-react";
import posthog from "posthog-js";
import { authClient } from "@/lib/auth-client";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }> };

export default function PwaInstall() {
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const previousUserId = useRef<string | null | undefined>(undefined);
  const [promptEvent, setPromptEvent] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [android, setAndroid] = useState(false);
  const [help, setHelp] = useState(false);
  const [chromeIntent, setChromeIntent] = useState("");

  useEffect(() => {
    if (isSessionPending) return;

    const user = session?.user;
    const userId = user?.id ?? null;

    if (previousUserId.current === userId) return;

    if (previousUserId.current && !userId) {
      posthog.reset();
    } else if (user && userId) {
      if (previousUserId.current && previousUserId.current !== userId) {
        posthog.reset();
      }
      posthog.identify(userId, {
        ...(user.email ? { email: user.email } : {}),
        ...(user.name ? { name: user.name } : {}),
      });
    }

    previousUserId.current = userId;
  }, [isSessionPending, session?.user]);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isAndroid = /android/i.test(navigator.userAgent);

    // Browser-only capabilities must be read after hydration; this one-time
    // client sync initializes the install guidance from the actual device.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInstalled(standalone);
    setIos(isIos);
    setAndroid(isAndroid);
    setChromeIntent(`intent://${window.location.host}${window.location.pathname}#Intent;scheme=https;package=com.android.chrome;end`);

    const capture = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPrompt);
    };
    const done = () => {
      setInstalled(true);
      setPromptEvent(null);
      setHelp(false);
    };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", done);
    if ("serviceWorker" in navigator && window.location.protocol === "https:") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", done);
    };
  }, []);

  if (installed) {
    return <span className="inline-flex items-center gap-2 text-sm text-[var(--accent)]"><Smartphone size={16} /> SAMURA app installed</span>;
  }

  async function install() {
    if (promptEvent) {
      await promptEvent.prompt();
      const result = await promptEvent.userChoice;
      if (result.outcome === "accepted") {
        setPromptEvent(null);
        setHelp(false);
      }
      return;
    }
    setHelp(value => !value);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button onClick={install} className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--accent)]/40 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/10" aria-label="Install SAMURA AI app">
        <Download size={17} /> {promptEvent ? "Install SAMURA AI" : "Install app"}
      </button>
      {help && (
        <div role="status" className="max-w-xs space-y-2 rounded-xl border border-white/10 bg-[#080b12] p-3 text-center text-xs leading-5 text-slate-300 shadow-xl">
          {ios ? (
            <p>On iPhone or iPad: tap Share, then choose <strong>Add to Home Screen</strong>.</p>
          ) : (
            <p>To install SAMURA as an app, open this page in <strong>Google Chrome</strong>, then tap the browser menu (⋮) and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>
          )}
          {android && (
            <a href={chromeIntent} className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 font-semibold text-[#07120e]">
              <ExternalLink size={14} /> Open in Chrome
            </a>
          )}
          <p className="text-slate-500">This installs the web app from this link; no APK download is required.</p>
        </div>
      )}
    </div>
  );
}
