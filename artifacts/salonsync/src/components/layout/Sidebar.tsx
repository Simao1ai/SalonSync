import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  CalendarRange,
  Users,
  Scissors,
  BarChart3,
  Settings,
  LogOut,
  Sparkles,
  DollarSign,
  Star,
  UserCircle,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import { useListNotifications } from "@workspace/api-client-react";

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const role = user?.role || "CLIENT";
  const [collapsed, setCollapsed] = useState(false);

  const { data: notifications } = useListNotifications({ userId: user?.id });
  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

  const adminLinks = [
    { href: "/admin/dashboard",    label: "Dashboard",       icon: LayoutDashboard },
    { href: "/admin/appointments", label: "Appointments",    icon: Calendar },
    { href: "/admin/calendar",     label: "Calendar",        icon: CalendarRange },
    { href: "/admin/staff",        label: "Staff",           icon: Users },
    { href: "/admin/services",     label: "Services",        icon: Scissors },
    { href: "/admin/analytics",    label: "Analytics",       icon: BarChart3 },
    { href: "/admin/settings",     label: "Settings",        icon: Settings },
  ];

  const staffLinks = [
    { href: "/staff/dashboard", label: "My Schedule", icon: LayoutDashboard },
    { href: "/staff/clients",   label: "My Clients",  icon: Users },
    { href: "/staff/earnings",  label: "Earnings",    icon: DollarSign },
  ];

  const clientLinks = [
    { href: "/client/dashboard", label: "My Dashboard",     icon: LayoutDashboard },
    { href: "/client/book",      label: "Book Appointment", icon: Calendar },
    { href: "/client/reviews",   label: "My Reviews",       icon: Star },
    { href: "/client/profile",   label: "Profile",          icon: UserCircle, badge: unreadCount },
  ];

  const links = role === "ADMIN" ? adminLinks : role === "STAFF" ? staffLinks : clientLinks;
  const initials = [user?.firstName?.charAt(0), user?.lastName?.charAt(0)].filter(Boolean).join("") || user?.email?.charAt(0) || "U";
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "User";

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-screen bg-[#09101E] border-r border-white/[0.06] shrink-0 transition-all duration-300 ease-in-out relative z-20",
        collapsed ? "w-[68px]" : "w-[220px]"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center h-[60px] px-4 shrink-0 border-b border-white/[0.06]", collapsed ? "justify-center" : "gap-2.5")}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(201,149,106,0.35)]">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <span className="font-display text-lg font-bold text-white tracking-wide truncate">SalonSync</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {links.map((link) => {
          const isActive = location === link.href || location.startsWith(link.href + "/");
          const badge = "badge" in link ? link.badge : 0;
          return (
            <Link key={link.href} href={link.href} className="block">
              <div
                title={collapsed ? link.label : undefined}
                className={cn(
                  "group relative flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 cursor-pointer",
                  collapsed ? "justify-center" : "gap-3",
                  isActive
                    ? "bg-primary/12 text-white"
                    : "text-white/40 hover:bg-white/5 hover:text-white/80"
                )}
              >
                {/* Active indicator */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-primary" />
                )}

                <link.icon className={cn("shrink-0 transition-colors duration-150", isActive ? "text-primary" : "", collapsed ? "w-5 h-5" : "w-[18px] h-[18px]")} />

                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{link.label}</span>
                    {badge > 0 && (
                      <span className="ml-auto bg-primary text-white text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {badge > 9 ? "9+" : badge}
                      </span>
                    )}
                  </>
                )}

                {/* Badge dot in collapsed mode */}
                {collapsed && badge > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary border border-[#09101E]" />
                )}

                {/* Tooltip in collapsed mode */}
                {collapsed && (
                  <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#1A2234] border border-white/10 rounded-lg text-xs text-white whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 -translate-x-2 transition-all duration-150 z-50 shadow-xl">
                    {link.label}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: user + collapse */}
      <div className="border-t border-white/[0.06] p-2 shrink-0 space-y-1">
        {/* User row */}
        <div
          title={collapsed ? fullName : undefined}
          className={cn("flex items-center rounded-xl px-3 py-2.5 hover:bg-white/5 transition-colors cursor-default", collapsed ? "justify-center" : "gap-2.5")}
        >
          <div className="w-7 h-7 rounded-full bg-primary/25 border border-primary/30 flex items-center justify-center text-primary text-xs font-bold shrink-0 overflow-hidden">
            {user?.profileImageUrl
              ? <img src={user.profileImageUrl} alt="" className="w-full h-full object-cover" />
              : initials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate leading-tight">{fullName}</p>
              <p className="text-[10px] text-white/35 capitalize">{role.toLowerCase()}</p>
            </div>
          )}
        </div>

        {/* Sign out */}
        <button
          onClick={() => logout()}
          title={collapsed ? "Sign Out" : undefined}
          className={cn(
            "group w-full flex items-center rounded-xl px-3 py-2.5 text-white/35 hover:bg-red-500/10 hover:text-red-400 transition-colors duration-150",
            collapsed ? "justify-center" : "gap-3"
          )}
        >
          <LogOut className="w-[18px] h-[18px] shrink-0 group-hover:-translate-x-0.5 transition-transform duration-150" />
          {!collapsed && <span className="text-sm font-medium">Sign Out</span>}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "group w-full flex items-center rounded-xl px-3 py-2.5 text-white/25 hover:bg-white/5 hover:text-white/60 transition-colors duration-150",
            collapsed ? "justify-center" : "gap-3"
          )}
        >
          {collapsed
            ? <PanelLeft className="w-[18px] h-[18px] shrink-0" />
            : <><PanelLeftClose className="w-[18px] h-[18px] shrink-0" /><span className="text-sm font-medium">Collapse</span></>
          }
        </button>
      </div>
    </aside>
  );
}
