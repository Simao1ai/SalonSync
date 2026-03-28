import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  Sparkles, Building2, User, CheckCircle2, ArrowRight,
  ArrowLeft, MapPin, Phone, Mail, FileText, Loader2,
} from "lucide-react";
import { toast } from "sonner";

const STEPS = [
  { id: 1, label: "Salon Info", icon: Building2 },
  { id: 2, label: "Your Details", icon: User },
  { id: 3, label: "Confirm", icon: CheckCircle2 },
];

interface FormData {
  salonName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  salonPhone: string;
  salonEmail: string;
  description: string;
  ownerFirstName: string;
  ownerLastName: string;
  ownerEmail: string;
  ownerPhone: string;
}

const INITIAL: FormData = {
  salonName: "", address: "", city: "", state: "", zip: "",
  salonPhone: "", salonEmail: "", description: "",
  ownerFirstName: "", ownerLastName: "", ownerEmail: "", ownerPhone: "",
};

export function Onboarding() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  function set(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  }

  function validateStep1(): boolean {
    const e: typeof errors = {};
    if (!form.salonName.trim()) e.salonName = "Salon name is required";
    if (!form.address.trim()) e.address = "Address is required";
    if (!form.city.trim()) e.city = "City is required";
    if (!form.state.trim()) e.state = "State is required";
    if (!form.zip.trim()) e.zip = "ZIP code is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep2(): boolean {
    const e: typeof errors = {};
    if (!form.ownerFirstName.trim()) e.ownerFirstName = "First name is required";
    if (!form.ownerLastName.trim()) e.ownerLastName = "Last name is required";
    if (!form.ownerEmail.trim()) e.ownerEmail = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.ownerEmail)) e.ownerEmail = "Enter a valid email";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function nextStep() {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep(s => Math.min(s + 1, 3));
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong");
        setSubmitting(false);
        return;
      }

      toast.success("Welcome to SalonSync! Your 7-day free trial has started.");

      setTimeout(() => {
        window.location.href = import.meta.env.BASE_URL + "admin/dashboard";
      }, 800);
    } catch {
      toast.error("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  const inputCls = (field: keyof FormData) =>
    `w-full bg-white/[0.04] border rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 transition-all ${
      errors[field] ? "border-red-500/50 focus:ring-red-500/30" : "border-white/10 focus:ring-primary/30 focus:border-primary/40"
    }`;

  return (
    <div className="min-h-screen bg-[#080C14] text-white flex flex-col">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(201,149,106,0.12),transparent)]" />
      </div>

      <nav className="relative z-10 max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-[0_0_16px_rgba(201,149,106,0.4)]">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="font-display text-xl font-bold tracking-wide">SalonSync</span>
        </Link>
        <Link href="/" className="text-sm text-white/40 hover:text-white/60 transition-colors">
          Already have an account? Sign in
        </Link>
      </nav>

      <div className="relative z-10 flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-xl">
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-display font-bold mb-3">
              Start Your Free Trial
            </h1>
            <p className="text-white/50 text-sm max-w-md mx-auto">
              7 days free, no credit card required. Set up your salon in under 2 minutes.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 mb-10">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  step === s.id
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : step > s.id
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : "bg-white/5 text-white/30 border border-white/10"
                }`}>
                  {step > s.id ? <CheckCircle2 className="w-3.5 h-3.5" /> : <s.icon className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-8 h-px ${step > s.id ? "bg-green-500/40" : "bg-white/10"}`} />
                )}
              </div>
            ))}
          </div>

          <div className="bg-[#0D1424] border border-white/[0.06] rounded-2xl p-8 shadow-2xl">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-display text-lg font-bold">Salon Information</h2>
                      <p className="text-xs text-white/40">Tell us about your business</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-white/50 mb-1.5 block">Salon Name *</label>
                      <input value={form.salonName} onChange={e => set("salonName", e.target.value)} className={inputCls("salonName")} placeholder="Luxe Hair Studio" />
                      {errors.salonName && <p className="text-xs text-red-400 mt-1">{errors.salonName}</p>}
                    </div>
                    <div>
                      <label className="text-xs text-white/50 mb-1.5 block">Street Address *</label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
                        <input value={form.address} onChange={e => set("address", e.target.value)} className={`${inputCls("address")} pl-10`} placeholder="123 Main Street" />
                      </div>
                      {errors.address && <p className="text-xs text-red-400 mt-1">{errors.address}</p>}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-white/50 mb-1.5 block">City *</label>
                        <input value={form.city} onChange={e => set("city", e.target.value)} className={inputCls("city")} placeholder="Los Angeles" />
                        {errors.city && <p className="text-xs text-red-400 mt-1">{errors.city}</p>}
                      </div>
                      <div>
                        <label className="text-xs text-white/50 mb-1.5 block">State *</label>
                        <input value={form.state} onChange={e => set("state", e.target.value)} className={inputCls("state")} placeholder="CA" />
                        {errors.state && <p className="text-xs text-red-400 mt-1">{errors.state}</p>}
                      </div>
                      <div>
                        <label className="text-xs text-white/50 mb-1.5 block">ZIP *</label>
                        <input value={form.zip} onChange={e => set("zip", e.target.value)} className={inputCls("zip")} placeholder="90210" />
                        {errors.zip && <p className="text-xs text-red-400 mt-1">{errors.zip}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-white/50 mb-1.5 block">Salon Phone</label>
                        <div className="relative">
                          <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
                          <input value={form.salonPhone} onChange={e => set("salonPhone", e.target.value)} className={`${inputCls("salonPhone")} pl-10`} placeholder="(555) 123-4567" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-white/50 mb-1.5 block">Salon Email</label>
                        <div className="relative">
                          <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
                          <input value={form.salonEmail} onChange={e => set("salonEmail", e.target.value)} className={`${inputCls("salonEmail")} pl-10`} placeholder="hello@salon.com" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-white/50 mb-1.5 block">Description</label>
                      <div className="relative">
                        <FileText className="w-4 h-4 absolute left-3.5 top-3.5 text-white/20" />
                        <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} className={`${inputCls("description")} pl-10`} placeholder="A few words about your salon..." />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h2 className="font-display text-lg font-bold">Owner Details</h2>
                      <p className="text-xs text-white/40">Your account will be the salon admin</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-white/50 mb-1.5 block">First Name *</label>
                        <input value={form.ownerFirstName} onChange={e => set("ownerFirstName", e.target.value)} className={inputCls("ownerFirstName")} placeholder="Jane" />
                        {errors.ownerFirstName && <p className="text-xs text-red-400 mt-1">{errors.ownerFirstName}</p>}
                      </div>
                      <div>
                        <label className="text-xs text-white/50 mb-1.5 block">Last Name *</label>
                        <input value={form.ownerLastName} onChange={e => set("ownerLastName", e.target.value)} className={inputCls("ownerLastName")} placeholder="Smith" />
                        {errors.ownerLastName && <p className="text-xs text-red-400 mt-1">{errors.ownerLastName}</p>}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-white/50 mb-1.5 block">Email *</label>
                      <div className="relative">
                        <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
                        <input type="email" value={form.ownerEmail} onChange={e => set("ownerEmail", e.target.value)} className={`${inputCls("ownerEmail")} pl-10`} placeholder="jane@example.com" />
                      </div>
                      {errors.ownerEmail && <p className="text-xs text-red-400 mt-1">{errors.ownerEmail}</p>}
                    </div>
                    <div>
                      <label className="text-xs text-white/50 mb-1.5 block">Phone</label>
                      <div className="relative">
                        <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
                        <input type="tel" value={form.ownerPhone} onChange={e => set("ownerPhone", e.target.value)} className={`${inputCls("ownerPhone")} pl-10`} placeholder="(555) 987-6543" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <h2 className="font-display text-lg font-bold">Review & Start Trial</h2>
                      <p className="text-xs text-white/40">Confirm your details and get started</p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="bg-white/[0.03] rounded-xl p-5 border border-white/[0.06]">
                      <h3 className="text-xs uppercase tracking-wider text-white/30 mb-3">Salon</h3>
                      <p className="font-semibold text-lg">{form.salonName}</p>
                      <p className="text-sm text-white/50 mt-1">{form.address}</p>
                      <p className="text-sm text-white/50">{form.city}, {form.state} {form.zip}</p>
                      {form.salonPhone && <p className="text-sm text-white/50 mt-1">{form.salonPhone}</p>}
                    </div>

                    <div className="bg-white/[0.03] rounded-xl p-5 border border-white/[0.06]">
                      <h3 className="text-xs uppercase tracking-wider text-white/30 mb-3">Account Owner</h3>
                      <p className="font-semibold">{form.ownerFirstName} {form.ownerLastName}</p>
                      <p className="text-sm text-white/50 mt-1">{form.ownerEmail}</p>
                      {form.ownerPhone && <p className="text-sm text-white/50">{form.ownerPhone}</p>}
                    </div>

                    <div className="bg-primary/10 border border-primary/20 rounded-xl p-5">
                      <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-primary">7-Day Free Trial</p>
                          <p className="text-sm text-white/50 mt-1">
                            Full access to all features. No credit card required.
                            Your trial will end on{" "}
                            <span className="text-white/70 font-medium">
                              {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                            </span>.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/[0.06]">
              {step > 1 ? (
                <button
                  onClick={() => setStep(s => s - 1)}
                  className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
              ) : (
                <div />
              )}

              {step < 3 ? (
                <button
                  onClick={nextStep}
                  className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-semibold px-6 py-2.5 rounded-full transition-all shadow-[0_0_20px_rgba(201,149,106,0.25)] hover:shadow-[0_0_28px_rgba(201,149,106,0.4)] hover:-translate-y-0.5"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold px-8 py-2.5 rounded-full transition-all shadow-[0_0_20px_rgba(201,149,106,0.25)] hover:shadow-[0_0_28px_rgba(201,149,106,0.4)] hover:-translate-y-0.5"
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Setting up...</>
                  ) : (
                    <>Start Free Trial <Sparkles className="w-4 h-4" /></>
                  )}
                </button>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-white/20 mt-6">
            By signing up, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
