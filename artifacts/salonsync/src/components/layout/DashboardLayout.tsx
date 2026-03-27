import { useState } from "react";
import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { useAuth } from "@workspace/replit-auth-web";
import { Redirect, useLocation } from "wouter";
import { Loader2, Bell, ChevronRight, Menu } from "lucide-react";
import { AiReceptionist } from "../chat/AiReceptionist";
import { useListNotifications } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { useBranding } from "@/contexts/BrandingContext";

const ROUTE_META: Record<string, { title: string; crumb?: string }> = {
  "/admin/dashboard":    { title: "Dashboard",    crumb: "Admin" },
  "/admin/appointments": { title: "Appointments", crumb: "Admin" },
  "/admin/calendar":     { title: "Calendar",     crumb: "Admin" },
  "/admin/schedule":     { title: "Schedule",     crumb: "Admin" },
  "/admin/staff":        { title: "Staff",        crumb: "Admin" },
  "/admin/services":     { title: "Services",     crumb: "Admin" },
  "/admin/analytics":    { title: "Analytics",    crumb: "Admin" },
  "/admin/settings":     { title: "Settings",     crumb: "Admin" },
  "/staff/dashboard":    { title: "My Schedule",  crumb: "Staff" },
  "/staff/clients":      { title: "My Clients",   crumb: "Staff" },
  "/staff/earnings":     { title: "Earnings",     crumb: "Staff" },
  "/client/dashboard":   { title: "My Dashboard", crumb: "Client" },
  "/client/book":        { title: "Book Appointment", crumb: "Client" },
  "/client/reviews":     { title: "My Reviews",   crumb: "Client" },
  "/client/profile":     { title: "Profile",      crumb: "Client" },
};

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: notifications } = useListNotifications({ userId: user?.id });
  const unreadCount = notifications?.filter((n: { isRead: boolean }) => !n.isRead).length ?? 0;

  const branding = useBranding();
  const meta = ROUTE_META[location] ?? { title: branding.name };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080C14] flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
          <div className="absolute -inset-3 bg-primary/10 rounded-3xl blur-xl animate-pulse" />
        </div>
        <p className="text-white/40 text-sm font-medium">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/" />;
  }

  return (
    <div className="flex h-screen bg-[#080C14] text-white overflow-hidden">
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="h-[60px] border-b border-white/[0.06] flex items-center justify-between px-4 md:px-6 shrink-0 bg-[#080C14]/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            {/* Hamburger — mobile only */}
            <button
              className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center text-white/50 hover:bg-white/5 hover:text-white transition-colors"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-sm">
              {meta.crumb && (
                <>
                  <span className="text-white/30 font-medium hidden sm:inline">{meta.crumb}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-white/20 hidden sm:inline" />
                </>
              )}
              <span className="font-semibold text-white">{meta.title}</span>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Notification bell */}
            <button className="relative w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:bg-white/5 hover:text-white/80 transition-colors">
              <Bell className="w-4.5 h-4.5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary border-2 border-[#080C14]" />
              )}
            </button>

            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary text-xs font-bold overflow-hidden cursor-pointer">
              {user?.profileImageUrl
                ? <img src={user.profileImageUrl} alt="" className="w-full h-full object-cover" />
                : [user?.firstName?.charAt(0), user?.lastName?.charAt(0)].filter(Boolean).join("") || "U"
              }
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto relative">
          {/* Ambient background glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/[0.04] rounded-full blur-[100px] pointer-events-none" />
          <div className="relative z-10 p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Floating AI Receptionist for clients */}
      {user?.role === "CLIENT" && <AiReceptionist />}
    </div>
  );
}
