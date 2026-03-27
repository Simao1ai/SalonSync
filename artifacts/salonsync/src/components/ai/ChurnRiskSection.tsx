import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Loader2, UserX, Mail, MessageSquare, Phone, Tag, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthHeaders } from "@/lib/auth-headers";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SEEDED_LOC = "da62c8fa-580b-44c9-bed8-e19938402d39";

const RISK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  HIGH: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
  MEDIUM: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/20" },
  LOW: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20" },
};

const ACTION_ICONS: Record<string, typeof Mail> = {
  email: Mail, sms: MessageSquare, call: Phone, discount: Tag,
};

export function ChurnRiskSection() {
  const [result, setResult] = useState<any>(null);

  const churnMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/ai/churn-prediction", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: SEEDED_LOC }),
      });
      return r.json();
    },
    onSuccess: (data) => {
      setResult(data);
      if (data.clients?.length > 0) toast.info(`Found ${data.clients.length} clients at risk`);
      else toast.success("No clients at high churn risk!");
    },
  });

  return (
    <Card className="bg-white/[0.03] border-white/[0.06]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <UserX className="w-4 h-4 text-red-400" />
            Clients at Risk
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => churnMutation.mutate()} disabled={churnMutation.isPending}
            className="text-xs h-7 px-2.5">
            {churnMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            Analyze
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!result && !churnMutation.isPending && (
          <p className="text-xs text-white/30 text-center py-4">Click Analyze to scan for at-risk clients</p>
        )}

        {churnMutation.isPending && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
            <span className="text-xs text-white/40">Analyzing client behavior...</span>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            {result.summary && <p className="text-xs text-white/50">{result.summary}</p>}
            {result.clients?.length === 0 && <p className="text-xs text-white/40 text-center py-3">All clients are healthy!</p>}
            {result.clients?.slice(0, 5).map((c: any, i: number) => {
              const risk = RISK_COLORS[c.riskLevel] ?? RISK_COLORS.LOW;
              const ActionIcon = ACTION_ICONS[c.actionType] ?? Mail;
              return (
                <div key={i} className={cn("rounded-xl border p-3", risk.border, risk.bg)}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-white">{c.name}</span>
                    <span className={cn("text-[10px] font-bold uppercase", risk.text)}>{c.riskLevel}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {c.riskFactors?.map((f: string, fi: number) => (
                      <span key={fi} className="bg-white/[0.06] text-white/50 text-[10px] px-1.5 py-0.5 rounded">{f}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <ActionIcon className="w-3 h-3" />
                    <span>{c.suggestedAction}</span>
                  </div>
                  {c.daysSinceLastVisit && (
                    <p className="text-[10px] text-white/30 mt-1">{c.daysSinceLastVisit} days since last visit</p>
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
