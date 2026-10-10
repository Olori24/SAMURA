import { ArrowUpRight, AudioWaveform, BrainCircuit, CheckCircle2, Code2, Compass, ShieldCheck, Sparkles } from "lucide-react";

const capabilities = [
  { icon: BrainCircuit, title: "One thoughtful conversation", text: "A clear, focused space for questions, ideas, and work that matters." },
  { icon: Compass, title: "Intelligence that can grow", text: "A modular foundation for multiple providers, tools, and future models." },
  { icon: ShieldCheck, title: "Trust is part of the product", text: "Transparent model identity, careful permissions, and user-controlled context." },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
        <a href="/" className="flex items-center gap-3" aria-label="SAMURA AI home">
          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-[var(--accent)]"><AudioWaveform size={21} /></span>
          <span><strong className="block font-[family-name:var(--font-space)] text-lg tracking-[0.2em]">SAMURA</strong><span className="block text-[10px] uppercase tracking-[0.28em] text-[var(--muted)]">Artificial Intelligence</span></span>
        </a>
        <a href="#vision" className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-white/25 hover:text-white">Our vision <ArrowUpRight className="ml-1 inline" size={14} /></a>
      </header>

      <section className="relative mx-auto flex max-w-7xl flex-col items-center px-5 pb-24 pt-20 text-center sm:px-8 sm:pt-28">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/20 bg-[var(--accent)]/[0.06] px-4 py-2 text-xs font-medium tracking-wide text-[var(--accent)]"><Sparkles size={14} /> An independent intelligence initiative</div>
        <h1 className="max-w-4xl font-[family-name:var(--font-space)] text-5xl font-medium leading-[1.06] tracking-[-0.055em] sm:text-7xl lg:text-8xl">Intelligence for<br /><span className="text-[var(--accent)]">what comes next.</span></h1>
        <p className="mt-7 max-w-2xl text-base leading-8 text-[var(--muted)] sm:text-lg">SAMURA is building toward a more capable, transparent, and useful AI platform — grounded in thoughtful engineering and a commitment to earn trust.</p>
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <a href="#vision" className="rounded-full bg-[var(--accent)] px-6 py-3.5 text-sm font-bold text-[#07120e] transition hover:bg-white">Explore the vision <ArrowUpRight className="ml-2 inline" size={16} /></a>
          <span className="px-4 py-3 text-sm text-slate-400">Built incrementally. Verified honestly.</span>
        </div>
        <div className="mt-20 grid w-full max-w-4xl grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[0.025] py-6">
          {[["01", "Useful first"], ["02", "Trust by design"], ["03", "Research-led"]].map(([n, label]) => <div key={n} className="px-2 sm:px-5"><span className="block font-[family-name:var(--font-space)] text-2xl text-[var(--accent)]">{n}</span><span className="mt-1 block text-[10px] text-slate-400 sm:text-sm">{label}</span></div>)}
        </div>
      </section>

      <section id="vision" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="mb-12 max-w-xl"><p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--accent)]">The foundation</p><h2 className="mt-4 font-[family-name:var(--font-space)] text-3xl tracking-tight sm:text-5xl">More than a model.<br />A system worth trusting.</h2><p className="mt-5 leading-7 text-[var(--muted)]">The ambition is long-term. The work starts with a dependable product, honest measurement, and a foundation that can evolve.</p></div>
        <div className="grid gap-4 md:grid-cols-3">{capabilities.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-3xl border border-white/10 bg-[var(--surface)] p-7 transition hover:-translate-y-1 hover:border-[var(--accent)]/30"><span className="mb-8 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]"><Icon size={23} /></span><h3 className="text-lg font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{text}</p></article>)}</div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8"><div className="flex flex-col justify-between gap-6 rounded-3xl border border-white/10 bg-gradient-to-br from-[#14251f] to-[var(--surface)] p-8 sm:flex-row sm:items-center sm:p-12"><div><p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--accent)]">The work ahead</p><h2 className="mt-3 max-w-2xl font-[family-name:var(--font-space)] text-2xl sm:text-3xl">Start with a solid foundation. Prove every next step.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">SAMURA is in its foundation stage. Live chat, provider integrations, and model training will be announced only when implemented and verified.</p></div><div className="flex shrink-0 items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="text-[var(--accent)]" size={18} /> Foundation in progress</div></div></section>
      <footer className="border-t border-white/10 px-5 py-7 text-center text-xs text-slate-500">© {new Date().getFullYear()} SAMURA AI · Built with purpose, measured by proof.</footer>
    </main>
  );
}
