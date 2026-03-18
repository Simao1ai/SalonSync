import { useAuth } from "@workspace/replit-auth-web";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Sparkles, CalendarCheck, ShieldCheck, Scissors } from "lucide-react";
import { motion } from "framer-motion";

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
    <div className="min-h-screen bg-background overflow-hidden selection:bg-primary/30">
      <div className="absolute top-0 left-0 w-full h-screen bg-[url('https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-10" />
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-background/40 via-background/80 to-background z-0" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8 flex flex-col min-h-screen">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="font-display text-3xl font-bold tracking-wider">SalonSync</h1>
          </div>
          <Button onClick={() => login()} variant="outline" className="rounded-full px-8 hidden sm:flex">
            Sign In
          </Button>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center text-center mt-12 md:mt-0">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium mb-8">
              <Sparkles className="w-4 h-4" />
              Premium AI-Powered Salon Experience
            </div>
            
            <h2 className="font-display text-5xl md:text-7xl font-bold max-w-4xl mx-auto leading-tight mb-6">
              Elevate Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-[#e3be9f]">Salon Experience</span>
            </h2>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Book high-end services, manage your appointments seamlessly, and experience luxury treatment powered by intelligent scheduling.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button onClick={() => login()} size="lg" className="w-full sm:w-auto text-lg px-12">
                Enter SalonSync
              </Button>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 w-full max-w-5xl"
          >
            <div className="glass-panel p-8 rounded-2xl text-left border border-white/5">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-6">
                <CalendarCheck className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">Seamless Booking</h3>
              <p className="text-muted-foreground leading-relaxed">Book your favorite stylist in seconds with our intelligent scheduling system.</p>
            </div>
            <div className="glass-panel p-8 rounded-2xl text-left border border-white/5">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-6">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">Secure Deposits</h3>
              <p className="text-muted-foreground leading-relaxed">Lock in high-value services with secure, transparent deposit handling.</p>
            </div>
            <div className="glass-panel p-8 rounded-2xl text-left border border-white/5">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-6">
                <Scissors className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">Premium Services</h3>
              <p className="text-muted-foreground leading-relaxed">Access a curated catalog of standard and high-value luxury treatments.</p>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
