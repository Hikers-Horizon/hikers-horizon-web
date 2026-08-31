"use client";
import { useEffect, useState, useRef } from "react";
import AppShell from "@/components/AppShell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface Thread {
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  last_message: string;
  last_message_direction: string | null;
  last_message_at: string | null;
  message_count: number;
  channel: string;
  lead_status: string | null;
  trek_name: string | null;
  ai_auto_reply: boolean;
  ai_disabled?: boolean;
}

interface Msg {
  id: string;
  direction: string;
  body: string;
  channel: string;
  status: string;
  created_at: string;
}

interface Activity {
  type: string;
  description: string;
  created_at: string;
}

interface ConversationDetail {
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    instagram_id?: string | null;
    ai_disabled?: boolean;
  };
  lead: {
    id: string | null;
    trek_name: string | null;
    status: string | null;
    num_people: number | null;
    ai_disabled?: boolean;
  } | null;
  messages: Msg[];
  activities: Activity[];
}

export default function ConversationsPage() {
  const { activeOrg } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "whatsapp" | "instagram">("all");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [togglingAi, setTogglingAi] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isLiveConnected, setIsLiveConnected] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const lastMsgCountRef = useRef<number>(0);

  const whatsappCount = threads.filter((t) => t.channel !== "instagram").length;
  const instagramCount = threads.filter((t) => t.channel === "instagram").length;

  const filteredThreads = threads.filter((t) => {
    if (activeTab === "whatsapp") return t.channel !== "instagram";
    if (activeTab === "instagram") return t.channel === "instagram";
    return true;
  });

  async function loadThreads(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await api.get("/api/conversations");
      setThreads(res.data);
      setIsLiveConnected(true);
    } catch (err) {
      console.error("Thread poll error", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function loadMessages(customerId: string, isPoll = false) {
    try {
      const res = await api.get(`/api/conversations/${customerId}/messages`);
      const newDetail: ConversationDetail = res.data;
      
      setDetail(newDetail);
      setIsLiveConnected(true);

      const prevCount = lastMsgCountRef.current;
      const newCount = newDetail.messages.length;
      lastMsgCountRef.current = newCount;

      // Scroll to bottom on initial load or when a new message arrives
      if (!isPoll || newCount > prevCount) {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: isPoll ? "smooth" : "auto" });
        }, 60);
      }
    } catch (err) {
      console.error("Message poll error", err);
    }
  }

  // Real-time background sync for thread list (every 3.5 seconds)
  useEffect(() => {
    if (!activeOrg) return;
    loadThreads();
    const threadInterval = setInterval(() => loadThreads(true), 3500);
    return () => clearInterval(threadInterval);
  }, [activeOrg]);

  // Real-time background sync for active chat (every 2 seconds)
  useEffect(() => {
    if (!selectedCustomerId) {
      lastMsgCountRef.current = 0;
      return;
    }

    loadMessages(selectedCustomerId, false);
    const msgInterval = setInterval(() => {
      loadMessages(selectedCustomerId, true);
    }, 2000);

    return () => clearInterval(msgInterval);
  }, [selectedCustomerId]);

  async function toggleAiForCustomer() {
    if (!selectedCustomerId || !detail) return;
    const currentDisabled = Boolean(detail.customer.ai_disabled);
    const newEnabledState = currentDisabled; // if currently disabled, enable it; else pause it
    setTogglingAi(true);
    try {
      await api.post(`/api/conversations/${selectedCustomerId}/toggle-ai`, {
        ai_enabled: newEnabledState,
      });
      await loadMessages(selectedCustomerId, false);
      await loadThreads(true);
    } catch (err) {
      console.error("Failed to toggle AI", err);
    } finally {
      setTogglingAi(false);
    }
  }

  async function sendReply() {
    if (!replyText.trim() || !selectedCustomerId || !detail) return;
    const textToSend = replyText.trim();
    setSending(true);
    setReplyText("");

    // Optimistic message append
    const optimisticMsg: Msg = {
      id: `temp-${Date.now()}`,
      direction: "OUTBOUND",
      channel: detail.customer.instagram_id || detail.customer.phone.startsWith("ig:") ? "instagram" : "whatsapp",
      body: textToSend,
      status: "sent",
      created_at: new Date().toISOString(),
    };
    setDetail((prev) => prev ? { ...prev, messages: [...prev.messages, optimisticMsg] } : prev);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const channel = detail.customer.instagram_id || detail.customer.phone.startsWith("ig:") ? "instagram" : "whatsapp";
      await api.post(`/api/conversations/${selectedCustomerId}/send`, {
        body: textToSend,
        channel,
      });
      await loadMessages(selectedCustomerId, true);
      await loadThreads(true);
    } catch (err) {
      console.error("Failed to send reply", err);
      // Revert if error
      await loadMessages(selectedCustomerId, false);
    } finally {
      setSending(false);
    }
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function statusBadgeColor(status: string | null) {
    const colors: Record<string, string> = {
      NEW: "bg-blue-100 text-blue-700",
      CONTACTED: "bg-yellow-100 text-yellow-700",
      INTERESTED: "bg-purple-100 text-purple-700",
      PAYMENT_PENDING: "bg-orange-100 text-orange-700",
      CONFIRMED: "bg-green-100 text-green-700",
      COMPLETED: "bg-gray-100 text-gray-600",
      LOST: "bg-red-100 text-red-700",
    };
    return colors[status || ""] || "bg-gray-100 text-gray-600";
  }

  if (loading) {
    return (
      <AppShell title="Conversations">
        <div className="flex h-[calc(100vh-140px)] items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-gray-500">
            <span className="text-3xl animate-pulse">💬</span>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Loading conversations...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const isAiDisabled = Boolean(detail?.customer.ai_disabled);

  return (
    <AppShell title="Conversations">
      <div className="flex h-[calc(100vh-85px)] sm:h-[calc(100vh-105px)] md:h-[calc(100vh-120px)] overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
        {/* Thread List (Full-width on mobile when no chat is selected; left 80-width column on desktop) */}
        <div className={`${selectedCustomerId ? "hidden md:flex" : "flex"} w-full md:w-80 flex-shrink-0 flex-col border-r border-gray-200 dark:border-gray-700 overflow-y-auto bg-white dark:bg-gray-900`}>
          <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm z-10">
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-1.5">
              <span>💬</span> Chats <span className="bg-gray-100 dark:bg-gray-800 text-xs px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-400">{threads.length}</span>
            </h2>
            <button
              onClick={() => loadThreads(false)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Refresh conversations"
            >
              🔄
            </button>
          </div>

          {/* Channel Filter Tabs (All / WhatsApp / Instagram) */}
          <div className="p-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
            <div className="grid grid-cols-3 p-1 bg-gray-200/80 dark:bg-gray-800 rounded-lg text-xs font-semibold gap-1">
              <button
                onClick={() => setActiveTab("all")}
                className={`py-1.5 px-1 rounded-md text-center transition-all flex items-center justify-center gap-1 ${
                  activeTab === "all"
                    ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm font-bold"
                    : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                }`}
              >
                <span>All</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-gray-100 dark:bg-gray-700 rounded-full font-medium">{threads.length}</span>
              </button>

              <button
                onClick={() => setActiveTab("whatsapp")}
                className={`py-1.5 px-1 rounded-md text-center transition-all flex items-center justify-center gap-1 ${
                  activeTab === "whatsapp"
                    ? "bg-emerald-600 text-white shadow-sm font-bold"
                    : "text-gray-600 hover:text-emerald-700 dark:text-gray-400 dark:hover:text-emerald-400"
                }`}
              >
                <span>💬 WA</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                  activeTab === "whatsapp" ? "bg-emerald-700 text-white" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                }`}>
                  {whatsappCount}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("instagram")}
                className={`py-1.5 px-1 rounded-md text-center transition-all flex items-center justify-center gap-1 ${
                  activeTab === "instagram"
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm font-bold"
                    : "text-gray-600 hover:text-pink-600 dark:text-gray-400 dark:hover:text-pink-400"
                }`}
              >
                <span>📸 Insta</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                  activeTab === "instagram" ? "bg-black/20 text-white" : "bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-300"
                }`}>
                  {instagramCount}
                </span>
              </button>
            </div>
          </div>

          {filteredThreads.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              {activeTab === "whatsapp"
                ? "No WhatsApp conversations yet."
                : activeTab === "instagram"
                ? "No Instagram conversations yet."
                : "No conversations yet. Incoming messages will appear here."}
            </div>
          ) : (
            filteredThreads.map((t) => (
              <button
                key={t.customer_id}
                onClick={() => setSelectedCustomerId(t.customer_id)}
                className={`w-full text-left p-3.5 sm:p-4 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-all ${
                  selectedCustomerId === t.customer_id ? "bg-brand-50/80 dark:bg-brand-500/10 border-l-4 border-l-brand-600" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm ${
                      t.channel === "instagram"
                        ? "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 text-white"
                        : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                    }`}>
                      {t.channel === "instagram" ? "📸" : t.customer_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate flex items-center gap-1.5 text-gray-900 dark:text-gray-100">
                        <span>{t.customer_name}</span>
                        {t.ai_disabled && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.2 rounded font-bold">
                            Human
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 truncate flex items-center gap-1 mt-0.5">
                        <span className={t.channel === "instagram" ? "text-pink-600 dark:text-pink-400 font-medium" : ""}>
                          {t.channel === "instagram" ? "Instagram DM" : t.customer_phone}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-gray-400 flex-shrink-0">
                    {t.last_message_at ? formatTime(t.last_message_at) : ""}
                  </div>
                </div>
                <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 truncate pl-11">
                  {t.last_message_direction === "OUTBOUND" && <span className="text-gray-400">You: </span>}
                  {t.last_message}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 pl-11 flex-wrap">
                  {t.trek_name && <span className="text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded truncate max-w-[150px]">🏔️ {t.trek_name}</span>}
                  {t.lead_status && <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${statusBadgeColor(t.lead_status)}`}>{t.lead_status.replace("_", " ")}</span>}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Chat Area (Right Panel on desktop, full screen on mobile when selected) */}
        <div className={`${!selectedCustomerId ? "hidden md:flex" : "flex"} flex-1 flex-col bg-gray-50 dark:bg-gray-950 overflow-hidden`}>
          {!selectedCustomerId ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 p-6">
              <div className="text-center max-w-sm">
                <span className="text-5xl block mb-3">💬</span>
                <p className="text-lg font-bold text-gray-700 dark:text-gray-300">Select a conversation</p>
                <p className="text-xs text-gray-500 mt-1">Choose a WhatsApp or Instagram customer from the left list to start messaging</p>
              </div>
            </div>
          ) : !detail ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              <div className="flex items-center gap-2">
                <span className="animate-spin text-lg">⏳</span> Loading messages...
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header with Back Button (mobile) and AI Pause/Takeover Button */}
              <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-between flex-wrap gap-2 sticky top-0 z-10">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setSelectedCustomerId(null)}
                    className="md:hidden p-1.5 -ml-1 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 flex items-center gap-1 text-xs font-semibold"
                    title="Back to all chats"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Chats</span>
                  </button>

                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-base font-bold flex-shrink-0 ${
                    detail.customer.instagram_id || detail.customer.phone.startsWith("ig:")
                      ? "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 text-white"
                      : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                  }`}>
                    {detail.customer.instagram_id || detail.customer.phone.startsWith("ig:") ? "📸" : detail.customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm sm:text-base flex items-center gap-1.5 truncate text-gray-900 dark:text-gray-100">
                      <span className="truncate">{detail.customer.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-medium">
                        {detail.customer.instagram_id || detail.customer.phone.startsWith("ig:") ? "Instagram" : "WhatsApp"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Live
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400 truncate">{detail.customer.phone}</div>
                  </div>
                </div>

                {/* Right Header Actions: Bot Toggle Button */}
                <div className="flex items-center gap-2 ml-auto">
                  {detail.lead && (
                    <div className="hidden lg:flex items-center gap-2 text-xs">
                      {detail.lead.trek_name && <span className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">🏔️ {detail.lead.trek_name}</span>}
                      {detail.lead.status && <span className={`px-2 py-1 rounded font-medium ${statusBadgeColor(detail.lead.status)}`}>{detail.lead.status}</span>}
                    </div>
                  )}

                  {/* AI Bot Toggle / Takeover Button */}
                  <button
                    onClick={toggleAiForCustomer}
                    disabled={togglingAi}
                    className={`flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all ${
                      isAiDisabled
                        ? "bg-amber-500 hover:bg-amber-600 text-white"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                    }`}
                    title={isAiDisabled ? "Click to resume AI auto-replies for this customer" : "Click to pause AI bot and take over conversation manually"}
                  >
                    {togglingAi ? (
                      <span>Saving...</span>
                    ) : isAiDisabled ? (
                      <>
                        <span>👤 Bot Paused</span>
                        <span className="bg-white/20 px-1 py-0.5 rounded ml-1 text-[11px]">▶️ Resume</span>
                      </>
                    ) : (
                      <>
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                        </span>
                        <span className="hidden sm:inline">🤖 AI Bot Active</span>
                        <span className="sm:hidden">🤖 Active</span>
                        <span className="bg-white/20 px-1.5 py-0.5 rounded ml-0.5 sm:ml-1 text-[11px]">⏸️ Take Over</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Notice Banner when Takeover is Active */}
              {isAiDisabled && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 px-3 sm:px-4 py-2 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between">
                  <span>
                    ⏸️ <strong>Bot paused for this chat.</strong> Reply manually below.
                  </span>
                  <button
                    onClick={toggleAiForCustomer}
                    disabled={togglingAi}
                    className="text-xs font-bold underline ml-2 hover:text-amber-900 whitespace-nowrap"
                  >
                    Resume Bot
                  </button>
                </div>
              )}

              {/* Messages Scroll Area */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 sm:space-y-3">
                {detail.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] sm:max-w-[75%] md:max-w-[70%] rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm ${
                        m.direction === "OUTBOUND"
                          ? "bg-brand-600 text-white rounded-br-sm shadow-sm"
                          : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm shadow-sm border border-gray-100 dark:border-gray-700/50"
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</div>
                      <div className={`text-[10px] mt-1 flex items-center justify-between gap-2 ${m.direction === "OUTBOUND" ? "text-brand-200" : "text-gray-400"}`}>
                        <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        {m.direction === "OUTBOUND" && m.status && (
                          <span>
                            {m.status === "sent" ? "✓" : m.status === "delivered" ? "✓✓" : m.status === "read" ? "✓✓" : m.status === "failed" ? "✗" : "✓"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Manual Reply Input Bar */}
              <div className="p-2.5 sm:p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 sticky bottom-0">
                <div className="flex items-end gap-2 sm:gap-3">
                  <textarea
                    className="input flex-1 resize-none text-xs sm:text-sm py-2 px-3 min-h-[44px]"
                    rows={2}
                    placeholder={`Reply on ${detail.customer.instagram_id || detail.customer.phone.startsWith("ig:") ? "Instagram DM" : "WhatsApp"}...`}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendReply();
                      }
                    }}
                  />
                  <button
                    className="btn-primary px-3.5 sm:px-6 h-[44px] sm:h-12 flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0"
                    disabled={sending || !replyText.trim()}
                    onClick={sendReply}
                  >
                    {sending ? "..." : "Send"}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5 truncate">
                  {isAiDisabled
                    ? "👤 Human Takeover active. Messages go directly to the customer."
                    : "💡 AI auto-reply is active. Click 'Take Over' above to reply manually without AI."}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
