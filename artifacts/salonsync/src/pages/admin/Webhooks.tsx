import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  Webhook, Plus, Trash2, X, Menu, Zap, CheckCircle, AlertCircle, Send, Copy
} from "lucide-react";
import { toast } from "sonner";

const EVENT_TYPES = [
  { key: "appointment.created", label: "Appointment Created" },
  { key: "appointment.cancelled", label: "Appointment Cancelled" },
  { key: "client.created", label: "New Client" },
  { key: "payment.completed", label: "Payment Completed" },
  { key: "review.created", label: "Review Created" },
];

function getHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const sid = sessionStorage.getItem("__salonsync_dev_sid__");
  if (sid) headers["Authorization"] = `Bearer ${sid}`;
  return headers;
}

export function AdminWebhooks() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const qc = useQueryClient();

  const { data: locations } = useQuery<any[]>({
    queryKey: ["locations"],
    queryFn: () => fetch("/api/locations", { headers: getHeaders() }).then(r => r.json()),
  });
  const locationId = locations?.[0]?.id;

  const { data: webhooks = [], isLoading } = useQuery<any[]>({
    queryKey: ["webhooks", locationId],
    queryFn: () => fetch(`/api/webhooks?locationId=${locationId}`, { headers: getHeaders() }).then(r => r.json()),
    enabled: !!locationId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/webhooks", {
        method: "POST", headers: getHeaders(),
        body: JSON.stringify({ locationId, url, events: selectedEvents }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("Webhook created");
      setShowForm(false); setUrl(""); setSelectedEvents([]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/webhooks/${id}`, { method: "DELETE", headers: getHeaders() });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("Webhook deleted");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/webhooks/${id}`, {
        method: "PATCH", headers: getHeaders(),
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/webhooks/${id}/test`, { method: "POST", headers: getHeaders() });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) toast.success(`Test passed! Status: ${data.statusCode}`);
      else toast.error(`Test failed: ${data.error || data.statusText}`);
    },
  });

  function toggleEvent(event: string) {
    setSelectedEvents(prev => prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]);
  }

  return (
    <div className="flex h-screen bg-[#0B1120]">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-[#0B1120]/80 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4 flex items-center gap-3">
          <button onClick={() => setMobileOpen(true)} className="md:hidden text-white/60"><Menu className="w-5 h-5" /></button>
          <Zap className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-lg font-display font-bold text-white">Webhook Integrations</h1>
            <p className="text-xs text-white/40">Connect with Zapier and 5000+ apps</p>
          </div>
        </div>

        <div className="p-6 max-w-4xl mx-auto space-y-6">
          <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <h3 className="text-white font-semibold text-sm">Automate Your Salon</h3>
                <p className="text-white/50 text-xs mt-1">
                  Webhooks send real-time notifications to external services when events happen in your salon.
                  Connect with Zapier, Make, or any custom integration to automate workflows.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <h2 className="text-white font-semibold">Active Webhooks</h2>
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90">
              <Plus className="w-4 h-4" /> Add Webhook
            </button>
          </div>

          {showForm && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-white font-semibold">New Webhook</h3>
                <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Webhook URL *</label>
                <input value={url} onChange={e => setUrl(e.target.value)}
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/20" />
              </div>

              <div>
                <label className="text-xs text-white/50 mb-2 block">Events *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {EVENT_TYPES.map(evt => (
                    <button key={evt.key} onClick={() => toggleEvent(evt.key)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                        selectedEvents.includes(evt.key)
                          ? "bg-primary/15 text-primary border border-primary/30"
                          : "bg-white/[0.03] text-white/50 border border-white/[0.06] hover:border-white/10"
                      }`}>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                        selectedEvents.includes(evt.key) ? "bg-primary border-primary" : "border-white/20"
                      }`}>
                        {selectedEvents.includes(evt.key) && <CheckCircle className="w-3 h-3 text-white" />}
                      </div>
                      {evt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-white/40 hover:text-white text-sm">Cancel</button>
                <button onClick={() => createMutation.mutate()}
                  disabled={!url || selectedEvents.length === 0}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40">
                  Create Webhook
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {isLoading && <p className="text-white/40 text-center py-8 text-sm">Loading...</p>}
            {!isLoading && webhooks.length === 0 && !showForm && (
              <div className="text-center py-16 text-white/30">
                <Webhook className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No webhooks configured yet</p>
                <p className="text-xs mt-1">Add your first webhook to start automating</p>
              </div>
            )}

            {webhooks.map((wh: any) => (
              <div key={wh.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${wh.isActive ? "bg-green-400" : "bg-white/20"}`} />
                      <p className="text-white text-sm font-medium truncate">{wh.url}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(wh.events || []).map((evt: string) => (
                        <span key={evt} className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary/80 rounded-full">{evt}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-white/30">
                      <span>Created: {new Date(wh.createdAt).toLocaleDateString()}</span>
                      {wh.lastTriggeredAt && <span>Last fired: {new Date(wh.lastTriggeredAt).toLocaleDateString()}</span>}
                      {parseInt(wh.failCount || "0") > 0 && (
                        <span className="text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {wh.failCount} failures
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { navigator.clipboard.writeText(wh.secret); toast.success("Secret copied"); }}
                      title="Copy signing secret" className="p-2 text-white/30 hover:text-white hover:bg-white/5 rounded-lg">
                      <Copy className="w-4 h-4" />
                    </button>
                    <button onClick={() => testMutation.mutate(wh.id)}
                      title="Test webhook" className="p-2 text-white/30 hover:text-primary hover:bg-primary/10 rounded-lg">
                      <Send className="w-4 h-4" />
                    </button>
                    <button onClick={() => toggleMutation.mutate({ id: wh.id, isActive: !wh.isActive })}
                      title={wh.isActive ? "Disable" : "Enable"}
                      className={`p-2 rounded-lg ${wh.isActive ? "text-green-400 hover:bg-green-500/10" : "text-white/30 hover:bg-white/5"}`}>
                      <Zap className="w-4 h-4" />
                    </button>
                    <button onClick={() => { if (confirm("Delete this webhook?")) deleteMutation.mutate(wh.id); }}
                      className="p-2 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
