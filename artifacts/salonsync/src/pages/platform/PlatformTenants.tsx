import { useState } from "react";
import { PlatformLayout } from "@/components/layout/PlatformLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import {
  Building2, MapPin, Users, Calendar, DollarSign,
  Star, Scissors, Search, TrendingUp, MoreVertical,
  CheckCircle2, XCircle, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

function getAuthHeaders() {
  const sid = sessionStorage.getItem("__salonsync_dev_sid__");
  return sid ? { Authorization: `Bearer ${sid}` } : {};
}

function useTenants() {
  return useQuery({
    queryKey: ["platform-tenants"],
    queryFn: async () => {
      const r = await fetch("/api/platform/tenants", { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
}

export function PlatformTenants() {
  const { data: tenants, isLoading } = useTenants();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"revenue" | "appointments" | "rating" | "name">("revenue");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const queryClient = useQueryClient();

  const filtered = (tenants ?? [])
    .filter((t: any) => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.city?.toLowerCase().includes(search.toLowerCase()))
    .sort((a: any, b: any) => {
      const mul = sortDir === "desc" ? -1 : 1;
      if (sortBy === "name") return mul * a.name.localeCompare(b.name);
      return mul * ((Number(a[sortBy]) || 0) - (Number(b[sortBy]) || 0));
    });

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortBy(col); setSortDir("desc"); }
  }

  function SortIcon({ col }: { col: typeof sortBy }) {
    if (sortBy !== col) return <ChevronDown className="w-3 h-3 text-white/20" />;
    return sortDir === "desc"
      ? <ChevronDown className="w-3 h-3 text-violet-400" />
      : <ChevronUp className="w-3 h-3 text-violet-400" />;
  }

  const totalRevenue = (tenants ?? []).reduce((s: number, t: any) => s + Number(t.revenue), 0);

  return (
    <PlatformLayout>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-white">Salon Management</h1>
          <p className="text-white/40 mt-1">All salon locations across the SalonSync network</p>
        </div>
        <Button className="bg-violet-600 hover:bg-violet-700 gap-2">
          <Building2 className="w-4 h-4" /> Add Salon
        </Button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Salons", value: tenants?.length ?? 0, icon: Building2, color: "text-violet-400" },
          { label: "Total Revenue", value: formatCurrency(totalRevenue), icon: DollarSign, color: "text-emerald-400" },
          { label: "Total Appointments", value: (tenants ?? []).reduce((s: number, t: any) => s + t.appointments, 0).toLocaleString(), icon: Calendar, color: "text-blue-400" },
          { label: "Total Staff", value: (tenants ?? []).reduce((s: number, t: any) => s + t.staff, 0), icon: Users, color: "text-primary" },
        ].map(card => (
          <Card key={card.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <card.icon className={`w-5 h-5 ${card.color} shrink-0`} />
              <div>
                <p className="text-lg font-bold text-white">{card.value}</p>
                <p className="text-xs text-white/40">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="border-b border-white/5 pb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search salons..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              />
            </div>
          </div>
        </CardHeader>

        {/* Table header */}
        <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] gap-4 px-6 py-3 border-b border-white/5 text-xs font-semibold text-white/30 uppercase tracking-wider">
          <button className="text-left flex items-center gap-1.5" onClick={() => toggleSort("name")}>Salon <SortIcon col="name" /></button>
          <button className="text-right flex items-center justify-end gap-1.5" onClick={() => toggleSort("revenue")}>Revenue <SortIcon col="revenue" /></button>
          <button className="text-right flex items-center justify-end gap-1.5" onClick={() => toggleSort("appointments")}>Apts <SortIcon col="appointments" /></button>
          <button className="text-right flex items-center justify-end gap-1.5" onClick={() => toggleSort("rating")}>Rating <SortIcon col="rating" /></button>
          <span className="text-right">Last Activity</span>
          <span className="text-right">Status</span>
        </div>

        <div className="divide-y divide-white/5">
          {isLoading
            ? Array.from({length: 3}).map((_, i) => <div key={i} className="p-6 animate-pulse h-20 bg-white/[0.01]" />)
            : filtered.map((tenant: any) => (
              <div key={tenant.id} className="px-6 py-4 hover:bg-white/[0.02] transition-colors">
                {/* Mobile layout */}
                <div className="flex items-start justify-between md:hidden gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400 text-lg font-bold shrink-0">
                      {tenant.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{tenant.name}</p>
                      <p className="text-xs text-white/40">{tenant.city}, {tenant.state}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 mt-3 md:hidden text-sm text-white/60">
                  <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> {formatCurrency(tenant.revenue)}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {tenant.appointments} apts</span>
                  <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-yellow-400" /> {tenant.avgRating}</span>
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {tenant.staff} staff</span>
                </div>

                {/* Desktop layout */}
                <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] gap-4 items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400 font-bold shrink-0">
                      {tenant.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm">{tenant.name}</p>
                      <p className="text-xs text-white/40 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {tenant.city}, {tenant.state}
                      </p>
                    </div>
                  </div>
                  <p className="text-right font-semibold text-emerald-400 text-sm">{formatCurrency(tenant.revenue)}</p>
                  <div className="text-right">
                    <p className="font-semibold text-white text-sm">{tenant.appointments}</p>
                    <p className="text-xs text-white/30">{tenant.staff} staff · {tenant.clients} clients</p>
                  </div>
                  <div className="text-right flex items-center justify-end gap-1">
                    <Star className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="font-semibold text-white text-sm">{Number(tenant.avgRating) > 0 ? tenant.avgRating : "—"}</span>
                  </div>
                  <p className="text-right text-xs text-white/40">
                    {tenant.lastActivity ? format(new Date(tenant.lastActivity), "MMM d") : "—"}
                  </p>
                  <div className="flex justify-end">
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                      <CheckCircle2 className="w-3 h-3" /> Active
                    </span>
                  </div>
                </div>
              </div>
            ))}
          {!isLoading && filtered.length === 0 && (
            <div className="p-12 text-center text-white/30">No salons found</div>
          )}
        </div>
      </Card>
    </PlatformLayout>
  );
}
