import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { useAuth } from "@workspace/replit-auth-web";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { AiReceptionist } from "../chat/AiReceptionist";

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground font-medium animate-pulse">Loading SalonSync...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/" />;
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto relative scroll-smooth">
        {/* Subtle background glow effect */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="p-6 md:p-10 relative z-10 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      
      {/* Floating AI Receptionist for clients */}
      {user?.role === 'CLIENT' && <AiReceptionist />}
    </div>
  );
}
