"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type ConnectionStatus = { testing: boolean; result: null | { connected: boolean; display_phone_number?: string; verified_name?: string; quality_rating?: string; error?: string } };

export default function SettingsPage() {
  const { activeOrg } = useAuth();
  const [form, setForm] = useState({
    ai_auto_reply_enabled: true,
    ai_system_prompt: "",
    whatsapp_phone_number_id: "",
    whatsapp_business_account_id: "",
    whatsapp_webhook_verify_token: "",
    whatsapp_access_token: "",
    instagram_page_id: "",
    instagram_access_token: "",
  });
  const [hints, setHints] = useState({ whatsapp: "", instagram: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [conn, setConn] = useState<ConnectionStatus>({ testing: false, result: null });
  const [showGuide, setShowGuide] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/api/organizations/ai-settings");
      setForm({
        ai_auto_reply_enabled: res.data.ai_auto_reply_enabled,
        ai_system_prompt: res.data.ai_system_prompt || "",
        whatsapp_phone_number_id: res.data.whatsapp_phone_number_id || "",
        whatsapp_business_account_id: res.data.whatsapp_business_account_id || "",
        whatsapp_webhook_verify_token: res.data.whatsapp_webhook_verify_token || "",
        whatsapp_access_token: "",
        instagram_page_id: res.data.instagram_page_id || "",
        instagram_access_token: "",
      });
      setHints({
        whatsapp: res.data.whatsapp_access_token_hint || "",
        instagram: res.data.instagram_access_token_hint || "",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeOrg) load();
  }, [activeOrg]);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      // Only send tokens if the user actually typed a new one, so we don't
      // overwrite an already-saved token with an empty string.
      const payload: any = { ...form };
      if (!payload.whatsapp_access_token) delete payload.whatsapp_access_token;
      if (!payload.instagram_access_token) delete payload.instagram_access_token;
      const res = await api.put("/api/organizations/ai-settings", payload);
      setHints({
        whatsapp: res.data.whatsapp_access_token_hint || "",
        instagram: res.data.instagram_access_token_hint || "",
      });
      setForm({ ...form, whatsapp_access_token: "", instagram_access_token: "" });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    const phoneId = form.whatsapp_phone_number_id;
    const token = form.whatsapp_access_token || "__use_saved__";
    if (!phoneId) {
      setConn({ testing: false, result: { connected: false, error: "Enter a Phone Number ID first." } });
      return;
    }
    if (!form.whatsapp_access_token && !hints.whatsapp) {
      setConn({ testing: false, result: { connected: false, error: "Enter an Access Token first." } });
      return;
    }
    setConn({ testing: true, result: null });
    try {
      // If user hasn't typed a new token, tell backend to use the saved one
      const tokenToUse = form.whatsapp_access_token || "";
      const res = await api.post("/api/organizations/whatsapp-test", {
        phone_number_id: phoneId,
        access_token: tokenToUse || "saved",
      });
      setConn({ testing: false, result: res.data });
    } catch {
      setConn({ testing: false, result: { connected: false, error: "Network error. Please try again." } });
    }
  }

  if (loading) return <AppShell title="Settings"><div>Loading...</div></AppShell>;

  return (
    <AppShell title="Settings">
      <div className="max-w-2xl space-y-6">
        {/* AI Auto-Reply Card */}
        <div className="card space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤖</span>
            <h2 className="text-lg font-semibold">AI Sales Agent</h2>
          </div>
          <p className="text-sm text-gray-500">
            When enabled, incoming WhatsApp and Instagram messages are handled by an AI sales agent
            that can answer trek queries, check availability, collect booking details, create bookings,
            and send payment links — all through natural conversation.
          </p>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.ai_auto_reply_enabled}
              onChange={(e) => setForm({ ...form, ai_auto_reply_enabled: e.target.checked })}
            />
            <span className="text-sm font-medium">Enable AI sales agent</span>
          </label>
          <div>
            <label className="text-sm font-medium">Assistant persona / system prompt</label>
            <textarea
              className="input mt-1 h-28"
              placeholder="e.g. You are a friendly assistant for Hikers Horizon. Be concise and encourage bookings. Mention pickup location is Bangalore."
              value={form.ai_system_prompt}
              onChange={(e) => setForm({ ...form, ai_system_prompt: e.target.value })}
            />
            <p className="mt-1 text-xs text-gray-400">Leave blank to use the default persona.</p>
          </div>
        </div>

        {/* WhatsApp Connection Card */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💬</span>
              <h2 className="text-lg font-semibold">WhatsApp Connection</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium"
            >
              {showGuide ? "Hide setup guide" : "📖 Setup guide"}
            </button>
          </div>

          {/* Collapsible Setup Guide */}
          {showGuide && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4 text-sm space-y-2 border border-blue-200 dark:border-blue-800">
              <p className="font-semibold text-blue-800 dark:text-blue-300">How to connect your WhatsApp number:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-700 dark:text-blue-400">
                <li>Go to <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="underline font-medium">Meta for Developers</a> → My Apps → Select your App</li>
                <li>Navigate to <strong>WhatsApp → API Setup</strong></li>
                <li>Copy your <strong>Phone Number ID</strong> (shown next to your registered number)</li>
                <li>Copy your <strong>WhatsApp Business Account ID</strong> (shown at the top of the page)</li>
                <li>Generate a <strong>Permanent Access Token</strong> via System Users in Business Settings</li>
                <li>Paste all values below and click <strong>Test Connection</strong></li>
              </ol>
              <p className="text-xs text-blue-600 dark:text-blue-500 mt-2">
                💡 Each organization connects their own WhatsApp number. Your tokens are encrypted and never shared.
              </p>
            </div>
          )}

          <p className="text-sm text-gray-500">
            Connect your organization's WhatsApp Business number. Each business enters their own
            Meta credentials — tokens are stored securely per organization.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Phone Number ID</label>
              <input
                className="input mt-1"
                placeholder="e.g. 109876543210123"
                value={form.whatsapp_phone_number_id}
                onChange={(e) => setForm({ ...form, whatsapp_phone_number_id: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Business Account ID</label>
              <input
                className="input mt-1"
                placeholder="e.g. 100575039524433"
                value={form.whatsapp_business_account_id}
                onChange={(e) => setForm({ ...form, whatsapp_business_account_id: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">
              Access Token {hints.whatsapp && <span className="text-xs text-gray-400">(saved: {hints.whatsapp})</span>}
            </label>
            <input
              className="input mt-1"
              type="password"
              placeholder={hints.whatsapp ? "Leave blank to keep current token" : "Paste permanent access token"}
              value={form.whatsapp_access_token}
              onChange={(e) => setForm({ ...form, whatsapp_access_token: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Webhook Verify Token</label>
            <input
              className="input mt-1"
              placeholder="Choose any secret string for webhook verification"
              value={form.whatsapp_webhook_verify_token}
              onChange={(e) => setForm({ ...form, whatsapp_webhook_verify_token: e.target.value })}
            />
            <p className="mt-1 text-xs text-gray-400">
              This is the token you set in Meta Developer Console → WhatsApp → Configuration → Webhook Verify Token.
            </p>
          </div>

          {/* Test Connection Button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={testConnection}
              disabled={conn.testing}
              className="rounded-lg border border-brand-300 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50 dark:border-brand-700 dark:bg-brand-500/10 dark:text-brand-400"
            >
              {conn.testing ? "Testing..." : "🔌 Test Connection"}
            </button>
            {conn.result && (
              <div className={`text-sm font-medium ${conn.result.connected ? "text-green-600" : "text-red-600"}`}>
                {conn.result.connected ? (
                  <span>✅ Connected — {conn.result.verified_name || conn.result.display_phone_number} (Quality: {conn.result.quality_rating || "N/A"})</span>
                ) : (
                  <span>❌ {conn.result.error}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Instagram Connection Card */}
        <div className="card space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📸</span>
            <h2 className="text-lg font-semibold">Instagram Connection</h2>
          </div>
          <p className="text-sm text-gray-500">
            Connect your Instagram Business page for automatic DM responses.
          </p>
          <div>
            <label className="text-sm font-medium">Instagram Page ID</label>
            <input
              className="input mt-1"
              placeholder="e.g. 178965432101234"
              value={form.instagram_page_id}
              onChange={(e) => setForm({ ...form, instagram_page_id: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">
              Instagram Access Token {hints.instagram && <span className="text-xs text-gray-400">(saved: {hints.instagram})</span>}
            </label>
            <input
              className="input mt-1"
              type="password"
              placeholder={hints.instagram ? "Leave blank to keep current token" : "Paste page access token"}
              value={form.instagram_access_token}
              onChange={(e) => setForm({ ...form, instagram_access_token: e.target.value })}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={saving} onClick={save}>
            {saving ? "Saving..." : "Save settings"}
          </button>
          {saved && <span className="text-sm text-green-600">✅ Saved</span>}
        </div>
      </div>
    </AppShell>
  );
}
