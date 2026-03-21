import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heart, CheckCircle2, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { getAuthHeaders } from "@/lib/auth-headers";

interface TipPromptProps {
  appointmentId: string;
  staffName: string;
  serviceTotal: number;
}

const PRESETS = [0.15, 0.18, 0.20, 0.25];

export function TipPrompt({ appointmentId, staffName, serviceTotal }: TipPromptProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [alreadyTipped, setAlreadyTipped] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if already tipped
  useEffect(() => {
    fetch(`/api/tips/appointment/${appointmentId}`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(d => setAlreadyTipped(d.tipped))
      .catch(() => setAlreadyTipped(false));
  }, [appointmentId]);

  const tipAmount = selected !== null
    ? Math.round(serviceTotal * selected * 100) / 100
    : custom ? parseFloat(custom) : 0;

  const isValid = tipAmount >= 0.5;

  const handleTip = async () => {
    if (!isValid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tips", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ appointmentId, amount: tipAmount }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to send tip");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (alreadyTipped === null) return null;
  if (alreadyTipped || done) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        <span>Tip sent — thank you for your generosity!</span>
      </div>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent mt-3">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold">Leave a tip for {staffName}?</p>
        </div>

        {/* Preset buttons */}
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map(pct => (
            <button
              key={pct}
              onClick={() => { setSelected(selected === pct ? null : pct); setCustom(""); }}
              className={`rounded-lg py-2 text-xs font-bold transition-all border ${
                selected === pct
                  ? "bg-primary text-white border-primary"
                  : "border-white/10 bg-white/5 hover:border-primary/50 text-muted-foreground hover:text-white"
              }`}
            >
              <span className="block">{(pct * 100).toFixed(0)}%</span>
              <span className="block text-[10px] opacity-70">{formatCurrency(serviceTotal * pct)}</span>
            </button>
          ))}
        </div>

        {/* Custom amount */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <Input
              type="number"
              min="0.50"
              step="0.50"
              placeholder="Custom"
              value={custom}
              onChange={e => { setCustom(e.target.value); setSelected(null); }}
              className="pl-6 h-9 text-sm"
            />
          </div>
          {tipAmount > 0 && (
            <span className="text-sm font-bold text-primary whitespace-nowrap">
              = {formatCurrency(tipAmount)}
            </span>
          )}
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <Button
          size="sm"
          className="w-full"
          disabled={!isValid || loading}
          onClick={handleTip}
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" />Processing…</>
          ) : (
            <><Heart className="w-4 h-4 mr-2" />Send {isValid ? formatCurrency(tipAmount) : ""} Tip</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
