import Link from "next/link";
import { ArrowRight, Braces, Cable, FileText, GitPullRequest, ImagePlus, ShieldCheck, Sparkles } from "lucide-react";

const items = [
  { title: "Code", eyebrow: "AVAILABLE NOW", description: "Switch to Code mode to generate, explain, review, and debug code with implementation-focused responses.", href: "/chat", icon: Braces, action: "Open Code workspace", ready: true },
  { title: "GitHub engineering", eyebrow: "AI PATCH · HUMAN APPROVAL", description: "Inspect an authorized repository, generate a bounded AI patch, review and edit each file, then publish a new branch and draft pull request.", href: "/studio/github-engine", icon: GitPullRequest, action: "Open engineering workspace", ready: true },
  { title: "Documents & files", eyebrow: "LOCAL DRAFT · EXPORT", description: "Draft and edit documents, track word counts, and export Markdown or plain text files. This first version does not save drafts to your account.", href: "/studio/documents", icon: FileText, action: "Open document workspace", ready: true },
  { title: "Image creation", eyebrow: "PROVIDER SETUP REQUIRED", description: "Create original images from text prompts, choose canvas orientation, and download generated results. Requires an administrator-configured image provider key.", href: "/studio/create", icon: ImagePlus, action: "Open image studio", ready: true },
  { title: "Connectors & plugins", eyebrow: "PLUGIN WORKSPACE AVAILABLE", description: "Explore the connector catalog, review permissions, and run built-in text utilities. GitHub, Drive, and Slack are listed with setup requirements until OAuth is configured.", href: "/studio/connect", icon: Cable, action: "Open Connect marketplace", ready: true },
  { title: "Capability status", eyebrow: "LIVE CONFIGURATION", description: "See which capabilities are available, need configuration, or are still planned. Status is based on the current server-side registry.", href: "/studio/capabilities", icon: ShieldCheck, action: "View capability status", ready: true },
];

export default function StudioPage() {
  return <main className="min-h-screen bg-[#080b12] px-4 py-8 text-white sm:px-8">
    <div className="mx-auto max-w-6xl">
      <Link href="/chat" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"><ArrowRight size={16} className="rotate-180"/> Back to chat</Link>
      <header className="mb-10 mt-8 max-w-3xl">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-teal-300/20 bg-teal-300/10 text-teal-200"><Sparkles size={21}/></div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-200">SAMURA Studio</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">One workspace. More ways to create.</h1>
        <p className="mt-4 text-sm leading-7 text-slate-400">Build with code, create visual assets, draft documents, and connect the tools you trust. Each capability is explicit about what is active and what still needs configuration.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map(item => { const Icon = item.icon; return <article key={item.title} className="flex min-h-[300px] flex-col rounded-3xl border border-white/10 bg-white/[0.035] p-6 transition hover:border-teal-200/25">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-teal-200"><Icon size={21}/></div>
          <p className="text-[10px] font-bold tracking-[0.18em] text-teal-200">{item.eyebrow}</p>
          <h2 className="mt-2 text-xl font-semibold">{item.title}</h2>
          <p className="mt-3 flex-1 text-sm leading-6 text-slate-400">{item.description}</p>
          <Link href={item.href} className="mt-6 inline-flex items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-teal-200/30 hover:bg-white/[0.035]">{item.action}<ArrowRight size={16}/></Link>
        </article>; })}
      </div>

    </div>
  </main>;
}
