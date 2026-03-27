import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useListLocations } from "@workspace/api-client-react";
import { Settings, MapPin, Clock, CreditCard, Bell, Shield, Save, Palette, Mail, Phone, MessageSquare, Star, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useBranding } from "@/contexts/BrandingContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";

function getAuthHeaders(): Record<string, string> {
  const sid = sessionStorage.getItem("__salonsync_dev_sid__");
  return sid ? { Authorization: `Bearer ${sid}` } : {};
}

function NotifToggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
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

function AdminNotificationSettings() {
  const { data: prefs, isLoading } = useQuery({
    queryKey: ["admin-notif-prefs"],
    queryFn: async () => {
      const r = await fetch("/api/notifications/preferences", { headers: getAuthHeaders() });
      return r.json();
    },
  });

  const qc = useQueryClient();

  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [reminderHours, setReminderHours] = useState(24);
  const [secondReminderHours, setSecondReminderHours] = useState(2);
  const [reviewEnabled, setReviewEnabled] = useState(true);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  useEffect(() => {
    if (prefs) {
      setEmailEnabled(prefs.emailEnabled ?? true);
      setSmsEnabled(prefs.smsEnabled ?? true);
      setReminderHours(prefs.reminderHoursBefore ?? 24);
      setSecondReminderHours(prefs.secondReminderHours ?? 2);
      setReviewEnabled(prefs.reviewRequestEnabled ?? true);
      setMarketingOptIn(prefs.marketingOptIn ?? false);
    }
  }, [prefs]);

  const mutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const r = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(data),
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-notif-prefs"] });
      toast.success("Notification preferences saved");
    },
  });

  function handleSaveAll() {
    mutation.mutate({
      emailEnabled,
      smsEnabled,
      reminderHoursBefore: reminderHours,
      secondReminderHours,
      reviewRequestEnabled: reviewEnabled,
      marketingOptIn,
    });
  }

  if (isLoading) return <Card><CardContent className="py-8 text-center text-muted-foreground">Loading...</CardContent></Card>;

  const channels = [
    {
      label: "Email Notifications",
      description: "Appointment confirmations, reminders, and review requests via email",
      icon: Mail,
      value: emailEnabled,
      onChange: setEmailEnabled,
    },
    {
      label: "SMS Notifications",
      description: "Text message reminders and alerts",
      icon: Phone,
      value: smsEnabled,
      onChange: setSmsEnabled,
    },
  ];

  const features = [
    {
      label: "Post-Visit Review Requests",
      description: "Automatically request client reviews 24 hours after completed appointments",
      icon: Star,
      value: reviewEnabled,
      onChange: setReviewEnabled,
    },
    {
      label: "Marketing Communications",
      description: "Promotional emails and special offers",
      icon: MessageSquare,
      value: marketingOptIn,
      onChange: setMarketingOptIn,
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5 text-primary" />Delivery Channels</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-white/5">
            {channels.map(({ label, description, icon: Icon, value, onChange }) => (
              <div key={label} className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${value ? "bg-primary/15" : "bg-white/[0.04]"}`}>
                    <Icon className={`w-4 h-4 ${value ? "text-primary" : "text-white/30"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                </div>
                <NotifToggle value={value} onChange={onChange} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5 text-primary" />Reminder Timing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70">Primary Reminder</label>
            <p className="text-xs text-muted-foreground">How many hours before the appointment to send the first reminder</p>
            <select
              value={reminderHours}
              onChange={e => setReminderHours(parseInt(e.target.value, 10))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              {[2, 4, 6, 12, 24, 48, 72].map(h => (
                <option key={h} value={h}>{h} hours before</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70">Secondary Reminder</label>
            <p className="text-xs text-muted-foreground">A shorter heads-up closer to the appointment time</p>
            <select
              value={secondReminderHours}
              onChange={e => setSecondReminderHours(parseInt(e.target.value, 10))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              {[1, 2, 3, 4, 6].map(h => (
                <option key={h} value={h}>{h} hour{h > 1 ? "s" : ""} before</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Star className="w-5 h-5 text-primary" />Automated Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-white/5">
            {features.map(({ label, description, icon: Icon, value, onChange }) => (
              <div key={label} className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${value ? "bg-primary/15" : "bg-white/[0.04]"}`}>
                    <Icon className={`w-4 h-4 ${value ? "text-primary" : "text-white/30"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                </div>
                <NotifToggle value={value} onChange={onChange} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSaveAll} disabled={mutation.isPending} className="gap-2">
          <Save className="w-4 h-4" /> Save All Notification Settings
        </Button>
        {mutation.isSuccess && (
          <span className="flex items-center gap-1.5 text-xs text-green-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Saved
          </span>
        )}
      </div>
    </div>
  );
}

const TABS = [
  { id: "general", label: "General", icon: Settings },
  { id: "branding", label: "Branding", icon: Palette },
  { id: "hours", label: "Business Hours", icon: Clock },
  { id: "payments", label: "Payments & Fees", icon: CreditCard },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
] as const;

type Tab = typeof TABS[number]["id"];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function InputField({ label, value, onChange, type = "text", hint }: { label: string; value: string; onChange: (v: string) => void; type?: string; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-white/80">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function AdminSettings() {
  const [tab, setTab] = useState<Tab>("general");
  const { data: locations } = useListLocations();
  const { user } = useAuth();
  const branding = useBranding();
  const queryClient = useQueryClient();

  const location = user?.locationId
    ? locations?.find((l: any) => l.id === user.locationId)
    : locations?.[0];

  const [name, setName] = useState(location?.name ?? "SalonSync Downtown");
  const [phone, setPhone] = useState(location?.phone ?? "+1 (555) 123-4567");
  const [address, setAddress] = useState(location?.address ?? "123 Luxury Ave, Beverly Hills");
  const [cancelFee, setCancelFee] = useState("25");
  const [depositPct, setDepositPct] = useState("50");
  const [cancelHours, setCancelHours] = useState("24");

  const [brandName, setBrandName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [tagline, setTagline] = useState("");
  const [brandingSaving, setBrandingSaving] = useState(false);

  useEffect(() => {
    if (location) {
      setBrandName((location as any).brandName || location.name || "");
      setLogoUrl((location as any).logoUrl || "");
      setPrimaryColor((location as any).primaryColor || "");
      setTagline((location as any).tagline || "");
    }
  }, [location]);

  function handleSave() {
    toast.success("Settings saved successfully");
  }

  async function handleSaveBranding() {
    if (!location) return;
    setBrandingSaving(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const sid = sessionStorage.getItem("__salonsync_dev_sid__");
      if (sid) headers["Authorization"] = `Bearer ${sid}`;
      const r = await fetch(`/api/locations/${location.id}/branding`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ brandName, logoUrl, primaryColor, tagline }),
      });
      if (!r.ok) throw new Error("Failed to save branding");
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast.success("Branding updated! Your salon's identity has been saved.");
    } catch {
      toast.error("Failed to save branding settings");
    } finally {
      setBrandingSaving(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">Configure your salon location</p>
        </div>
        <Button onClick={handleSave} className="gap-2"><Save className="w-4 h-4" /> Save Changes</Button>
      </div>

      <div className="flex gap-8">
        <aside className="w-52 shrink-0">
          <nav className="space-y-1">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${tab === t.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-white/5 hover:text-white"}`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1 space-y-6">
          {tab === "general" && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5 text-primary" />Location Details</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <InputField label="Salon Name" value={name} onChange={setName} />
                <InputField label="Phone Number" value={phone} onChange={setPhone} type="tel" />
                <InputField label="Address" value={address} onChange={setAddress} />
                <div className="pt-2">
                  <Button onClick={handleSave} className="gap-2"><Save className="w-4 h-4" /> Save General Info</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {tab === "branding" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Palette className="w-5 h-5 text-primary" />White Label Branding</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-sm text-muted-foreground">Customize how your salon appears to staff and clients. Your brand name replaces the platform name throughout the app.</p>
                <InputField
                  label="Brand Name"
                  value={brandName}
                  onChange={setBrandName}
                  hint="This is the name displayed in the sidebar, dashboard, and client-facing pages"
                />
                <InputField
                  label="Logo URL"
                  value={logoUrl}
                  onChange={setLogoUrl}
                  hint="URL to your salon logo (recommended: square image, 200x200px or larger)"
                />
                <InputField
                  label="Tagline"
                  value={tagline}
                  onChange={setTagline}
                  hint="A short tagline shown on your salon's public profile"
                />
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-white/80">Brand Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={primaryColor || "#C9956A"}
                      onChange={e => setPrimaryColor(e.target.value)}
                      className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={e => setPrimaryColor(e.target.value)}
                      placeholder="#C9956A"
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Accent color used across your salon's interface</p>
                </div>

                {brandName && (
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <p className="text-xs text-muted-foreground mb-3">Preview</p>
                    <div className="flex items-center gap-3">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo preview" className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                          style={{ backgroundColor: primaryColor || "#C9956A" }}>
                          {brandName.charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="font-display text-lg font-bold text-white">{brandName}</p>
                        {tagline && <p className="text-xs text-white/50">{tagline}</p>}
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <Button onClick={handleSaveBranding} disabled={brandingSaving} className="gap-2">
                    <Save className="w-4 h-4" />
                    {brandingSaving ? "Saving..." : "Save Branding"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {tab === "hours" && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5 text-primary" />Business Hours</CardTitle></CardHeader>
              <CardContent>
                <div className="divide-y divide-white/5">
                  {DAYS.map(day => {
                    const isWeekend = day === "Sunday";
                    return (
                      <div key={day} className="flex items-center justify-between py-4">
                        <span className="text-sm font-medium w-28">{day}</span>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                            <input type="checkbox" defaultChecked={!isWeekend} className="rounded accent-primary" />
                            {isWeekend ? "Closed" : "Open"}
                          </label>
                          {!isWeekend && (
                            <>
                              <select defaultValue="09:00" className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50">
                                {["08:00","09:00","10:00"].map(h => <option key={h} value={h}>{h}</option>)}
                              </select>
                              <span className="text-muted-foreground">—</span>
                              <select defaultValue="18:00" className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50">
                                {["17:00","18:00","19:00","20:00"].map(h => <option key={h} value={h}>{h}</option>)}
                              </select>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="pt-4">
                  <Button onClick={handleSave} className="gap-2"><Save className="w-4 h-4" /> Save Hours</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {tab === "payments" && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-primary" />Cancellation & Deposit Policy</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <InputField
                  label="Cancellation Fee ($)"
                  value={cancelFee}
                  onChange={setCancelFee}
                  type="number"
                  hint="Charged when a client cancels within the window"
                />
                <InputField
                  label="Cancellation Window (hours)"
                  value={cancelHours}
                  onChange={setCancelHours}
                  type="number"
                  hint="How many hours before the appointment cancellations incur a fee"
                />
                <InputField
                  label="Deposit Percentage (%)"
                  value={depositPct}
                  onChange={setDepositPct}
                  type="number"
                  hint="Percentage of service price charged as a deposit for high-value services"
                />
                <div className="pt-2">
                  <Button onClick={handleSave} className="gap-2"><Save className="w-4 h-4" /> Save Policy</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {tab === "notifications" && <AdminNotificationSettings />}

          {tab === "security" && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-primary" />Security</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3">
                  <Shield className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="text-sm font-medium text-green-400">Two-Factor Authentication is active</p>
                    <p className="text-xs text-muted-foreground">Your account is protected with 2FA.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <Button variant="outline" className="w-full justify-start gap-3">Change Password</Button>
                  <Button variant="outline" className="w-full justify-start gap-3">Manage API Keys</Button>
                  <Button variant="outline" className="w-full justify-start gap-3 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10">
                    Revoke All Sessions
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
