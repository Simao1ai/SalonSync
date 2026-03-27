import { useState } from "react";
import { PlatformLayout } from "@/components/layout/PlatformLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Users, Search, Shield, Scissors, UserCircle,
  ShieldCheck, ChevronDown, ChevronUp, Building2, Eye,
} from "lucide-react";
import { toast } from "sonner";

function getAuthHeaders() {
  const sid = sessionStorage.getItem("__salonsync_dev_sid__");
  return sid ? { Authorization: `Bearer ${sid}` } : {};
}

function useUsers() {
  return useQuery({
    queryKey: ["platform-users"],
    queryFn: async () => {
      const r = await fetch("/api/platform/users", { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
}

const ROLE_META: Record<string, { label: string; color: string; icon: any }> = {
  ADMIN:       { label: "Admin",  color: "text-primary bg-primary/10 border-primary/30",          icon: Shield },
  STAFF:       { label: "Staff",  color: "text-blue-400 bg-blue-500/10 border-blue-500/30",        icon: Scissors },
  CLIENT:      { label: "Client", color: "text-white/60 bg-white/5 border-white/10",               icon: UserCircle },
  SUPER_ADMIN: { label: "Super",  color: "text-violet-400 bg-violet-500/10 border-violet-500/30",  icon: ShieldCheck },
};

const ROLE_FILTERS = ["All", "ADMIN", "STAFF", "CLIENT"];

export function PlatformUsers() {
  const { data: users, isLoading } = useUsers();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"name" | "role" | "createdAt">("createdAt");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [impersonating, setImpersonating] = useState<string | null>(null);

  const filtered = (users ?? [])
    .filter((u: any) => {
      const matchRole = roleFilter === "All" || u.role === roleFilter;
      const matchSearch = !search ||
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.firstName?.toLowerCase().includes(search.toLowerCase()) ||
        u.lastName?.toLowerCase().includes(search.toLowerCase()) ||
        u.locationName?.toLowerCase().includes(search.toLowerCase());
      return matchRole && matchSearch;
    })
    .sort((a: any, b: any) => {
      const mul = sortDir === "desc" ? -1 : 1;
      if (sortBy === "name") return mul * `${a.firstName}${a.lastName}`.localeCompare(`${b.firstName}${b.lastName}`);
      if (sortBy === "role") return mul * a.role.localeCompare(b.role);
      return mul * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortBy(col); setSortDir("desc"); }
  }

  function SortIcon({ col }: { col: typeof sortBy }) {
    if (sortBy !== col) return <ChevronDown className="w-3 h-3 text-white/20" />;
    return sortDir === "desc" ? <ChevronDown className="w-3 h-3 text-violet-400" /> : <ChevronUp className="w-3 h-3 text-violet-400" />;
  }

  async function handleImpersonate(userId: string) {
    setImpersonating(userId);
    try {
      const r = await fetch(`/api/platform/impersonate/${userId}`, {
        method: "POST",
        credentials: "include",
        headers: { ...getAuthHeaders() },
      });
      const data = await r.json();
      if (!r.ok) {
        toast.error(data.error || "Failed to impersonate");
        return;
      }
      toast.success(`Now viewing as ${data.user.firstName || data.user.email}`);
      window.location.href = data.redirectTo || "/";
    } catch {
      toast.error("Failed to impersonate user");
    } finally {
      setImpersonating(null);
    }
  }

  const counts = (users ?? []).reduce((acc: any, u: any) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <PlatformLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-white">User Management</h1>
        <p className="text-white/40 mt-1">All users across every salon on the platform</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { role: "ADMIN",  label: "Admins",  icon: Shield,      color: "text-primary",    bg: "bg-primary/10" },
          { role: "STAFF",  label: "Staff",   icon: Scissors,    color: "text-blue-400",   bg: "bg-blue-500/10" },
          { role: "CLIENT", label: "Clients", icon: UserCircle,  color: "text-white/60",   bg: "bg-white/5" },
          { role: "ALL",    label: "Total",   icon: Users,       color: "text-violet-400", bg: "bg-violet-500/10" },
        ].map(card => (
          <Card
            key={card.role}
            className={`cursor-pointer transition-colors ${roleFilter === (card.role === "ALL" ? "All" : card.role) ? "border-violet-500/40" : ""}`}
            onClick={() => setRoleFilter(card.role === "ALL" ? "All" : card.role)}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <div>
                <p className="text-lg font-bold text-white">
                  {card.role === "ALL" ? (users?.length ?? 0) : (counts[card.role] ?? 0)}
                </p>
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
                placeholder="Search by name, email, or salon..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              />
            </div>
            <div className="flex gap-1.5">
              {ROLE_FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => setRoleFilter(f)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${roleFilter === f ? "bg-violet-600 text-white" : "bg-white/5 text-white/50 hover:bg-white/10"}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <div className="hidden md:grid grid-cols-[2fr_1fr_1.5fr_1fr_80px] gap-4 px-6 py-3 border-b border-white/5 text-xs font-semibold text-white/30 uppercase tracking-wider">
          <button className="text-left flex items-center gap-1.5" onClick={() => toggleSort("name")}>User <SortIcon col="name" /></button>
          <button className="flex items-center gap-1.5" onClick={() => toggleSort("role")}>Role <SortIcon col="role" /></button>
          <span>Salon</span>
          <button className="text-right flex items-center justify-end gap-1.5" onClick={() => toggleSort("createdAt")}>Joined <SortIcon col="createdAt" /></button>
          <span className="text-center">Actions</span>
        </div>

        <div className="divide-y divide-white/5">
          {isLoading
            ? Array.from({length: 5}).map((_, i) => <div key={i} className="p-4 animate-pulse h-16" />)
            : filtered.map((user: any) => {
              const meta = ROLE_META[user.role] ?? ROLE_META.CLIENT;
              const initials = [user.firstName?.charAt(0), user.lastName?.charAt(0)].filter(Boolean).join("") || user.email?.charAt(0)?.toUpperCase() || "?";
              return (
                <div key={user.id} className="px-6 py-3.5 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center justify-between md:grid md:grid-cols-[2fr_1fr_1.5fr_1fr_80px] gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-300 text-xs font-bold shrink-0">
                        {initials}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {[user.firstName, user.lastName].filter(Boolean).join(" ") || "\u2014"}
                        </p>
                        <p className="text-xs text-white/40">{user.email}</p>
                      </div>
                    </div>
                    <div className="hidden md:flex">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border font-medium ${meta.color}`}>
                        <meta.icon className="w-3 h-3" />
                        {meta.label}
                      </span>
                    </div>
                    <div className="hidden md:flex items-center gap-1.5 text-xs text-white/50">
                      {user.locationName
                        ? <><Building2 className="w-3 h-3" /> {user.locationName}</>
                        : <span className="text-white/20">\u2014</span>}
                    </div>
                    <p className="text-xs text-white/40 text-right hidden md:block">
                      {user.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "\u2014"}
                    </p>
                    <div className="flex items-center justify-center">
                      <button
                        onClick={() => handleImpersonate(user.id)}
                        disabled={impersonating === user.id}
                        title="Login as this user"
                        className="p-1.5 rounded-lg hover:bg-amber-500/10 text-white/30 hover:text-amber-400 transition-colors disabled:opacity-50"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                    <span className={`md:hidden inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${meta.color}`}>
                      {meta.label}
                    </span>
                  </div>
                </div>
              );
            })}
          {!isLoading && filtered.length === 0 && (
            <div className="p-12 text-center text-white/30">No users found</div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-white/5 text-xs text-white/30">
          Showing {filtered.length} of {users?.length ?? 0} users
        </div>
      </Card>
    </PlatformLayout>
  );
}
