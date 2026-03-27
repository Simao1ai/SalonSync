import { useState } from "react";
import { PlatformLayout } from "@/components/layout/PlatformLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Bell, Plus, X, Trash2, Info, AlertTriangle, AlertCircle, Megaphone,
} from "lucide-react";
import { toast } from "sonner";

function getAuthHeaders() {
  const sid = sessionStorage.getItem("__salonsync_dev_sid__");
  return sid ? { Authorization: `Bearer ${sid}` } : {};
}

function useAnnouncements() {
  return useQuery({
    queryKey: ["platform-announcements"],
    queryFn: async () => {
      const r = await fetch("/api/platform/announcements", { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
}

const TYPE_META: Record<string, { label: string; color: string; icon: any }> = {
  info:    { label: "Info",    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",    icon: Info },
  warning: { label: "Warning", color: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: AlertTriangle },
  alert:   { label: "Alert",   color: "text-red-400 bg-red-500/10 border-red-500/20",       icon: AlertCircle },
  update:  { label: "Update",  color: "text-green-400 bg-green-500/10 border-green-500/20", icon: Megaphone },
};

function CreateAnnouncementModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [targetRole, setTargetRole] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      const r = await fetch("/api/platform/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ title, message, type, targetRole: targetRole || null }),
      });
      if (!r.ok) throw new Error("Failed");
      toast.success("Announcement published");
      queryClient.invalidateQueries({ queryKey: ["platform-announcements"] });
      onClose();
      setTitle(""); setMessage(""); setType("info"); setTargetRole("");
    } catch {
      toast.error("Failed to create announcement");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-display font-bold text-white">New Announcement</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-white/60 block mb-1.5">Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. System Maintenance Notice"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-white/60 block mb-1.5">Message *</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Write your announcement..."
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-white/60 block mb-1.5">Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              >
                <option value="info">Info</option>
                <option value="update">Update</option>
                <option value="warning">Warning</option>
                <option value="alert">Alert</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-white/60 block mb-1.5">Target Audience</label>
              <select
                value={targetRole}
                onChange={e => setTargetRole(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              >
                <option value="">All Users</option>
                <option value="ADMIN">Salon Admins</option>
                <option value="STAFF">Staff Only</option>
                <option value="CLIENT">Clients Only</option>
              </select>
            </div>
          </div>
          <Button type="submit" disabled={submitting || !title.trim() || !message.trim()} className="w-full bg-violet-600 hover:bg-violet-700 mt-2">
            {submitting ? "Publishing..." : "Publish Announcement"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export function PlatformAnnouncements() {
  const { data: announcements, isLoading } = useAnnouncements();
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  async function handleDelete(id: number) {
    try {
      const r = await fetch(`/api/platform/announcements/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!r.ok) throw new Error("Failed");
      toast.success("Announcement deleted");
      queryClient.invalidateQueries({ queryKey: ["platform-announcements"] });
    } catch {
      toast.error("Failed to delete");
    }
  }

  return (
    <PlatformLayout>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-white">Announcements</h1>
          <p className="text-white/40 mt-1">Broadcast messages to salons and users across the platform</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-violet-600 hover:bg-violet-700 gap-2">
          <Plus className="w-4 h-4" /> New Announcement
        </Button>
      </div>

      <CreateAnnouncementModal open={showCreate} onClose={() => setShowCreate(false)} />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total", count: announcements?.length ?? 0, color: "text-violet-400", bg: "bg-violet-500/10" },
          { label: "Alerts", count: (announcements ?? []).filter((a: any) => a.type === "alert").length, color: "text-red-400", bg: "bg-red-500/10" },
          { label: "This Week", count: (announcements ?? []).filter((a: any) => {
            const d = new Date(a.createdAt);
            const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
            return d >= weekAgo;
          }).length, color: "text-blue-400", bg: "bg-blue-500/10" },
        ].map(c => (
          <Card key={c.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
                <Bell className={`w-4 h-4 ${c.color}`} />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{c.count}</p>
                <p className="text-xs text-white/40">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6 animate-pulse h-24" /></Card>
          ))
        ) : (announcements ?? []).length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Bell className="w-12 h-12 text-white/10 mx-auto mb-4" />
              <p className="text-white/30 text-sm">No announcements yet</p>
              <p className="text-white/20 text-xs mt-1">Click "New Announcement" to broadcast a message</p>
            </CardContent>
          </Card>
        ) : (
          (announcements ?? []).map((ann: any) => {
            const meta = TYPE_META[ann.type] ?? TYPE_META.info;
            return (
              <Card key={ann.id} className="group">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-8 h-8 rounded-lg ${meta.color.split(" ").slice(1).join(" ")} flex items-center justify-center shrink-0 mt-0.5`}>
                        <meta.icon className={`w-4 h-4 ${meta.color.split(" ")[0]}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-white text-sm">{ann.title}</h3>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${meta.color}`}>
                            {meta.label}
                          </span>
                          {ann.targetRole && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10">
                              {ann.targetRole}s only
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-white/50 whitespace-pre-wrap">{ann.message}</p>
                        <div className="flex items-center gap-3 mt-3 text-xs text-white/30">
                          <span>{ann.createdAt ? format(new Date(ann.createdAt), "MMM d, yyyy 'at' h:mm a") : ""}</span>
                          {ann.createdByFirstName && (
                            <span>by {ann.createdByFirstName} {ann.createdByLastName}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(ann.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all"
                      title="Delete announcement"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </PlatformLayout>
  );
}
