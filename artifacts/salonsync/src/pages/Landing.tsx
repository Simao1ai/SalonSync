import { useAuth } from "@workspace/replit-auth-web";
import { Redirect } from "wouter";
import { motion } from "framer-motion";
import {
  Sparkles, CalendarCheck, ShieldCheck, Scissors,
  BrainCircuit, Star, TrendingUp, ArrowRight, Check,
} from "lucide-react";

const STATS = [
  { value: "2,400+", label: "Salons" },
  { value: "98%", label: "Retention" },
  { value: "$4.2M", label: "Revenue Tracked" },
  { value: "4.9★", label: "Avg Rating" },
];

const FEATURES = [
  {
    icon: CalendarCheck,
    title: "Smart Scheduling",
    desc: "AI-driven booking that fills gaps, reduces no-shows, and auto-enforces cancellation policies.",
    perks: ["Real-time availability", "Cancellation fee automation", "Buffer time management"],
  },
  {
    icon: BrainCircuit,
    title: "AI Receptionist",
    desc: "A 24/7 streaming AI chatbot that handles bookings, answers questions, and learns your salon.",
    perks: ["Live SSE streaming", "Sentiment analysis", "Risk scoring"],
  },
  {
    icon: TrendingUp,
    title: "Revenue Analytics",
    desc: "See exactly what's working — by service, by stylist, by time slot — in one live dashboard.",
    perks: ["Multi-location support", "Staff commission tracking", "Gift card management"],
  },
];

export function Landing() {
  const { isAuthenticated, isLoading, login, user } = useAuth();

  if (isLoading) return null;
  if (isAuthenticated) {
    const role = user?.role;
    if (role === "ADMIN") return <Redirect to="/admin/dashboard" />;
    if (role === "STAFF") return <Redirect to="/staff/dashboard" />;
    return <Redirect to="/client/dashboard" />;
  }

  return (
    <div className="min-h-screen bg-[#080C14] overflow-x-hidden selection:bg-primary/30 text-white">

      {/* Background noise + gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(201,149,106,0.12),transparent)]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoNjB2NjBIMHoiLz48cGF0aCBkPSJNNjAgMEgwdjYwaDYwVjB6TTEgMWg1OHY1OEgxVjF6IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9Ii4wMiIvPjwvZz48L3N2Zz4=')] opacity-40" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-[0_0_16px_rgba(201,149,106,0.4)]">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="font-display text-xl font-bold tracking-wide">SalonSync</span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => login()}
            className="text-sm font-medium text-white/60 hover:text-white transition-colors hidden sm:block"
          >
            Sign in
          </button>
          <button
            onClick={() => login()}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-all shadow-[0_0_20px_rgba(201,149,106,0.25)] hover:shadow-[0_0_28px_rgba(201,149,106,0.4)] hover:-translate-y-0.5"
          >
            Get Started <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-24 grid lg:grid-cols-2 gap-16 items-center">
        {/* Left */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold mb-8 tracking-wide">
            <Sparkles className="w-3 h-3" />
            AI-POWERED SALON MANAGEMENT
          </div>

          <h1 className="font-display text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.05] mb-6">
            The smarter way to{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-[#daa87a] to-primary/70">
              run your salon
            </span>
          </h1>

          <p className="text-lg text-white/50 max-w-lg leading-relaxed mb-10">
            Multi-location scheduling, AI risk scoring, a 24/7 chatbot receptionist, and real-time analytics — all in one platform built for high-end salons.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => login()}
              className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold px-8 py-3.5 rounded-full transition-all shadow-[0_0_24px_rgba(201,149,106,0.3)] hover:shadow-[0_0_36px_rgba(201,149,106,0.45)] hover:-translate-y-0.5 text-sm"
            >
              Start for free <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => login()}
              className="flex items-center justify-center gap-2 text-white/70 hover:text-white border border-white/10 hover:border-white/20 font-medium px-8 py-3.5 rounded-full transition-all text-sm"
            >
              View demo
            </button>
          </div>

          {/* Social proof avatars */}
          <div className="flex items-center gap-3 mt-10">
            <div className="flex -space-x-2.5">
              {["#C9956A","#8B5CF6","#10B981","#F59E0B","#EF4444"].map((c, i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-[#080C14] flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: c + "33", borderColor: "#080C14", color: c }}>
                  {["S","M","J","A","R"][i]}
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-0.5 mb-0.5">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 fill-primary text-primary" />)}
              </div>
              <p className="text-xs text-white/40">Loved by 2,400+ salon owners</p>
            </div>
          </div>
        </motion.div>

        {/* Right — floating dashboard card */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
          className="hidden lg:block"
        >
          <div className="relative">
            {/* Glow */}
            <div className="absolute -inset-4 bg-primary/10 rounded-3xl blur-2xl" />

            {/* Dashboard mockup card */}
            <div className="relative bg-[#0D1422] border border-white/8 rounded-2xl overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="border-b border-white/5 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center">
                    <Sparkles className="w-3 h-3 text-primary" />
                  </div>
                  <span className="text-xs font-semibold text-white/70">SalonSync — Dashboard</span>
                </div>
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
                </div>
              </div>

              {/* Stat row */}
              <div className="grid grid-cols-3 gap-px bg-white/5 border-b border-white/5">
                {[
                  { label: "Revenue (MTD)", value: "$18,420" },
                  { label: "Appointments", value: "84" },
                  { label: "No-shows", value: "2" },
                ].map((s) => (
                  <div key={s.label} className="bg-[#0D1422] px-4 py-4">
                    <p className="text-[10px] text-white/40 mb-1 font-medium">{s.label}</p>
                    <p className="text-xl font-bold text-white">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Appointment list */}
              <div className="p-4 space-y-2.5">
                {[
                  { name: "Emma Wilson", service: "Balayage + Cut", time: "9:00 AM", staff: "Sarah", color: "#C9956A", status: "Confirmed" },
                  { name: "Mia Johnson", service: "Keratin Treatment", time: "11:30 AM", staff: "James", color: "#8B5CF6", status: "Confirmed" },
                  { name: "Lily Chen", service: "Color + Style", time: "2:00 PM", staff: "Aisha", color: "#10B981", status: "Pending" },
                ].map((appt) => (
                  <div key={appt.name} className="flex items-center gap-3 bg-white/[0.03] rounded-xl px-3.5 py-3 border border-white/5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ backgroundColor: appt.color + "22", color: appt.color }}>
                      {appt.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{appt.name}</p>
                      <p className="text-[10px] text-white/40 truncate">{appt.service}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-medium text-white/60">{appt.time}</p>
                      <p className="text-[9px]" style={{ color: appt.color }}>{appt.staff}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* AI badge */}
              <div className="mx-4 mb-4 flex items-center gap-2.5 bg-primary/10 border border-primary/20 rounded-xl px-4 py-3">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <p className="text-xs text-primary font-medium">AI receptionist active — 3 enquiries handled today</p>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Stats strip */}
      <section className="relative z-10 border-y border-white/5 bg-white/[0.02] py-8">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((s) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-center"
            >
              <p className="text-3xl font-display font-bold text-white">{s.value}</p>
              <p className="text-xs text-white/40 mt-1 font-medium uppercase tracking-widest">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center mb-16"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-4">Everything you need</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">Built for serious salons</h2>
          <p className="text-white/40 max-w-xl mx-auto">Not a generic booking tool. SalonSync is purpose-built for multi-location, high-value hair salons.</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 + i * 0.1 }}
              className="group relative bg-[#0D1422] border border-white/8 rounded-2xl p-7 hover:border-primary/30 transition-all duration-300 hover:shadow-[0_0_40px_rgba(201,149,106,0.08)]"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center mb-6 border border-primary/20">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-white/40 leading-relaxed mb-5">{f.desc}</p>
              <ul className="space-y-2">
                {f.perks.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-xs text-white/60">
                    <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="relative bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/20 rounded-3xl p-12 text-center overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_50%,rgba(201,149,106,0.08),transparent)] pointer-events-none" />
          <div className="relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">Ready to transform your salon?</h2>
            <p className="text-white/40 max-w-lg mx-auto mb-8">Join thousands of salon owners using SalonSync to save time, reduce no-shows, and grow revenue.</p>
            <button
              onClick={() => login()}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold px-10 py-4 rounded-full transition-all shadow-[0_0_32px_rgba(201,149,106,0.35)] hover:shadow-[0_0_48px_rgba(201,149,106,0.5)] hover:-translate-y-0.5 text-sm"
            >
              Get started for free <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
