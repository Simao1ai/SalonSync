import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { cn } from "@/lib/utils";
import { MessageSquare, Plus, Search } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

async function fetchThreads(headers: Record<string, string>) {
  const res = await fetch("/api/messages/threads", { headers });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function createThread(body: object, headers: Record<string, string>) {
  return fetch("/api/messages/threads", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  }).then(r => r.json());
}

interface Props {
  selectedThreadId?: string;
  onSelectThread: (id: string) => void;
}

export function MessageInbox({ selectedThreadId, onSelectThread }: Props) {
  const { user, getAuthHeaders } = useAuth() as any;
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["dm-threads"],
    queryFn: () => fetchThreads(getAuthHeaders?.() ?? {}),
    refetchInterval: 15000,
  });

  const filtered = threads.filter((t: any) => {
    const other = user?.role === "CLIENT" ? t.staff : t.client;
    const name = [other?.firstName, other?.lastName].filter(Boolean).join(" ").toLowerCase();
    return !search || name.includes(search.toLowerCase());
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-white/[0.06]">
          <div className="h-4 bg-white/5 rounded animate-pulse w-24" />
        </div>
        {[1,2,3].map(i => (
          <div key={i} className="flex items-center gap-3 p-4 border-b border-white/[0.04]">
            <div className="w-10 h-10 rounded-full bg-white/5 animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-white/5 rounded animate-pulse w-32" />
              <div className="h-3 bg-white/5 rounded animate-pulse w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Messages</h2>
          <span className="text-xs text-white/30">{filtered.length}</span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-white/25 focus:outline-none focus:border-primary/40 focus:bg-white/[0.06] transition-all"
          />
        </div>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-3">
              <MessageSquare className="w-5 h-5 text-white/20" />
            </div>
            <p className="text-sm font-medium text-white/50">No conversations yet</p>
            <p className="text-xs text-white/25 mt-1">Messages from staff will appear here</p>
          </div>
        ) : (
          filtered.map((thread: any) => {
            const other = user?.role === "CLIENT" ? thread.staff : thread.client;
            const name = other ? [other.firstName, other.lastName].filter(Boolean).join(" ") : "Unknown";
            const initials = [other?.firstName?.charAt(0), other?.lastName?.charAt(0)].filter(Boolean).join("") || "?";
            const lastMsg = thread.lastMessage;
            const isSelected = thread.id === selectedThreadId;
            const hasUnread = lastMsg && !lastMsg.isRead && lastMsg.senderId !== user?.id;

            return (
              <button
                key={thread.id}
                onClick={() => onSelectThread(thread.id)}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-3.5 border-b border-white/[0.04] text-left transition-colors hover:bg-white/[0.03]",
                  isSelected && "bg-primary/[0.08] border-l-2 border-l-primary"
                )}
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/25 flex items-center justify-center text-primary text-xs font-bold shrink-0 overflow-hidden">
                  {other?.profileImageUrl
                    ? <img src={other.profileImageUrl} alt="" className="w-full h-full object-cover" />
                    : initials}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className={cn("text-xs font-semibold truncate", hasUnread ? "text-white" : "text-white/70")}>
                      {name}
                    </span>
                    {lastMsg && (
                      <span className="text-[10px] text-white/25 shrink-0">
                        {formatTime(lastMsg.sentAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <p className={cn("text-[11px] truncate flex-1", hasUnread ? "text-white/70" : "text-white/30")}>
                      {lastMsg ? (lastMsg.senderId === user?.id ? "You: " : "") + lastMsg.content : "Start a conversation"}
                    </p>
                    {hasUnread && (
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
