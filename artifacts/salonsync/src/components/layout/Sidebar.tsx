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
  Bell,
} from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import { useListNotifications } from "@workspace/api-client-react";

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const role = user?.role || "CLIENT";

  const { data: notifications } = useListNotifications({ userId: user?.id });
  const unreadCount = notifications?.filter(n => !n.isRead).length ?? 0;

  const adminLinks = [
    { href: "/admin/dashboard",     label: "Dashboard",     icon: LayoutDashboard },
    { href: "/admin/appointments",  label: "Appointments",  icon: Calendar },
    { href: "/admin/calendar",      label: "Calendar",      icon: CalendarRange },
    { href: "/admin/staff",         label: "Staff",         icon: Users },
    { href: "/admin/services",      label: "Services",      icon: Scissors },
    { href: "/admin/analytics",     label: "Analytics",     icon: BarChart3 },
    { href: "/admin/settings",      label: "Settings",      icon: Settings },
  ];

  const staffLinks = [
    { href: "/staff/dashboard",  label: "My Schedule",  icon: LayoutDashboard },
    { href: "/staff/clients",    label: "My Clients",   icon: Users },
    { href: "/staff/earnings",   label: "Earnings",     icon: DollarSign },
  ];

  const clientLinks = [
    { href: "/client/dashboard", label: "My Dashboard",      icon: LayoutDashboard },
    { href: "/client/book",      label: "Book Appointment",  icon: Calendar },
    { href: "/client/reviews",   label: "My Reviews",        icon: Star },
    { href: "/client/profile",   label: "Profile",           icon: UserCircle, badge: unreadCount > 0 ? unreadCount : 0 },
  ];

  const links = role === "ADMIN" ? adminLinks : role === "STAFF" ? staffLinks : clientLinks;

  return (
    <div className="w-72 bg-[#0A0F1D] border-r border-white/5 h-screen flex flex-col hidden md:flex shrink-0 relative z-10 shadow-2xl">
      <div className="p-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-[0_0_15px_rgba(201,149,106,0.3)]">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <h1 className="font-display text-2xl font-bold text-white tracking-wide">SalonSync</h1>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {links.map((link) => {
          const isActive = location === link.href || location.startsWith(link.href + "/");
          const badge = "badge" in link ? link.badge : 0;
          return (
            <Link key={link.href} href={link.href} className="block">
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                  isActive
                    ? "bg-primary/10 text-primary shadow-[inset_2px_0_0_0_rgba(201,149,106,1)]"
                    : "text-muted-foreground hover:bg-white/5 hover:text-white"
                )}
              >
                <link.icon className={cn("w-5 h-5 transition-transform duration-200 shrink-0", isActive ? "scale-110" : "group-hover:scale-110")} />
                <span className="flex-1">{link.label}</span>
                {badge > 0 && (
                  <span className="bg-primary text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-6 border-t border-white/5 bg-[#0F172A]/50">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden border border-primary/30">
            {user?.profileImageUrl ? (
              <img src={user.profileImageUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              user?.firstName?.charAt(0) || user?.email?.charAt(0) || "U"
            )}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium text-white truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-primary capitalize">{role.toLowerCase()}</p>
          </div>
        </div>

        <button
          onClick={() => logout()}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-destructive transition-colors duration-200 group"
        >
          <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
