import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { DollarSign, Loader2, TrendingUp, TrendingDown, Clock, Sparkles, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthHeaders } from "@/lib/auth-headers";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SEEDED_LOC = "da62c8fa-580b-44c9-bed8-e19938402d39";

export function SmartPricingPanel() {
  const [result, setResult] = useState<any>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const pricingMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/ai/pricing-suggestions", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: SEEDED_LOC }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: (data) => {
      setResult(data);
      setAppliedIds(new Set());
    },
  });

  function applyPrice(serviceId: string, newPrice: number) {
    fetch(`/api/services/${serviceId}`, {
      method: "PUT",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ basePrice: newPrice }),
    }).then(r => {
      if (r.ok) {
        setAppliedIds(prev => new Set(prev).add(serviceId));
        toast.success("Price updated!");
      } else {
        toast.error("Failed to update price");
      }
    });
  }

  return (
    <Card className="bg-white/[0.03] border-white/[0.06]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Smart Pricing
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => pricingMutation.mutate()} disabled={pricingMutation.isPending}
            className="text-xs h-7 px-2.5">
            {pricingMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            Analyze
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!result && !pricingMutation.isPending && (
          <p className="text-xs text-white/30 text-center py-4">Click Analyze to get AI pricing recommendations</p>
        )}

        {pricingMutation.isPending && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
            <span className="text-xs text-white/40">Analyzing pricing data...</span>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            {result.summary && <p className="text-xs text-white/50 mb-3">{result.summary}</p>}

            {result.suggestions?.map((s: any, i: number) => {
              const isIncrease = s.type === "increase" || s.type === "premium_peak";
              const isApplied = appliedIds.has(s.serviceId);
              return (
                <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white">{s.serviceName}</span>
                    <div className="flex items-center gap-1">
                      {isIncrease ? <TrendingUp className="w-3 h-3 text-green-400" /> : <TrendingDown className="w-3 h-3 text-blue-400" />}
                      <span className={cn("text-xs font-semibold", isIncrease ? "text-green-400" : "text-blue-400")}>
                        {s.changePercent > 0 ? "+" : ""}{s.changePercent}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/50 mb-2">
                    <span>${s.currentPrice}</span>
                    <span className="text-white/20">&rarr;</span>
                    <span className="text-white font-medium">${s.suggestedPrice}</span>
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px]",
                      s.confidence === "high" ? "bg-green-500/10 text-green-400" :
                      s.confidence === "medium" ? "bg-yellow-500/10 text-yellow-400" :
                      "bg-white/[0.06] text-white/40"
                    )}>{s.confidence}</span>
                  </div>
                  <p className="text-[11px] text-white/40 mb-2">{s.reason}</p>
                  {isApplied ? (
                    <div className="flex items-center gap-1 text-xs text-green-400"><Check className="w-3 h-3" /> Applied</div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => applyPrice(s.serviceId, s.suggestedPrice)} className="text-xs h-6 px-2">
                      Apply Price
                    </Button>
                  )}
                </div>
              );
            })}

            {result.happyHourSuggestion?.enabled && (
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium text-primary">Happy Hour Suggestion</span>
                </div>
                <p className="text-xs text-white/60">{result.happyHourSuggestion.hours} — {result.happyHourSuggestion.discount}% off</p>
                <p className="text-[10px] text-white/40 mt-1">{result.happyHourSuggestion.reason}</p>
              </div>
            )}

            {result.peakPricingSuggestion?.enabled && (
              <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-xs font-medium text-violet-400">Peak Pricing</span>
                </div>
                <p className="text-xs text-white/60">{result.peakPricingSuggestion.hours} — +{result.peakPricingSuggestion.premium}%</p>
                <p className="text-[10px] text-white/40 mt-1">{result.peakPricingSuggestion.reason}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
