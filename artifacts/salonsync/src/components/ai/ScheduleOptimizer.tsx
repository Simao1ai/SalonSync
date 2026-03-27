import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles, Zap, Calendar, Users, Clock, CheckCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthHeaders } from "@/lib/auth-headers";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SEEDED_LOC = "da62c8fa-580b-44c9-bed8-e19938402d39";

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  high: { bg: "bg-red-500/10", text: "text-red-400" },
  medium: { bg: "bg-yellow-500/10", text: "text-yellow-400" },
  low: { bg: "bg-green-500/10", text: "text-green-400" },
};

const TYPE_ICONS: Record<string, typeof Zap> = {
  gap_fill: Clock,
  waitlist_placement: Users,
  rearrangement: Calendar,
};

export function ScheduleOptimizer({ weekOf }: { weekOf?: string }) {
  const [result, setResult] = useState<any>(null);
  const [appliedIdx, setAppliedIdx] = useState<Set<number>>(new Set());

  const optimizeMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/ai/optimize-schedule", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: SEEDED_LOC, weekOf }),
      });
      return r.json();
    },
    onSuccess: (data) => {
      setResult(data);
      setAppliedIdx(new Set());
    },
  });

  function applyAction(idx: number) {
    setAppliedIdx(prev => new Set(prev).add(idx));
    toast.success("Suggestion noted for scheduling");
  }

  return (
    <Card className="bg-white/[0.03] border-white/[0.06]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            Schedule Optimizer
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => optimizeMutation.mutate()} disabled={optimizeMutation.isPending}
            className="text-xs h-7 px-2.5">
            {optimizeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            Optimize
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!result && !optimizeMutation.isPending && (
          <p className="text-xs text-white/30 text-center py-4">Click Optimize to analyze your schedule</p>
        )}

        {optimizeMutation.isPending && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
            <span className="text-xs text-white/40">Analyzing schedule...</span>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-white/[0.04] rounded-xl p-3">
              <div>
                <p className="text-xs text-white/50">Schedule Efficiency</p>
                <p className="text-2xl font-bold text-white">{result.efficiencyScore}%</p>
              </div>
              <div className={cn("w-12 h-12 rounded-full flex items-center justify-center",
                result.efficiencyScore >= 80 ? "bg-green-500/20" : result.efficiencyScore >= 50 ? "bg-yellow-500/20" : "bg-red-500/20"
              )}>
                <Sparkles className={cn("w-5 h-5",
                  result.efficiencyScore >= 80 ? "text-green-400" : result.efficiencyScore >= 50 ? "text-yellow-400" : "text-red-400"
                )} />
              </div>
            </div>

            {result.summary && <p className="text-xs text-white/50">{result.summary}</p>}

            {result.suggestions?.map((s: any, i: number) => {
              const prio = PRIORITY_COLORS[s.priority] ?? PRIORITY_COLORS.low;
              const TypeIcon = TYPE_ICONS[s.type] ?? Zap;
              const isApplied = appliedIdx.has(i);
              return (
                <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <TypeIcon className="w-3.5 h-3.5 text-white/40" />
                      <span className="text-sm font-medium text-white">{s.title}</span>
                    </div>
                    <span className={cn("text-[10px] font-bold uppercase px-1.5 py-0.5 rounded", prio.bg, prio.text)}>{s.priority}</span>
                  </div>
                  <p className="text-xs text-white/50 mb-2">{s.description}</p>
                  {s.suggestedDay && s.suggestedTime && (
                    <p className="text-[10px] text-primary mb-2">{s.suggestedDay} at {s.suggestedTime}</p>
                  )}
                  {isApplied ? (
                    <div className="flex items-center gap-1 text-xs text-green-400"><CheckCircle className="w-3 h-3" /> Applied</div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => applyAction(i)} className="text-xs h-6 px-2">
                      Apply
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
