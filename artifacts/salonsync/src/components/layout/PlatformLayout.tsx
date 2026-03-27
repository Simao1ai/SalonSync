import { useState, type ReactNode } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  Users,
  BarChart3,
  Headphones,
  LogOut,
  Sparkles,
  Menu,
  X,
  ChevronRight,
  Bell,
  ShieldCheck,
} from "lucide-react";
import { Loader2 } from "lucide-react";

const navLinks = [
  { href: "/platform/dashboard",  label: "Overview",    icon: LayoutDashboard },
  { href: "/platform/tenants",    label: "Salons",      icon: Building2 },
  { href: "/platform/users",      label: "Users",       icon: Users },
  { href: "/platform/analytics",  label: "Analytics",   icon: BarChart3 },
  { href: "/platform/support",    label: "Support",     icon: Headphones },
];

const ROUTE_META: Record<string, string> = {
  "/platform/dashboard": "Platform Overview",
  "/platform/tenants":   "Salon Management",
  "/platform/users":     "User Management",
  "/platform/analytics": "Platform Analytics",
  "/platform/support":   "Support & Activity",
};

function PlatformSidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const initials = [user?.firstName?.charAt(0), user?.lastName?.charAt(0)].filter(Boolean).join("") || "SA";
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Super Admin";

  const NavContent = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      <div className={cn("flex items-center h-[60px] px-4 shrink-0 border-b border-white/[0.06]", mobile ? "justify-between" : "gap-2.5")}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(139,92,246,0.4)]">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-display text-sm font-bold text-white tracking-wide">SalonSync</span>
            <p className="text-[9px] text-violet-400 font-semibold tracking-widest uppercase leading-none">Platform</p>
          </div>
        </div>
        {mobile && (
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {navLinks.map((link) => {
          const isActive = location === link.href || location.startsWith(link.href + "/");
          return (
            <Link key={link.href} href={link.href} className="block" onClick={mobile ? onClose : undefined}>
              <div className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 cursor-pointer",
                isActive
                  ? "bg-violet-500/15 text-white"
                  : "text-white/40 hover:bg-white/5 hover:text-white/80"
              )}>
                {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-violet-400" />}
                <link.icon className={cn("w-[18px] h-[18px] shrink-0", isActive ? "text-violet-400" : "")} />
                <span className="flex-1 truncate">{link.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/[0.06] p-2 shrink-0 space-y-1">
        <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5">
          <div className="w-7 h-7 rounded-full bg-violet-500/25 border border-violet-500/30 flex items-center justify-center text-violet-300 text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate leading-tight">{fullName}</p>
            <p className="text-[10px] text-violet-400 font-medium">Super Admin</p>
          </div>
        </div>
        <button
          onClick={() => { logout(); if (mobile) onClose(); }}
          className="group w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-white/35 hover:bg-red-500/10 hover:text-red-400 transition-colors duration-150"
        >
          <LogOut className="w-[18px] h-[18px] shrink-0 group-hover:-translate-x-0.5 transition-transform duration-150" />
          <span className="text-sm font-medium">Sign Out</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden md:flex flex-col h-screen w-[220px] bg-[#09101E] border-r border-white/[0.06] shrink-0 z-20">
        <NavContent mobile={false} />
      </aside>

      <div
        className={cn("fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden", mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")}
        onClick={onClose}
      />
      <aside className={cn("fixed top-0 left-0 z-50 flex flex-col h-screen w-[280px] bg-[#09101E] border-r border-white/[0.06] shadow-2xl transition-transform duration-300 ease-in-out md:hidden", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
        <NavContent mobile={true} />
      </aside>
    </>
  );
}

export function PlatformLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080C14] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return <Redirect to="/" />;
  if (user?.role !== "SUPER_ADMIN") return <Redirect to="/" />;

  const title = ROUTE_META[location] ?? "Platform Admin";

  return (
    <div className="flex h-screen bg-[#080C14] text-white overflow-hidden">
      <PlatformSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-[60px] border-b border-white/[0.06] flex items-center justify-between px-4 md:px-6 shrink-0 bg-[#080C14]/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center text-white/50 hover:bg-white/5 hover:text-white transition-colors"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-white/30 font-medium hidden sm:inline">Platform</span>
              <ChevronRight className="w-3.5 h-3.5 text-white/20 hidden sm:inline" />
              <span className="font-semibold text-white">{title}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-xs text-violet-400 font-medium">Super Admin</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300 text-xs font-bold">
              {[user?.firstName?.charAt(0), user?.lastName?.charAt(0)].filter(Boolean).join("") || "SA"}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto relative">
          <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/[0.04] rounded-full blur-[100px] pointer-events-none" />
          <div className="relative z-10 p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
