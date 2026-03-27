import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Sparkles, X, Send, Loader2, History, BarChart3, ChevronRight } from "lucide-react";
import { getAuthHeaders } from "@/lib/auth-headers";
import { cn } from "@/lib/utils";

const SEEDED_LOC = "da62c8fa-580b-44c9-bed8-e19938402d39";

const SUGGESTED_QUESTIONS = [
  "What was my revenue last month?",
  "Who are my top 5 clients by spend?",
  "Which stylist has the most cancellations?",
  "What's my busiest day of the week?",
  "How many appointments were booked this week?",
  "What's the average spend per client?",
  "Which services are most popular?",
  "Show me revenue by month for the last 6 months",
];

interface Message {
  role: "user" | "assistant";
  content: string;
  data?: any[];
  chartType?: string;
}

export function AiInsightsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const headers = getAuthHeaders();

  const { data: history = [] } = useQuery<any[]>({
    queryKey: ["ai-insights-history"],
    queryFn: async () => {
      const r = await fetch(`/api/ai/insights/history?locationId=${SEEDED_LOC}`, { headers });
      return r.json();
    },
    enabled: open,
  });

  const askMutation = useMutation({
    mutationFn: async (q: string) => {
      const r = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, locationId: SEEDED_LOC }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: "assistant", content: data.answer, data: data.data, chartType: data.chartType }]);
    },
    onError: () => {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't process that question. Please try rephrasing." }]);
    },
  });

  function handleSubmit(q?: string) {
    const text = q || query.trim();
    if (!text) return;
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setQuery("");
    setShowHistory(false);
    askMutation.mutate(text);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!open) return null;

  return (
    <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] bg-[#0D1420] border-l border-white/[0.08] z-50 flex flex-col shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">AI Business Insights</h3>
            <p className="text-[10px] text-white/40">Ask anything about your business</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowHistory(!showHistory)}
            className="p-2 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white transition-all">
            <History className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showHistory ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <p className="text-xs text-white/40 mb-3">Recent Queries</p>
          {history.length === 0 ? (
            <p className="text-xs text-white/30 text-center py-8">No history yet</p>
          ) : history.map((h: any) => (
            <button key={h.id} onClick={() => { handleSubmit(h.query); }}
              className="w-full text-left bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 hover:border-white/10 transition-all">
              <p className="text-xs text-white/70 truncate">{h.query}</p>
              <p className="text-[10px] text-white/30 mt-1">{new Date(h.createdAt).toLocaleDateString()}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-xs text-white/40">Try asking:</p>
              <div className="grid grid-cols-1 gap-2">
                {SUGGESTED_QUESTIONS.map(q => (
                  <button key={q} onClick={() => handleSubmit(q)}
                    className="flex items-center gap-2 text-left bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5 text-xs text-white/60 hover:border-primary/30 hover:text-white transition-all">
                    <ChevronRight className="w-3 h-3 text-primary/60 shrink-0" />
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[90%] rounded-2xl px-4 py-2.5 text-sm",
                m.role === "user" ? "bg-primary/20 text-white" : "bg-white/[0.04] text-white/80"
              )}>
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.data && m.data.length > 0 && (
                  <div className="mt-3 bg-white/[0.04] rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          {Object.keys(m.data[0]).slice(0, 5).map(k => (
                            <th key={k} className="px-2 py-1.5 text-left text-white/40 font-medium">{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {m.data.slice(0, 10).map((row: any, ri: number) => (
                          <tr key={ri} className="border-b border-white/[0.04]">
                            {Object.keys(m.data![0]).slice(0, 5).map(k => (
                              <td key={k} className="px-2 py-1.5 text-white/60">{String(row[k] ?? "")}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ))}

          {askMutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-white/[0.04] rounded-2xl px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}

      <div className="p-3 border-t border-white/[0.06]">
        <form onSubmit={e => { e.preventDefault(); handleSubmit(); }} className="flex gap-2">
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Ask about your business..."
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/40" />
          <button type="submit" disabled={!query.trim() || askMutation.isPending}
            className="bg-primary hover:bg-primary/90 text-white rounded-xl px-3 py-2.5 transition-all disabled:opacity-40">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

export function AiInsightsButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 transition-all flex items-center justify-center group">
      <Sparkles className="w-6 h-6 group-hover:scale-110 transition-transform" />
    </button>
  );
}
