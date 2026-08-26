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
  customer: { id: string; name: string; phone: string; email: string | null };
  lead: { id: string | null; trek_name: string | null; status: string | null; num_people: number | null } | null;
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
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  async function loadThreads() {
    setLoading(true);
    try {
      const res = await api.get("/api/conversations");
      setThreads(res.data);
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(customerId: string) {
    const res = await api.get(`/api/conversations/${customerId}/messages`);
    setDetail(res.data);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  useEffect(() => {
    if (activeOrg) loadThreads();
  }, [activeOrg]);

  useEffect(() => {
    if (selectedCustomerId) loadMessages(selectedCustomerId);
  }, [selectedCustomerId]);

  async function sendReply() {
    if (!replyText.trim() || !selectedCustomerId) return;
    setSending(true);
    try {
      await api.post(`/api/conversations/${selectedCustomerId}/send`, { body: replyText, channel: "whatsapp" });
      setReplyText("");
      await loadMessages(selectedCustomerId);
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

  return (
    <AppShell title="Conversations">
      <div className="flex h-[calc(100vh-120px)] overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
        {/* Thread List (Left Panel) */}
        <div className="w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto bg-white dark:bg-gray-900">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              💬 All Conversations ({threads.length})
            </h2>
          </div>
          {threads.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">
              No conversations yet. Incoming WhatsApp messages will appear here.
            </div>
          ) : (
            threads.map((t) => (
              <button
                key={t.customer_id}
                onClick={() => setSelectedCustomerId(t.customer_id)}
                className={`w-full text-left p-4 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                  selectedCustomerId === t.customer_id ? "bg-brand-50 dark:bg-brand-500/10 border-l-2 border-l-brand-600" : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-500/20 flex items-center justify-center text-sm font-bold text-brand-700 flex-shrink-0">
                      {t.customer_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{t.customer_name}</div>
                      <div className="text-xs text-gray-400 truncate">{t.customer_phone}</div>
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
                <p className="text-sm mt-1">Choose a customer from the left to view their chat</p>
              </div>
            </div>
          ) : !detail ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">Loading messages...</div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-500/20 flex items-center justify-center text-lg font-bold text-brand-700">
                    {detail.customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold">{detail.customer.name}</div>
                    <div className="text-xs text-gray-400">{detail.customer.phone} {detail.customer.email && `• ${detail.customer.email}`}</div>
                  </div>
                </div>
                {detail.lead && (
                  <div className="flex items-center gap-2 text-sm">
                    {detail.lead.trek_name && <span className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">🏔️ {detail.lead.trek_name}</span>}
                    {detail.lead.status && <span className={`px-2 py-1 rounded text-xs font-medium ${statusBadgeColor(detail.lead.status)}`}>{detail.lead.status}</span>}
                    {detail.lead.num_people && <span className="text-xs text-gray-400">👥 {detail.lead.num_people}</span>}
                  </div>
                )}
              </div>

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
                      <div className={`text-[10px] mt-1 ${m.direction === "OUTBOUND" ? "text-brand-200" : "text-gray-400"}`}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {m.direction === "OUTBOUND" && m.status && (
                          <span className="ml-1">
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
                    rows={1}
                    placeholder="Type a manual reply..."
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
                    className="btn-primary px-6"
                    disabled={sending || !replyText.trim()}
                    onClick={sendReply}
                  >
                    {sending ? "Sending..." : "Send"}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  💡 AI auto-reply handles conversations automatically. Use manual replies to override the AI when needed.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
