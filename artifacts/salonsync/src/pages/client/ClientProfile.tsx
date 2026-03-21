import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@workspace/replit-auth-web";
import { useListNotifications, useMarkNotificationRead, useListGiftCards } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { User, Bell, Gift, Settings, Save, CreditCard, Palette, ChevronRight, Phone, Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-4 border-b border-white/5">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="w-5 h-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`relative w-10 h-5 rounded-full transition-colors ${value ? "bg-primary" : "bg-white/10"} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? "left-5" : "left-0.5"}`} />
    </button>
  );
}

function getAuthHeaders(): Record<string, string> {
  const sid = sessionStorage.getItem("__salonsync_dev_sid__");
  return sid ? { Authorization: `Bearer ${sid}` } : {};
}

export function ClientProfile() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const { data: notifications, refetch: refetchNotifs } = useListNotifications({ userId: user?.id });
  const { mutate: markRead } = useMarkNotificationRead();
  const { data: giftCards } = useListGiftCards({ userId: user?.id });

  const [hairType, setHairType] = useState("Curly");
  const [allergies, setAllergies] = useState("None");
  const [preferred, setPreferred] = useState("Any");
  const [phone, setPhone] = useState("");

  // ── Notification preferences ────────────────────────────────────────────
  const { data: prefs, isLoading: prefsLoading } = useQuery({
    queryKey: ["notif-prefs"],
    queryFn: async () => {
      const r = await fetch("/api/notifications/preferences", { headers: getAuthHeaders() });
      return r.json() as Promise<{ smsEnabled: boolean; emailEnabled: boolean; phone: string | null; email: string | null }>;
    },
    enabled: !!user,
  });

  const [emailNotifs, setEmailNotifs] = useState(true);
  const [smsNotifs, setSmsNotifs] = useState(true);

  useEffect(() => {
    if (prefs) {
      setEmailNotifs(prefs.emailEnabled ?? true);
      setSmsNotifs(prefs.smsEnabled ?? true);
      if (prefs.phone) setPhone(prefs.phone);
    }
  }, [prefs]);

  const prefsMutation = useMutation({
    mutationFn: async (data: { smsEnabled?: boolean; emailEnabled?: boolean }) => {
      const r = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(data),
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-prefs"] });
    },
  });

  function handleToggleEmail(v: boolean) {
    setEmailNotifs(v);
    prefsMutation.mutate({ emailEnabled: v });
  }

  function handleToggleSms(v: boolean) {
    setSmsNotifs(v);
    prefsMutation.mutate({ smsEnabled: v });
  }

  const unread = notifications?.filter(n => !n.isRead) ?? [];
  const totalGiftBalance = (giftCards ?? []).filter(g => g.status === "ACTIVE").reduce((s, g) => s + parseFloat(g.balance), 0);

  function handleSave() {
    toast.success("Profile updated!");
  }

  function handleMarkAllRead() {
    for (const n of unread) {
      markRead({ id: n.id }, { onSuccess: () => refetchNotifs() });
    }
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold">My Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your preferences and account</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Section title="Personal Info" icon={User}>
            <div className="flex items-center gap-5 mb-6">
              <div className="w-20 h-20 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-3xl">
                {user?.firstName?.charAt(0) ?? "?"}
              </div>
              <div>
                <h2 className="text-xl font-bold">{user?.firstName} {user?.lastName}</h2>
                <p className="text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-white/70">First Name</label>
                <input defaultValue={user?.firstName ?? ""} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-white/70">Last Name</label>
                <input defaultValue={user?.lastName ?? ""} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-white/70 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> Phone (for SMS reminders)
                </label>
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+1 555 000 0000"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-white/70 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> Email
                </label>
                <input defaultValue={user?.email ?? ""} disabled className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm opacity-50 cursor-not-allowed" />
              </div>
            </div>
          </Section>

          <Section title="Hair Preferences" icon={Palette}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-white/70">Hair Type</label>
                <select value={hairType} onChange={e => setHairType(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50">
                  {["Straight","Wavy","Curly","Coily"].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-white/70">Preferred Stylist</label>
                <input value={preferred} onChange={e => setPreferred(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-white/70">Allergies / Notes</label>
                <input value={allergies} onChange={e => setAllergies(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
              </div>
            </div>
            <div className="mt-5">
              <Button onClick={handleSave} className="gap-2"><Save className="w-4 h-4" /> Save Preferences</Button>
            </div>
          </Section>

          <Section title="Notifications" icon={Bell}>
            {unread.length > 0 && (
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{unread.length} unread</p>
                <button onClick={handleMarkAllRead} className="text-xs text-primary hover:underline">Mark all read</button>
              </div>
            )}
            <div className="space-y-3 mb-6">
              {notifications?.slice(0, 5).map(n => (
                <div key={n.id} className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${!n.isRead ? "bg-primary/5 border border-primary/10" : "bg-white/[0.02]"}`}>
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.isRead ? "bg-primary" : "bg-white/20"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{format(new Date(n.createdAt), "MMM d, h:mm a")}</p>
                  </div>
                </div>
              ))}
              {(!notifications || notifications.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No notifications yet</p>
              )}
            </div>

            {/* Delivery channel toggles */}
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.06]">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Delivery channels</p>
              </div>
              {[
                {
                  label: "Email reminders",
                  description: `Booking confirmations & 24hr reminders to ${prefs?.email ?? user?.email ?? "your email"}`,
                  icon: Mail,
                  value: emailNotifs,
                  onChange: handleToggleEmail,
                },
                {
                  label: "SMS reminders",
                  description: phone ? `Text reminders to ${phone}` : "Add a phone number above to receive SMS reminders",
                  icon: Phone,
                  value: smsNotifs,
                  onChange: handleToggleSms,
                  disabled: !phone,
                },
              ].map(({ label, description, icon: Icon, value, onChange, disabled }) => (
                <div key={label} className="flex items-center justify-between gap-4 px-4 py-3.5 border-b border-white/[0.04] last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${value && !disabled ? "bg-primary/15" : "bg-white/[0.04]"}`}>
                      <Icon className={`w-3.5 h-3.5 ${value && !disabled ? "text-primary" : "text-white/30"}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white/80">{label}</p>
                      <p className="text-xs text-white/30 truncate">{description}</p>
                    </div>
                  </div>
                  <Toggle value={value && !disabled} onChange={onChange} disabled={!!disabled || prefsLoading} />
                </div>
              ))}
            </div>

            {prefsMutation.isSuccess && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-green-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Preferences saved
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Gift Cards" icon={Gift}>
            <div className="text-center py-4 mb-4 bg-gradient-to-br from-primary/20 to-transparent rounded-2xl border border-primary/20">
              <p className="text-sm text-muted-foreground mb-1">Total Balance</p>
              <p className="text-4xl font-display font-bold text-primary">{formatCurrency(totalGiftBalance)}</p>
            </div>
            {(giftCards ?? []).map(gc => (
              <div key={gc.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <p className="text-sm font-medium">{gc.code}</p>
                  <p className="text-xs text-muted-foreground">Expires {gc.expiresAt ? format(new Date(gc.expiresAt), "MMM yyyy") : "Never"}</p>
                </div>
                <span className="font-bold text-primary">{formatCurrency(parseFloat(gc.balance))}</span>
              </div>
            ))}
            <Button variant="outline" className="w-full mt-4 gap-2"><CreditCard className="w-4 h-4" /> Purchase Gift Card</Button>
          </Section>

          <Card>
            <CardContent className="p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Settings className="w-4 h-4 text-primary" />Account</h3>
              <div className="space-y-2">
                <button className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white/5 text-sm transition-colors">
                  Change Password <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
                <button className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white/5 text-sm transition-colors">
                  Privacy Settings <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
                <button
                  onClick={() => logout()}
                  className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-red-500/10 text-sm text-red-400 transition-colors"
                >
                  Sign Out <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
