"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Archive, AudioWaveform, Check, ChevronLeft, Clipboard, Download, LoaderCircle, LogOut, Menu, MessageSquarePlus, Mic, MicOff, Pencil, RotateCw, Search, Send, Square, Sparkles, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type Conversation = { id: string; title: string; createdAt: string; updatedAt: string };
type Message = { id: string; role: "user" | "assistant"; content: string; status?: string; createdAt?: string };
type SpeechRecognitionResultLike = { isFinal: boolean; [index: number]: { transcript: string } };
type SpeechRecognitionEventLike = { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionErrorEventLike = { error: string; message?: string };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export default function ChatPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchResults, setSearchResults] = useState<Conversation[]>([]);
  const [conversationSearch, setConversationSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const showArchivedRef = useRef(false);
  const activeIdRef = useRef("");
  const [copiedMessageId, setCopiedMessageId] = useState("");
  const [activeId, setActiveId] = useState("");
  const [activeTitle, setActiveTitle] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [historyCursor, setHistoryCursor] = useState<{ createdAt: string; id: string } | null>(null);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"chat" | "code">("chat");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const speechRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const speechTextRef = useRef("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const conversationLoadRef = useRef(0);
  const setArchiveMode = (value: boolean) => { showArchivedRef.current = value; setShowArchived(value); };
  const olderRequestRef = useRef(0);
  const searchRequestRef = useRef(0);
  const preserveScrollRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);

  const loadConversations = useCallback(async (archived = false) => {
    const response = await fetch("/api/conversations" + (archived ? "?archived=true" : ""), { cache: "no-store" });
    if (response.status === 401) { router.replace("/login"); return []; }
    if (!response.ok) throw new Error("Could not load your conversation history.");
    const data = await response.json();
    setConversations(data.conversations);
    return data.conversations as Conversation[];
  }, [router]);

  const openConversation = useCallback(async (id: string) => {
    const loadId = ++conversationLoadRef.current;
    olderRequestRef.current += 1;
    preserveScrollRef.current = null;
    setLoadingOlderMessages(false);
    setError(""); activeIdRef.current = id; setActiveId(id); setSidebarOpen(false); setMessages([]);
    setHasOlderMessages(false); setHistoryCursor(null);
    const response = await fetch("/api/conversations/" + id, { cache: "no-store" });
    if (loadId !== conversationLoadRef.current) return;
    if (!response.ok) { setError(response.status === 404 ? "That conversation could not be found." : "Could not restore this conversation."); return; }
    const data = await response.json();
    if (loadId !== conversationLoadRef.current) return;
    setActiveTitle(data.conversation.title);
    setMessages(data.messages);
    setHasOlderMessages(Boolean(data.hasMoreMessages));
    setHistoryCursor(data.nextCursor ?? null);
  }, []);
  
  async function loadOlderMessages() {
    const conversationId = activeId;
    const cursor = historyCursor;
    if (!conversationId || !cursor || loadingOlderMessages) return;
    const loadId = conversationLoadRef.current;
    const requestId = ++olderRequestRef.current;
    const scrollContainer = messagesScrollRef.current;
    const scrollPosition = scrollContainer
      ? { scrollHeight: scrollContainer.scrollHeight, scrollTop: scrollContainer.scrollTop }
      : null;
    setLoadingOlderMessages(true);
    try {
      const params = new URLSearchParams({ before: cursor.createdAt, beforeId: cursor.id });
      const response = await fetch("/api/conversations/" + conversationId + "?" + params.toString(), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load older messages.");
      if (requestId !== olderRequestRef.current || loadId !== conversationLoadRef.current || activeId !== conversationId) return;
      preserveScrollRef.current = scrollPosition;
      setMessages(previous => [...data.messages, ...previous]);
      setHasOlderMessages(Boolean(data.hasMoreMessages));
      setHistoryCursor(data.nextCursor ?? null);
    } catch (e) {
      if (requestId === olderRequestRef.current && loadId === conversationLoadRef.current) {
        setError(e instanceof Error ? e.message : "Could not load older messages.");
      }
    } finally {
      if (requestId === olderRequestRef.current) setLoadingOlderMessages(false);
    }
  }

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

  useEffect(() => {
    const query = conversationSearch.trim();
    if (!query) {
      if (searchRequestRef.current > 0) {
        void loadConversations(showArchived).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load conversations."));
      }
      return;
    }
    const requestId = ++searchRequestRef.current;
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, archived: String(showArchived) });
        const response = await fetch("/api/conversations?" + params.toString(), { cache: "no-store" });
        if (response.status === 401) { router.replace("/login"); return; }
        if (!response.ok) throw new Error("Could not search your conversations.");
        const data = await response.json();
        if (requestId === searchRequestRef.current) setSearchResults(data.conversations);
      } catch (cause) {
        if (requestId === searchRequestRef.current) setError(cause instanceof Error ? cause.message : "Could not search your conversations.");
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      if (searchRequestRef.current === requestId) searchRequestRef.current += 1;
    };
  }, [conversationSearch, showArchived, loadConversations, router]);

  useLayoutEffect(() => {
    const container = messagesScrollRef.current;
    const previousPosition = preserveScrollRef.current;
    if (container && previousPosition) {
      preserveScrollRef.current = null;
      container.scrollTop = previousPosition.scrollTop + (container.scrollHeight - previousPosition.scrollHeight);
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: streaming ? "auto" : "smooth" });
  }, [messages, streaming]);

  useEffect(() => () => {
    speechRef.current?.stop();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  useEffect(() => { showArchivedRef.current = showArchived; }, [showArchived]);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  const visibleConversations = conversationSearch.trim() ? searchResults : conversations;

  async function renameConversation(conversation: Conversation) {
    const entered = window.prompt("Rename conversation", conversation.title);
    if (entered === null) return;
    const title = entered.trim();
    if (!title || title.length > 160) { setError("Conversation titles must contain 1 to 160 characters."); return; }
    try {
      const response = await fetch("/api/conversations/" + conversation.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not rename this conversation.");
      setConversations(previous => previous.map(item => item.id === conversation.id ? data.conversation : item));
      if (activeId === conversation.id) setActiveTitle(data.conversation.title);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not rename this conversation.");
    }
  }

  async function archiveConversation(conversation: Conversation) {
    if (!window.confirm("Archive this conversation? It will disappear from your recent list.")) return;
    try {
      const response = await fetch("/api/conversations/" + conversation.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not archive this conversation.");
      setConversations(previous => previous.filter(item => item.id !== conversation.id));
      if (activeId === conversation.id) {
        conversationLoadRef.current += 1; olderRequestRef.current += 1; preserveScrollRef.current = null; setLoadingOlderMessages(false);
        activeIdRef.current = ""; setActiveId(""); setActiveTitle(""); setMessages([]); setHasOlderMessages(false); setHistoryCursor(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not archive this conversation.");
    }
  }

  async function restoreConversation(conversation: Conversation) {
    try {
      const response = await fetch("/api/conversations/" + conversation.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not restore this conversation.");
      setConversations(previous => previous.filter(item => item.id !== conversation.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not restore this conversation.");
    }
  }

  async function deleteConversation(conversation: Conversation) {
    if (!window.confirm("Permanently delete this conversation and its messages? This cannot be undone.")) return;
    try {
      const response = await fetch("/api/conversations/" + conversation.id, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not delete this conversation.");
      setConversations(previous => previous.filter(item => item.id !== conversation.id));
      if (activeId === conversation.id) {
        conversationLoadRef.current += 1; olderRequestRef.current += 1; preserveScrollRef.current = null; setLoadingOlderMessages(false);
        activeIdRef.current = ""; setActiveId(""); setActiveTitle(""); setMessages([]); setHasOlderMessages(false); setHistoryCursor(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete this conversation.");
    }
  }

  function exportActiveConversation() {
    const title = activeTitle.trim() || "SAMURA conversation";
    if (!activeId || messages.length === 0) {
      setError("There are no messages to export yet.");
      return;
    }
    const markdown = [
      "# " + title,
      "",
      ...messages.map((message) => `## ${message.role === "assistant" ? "SAMURA" : "You"}

${message.content}`),
      "",
    ].join("\n");
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "samura-conversation";
    link.href = url;
    link.download = safeTitle + ".md";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function newConversation() {
    conversationLoadRef.current += 1; olderRequestRef.current += 1; preserveScrollRef.current = null; setLoadingOlderMessages(false);
    setError(""); setMessages([]); activeIdRef.current = ""; setActiveId(""); setActiveTitle(""); setSidebarOpen(false); setArchiveMode(false); setHasOlderMessages(false); setHistoryCursor(null);
    try {
      const response = await fetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (!response.ok) { const data = await response.json().catch(()=>({})); throw new Error(data.error ?? "Could not create a conversation."); }
      const data = await response.json();
      activeIdRef.current = data.conversation.id; setActiveId(data.conversation.id);
      setActiveTitle(data.conversation.title);
      setHasOlderMessages(false); setHistoryCursor(null);
      await loadConversations(false);
    } catch(e) { setError(e instanceof Error ? e.message : "Could not create a conversation."); }
  }

  async function sendMessage(event?: FormEvent, overrideText?: string) {
    event?.preventDefault();
    const text = (overrideText ?? draft).trim();
    if (!text || streaming) return;
    setError("");
    let conversationId = activeId;
    if (!conversationId) {
      try {
        const created = await fetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        if (!created.ok) throw new Error("Could not create a conversation.");
        const data = await created.json(); conversationId = data.conversation.id; activeIdRef.current = conversationId; setActiveId(conversationId); setActiveTitle(data.conversation.title); setArchiveMode(false); setHasOlderMessages(false); setHistoryCursor(null);
        await loadConversations(false);
      } catch(e) { setError(e instanceof Error ? e.message : "Could not create a conversation."); return; }
    }
    const requestId = crypto.randomUUID();
    setDraft("");
    if (!activeTitle.trim() || activeTitle === "New conversation") setActiveTitle(text.slice(0, 72));
    setMessages(prev => [...prev, { id: requestId, role: "user", content: text }, { id: "assistant-" + requestId, role: "assistant", content: "", status: "streaming" }]);
    setStreaming(true);
    const controller = new AbortController(); abortRef.current = controller;
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId, message: text, requestId, mode }), signal: controller.signal });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        // The server may have persisted the user turn before the provider failed.
        // Reload so the UI uses its durable message ID rather than the optimistic ID.
        if (activeIdRef.current === conversationId) await openConversation(conversationId);
        throw new Error(data.error ?? "The response could not be generated.");
      }
      if (!response.body) throw new Error("Streaming is unavailable in this browser.");
      const reader = response.body.getReader(); const decoder = new TextDecoder();
      let received = ""; let buffer = ""; let streamFailed = false; let streamCancelled = false; let streamUnsaved = false;
      const consumeEvent = (raw: string) => {
        const line = raw.split("\n").find(item => item.startsWith("data: "));
        if (!line) return;
        try {
          const event = JSON.parse(line.slice(6)) as { type: string; id?: string; text?: string; message?: string; status?: string };
          if (event.type === "user_message" && typeof event.id === "string") {
            setMessages(prev => prev.map(m => m.id === requestId && m.role === "user" ? { ...m, id: event.id as string } : m));
          } else if (event.type === "delta" && typeof event.text === "string") {
            received += event.text;
            setMessages(prev => prev.map(m => m.id === "assistant-" + requestId ? { ...m, content: received } : m));
          } else if (event.type === "error") {
            streamFailed = true; setError(event.message ?? "Generation stopped unexpectedly.");
          } else if (event.type === "done" && event.status === "unsaved") {
            streamUnsaved = true;
            streamFailed = true;
            setError("This response was not saved because the conversation changed or could not be saved. Retry it from the composer.");
          } else if (event.type === "done" && event.status === "cancelled") {
            streamCancelled = true;
          } else if (event.type === "done" && event.status === "empty") {
            streamFailed = true;
            setError("The model returned an empty response. You can try again.");
          } else if (event.type === "done" && event.status !== "complete") {
            streamFailed = true;
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
      setMessages(prev => prev.map(m => m.id === "assistant-" + requestId ? {
        ...m,
        content: received,
        status: streamUnsaved ? "unsaved" : streamCancelled ? "stopped" : received ? (streamFailed ? "partial" : "complete") : "failed",
      } : m));
      if (!received && !streamFailed && !streamCancelled) setError("The model returned an empty response. You can try again.");
      await loadConversations(showArchivedRef.current);
    } catch(e) {
      const stopped = e instanceof DOMException && e.name === "AbortError";
      setMessages(prev => prev.map(m => m.id === "assistant-" + requestId ? { ...m, status: stopped ? "stopped" : "failed", content: m.content } : m));
      if (!stopped) setError(e instanceof Error ? e.message : "Network error. Please try again.");
    } finally { setStreaming(false); abortRef.current = null; }
  }

  async function editLatestUserMessage(message: Message) {
    if (streaming || message.role !== "user") return;
    const index = messages.findIndex((item) => item.id === message.id);
    if (index < 0) return;
    const latestUser = [...messages].reverse().find((item) => item.role === "user");
    if (!latestUser || latestUser.id !== message.id || !activeId) {
      setError("Only the most recent user message can be edited.");
      return;
    }
    try {
      const response = await fetch("/api/conversations/" + activeId + "/messages/" + message.id, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not edit this message.");
      setDraft(message.content);
      setMessages((previous) => previous.slice(0, index));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not edit this message.");
    }
  }

  async function regenerateResponse(message: Message) {
    if (streaming || message.role !== "assistant" || !activeId) return;
    const messageIndex = messages.findIndex((item) => item.id === message.id);
    const previousUser = messages.slice(0, messageIndex).reverse().find((item) => item.role === "user");
    const latestUser = [...messages].reverse().find((item) => item.role === "user");
    if (!previousUser || latestUser?.id !== previousUser.id) {
      setError("Only the most recent assistant response can be regenerated.");
      return;
    }

    const requestConversationId = activeId;
    setError("");
    setStreaming(true);
    try {
      const response = await fetch(
        "/api/conversations/" + requestConversationId + "/messages/" + previousUser.id + "/regenerate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not regenerate this response.");
      if (typeof data.answer !== "string" || typeof data.messageId !== "string") {
        throw new Error("The regenerated response was incomplete. Your previous response has been preserved.");
      }
      if (activeIdRef.current !== requestConversationId) return;
      const userIndex = messages.findIndex((item) => item.id === previousUser.id);
      setMessages((previous) => [
        ...previous.slice(0, userIndex + 1),
        { id: data.messageId, role: "assistant", content: data.answer, status: "complete" },
      ]);
      await loadConversations(showArchivedRef.current);
    } catch (e) {
      // The server commits the replacement only after generation succeeds;
      // leave the existing user and assistant messages untouched on failure.
      setError(e instanceof Error ? e.message : "Could not regenerate this response.");
    } finally {
      setStreaming(false);
    }
  }

  async function copyMessage(message: Message) {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      window.setTimeout(() => setCopiedMessageId((current) => current === message.id ? "" : current), 1800);
    } catch {
      setError("Could not copy this response. Check clipboard permissions and try again.");
    }
  }

  async function toggleVoiceInput() {
    if (voiceListening) {
      speechRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      setVoiceListening(false);
      return;
    }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("Microphone access requires a secure connection and a browser that supports microphone permissions. Open SAMURA over HTTPS in an up-to-date browser.");
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
    try {
      // Explicitly request microphone access from the browser before starting recognition.
      // Keep the stream alive while dictation is active, then release it on stop/end/error.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = stream;
      const recognition = new Recognition();
      recognition.lang = navigator.language || "en-NG";
      recognition.interimResults = false;
      recognition.continuous = false;
      speechTextRef.current = "";
      recognition.onresult = (event) => {
        const parts: string[] = [];
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          if (event.results[index].isFinal) parts.push(event.results[index][0].transcript.trim());
        }
        speechTextRef.current = parts.filter(Boolean).join(" ");
      };
      recognition.onerror = (event) => {
        setVoiceListening(false);
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        const messages: Record<string, string> = {
          "not-allowed": "Microphone or speech-recognition access was denied. Allow microphone access for this site in your browser settings.",
          "service-not-allowed": "Your browser or device is blocking its speech-recognition service. Try Chrome with an active internet connection.",
          "audio-capture": "No usable microphone input was found. Check that your microphone works and is not being used exclusively by another app.",
          "network": "The browser's speech-recognition service could not connect. Check your internet connection and try again.",
          "no-speech": "No speech was detected. Tap Voice and speak clearly after listening starts.",
          "language-not-supported": "The browser speech service does not support the selected language. Check your device's speech-language settings.",
          "aborted": "Voice typing was stopped before recognition completed.",
        };
        setError(messages[event.error] ?? `Voice typing failed (${event.error || "unknown error"}). Check your connection and browser microphone/speech settings, then try again.`);
      };
      recognition.onend = () => {
        const transcript = speechTextRef.current.trim();
        if (transcript) setDraft((current) => [current.trim(), transcript].filter(Boolean).join(" "));
        setVoiceListening(false);
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        speechRef.current = null;
      };
      speechRef.current = recognition;
      setVoiceListening(true);
      recognition.start();
    } catch (cause) {
      setVoiceListening(false);
      speechRef.current = null;
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      if (cause instanceof DOMException && cause.name === "NotAllowedError") {
        setError("SAMURA could not access your microphone. When your browser asks, choose Allow. If no prompt appears, open the site permissions in Chrome and set Microphone to Allow, then reload SAMURA.");
      } else if (cause instanceof DOMException && cause.name === "NotFoundError") {
        setError("No microphone was found on this device. Connect or enable a microphone and try again.");
      } else if (cause instanceof DOMException && cause.name === "NotReadableError") {
        setError("Your microphone is unavailable or busy in another app. Close other apps using it and try again.");
      } else {
        setError(cause instanceof Error ? `Could not access the microphone: ${cause.message}` : "Could not access the microphone. Check site permissions and try again.");
      }
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
      <label htmlFor="conversation-search" className="mb-2 mt-6 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2.5 text-slate-500 focus-within:border-[var(--accent)]/40"><Search size={15} aria-hidden="true"/><input id="conversation-search" type="search" value={conversationSearch} onChange={(event) => { setConversationSearch(event.target.value); setSearchResults([]); }} placeholder="Search conversations and messages" aria-label="Search conversation titles and messages" className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"/></label>
      <button type="button" onClick={() => { const next = !showArchived; setShowArchived(next); setConversationSearch(""); setError(""); void loadConversations(next).catch((e) => setError(e instanceof Error ? e.message : "Could not load archived conversations.")); }} className="mt-3 flex w-full items-center justify-between rounded-xl border border-white/10 px-3 py-2.5 text-xs text-slate-400 transition hover:bg-white/[0.04] hover:text-white"><span className="flex items-center gap-2"><Archive size={14}/>{showArchived ? "Back to recent conversations" : "View archived conversations"}</span><span>{showArchived ? "Recent" : "Archived"}</span></button>
      <p className="mb-3 mt-4 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{conversationSearch.trim() ? "Search results" : showArchived ? "Archived conversations" : "Recent conversations"}</p>
      <nav aria-label="Conversation history" className="flex-1 space-y-1 overflow-y-auto">{visibleConversations.map(c=><div key={c.id} className={"group flex items-center gap-0.5 rounded-xl transition " + (activeId===c.id ? "bg-white/[0.08]" : "hover:bg-white/[0.04]")}><button onClick={()=>void openConversation(c.id)} title={c.title} className={"min-w-0 flex-1 truncate rounded-xl px-3 py-3 text-left text-sm transition " + (activeId===c.id ? "text-white" : "text-slate-400 hover:text-slate-200")}>{c.title}</button><button type="button" aria-label={"Rename " + c.title} title="Rename conversation" onClick={()=>void renameConversation(c)} className="rounded-lg p-2 text-slate-500 transition hover:bg-white/[0.08] hover:text-white"><Pencil size={13}/></button>{showArchived ? <button type="button" aria-label={"Restore " + c.title} title="Restore conversation" onClick={()=>void restoreConversation(c)} className="rounded-lg p-2 text-slate-500 transition hover:bg-white/[0.08] hover:text-white"><RotateCw size={13}/></button> : <button type="button" aria-label={"Archive " + c.title} title="Archive conversation" onClick={()=>void archiveConversation(c)} className="rounded-lg p-2 text-slate-500 transition hover:bg-white/[0.08] hover:text-white"><Archive size={13}/></button>}<button type="button" aria-label={"Delete " + c.title} title="Delete conversation permanently" onClick={()=>void deleteConversation(c)} className="rounded-lg p-2 text-slate-500 transition hover:bg-red-400/10 hover:text-red-200"><Trash2 size={13}/></button></div>)}{!visibleConversations.length && <p className="px-3 py-2 text-xs leading-5 text-slate-600">{conversationSearch.trim() ? "No conversations match your search." : "Your conversations will appear here."}</p>}</nav>
      <div className="border-t border-white/10 pt-3"><div className="mb-3 truncate px-2 text-xs text-slate-500">{session?.user?.email}</div><button onClick={()=>void signOut()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:bg-white/[0.05] hover:text-white"><LogOut size={16}/> Sign out</button></div>
    </aside>
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-[65px] shrink-0 items-center justify-between border-b border-white/[0.08] px-4 sm:px-6"><div className="flex items-center gap-3"><button aria-label="Open navigation" onClick={()=>setSidebarOpen(true)} className="rounded-lg p-2 hover:bg-white/[0.06] md:hidden"><Menu size={19}/></button><div><p className="text-sm font-semibold">SAMURA Chat</p><p className="text-[11px] text-slate-500">Your private intelligence workspace</p></div></div><div className="flex items-center gap-1">{activeId && messages.length > 0 && <button type="button" onClick={exportActiveConversation} aria-label="Export conversation as Markdown" title="Export conversation" className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white"><Download size={15}/></button>}<Link href="/studio" className="rounded-xl px-3 py-2 text-xs text-[var(--accent)] hover:bg-white/[0.06]">Studio</Link><button onClick={()=>void newConversation()} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-400 hover:bg-white/[0.06] hover:text-white"><ChevronLeft className="hidden sm:block" size={15}/> New chat</button></div></header>
      <div ref={messagesScrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-5 py-12"><div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/[0.07] text-[var(--accent)]"><Sparkles size={23}/></div><p className="text-xs font-bold uppercase tracking-[0.23em] text-[var(--accent)]">Your thinking space</p><h1 className="mt-3 font-[family-name:var(--font-space)] text-4xl tracking-tight sm:text-5xl">What are we working<br className="hidden sm:block"/> on today?</h1><p className="mt-5 max-w-lg text-sm leading-7 text-[var(--muted)]">Ask a question, explore an idea, or work through a challenge. Your conversations are saved to your account.</p><div className="mt-8 grid gap-3 sm:grid-cols-2">{["Help me turn an idea into a practical plan","Explain a complex topic in simple language","Review this code and help me debug it","Help me research a new business opportunity"].map(s=><button key={s} onClick={()=>setDraft(s)} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-left text-sm text-slate-300 transition hover:border-[var(--accent)]/30 hover:bg-white/[0.045]">{s}<span className="mt-2 block text-xs text-slate-600">Use this prompt ↗</span></button>)}</div></div> :
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">{hasOlderMessages && <div className="mb-6 flex justify-center"><button type="button" onClick={() => void loadOlderMessages()} disabled={loadingOlderMessages} className="rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-300 transition hover:bg-white/[0.05] disabled:opacity-50">{loadingOlderMessages ? "Loading older messages…" : "Load older messages"}</button></div>}{messages.map(m=><article key={m.id} className="mb-8 flex gap-3 sm:gap-4"><div className={"mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl " + (m.role==="assistant" ? "bg-[var(--accent)]/10 text-[var(--accent)]" : "bg-white/10 text-slate-300")}>{m.role==="assistant" ? <AudioWaveform size={17}/> : <span className="text-xs font-bold">YOU</span>}</div><div className="min-w-0 flex-1 pt-1"><div className="mb-2 flex items-center justify-between gap-3"><p className="text-xs font-semibold text-slate-400">{m.role==="assistant" ? "SAMURA" : "You"}</p><div className="flex items-center gap-1">{m.role === "user" && m.content && !streaming && messages.filter(item => item.role === "user").at(-1)?.id === m.id && <button type="button" onClick={() => void editLatestUserMessage(m)} aria-label="Edit latest message" title="Edit and resubmit this message" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200"><Pencil size={13}/><span>Edit</span></button>}{m.role === "assistant" && m.content && m.status !== "streaming" && m.status !== "unsaved" && <><button type="button" onClick={() => void regenerateResponse(m)} disabled={streaming || messages.filter(item => item.role === "assistant").at(-1)?.id !== m.id} aria-label="Regenerate response" title="Regenerate latest response" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-30"><RotateCw size={13}/><span>Regenerate</span></button><button type="button" onClick={() => void copyMessage(m)} aria-label={copiedMessageId === m.id ? "Response copied" : "Copy response"} title={copiedMessageId === m.id ? "Copied" : "Copy response"} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200">{copiedMessageId === m.id ? <Check size={13}/> : <Clipboard size={13}/>}<span>{copiedMessageId === m.id ? "Copied" : "Copy"}</span></button></>}</div></div>{m.content ? <div className="prose prose-invert prose-sm max-w-none break-words leading-7 prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:border prose-pre:border-white/10 prose-pre:bg-black/30 prose-code:text-[var(--accent)] prose-a:text-[var(--accent)]"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div> : <span className="inline-flex items-center gap-2 text-sm text-slate-500"><LoaderCircle size={15} className="animate-spin"/>Thinking…</span>}{(m.status==="failed" || m.status==="unsaved") && <div className="mt-2 flex items-center gap-3 text-xs text-amber-300"><span>{m.status === "unsaved" ? "This response was not saved." : "This response did not finish."}</span><button onClick={() => { const previousUser = messages.slice(0, messages.indexOf(m)).reverse().find(item => item.role === "user"); if (previousUser) setDraft(previousUser.content); }} className="underline underline-offset-2 hover:text-white">Retry in composer</button></div>}{m.status==="stopped" && <p className="mt-2 text-xs text-slate-500">Generation stopped.</p>}</div></article>)}<div ref={bottomRef}/></div>}
      </div>
      <div className="shrink-0 px-3 pb-3 pt-2 sm:px-6 sm:pb-5"><div className="mx-auto max-w-3xl">{error && <div role="alert" className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100"><span>{error}</span><button aria-label="Dismiss error" onClick={()=>setError("")}><X size={16}/></button></div>}<form onSubmit={sendMessage} className="rounded-2xl border border-white/15 bg-[#111722] p-2 shadow-xl focus-within:border-[var(--accent)]/40"><div className="flex items-center gap-2 px-2 pb-2"><button type="button" onClick={()=>setMode("chat")} aria-pressed={mode === "chat"} className={"rounded-lg px-3 py-1.5 text-xs transition " + (mode === "chat" ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "text-slate-400 hover:bg-white/[0.05]")}>Chat</button><button type="button" onClick={()=>setMode("code")} aria-pressed={mode === "code"} className={"rounded-lg px-3 py-1.5 text-xs transition " + (mode === "code" ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "text-slate-400 hover:bg-white/[0.05]")}>Code</button><span className="ml-auto text-[10px] text-slate-600">{mode === "code" ? "Code-focused responses" : "General assistant"}</span></div><textarea value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={handleComposerKey} disabled={streaming} rows={2} maxLength={12000} placeholder={mode === "code" ? "Describe what you want to build or debug…" : "Message SAMURA…"} className="max-h-40 min-h-[54px] w-full resize-y bg-transparent px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-slate-600 disabled:opacity-60" /><div className="flex items-center justify-between gap-2 px-2 pb-1"><span className="text-[10px] text-slate-600">Enter to send · Shift + Enter for a new line</span><div className="flex items-center gap-2">{!streaming && <button type="button" onClick={toggleVoiceInput} aria-pressed={voiceListening} title={voiceListening ? "Stop voice typing" : "Dictate a message"} className={"flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs transition " + (voiceListening ? "border-red-300/30 bg-red-300/10 text-red-200" : "border-white/10 text-slate-300 hover:bg-white/[0.05]")}><span className="sr-only">{voiceListening ? "Stop voice typing" : "Start voice typing"}</span>{voiceListening ? <MicOff size={14}/> : <Mic size={14}/>}<span>{voiceListening ? "Listening…" : "Voice"}</span></button>}{streaming ? <button type="button" onClick={()=>abortRef.current?.abort()} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/15"><Square size={13}/> Stop</button> : <button disabled={!draft.trim()} className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-bold text-[#07120e] transition hover:bg-white disabled:opacity-30"><Send size={14}/> Send</button>}</div></div></form><p className="mt-2 text-center text-[10px] leading-4 text-slate-600">AI can make mistakes. Verify important information. Provider usage may incur costs.</p></div></div>
    </section>
  </main>;
}
