"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, ImagePlus, LoaderCircle, Sparkles } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";

export default function CreatePage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function generate(event: FormEvent) {
    event.preventDefault();
    setError("");
    setImage("");
    setBusy(true);
    try {
      const response = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, size }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) { router.replace("/login"); return; }
      if (!response.ok) throw new Error(data.error ?? "Could not generate the image.");
      setImage(data.image);
      posthog.capture("image_generated", { image_size: size });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate the image.");
    } finally {
      setBusy(false);
    }
  }

  if (isPending) return <main className="grid min-h-screen place-items-center bg-[#080b12] text-slate-400">Loading your workspace…</main>;
  if (!session?.user) { router.replace("/login"); return null; }

  return <main className="min-h-screen bg-[#080b12] px-4 py-8 text-white sm:px-8">
    <div className="mx-auto max-w-5xl">
      <Link href="/chat" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"><ArrowLeft size={16}/> Back to SAMURA</Link>
      <header className="mb-8 mt-8">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-teal-300/20 bg-teal-300/10 text-teal-200"><ImagePlus size={21}/></div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-200">SAMURA Studio</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Turn a prompt into an image.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Describe the scene, visual style, lighting, and composition. Your image request is processed server-side; provider credentials are never sent to the browser.</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <form onSubmit={generate} className="h-fit rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
          <label htmlFor="prompt" className="mb-2 block text-sm font-medium text-slate-200">Describe your image</label>
          <textarea id="prompt" value={prompt} onChange={e=>setPrompt(e.target.value)} maxLength={2000} minLength={3} required rows={7} placeholder="A cinematic editorial portrait in a warmly lit modern studio, rich shadows, realistic skin texture, 35mm photography…" className="w-full resize-y rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-teal-200/50"/>
          <div className="mt-4">
            <label htmlFor="size" className="mb-2 block text-sm font-medium text-slate-200">Canvas</label>
            <select id="size" value={size} onChange={e=>setSize(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#111722] px-3 py-3 text-sm text-white outline-none focus:border-teal-200/50">
              <option value="1024x1024">Square · 1024 × 1024</option>
              <option value="1536x1024">Landscape · 1536 × 1024</option>
              <option value="1024x1536">Portrait · 1024 × 1536</option>
            </select>
          </div>
          {error && <p role="alert" className="mt-4 rounded-xl border border-amber-200/15 bg-amber-200/[0.05] p-3 text-sm leading-5 text-amber-100">{error}</p>}
          <button type="submit" disabled={busy || prompt.trim().length < 3} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-200 px-4 py-3 text-sm font-bold text-[#07120e] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">
            {busy ? <><LoaderCircle size={16} className="animate-spin"/> Creating image…</> : <><Sparkles size={16}/> Generate image</>}
          </button>
          <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">Image generation requires an administrator-configured provider key and may incur usage costs.</p>
        </form>
        <section aria-label="Generated image" className="flex min-h-[360px] items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025] p-4 sm:min-h-[520px]">
          {image ? <div className="w-full"><img src={image} alt={prompt} className="mx-auto max-h-[720px] w-full rounded-2xl object-contain"/><a href={image} download="samura-generated-image.png" className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white transition hover:bg-white/5"><Download size={16}/> Download image</a></div> : <div className="max-w-xs text-center"><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-400"><ImagePlus size={24}/></div><h2 className="text-sm font-semibold text-slate-200">Your canvas is ready</h2><p className="mt-2 text-sm leading-6 text-slate-500">The generated image will appear here. Start with a clear subject, then add style, lighting, and framing.</p></div>}
        </section>
      </div>
    </div>
  </main>;
}
