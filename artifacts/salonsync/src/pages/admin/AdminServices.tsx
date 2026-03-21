import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useListServices } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Scissors, Plus, Clock, DollarSign, Search, Zap } from "lucide-react";

const LOCATION_ID = "da62c8fa-580b-44c9-bed8-e19938402d39";

export function AdminServices() {
  const [search, setSearch] = useState("");
  const { data: services, isLoading } = useListServices({ locationId: LOCATION_ID });

  const filtered = (services ?? []).filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  const avgPrice = services && services.length > 0
    ? services.reduce((sum, s) => sum + parseFloat(s.price), 0) / services.length
    : 0;

  const highValue = services?.filter(s => s.requiresDeposit) ?? [];

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold">Services</h1>
          <p className="text-muted-foreground mt-1">Manage your service catalog and pricing</p>
        </div>
        <Button className="gap-2"><Plus className="w-4 h-4" /> Add Service</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Scissors className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{services?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total Services</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(avgPrice)}</p>
              <p className="text-xs text-muted-foreground">Avg. Price</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{highValue.length}</p>
              <p className="text-xs text-muted-foreground">High-Value (Deposit Required)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search services..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>
        </CardHeader>
        <div className="divide-y divide-white/5">
          {isLoading && (
            <div className="p-8 text-center text-muted-foreground">Loading services...</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No services found.</div>
          )}
          {filtered.map(service => (
            <div key={service.id} className="flex items-center justify-between px-6 py-5 hover:bg-white/[0.02] transition-colors group">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${service.requiresDeposit ? "bg-rose-500/20" : "bg-primary/20"}`}>
                  <Scissors className={`w-5 h-5 ${service.requiresDeposit ? "text-rose-400" : "text-primary"}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{service.name}</h4>
                    {service.requiresDeposit && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/20 text-rose-400 border border-rose-500/30">
                        Deposit Required
                      </span>
                    )}
                  </div>
                  {service.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{service.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-8 text-right">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">{service.durationMinutes} min</span>
                </div>
                <div>
                  <p className="font-bold text-lg">{formatCurrency(parseFloat(service.price))}</p>
                  {service.requiresDeposit && service.depositAmount && (
                    <p className="text-xs text-muted-foreground">{formatCurrency(parseFloat(service.depositAmount))} deposit</p>
                  )}
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" className="text-xs">Edit</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </DashboardLayout>
  );
}
