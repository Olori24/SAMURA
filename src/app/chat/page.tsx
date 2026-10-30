"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AudioWaveform, ChevronLeft, LoaderCircle, LogOut, Menu, MessageSquarePlus, Mic, MicOff, Send, Square, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type Conversation = { id: string; title: string; createdAt: string; updatedAt: string };
type Message = { id: string; role: "user" | "assistant"; content: string; status?: string; createdAt?: string };
type SpeechRecognitionResultLike = { isFinal: boolean; [index: number]: { transcript: string } };
type SpeechRecognitionEventLike = { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionErrorEventLike = { error: string };
type SpeechRecognitionLike = {
  lang: string; interimResults: boolean; continuous: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null; start: () => void; stop: () => void;
};

export default function ChatPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"chat" | "code">("chat");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceStarting, setVoiceStarting] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const speechRef = useRef<SpeechRecognitionLike | null>(null);
  const speechTextRef = useRef("");
  const voiceStartingRef = useRef(false);
  const voiceSessionRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    const response = await fetch("/api/conversations", { cache: "no-store" });
    if (response.status === 401) { router.replace("/login"); return []; }
    if (!response.ok) throw new Error("Could not load your conversation history.");
    const data = await response.json();
    setConversations(data.conversations);
    return data.conversations as Conversation[];
  }, [router]);

  const openConversation = useCallback(async (id: string) => {
    setError(""); setActiveId(id); setSidebarOpen(false); setMessages([]);
    const response = await fetch("/api/conversations/" + id, { cache: "no-store" });
    if (!response.ok) { setError(response.status === 404 ? "That conversation could not be found." : "Could not restore this conversation."); return; }
    const data = await response.json();
    setMessages(data.messages);
  }, []);

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) { router.replace("/login"); return; }
    let cancelled = false;
    (async () => {
      try {
        const rows = await loadConversations();
        if (!cancelled && rows.length) await openConversation(rows[0].id);
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load history."); }
      finally { if (!cancelled) setLoadingHistory(false); }
    })();
    return () => { cancelled = true; };
  }, [session, isPending, router, loadConversations, openConversation]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: streaming ? "auto" : "smooth" }); }, [messages, streaming]);

  useEffect(() => () => {
    voiceSessionRef.current += 1;
    voiceStartingRef.current = false;
    speechRef.current?.stop();
    speechRef.current = null;
  }, []);

  async function newConversation() {
    setError(""); setMessages([]); setActiveId(""); setSidebarOpen(false);
    try {
      const response = await fetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (!response.ok) { const data = await response.json().catch(()=>({})); throw new Error(data.error ?? "Could not create a conversation."); }
      const data = await response.json();
      setActiveId(data.conversation.id);
      setConversations(prev => [data.conversation, ...prev.filter(c => c.id !== data.conversation.id)]);
    } catch(e) { setError(e instanceof Error ? e.message : "Could not create a conversation."); }
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || streaming) return;
    setError("");
    let conversationId = activeId;
    if (!conversationId) {
      try {
        const created = await fetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        if (!created.ok) throw new Error("Could not create a conversation.");
        const data = await created.json(); conversationId = data.conversation.id; setActiveId(conversationId);
        setConversations(prev => [data.conversation, ...prev]);
      } catch(e) { setError(e instanceof Error ? e.message : "Could not create a conversation."); return; }
    }
    const requestId = crypto.randomUUID();
    setDraft("");
    setMessages(prev => [...prev, { id: requestId, role: "user", content: text }, { id: "assistant-" + requestId, role: "assistant", content: "", status: "streaming" }]);
    setStreaming(true);
    const controller = new AbortController(); abortRef.current = controller;
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId, message: text, requestId, mode }), signal: controller.signal });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "The response could not be generated.");
      }
      if (!response.body) throw new Error("Streaming is unavailable in this browser.");
      const reader = response.body.getReader(); const decoder = new TextDecoder();
      let received = ""; let buffer = ""; let streamFailed = false;
      const consumeEvent = (raw: string) => {
        const line = raw.split("\n").find(item => item.startsWith("data: "));
        if (!line) return;
        try {
          const event = JSON.parse(line.slice(6)) as { type: string; text?: string; message?: string; status?: string };
          if (event.type === "delta" && typeof event.text === "string") {
            received += event.text;
            setMessages(prev => prev.map(m => m.id === "assistant-" + requestId ? { ...m, content: received } : m));
          } else if (event.type === "error") {
            streamFailed = true; setError(event.message ?? "Generation stopped unexpectedly.");
          } else if (event.type === "done" && event.status !== "complete") {
            streamFailed = event.status !== "cancelled";
          }
        } catch { streamFailed = true; setError("Received an invalid streaming response. Refresh the conversation."); }
      };
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n"); buffer = events.pop() ?? "";
        events.forEach(consumeEvent);
      }
      buffer += decoder.decode();
      if (buffer.trim()) consumeEvent(buffer);
      setMessages(prev => prev.map(m => m.id === "assistant-" + requestId ? { ...m, content: received, status: received ? (streamFailed ? "partial" : "complete") : "failed" } : m));
      if (!received && !streamFailed) setError("The model returned an empty response. You can try again.");
      await loadConversations();
    } catch(e) {
      const stopped = e instanceof DOMException && e.name === "AbortError";
      setMessages(prev => prev.map(m => m.id === "assistant-" + requestId ? { ...m, status: stopped ? "stopped" : "failed", content: m.content } : m));
      if (!stopped) setError(e instanceof Error ? e.message : "Network error. Please try again.");
    } finally { setStreaming(false); abortRef.current = null; }
  }

  function toggleVoiceInput() {
    if (voiceListening) {
      speechRef.current?.stop();
      return;
    }
    if (voiceStartingRef.current || speechRef.current || streaming) return;
    if (!window.isSecureContext) {
      setError("Voice typing requires a secure HTTPS connection.");
      return;
    }
    const speechWindow = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Voice typing is not supported by this browser. Try the latest Chrome browser.");
      return;
    }
    setError("");
    voiceStartingRef.current = true;
    setVoiceStarting(true);
    const sessionId = ++voiceSessionRef.current;
    try {
      const recognition = new Recognition();
      recognition.lang = navigator.language || "en-NG";
      recognition.interimResults = false;
      recognition.continuous = false;
      speechTextRef.current = "";
      recognition.onstart = () => {
        if (voiceSessionRef.current !== sessionId || speechRef.current !== recognition) return;
        voiceStartingRef.current = false;
        setVoiceStarting(false);
        setVoiceListening(true);
      };
      recognition.onresult = event => {
        if (voiceSessionRef.current !== sessionId || speechRef.current !== recognition) return;
        const parts: string[] = [];
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          if (event.results[index].isFinal) parts.push(event.results[index][0].transcript.trim());
        }
        speechTextRef.current = parts.filter(Boolean).join(" ");
      };
      recognition.onerror = event => {
        if (voiceSessionRef.current !== sessionId || speechRef.current !== recognition) return;
        const transcript = speechTextRef.current.trim();
        if (transcript) setDraft(current => [current.trim(), transcript].filter(Boolean).join(" "));
        voiceStartingRef.current = false;
        setVoiceStarting(false);
        setVoiceListening(false);
        speechRef.current = null;
        const messages: Record<string, string> = {
          "not-allowed": "Microphone or speech-recognition access was denied. Allow microphone access for this site.",
          "service-not-allowed": "Your browser or device is blocking its speech-recognition service. Try Chrome with an active internet connection.",
          "audio-capture": "No usable microphone input was found. Check your microphone and close apps that may be using it.",
          "network": "The browser's speech-recognition service could not connect. Check your internet connection.",
          "no-speech": "No speech was detected. Tap the microphone and speak after listening starts.",
          "language-not-supported": "The speech service does not support your device's selected language.",
          "aborted": "Voice typing was stopped before recognition completed."
        };
        setError(messages[event.error] ?? "Voice typing failed. Check your browser microphone and speech settings.");
      };
      recognition.onend = () => {
        if (voiceSessionRef.current !== sessionId || speechRef.current !== recognition) return;
        const transcript = speechTextRef.current.trim();
        if (transcript) setDraft(current => [current.trim(), transcript].filter(Boolean).join(" "));
        setVoiceListening(false);
        voiceStartingRef.current = false;
        setVoiceStarting(false);
        speechRef.current = null;
      };
      speechRef.current = recognition;
      recognition.start();
    } catch (cause) {
      if (voiceSessionRef.current !== sessionId) return;
      voiceStartingRef.current = false;
      setVoiceStarting(false);
      setVoiceListening(false);
      speechRef.current = null;
      setError(cause instanceof DOMException && cause.name === "NotAllowedError"
        ? "Microphone permission was denied. Allow microphone access for SAMURA in your browser settings."
        : "Could not start voice typing. Check microphone access and try again.");
    }
  }

  function handleComposerKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); }
  }

  async function signOut() { abortRef.current?.abort(); await authClient.signOut(); router.replace("/login"); router.refresh(); }

  if (isPending || loadingHistory) return <main className="grid min-h-screen place-items-center text-slate-400"><span className="flex items-center gap-3"><LoaderCircle className="animate-spin" size={20}/>Opening your SAMURA workspace…</span></main>;

  return <main className="flex h-dvh min-h-[520px] overflow-hidden">
    {sidebarOpen && <button aria-label="Close navigation overlay" onClick={()=>setSidebarOpen(false)} className="fixed inset-0 z-20 bg-black/60 md:hidden"/>}
    <aside className={(sidebarOpen ? "translate-x-0" : "-translate-x-full") + " fixed inset-y-0 left-0 z-30 flex w-[285px] flex-col border-r border-white/10 bg-[#0b0f18] p-4 transition-transform md:static md:z-auto md:translate-x-0"}>
      <div className="flex items-center justify-between px-2 py-2"><Link href="/" className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-[var(--accent)]"><AudioWaveform size={20}/></span><span className="font-[family-name:var(--font-space)] tracking-[0.16em]">SAMURA</span></Link><button aria-label="Close sidebar" onClick={()=>setSidebarOpen(false)} className="md:hidden"><X size={18}/></button></div>
      <button onClick={newConversation} className="mt-7 flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-200 transition hover:border-[var(--accent)]/40 hover:bg-white/[0.04]"><MessageSquarePlus size={17} className="text-[var(--accent)]"/> New conversation</button>
      <p className="mb-3 mt-8 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Recent conversations</p>
      <nav className="flex-1 space-y-1 overflow-y-auto">{conversations.map(c=><button key={c.id} onClick={()=>void openConversation(c.id)} className={"w-full truncate rounded-xl px-3 py-3 text-left text-sm transition " + (activeId===c.id ? "bg-white/[0.08] text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200")}>{c.title}</button>)}{!conversations.length && <p className="px-3 py-2 text-xs leading-5 text-slate-600">Your conversations will appear here.</p>}</nav>
      <div className="border-t border-white/10 pt-3"><div className="mb-3 truncate px-2 text-xs text-slate-500">{session?.user?.email}</div><button onClick={()=>void signOut()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:bg-white/[0.05] hover:text-white"><LogOut size={16}/> Sign out</button></div>
    </aside>
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-[65px] shrink-0 items-center justify-between border-b border-white/[0.08] px-4 sm:px-6"><div className="flex items-center gap-3"><button aria-label="Open navigation" onClick={()=>setSidebarOpen(true)} className="rounded-lg p-2 hover:bg-white/[0.06] md:hidden"><Menu size={19}/></button><div><p className="text-sm font-semibold">SAMURA Chat</p><p className="text-[11px] text-slate-500">Your private intelligence workspace</p></div></div><div className="flex items-center gap-1"><Link href="/studio" className="rounded-xl px-3 py-2 text-xs text-[var(--accent)] hover:bg-white/[0.06]">Studio</Link><button onClick={()=>void newConversation()} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-400 hover:bg-white/[0.06] hover:text-white"><ChevronLeft className="hidden sm:block" size={15}/> New chat</button></div></header>
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-5 py-12"><div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/[0.07] text-[var(--accent)]"><Sparkles size={23}/></div><p className="text-xs font-bold uppercase tracking-[0.23em] text-[var(--accent)]">Your thinking space</p><h1 className="mt-3 font-[family-name:var(--font-space)] text-4xl tracking-tight sm:text-5xl">What are we working<br className="hidden sm:block"/> on today?</h1><p className="mt-5 max-w-lg text-sm leading-7 text-[var(--muted)]">Ask a question, explore an idea, or work through a challenge. Your conversations are saved to your account.</p><div className="mt-8 grid gap-3 sm:grid-cols-2">{["Help me turn an idea into a practical plan","Explain a complex topic in simple language","Review this code and help me debug it","Help me research a new business opportunity"].map(s=><button key={s} onClick={()=>setDraft(s)} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-left text-sm text-slate-300 transition hover:border-[var(--accent)]/30 hover:bg-white/[0.045]">{s}<span className="mt-2 block text-xs text-slate-600">Use this prompt ↗</span></button>)}</div></div> :
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">{messages.map(m=><article key={m.id} className="mb-8 flex gap-3 sm:gap-4"><div className={"mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl " + (m.role==="assistant" ? "bg-[var(--accent)]/10 text-[var(--accent)]" : "bg-white/10 text-slate-300")}>{m.role==="assistant" ? <AudioWaveform size={17}/> : <span className="text-xs font-bold">YOU</span>}</div><div className="min-w-0 flex-1 pt-1"><p className="mb-2 text-xs font-semibold text-slate-400">{m.role==="assistant" ? "SAMURA" : "You"}</p>{m.content ? <div className="prose prose-invert prose-sm max-w-none break-words leading-7 prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:border prose-pre:border-white/10 prose-pre:bg-black/30 prose-code:text-[var(--accent)] prose-a:text-[var(--accent)]"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div> : <span className="inline-flex items-center gap-2 text-sm text-slate-500"><LoaderCircle size={15} className="animate-spin"/>Thinking…</span>}{m.status==="failed" && <div className="mt-2 flex items-center gap-3 text-xs text-amber-300"><span>This response did not finish.</span><button onClick={() => { const previousUser = messages.slice(0, messages.indexOf(m)).reverse().find(item => item.role === "user"); if (previousUser) setDraft(previousUser.content); }} className="underline underline-offset-2 hover:text-white">Retry in composer</button></div>}{m.status==="stopped" && <p className="mt-2 text-xs text-slate-500">Generation stopped.</p>}</div></article>)}<div ref={bottomRef}/></div>}
      </div>
      <div className="shrink-0 px-3 pb-3 pt-2 sm:px-6 sm:pb-5"><div className="mx-auto max-w-3xl">{error && <div role="alert" className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100"><span>{error}</span><button aria-label="Dismiss error" onClick={()=>setError("")}><X size={16}/></button></div>}<form onSubmit={sendMessage} className="rounded-2xl border border-white/15 bg-[#111722] p-2 shadow-xl focus-within:border-[var(--accent)]/40"><div className="flex items-center gap-2 px-2 pb-2"><button type="button" onClick={()=>setMode("chat")} aria-pressed={mode === "chat"} className={"rounded-lg px-3 py-1.5 text-xs transition " + (mode === "chat" ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "text-slate-400 hover:bg-white/[0.05]")}>Chat</button><button type="button" onClick={()=>setMode("code")} aria-pressed={mode === "code"} className={"rounded-lg px-3 py-1.5 text-xs transition " + (mode === "code" ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "text-slate-400 hover:bg-white/[0.05]")}>Code</button><span className="ml-auto text-[10px] text-slate-600">{mode === "code" ? "Code-focused responses" : "General assistant"}</span></div><textarea value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={handleComposerKey} disabled={streaming} rows={2} maxLength={12000} placeholder={mode === "code" ? "Describe what you want to build or debug…" : "Message SAMURA…"} className="max-h-40 min-h-[54px] w-full resize-y bg-transparent px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-slate-600 disabled:opacity-60" /><div className="flex items-center justify-between px-2 pb-1"><span className="text-[10px] text-slate-600">Enter to send · Shift + Enter for a new line</span>{voiceListening ? <button type="button" aria-label="Stop voice typing" onClick={()=>speechRef.current?.stop()} className="flex items-center gap-2 rounded-xl border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs text-rose-200"><MicOff size={14}/> Listening</button> : <button type="button" disabled={streaming || voiceStarting} aria-label="Start voice typing" onClick={()=>toggleVoiceInput()} className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.06] disabled:opacity-30"><Mic size={14}/> {voiceStarting ? "Starting…" : "Voice"}</button>}{streaming ? <button type="button" onClick={()=>abortRef.current?.abort()} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/15"><Square size={13}/> Stop</button> : <button disabled={!draft.trim()} className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-bold text-[#07120e] transition hover:bg-white disabled:opacity-30"><Send size={14}/> Send</button>}</div></form><p className="mt-2 text-center text-[10px] leading-4 text-slate-600">AI can make mistakes. Verify important information. Provider usage may incur costs.</p></div></div>
    </section>
  </main>;
}
