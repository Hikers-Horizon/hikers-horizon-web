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
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [togglingAi, setTogglingAi] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  async function loadThreads(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await api.get("/api/conversations");
      setThreads(res.data);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function loadMessages(customerId: string) {
    const res = await api.get(`/api/conversations/${customerId}/messages`);
    setDetail(res.data);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  useEffect(() => {
    if (activeOrg) {
      loadThreads();
      const interval = setInterval(() => loadThreads(true), 8000);
      return () => clearInterval(interval);
    }
  }, [activeOrg]);

  useEffect(() => {
    if (selectedCustomerId) loadMessages(selectedCustomerId);
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
      await loadMessages(selectedCustomerId);
      await loadThreads(true);
    } catch (err) {
      console.error("Failed to toggle AI", err);
    } finally {
      setTogglingAi(false);
    }
  }

  async function sendReply() {
    if (!replyText.trim() || !selectedCustomerId || !detail) return;
    setSending(true);
    try {
      const channel = detail.customer.instagram_id || detail.customer.phone.startsWith("ig:") ? "instagram" : "whatsapp";
      await api.post(`/api/conversations/${selectedCustomerId}/send`, {
        body: replyText,
        channel,
      });
      setReplyText("");
      await loadMessages(selectedCustomerId);
      await loadThreads(true);
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

  if (loading) return <AppShell title="Conversations"><div>Loading...</div></AppShell>;

  const isAiDisabled = Boolean(detail?.customer.ai_disabled);

  return (
    <AppShell title="Conversations">
      <div className="flex h-[calc(100vh-120px)] overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
        {/* Thread List (Left Panel) */}
        <div className="w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto bg-white dark:bg-gray-900">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              💬 Chats ({threads.length})
            </h2>
            <button
              onClick={() => loadThreads(false)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              title="Refresh"
            >
              🔄
            </button>
          </div>
          {threads.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">
              No conversations yet. Incoming WhatsApp and Instagram messages will appear here.
            </div>
          ) : (
            threads.map((t) => (
              <button
                key={t.customer_id}
                onClick={() => setSelectedCustomerId(t.customer_id)}
                className={`w-full text-left p-4 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                  selectedCustomerId === t.customer_id ? "bg-brand-50 dark:bg-brand-500/10 border-l-4 border-l-brand-600" : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      t.channel === "instagram"
                        ? "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 text-white"
                        : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                    }`}>
                      {t.channel === "instagram" ? "📸" : t.customer_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate flex items-center gap-1.5">
                        <span>{t.customer_name}</span>
                        {t.ai_disabled && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-1 py-0.2 rounded font-semibold">
                            Human
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 truncate flex items-center gap-1">
                        <span>{t.channel === "instagram" ? "Instagram DM" : t.customer_phone}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 flex-shrink-0">
                    {t.last_message_at ? formatTime(t.last_message_at) : ""}
                  </div>
                </div>
                <div className="mt-1.5 text-xs text-gray-500 truncate pl-11">
                  {t.last_message_direction === "OUTBOUND" && <span className="text-gray-400">You: </span>}
                  {t.last_message}
                </div>
                <div className="mt-1.5 flex items-center gap-2 pl-11">
                  {t.trek_name && <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">🏔️ {t.trek_name}</span>}
                  {t.lead_status && <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusBadgeColor(t.lead_status)}`}>{t.lead_status.replace("_", " ")}</span>}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Chat Area (Right Panel) */}
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-950">
          {!selectedCustomerId ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <span className="text-5xl block mb-4">💬</span>
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm mt-1">Choose a WhatsApp or Instagram customer to view their chat</p>
              </div>
            </div>
          ) : !detail ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">Loading messages...</div>
          ) : (
            <>
              {/* Chat Header with AI Pause/Takeover Button */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 ${
                    detail.customer.instagram_id || detail.customer.phone.startsWith("ig:")
                      ? "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 text-white"
                      : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                  }`}>
                    {detail.customer.instagram_id || detail.customer.phone.startsWith("ig:") ? "📸" : detail.customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold flex items-center gap-2">
                      <span>{detail.customer.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-normal">
                        {detail.customer.instagram_id || detail.customer.phone.startsWith("ig:") ? "Instagram DM" : "WhatsApp"}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">{detail.customer.phone} {detail.customer.email && `• ${detail.customer.email}`}</div>
                  </div>
                </div>

                {/* Right Header Actions: Bot Toggle Button */}
                <div className="flex items-center gap-3">
                  {detail.lead && (
                    <div className="hidden sm:flex items-center gap-2 text-sm">
                      {detail.lead.trek_name && <span className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">🏔️ {detail.lead.trek_name}</span>}
                      {detail.lead.status && <span className={`px-2 py-1 rounded text-xs font-medium ${statusBadgeColor(detail.lead.status)}`}>{detail.lead.status}</span>}
                    </div>
                  )}

                  {/* AI Bot Toggle / Takeover Button */}
                  <button
                    onClick={toggleAiForCustomer}
                    disabled={togglingAi}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all ${
                      isAiDisabled
                        ? "bg-amber-500 hover:bg-amber-600 text-white"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                    }`}
                    title={isAiDisabled ? "Click to resume AI auto-replies for this customer" : "Click to pause AI bot and take over conversation manually"}
                  >
                    {togglingAi ? (
                      <span>Updating...</span>
                    ) : isAiDisabled ? (
                      <>
                        <span>👤 Human Takeover (Bot Paused)</span>
                        <span className="bg-white/20 px-1.5 py-0.5 rounded ml-1">▶️ Resume Bot</span>
                      </>
                    ) : (
                      <>
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                        </span>
                        <span>🤖 AI Bot Active</span>
                        <span className="bg-white/20 px-1.5 py-0.5 rounded ml-1">⏸️ Take Over</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Notice Banner when Takeover is Active */}
              {isAiDisabled && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 px-4 py-2 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between">
                  <span>
                    ⏸️ <strong>Bot replies are paused for this customer.</strong> The AI will not answer incoming messages until you click <strong>Resume Bot</strong>.
                  </span>
                  <button
                    onClick={toggleAiForCustomer}
                    disabled={togglingAi}
                    className="text-xs font-bold underline ml-2 hover:text-amber-900"
                  >
                    Resume Bot
                  </button>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {detail.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                        m.direction === "OUTBOUND"
                          ? "bg-brand-600 text-white rounded-br-md"
                          : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md shadow-sm"
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words">{m.body}</div>
                      <div className={`text-[10px] mt-1 flex items-center justify-between gap-2 ${m.direction === "OUTBOUND" ? "text-brand-200" : "text-gray-400"}`}>
                        <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        {m.direction === "OUTBOUND" && m.status && (
                          <span>
                            {m.status === "sent" ? "✓" : m.status === "delivered" ? "✓✓" : m.status === "read" ? "✓✓" : m.status === "failed" ? "✗" : "⏳"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Input */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <div className="flex items-end gap-3">
                  <textarea
                    className="input flex-1 resize-none"
                    rows={2}
                    placeholder={`Type a manual reply to send on ${detail.customer.instagram_id || detail.customer.phone.startsWith("ig:") ? "Instagram DM" : "WhatsApp"}...`}
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
                    className="btn-primary px-6 h-12 flex items-center justify-center font-semibold"
                    disabled={sending || !replyText.trim()}
                    onClick={sendReply}
                  >
                    {sending ? "Sending..." : "Send Reply"}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {isAiDisabled
                    ? "👤 Human Takeover active. Replies you send go directly to the customer."
                    : "💡 AI auto-reply is currently active. If you want to chat manually without AI responding, click 'Take Over' above."}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
