import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface PaymentRow {
  payment: {
    id: string;
    amount: number;
    type: string;
    status: string | null;
    stripeId: string | null;
    appointmentId: string;
    createdAt: string;
  };
  appointment: {
    id: string;
    totalPrice: number;
    startTime: string;
    status: string | null;
  } | null;
}

const STATUS_STYLES: Record<string, string> = {
  succeeded: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  pending:   "bg-amber-500/15 text-amber-400 border-amber-500/30",
  failed:    "bg-red-500/15 text-red-400 border-red-500/30",
  refunded:  "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

const TYPE_LABEL: Record<string, string> = {
  DEPOSIT:      "Deposit",
  FULL_PAYMENT: "Full Payment",
};

export function PaymentHistory() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/history", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch payment history");
      const data = await res.json();
      setRows(data);
    } catch {
      setError("Could not load payment history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, []);

  return (
    <Card className="bg-[#0A0F1D] border-white/5">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center border border-primary/20">
            <CreditCard className="w-4 h-4 text-primary" />
          </div>
          <CardTitle className="text-lg font-semibold">Payment History</CardTitle>
        </div>
        <button
          onClick={fetchHistory}
          className="text-white/30 hover:text-white/60 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </CardHeader>

      <CardContent>
        {loading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        )}

        {error && !loading && (
          <p className="text-sm text-red-400 text-center py-6">{error}</p>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="text-center py-10">
            <CreditCard className="w-10 h-10 text-white/15 mx-auto mb-3" />
            <p className="text-sm text-white/30">No payments yet</p>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="space-y-2.5">
            {rows.map(({ payment, appointment }) => (
              <div
                key={payment.id}
                className="flex items-center justify-between gap-4 bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3.5 hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <CreditCard className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {TYPE_LABEL[payment.type] ?? payment.type}
                    </p>
                    {appointment?.startTime && (
                      <p className="text-xs text-white/35 mt-0.5">
                        {format(parseISO(appointment.startTime), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <Badge className={cn("text-[10px] border capitalize", STATUS_STYLES[payment.status ?? "pending"] ?? "bg-white/10 text-white")}>
                    {payment.status ?? "pending"}
                  </Badge>
                  <span className="text-sm font-bold text-white w-20 text-right">
                    ${payment.amount.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
