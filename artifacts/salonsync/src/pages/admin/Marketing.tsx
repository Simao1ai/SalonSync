import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListLocations } from "@workspace/api-client-react";
import {
  Megaphone, Sparkles, Mail, MessageSquare, Share2,
  Send, Trash2, Eye, BarChart3, Plus, Loader2, CheckCircle, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { getAuthHeaders } from "@/lib/auth-headers";
import { cn } from "@/lib/utils";

const SEEDED_LOC = "da62c8fa-580b-44c9-bed8-e19938402d39";
type CampaignType = "email" | "sms" | "social";

const TYPE_META: Record<CampaignType, { icon: typeof Mail; label: string; color: string }> = {
  email: { icon: Mail, label: "Email", color: "text-blue-400" },
  sms: { icon: MessageSquare, label: "SMS", color: "text-green-400" },
  social: { icon: Share2, label: "Social", color: "text-purple-400" },
};

const SEGMENTS = [
  "All Clients", "New Clients (last 30 days)", "Lapsed Clients (60+ days)",
  "High Spenders", "Frequent Visitors", "Birthday This Month",
];

const GOALS = [
  "Increase bookings", "Promote new service", "Re-engage lapsed clients",
  "Seasonal promotion", "Fill slow days", "Build loyalty",
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    draft: { bg: "bg-white/10", text: "text-white/60" },
    sent: { bg: "bg-green-500/20", text: "text-green-400" },
    scheduled: { bg: "bg-blue-500/20", text: "text-blue-400" },
  };
  const s = map[status] ?? map.draft;
  return <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium uppercase", s.bg, s.text)}>{status}</span>;
}

export function Marketing() {
  const headers = getAuthHeaders();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"list" | "create" | "preview">("list");
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);

  const [campaignType, setCampaignType] = useState<CampaignType>("email");
  const [segment, setSegment] = useState(SEGMENTS[0]);
  const [goal, setGoal] = useState(GOALS[0]);

  const [generated, setGenerated] = useState<any>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editSms, setEditSms] = useState("");
  const [editSocial, setEditSocial] = useState("");

  const { data: campaigns = [], isLoading } = useQuery<any[]>({
    queryKey: ["campaigns", SEEDED_LOC],
    queryFn: async () => {
      const r = await fetch(`/api/campaigns?locationId=${SEEDED_LOC}`, { headers });
      return r.json();
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/ai/generate-campaign", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: SEEDED_LOC, type: campaignType, segment, goal }),
      });
      if (!r.ok) throw new Error("Generation failed");
      return r.json();
    },
    onSuccess: (data) => {
      setGenerated(data);
      setEditSubject(data.subject || "");
      setEditBody(data.body || "");
      setEditSms(data.smsText || "");
      setEditSocial(data.socialCaption || "");
      toast.success("Campaign content generated!");
    },
    onError: () => toast.error("Failed to generate content"),
  });

  const saveMutation = useMutation({
    mutationFn: async (status: string) => {
      const r = await fetch("/api/campaigns", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: SEEDED_LOC, type: campaignType, segment, goal,
          subject: editSubject, body: editBody, smsText: editSms,
          socialCaption: editSocial, status,
        }),
      });
      return r.json();
    },
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success(status === "sent" ? "Campaign sent!" : "Campaign saved as draft");
      setMode("list");
      setGenerated(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/campaigns/${id}`, { method: "DELETE", headers });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campaign deleted");
    },
  });

  if (mode === "create") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold text-white">Create Campaign</h1>
            <p className="text-sm text-white/40 mt-0.5">AI-powered marketing content</p>
          </div>
          <Button variant="outline" onClick={() => { setMode("list"); setGenerated(null); }}>Back to Campaigns</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white/[0.03] border-white/[0.06]">
            <CardHeader><CardTitle className="text-white text-sm">Campaign Setup</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Campaign Type</label>
                <div className="flex gap-2">
                  {(Object.keys(TYPE_META) as CampaignType[]).map(t => {
                    const meta = TYPE_META[t];
                    const Icon = meta.icon;
                    return (
                      <button key={t} onClick={() => setCampaignType(t)}
                        className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all border",
                          campaignType === t ? "bg-primary/20 border-primary text-primary" : "bg-white/[0.03] border-white/[0.06] text-white/50 hover:border-white/20"
                        )}>
                        <Icon className="w-3.5 h-3.5" /> {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Target Audience</label>
                <select value={segment} onChange={e => setSegment(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                  {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Campaign Goal</label>
                <select value={goal} onChange={e => setGoal(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                  {GOALS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="w-full mt-2">
                {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Generate with AI
              </Button>
            </CardContent>
          </Card>

          {generated && (
            <Card className="bg-white/[0.03] border-white/[0.06]">
              <CardHeader><CardTitle className="text-white text-sm">Review & Edit</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {(campaignType === "email" || campaignType === "social") && (
                  <div>
                    <label className="text-xs text-white/50 mb-1.5 block">Subject Line</label>
                    <input value={editSubject} onChange={e => setEditSubject(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
                  </div>
                )}

                {campaignType === "email" && (
                  <div>
                    <label className="text-xs text-white/50 mb-1.5 block">Email Body</label>
                    <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={8}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none resize-none" />
                  </div>
                )}

                {campaignType === "sms" && (
                  <div>
                    <label className="text-xs text-white/50 mb-1.5 block">SMS Text <span className="text-white/30">({editSms.length}/160)</span></label>
                    <textarea value={editSms} onChange={e => setEditSms(e.target.value.slice(0, 160))} rows={3}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none resize-none" />
                  </div>
                )}

                {campaignType === "social" && (
                  <div>
                    <label className="text-xs text-white/50 mb-1.5 block">Social Caption</label>
                    <textarea value={editSocial} onChange={e => setEditSocial(e.target.value)} rows={4}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none resize-none" />
                  </div>
                )}

                {generated.promotionIdea && (
                  <div className="bg-primary/10 border border-primary/20 rounded-xl p-3">
                    <p className="text-xs font-medium text-primary mb-1">AI Promotion Idea</p>
                    <p className="text-xs text-white/70">{generated.promotionIdea}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button onClick={() => saveMutation.mutate("draft")} variant="outline" className="flex-1">
                    <Clock className="w-3.5 h-3.5 mr-1.5" /> Save Draft
                  </Button>
                  <Button onClick={() => saveMutation.mutate("sent")} className="flex-1">
                    <Send className="w-3.5 h-3.5 mr-1.5" /> Send Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DashboardLayout>
    );
  }

  if (mode === "preview" && selectedCampaign) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-display font-bold text-white">Campaign Preview</h1>
          <Button variant="outline" onClick={() => setMode("list")}>Back</Button>
        </div>
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <StatusBadge status={selectedCampaign.status} />
              <span className="text-xs text-white/40">{selectedCampaign.type?.toUpperCase()}</span>
              <span className="text-xs text-white/30">{new Date(selectedCampaign.createdAt).toLocaleDateString()}</span>
            </div>
            {selectedCampaign.subject && (
              <div>
                <p className="text-xs text-white/50 mb-1">Subject</p>
                <p className="text-white font-medium">{selectedCampaign.subject}</p>
              </div>
            )}
            {selectedCampaign.body && (
              <div>
                <p className="text-xs text-white/50 mb-1">Body</p>
                <div className="bg-white/[0.04] rounded-xl p-4 text-sm text-white/80" dangerouslySetInnerHTML={{ __html: selectedCampaign.body }} />
              </div>
            )}
            {selectedCampaign.smsText && (
              <div>
                <p className="text-xs text-white/50 mb-1">SMS</p>
                <p className="text-sm text-white/80">{selectedCampaign.smsText}</p>
              </div>
            )}
            {selectedCampaign.socialCaption && (
              <div>
                <p className="text-xs text-white/50 mb-1">Social Caption</p>
                <p className="text-sm text-white/80">{selectedCampaign.socialCaption}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Marketing</h1>
          <p className="text-sm text-white/40 mt-0.5">AI-powered campaign management</p>
        </div>
        <Button onClick={() => setMode("create")}>
          <Plus className="w-4 h-4 mr-1.5" /> New Campaign
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Megaphone className="w-12 h-12 text-white/20 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No campaigns yet</h3>
            <p className="text-sm text-white/40 mb-6 max-w-sm">Create your first AI-powered marketing campaign to engage clients and boost bookings.</p>
            <Button onClick={() => setMode("create")}>
              <Sparkles className="w-4 h-4 mr-1.5" /> Create Your First Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c: any) => {
            const meta = TYPE_META[c.type as CampaignType] ?? TYPE_META.email;
            const Icon = meta.icon;
            return (
              <Card key={c.id} className="bg-white/[0.03] border-white/[0.06] hover:border-white/10 transition-all">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-white/[0.06]", meta.color)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{c.subject || c.smsText || "Untitled Campaign"}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StatusBadge status={c.status} />
                      <span className="text-xs text-white/30">{c.segment}</span>
                      <span className="text-xs text-white/20">{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => { setSelectedCampaign(c); setMode("preview"); }}
                      className="p-2 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white transition-all">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteMutation.mutate(c.id)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
