import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Send, ArrowLeft, Loader2 } from "lucide-react";

function fetchThread(id: string, headers: Record<string, string>) {
  return fetch(`/api/messages/threads/${id}`, { headers }).then(r => r.json());
}

function sendMessage(threadId: string, content: string, headers: Record<string, string>) {
  return fetch(`/api/messages/threads/${threadId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ content }),
  }).then(r => r.json());
}

function markRead(threadId: string, headers: Record<string, string>) {
  return fetch(`/api/messages/threads/${threadId}/read`, {
    method: "POST",
    headers,
  }).then(r => r.json());
}

interface Props {
  threadId: string;
  onBack?: () => void;
}

export function MessageThread({ threadId, onBack }: Props) {
  const { user, getAuthHeaders } = useAuth() as any;
  const qc = useQueryClient();
  const headers = getAuthHeaders?.() ?? {};
  const bottomRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [optimisticMsgs, setOptimisticMsgs] = useState<any[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dm-thread", threadId],
    queryFn: () => fetchThread(threadId, headers),
    refetchOnWindowFocus: false,
  });

  // Mark as read on open
  useEffect(() => {
    if (threadId) markRead(threadId, headers).then(() => {
      qc.invalidateQueries({ queryKey: ["dm-unread-count"] });
      qc.invalidateQueries({ queryKey: ["dm-threads"] });
    });
  }, [threadId]);

  // SSE listener for real-time messages
  useEffect(() => {
    const sid = sessionStorage.getItem("__salonsync_dev_sid__");
    const url = `/api/messages/threads/${threadId}/sse${sid ? `?dev_sid=${sid}` : ""}`;
    const sse = new EventSource(url, { withCredentials: true });

    sse.onmessage = (e) => {
      const payload = JSON.parse(e.data);
      if (payload.type === "message") {
        qc.setQueryData(["dm-thread", threadId], (old: any) => {
          if (!old) return old;
          const exists = old.messages.some((m: any) => m.id === payload.message.id);
          if (exists) return old;
          return { ...old, messages: [...old.messages, payload.message] };
        });
        setOptimisticMsgs(prev => prev.filter(m => m._optimistic !== true));
        qc.invalidateQueries({ queryKey: ["dm-threads"] });
        qc.invalidateQueries({ queryKey: ["dm-unread-count"] });
        // Mark read if not from us
        if (payload.message.senderId !== user?.id) {
          markRead(threadId, headers);
        }
      }
    };

    return () => sse.close();
  }, [threadId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages, optimisticMsgs]);

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendMessage(threadId, content, headers),
    onMutate: (content) => {
      const optimistic = {
        id: `opt-${Date.now()}`,
        senderId: user?.id,
        content,
        sentAt: new Date().toISOString(),
        isRead: false,
        _optimistic: true,
      };
      setOptimisticMsgs(prev => [...prev, optimistic]);
    },
    onSuccess: (msg) => {
      setOptimisticMsgs([]);
      qc.setQueryData(["dm-thread", threadId], (old: any) => {
        if (!old) return old;
        const exists = old.messages.some((m: any) => m.id === msg.id);
        if (exists) return old;
        return { ...old, messages: [...old.messages, msg] };
      });
      qc.invalidateQueries({ queryKey: ["dm-threads"] });
    },
  });

  function handleSend() {
    const content = text.trim();
    if (!content || sendMutation.isPending) return;
    setText("");
    sendMutation.mutate(content);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const thread = data?.thread;
  const allMessages = [...(data?.messages ?? []), ...optimisticMsgs];
  const other = user?.role === "CLIENT" ? thread?.staff : thread?.client;
  const otherName = other ? [other.firstName, other.lastName].filter(Boolean).join(" ") : "…";

  if (isLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] shrink-0 bg-[#0B1120]">
        {onBack && (
          <button onClick={onBack} className="text-white/40 hover:text-white transition-colors mr-1">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/25 flex items-center justify-center text-primary text-xs font-bold shrink-0 overflow-hidden">
          {other?.profileImageUrl
            ? <img src={other.profileImageUrl} alt="" className="w-full h-full object-cover" />
            : [other?.firstName?.charAt(0), other?.lastName?.charAt(0)].filter(Boolean).join("") || "?"}
        </div>
        <div>
          <p className="text-sm font-semibold text-white leading-tight">{otherName}</p>
          <p className="text-[10px] text-white/30 capitalize">{other?.role?.toLowerCase()}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {allMessages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-white/30">No messages yet. Say hello!</p>
          </div>
        )}
        {allMessages.map((msg: any, i: number) => {
          const isMine = msg.senderId === user?.id;
          const prev = allMessages[i - 1];
          const showTime = !prev || new Date(msg.sentAt).getTime() - new Date(prev.sentAt).getTime() > 300000;

          return (
            <div key={msg.id}>
              {showTime && (
                <div className="text-center my-3">
                  <span className="text-[10px] text-white/20 bg-white/[0.03] px-3 py-1 rounded-full">
                    {formatFull(msg.sentAt)}
                  </span>
                </div>
              )}
              <div className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[72%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    msg._optimistic && "opacity-60",
                    isMine
                      ? "bg-primary text-white rounded-br-sm"
                      : "bg-white/[0.06] text-white/85 rounded-bl-sm"
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className={cn("text-[10px] mt-1 text-right", isMine ? "text-white/50" : "text-white/25")}>
                    {new Date(msg.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {msg._optimistic && " · Sending…"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="px-4 py-3 border-t border-white/[0.06] shrink-0 bg-[#0B1120]">
        <div className="flex items-end gap-2.5">
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send)"
            rows={1}
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/25 resize-none focus:outline-none focus:border-primary/40 focus:bg-white/[0.06] transition-all max-h-32 overflow-y-auto"
            style={{ lineHeight: "1.5" }}
            onInput={e => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = Math.min(t.scrollHeight, 128) + "px";
            }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sendMutation.isPending}
            className={cn(
              "flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-all",
              text.trim()
                ? "bg-primary hover:bg-primary/90 text-white shadow-[0_0_12px_rgba(201,149,106,0.4)]"
                : "bg-white/[0.05] text-white/20 cursor-not-allowed"
            )}
          >
            {sendMutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatFull(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Today " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
