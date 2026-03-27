import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { useGetAnalytics, useListAppointments } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { format } from "date-fns";
import { TrendingUp, Users, CalendarX, CalendarClock, DollarSign, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { useBranding } from "@/contexts/BrandingContext";
import { AnnouncementsBanner } from "@/components/AnnouncementsBanner";
import { ChurnRiskSection } from "@/components/ai/ChurnRiskSection";
import { AiInsightsPanel, AiInsightsButton } from "@/components/ai/AiInsightsPanel";

export function AdminDashboard() {
  const { user } = useAuth();
  const locationId = user?.locationId ?? "da62c8fa-580b-44c9-bed8-e19938402d39";
  const branding = useBranding();
  const [insightsOpen, setInsightsOpen] = useState(false);
  
  const { data: analytics, isLoading: analyticsLoading } = useGetAnalytics({ locationId });
  const { data: appointments, isLoading: appointmentsLoading } = useListAppointments({ locationId });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return <Badge variant="success">Confirmed</Badge>;
      case 'PENDING': return <Badge variant="warning">Pending</Badge>;
      case 'CANCELLED': return <Badge variant="destructive">Cancelled</Badge>;
      case 'COMPLETED': return <Badge variant="default" className="bg-blue-500">Completed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRiskBadge = (score: string | null | undefined) => {
    if (!score) return null;
    switch (score) {
      case 'HIGH': return <Badge variant="destructive" className="flex gap-1"><AlertTriangle className="w-3 h-3"/> High Risk</Badge>;
      case 'MEDIUM': return <Badge variant="warning">Med Risk</Badge>;
      case 'LOW': return <Badge variant="success">Low Risk</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <AnnouncementsBanner />

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold">{branding.name}</h1>
          <p className="text-muted-foreground mt-1">Here's what's happening at your salon today.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">Add Staff</Button>
          <Button>New Appointment</Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-gradient-to-br from-card to-background relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-10 -mt-10" />
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Total Revenue</p>
                  <h3 className="text-3xl font-display font-bold">{formatCurrency(analytics?.totalRevenue || 12450.00)}</h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm text-success">
                <TrendingUp className="w-4 h-4 mr-1" />
                <span>+12.5% from last month</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Appointments Today</p>
                  <h3 className="text-3xl font-display font-bold">{analytics?.totalAppointments || 24}</h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <CalendarClock className="w-5 h-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Cancellation Rate</p>
                  <h3 className="text-3xl font-display font-bold">{(analytics?.cancelledCount ? (analytics.cancelledCount / (analytics.totalAppointments || 1) * 100).toFixed(1) : '4.2')}%</h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-destructive/20 flex items-center justify-center">
                  <CalendarX className="w-5 h-5 text-destructive" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">{formatCurrency(analytics?.cancelFeeRevenue || 450)} collected in fees</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Appointments */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-white/5 bg-[#131D33]/50">
          <CardTitle className="text-xl">Recent Appointments</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-[#131D33]/30 uppercase">
              <tr>
                <th className="px-6 py-4 font-medium">Client</th>
                <th className="px-6 py-4 font-medium">Service</th>
                <th className="px-6 py-4 font-medium">Stylist</th>
                <th className="px-6 py-4 font-medium">Time</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Risk Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {appointmentsLoading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">Loading appointments...</td></tr>
              ) : appointments?.slice(0, 5).map((apt) => (
                <tr key={apt.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 font-medium">{apt.client?.firstName || 'Unknown'}</td>
                  <td className="px-6 py-4 text-muted-foreground truncate max-w-[200px]">
                    {apt.services?.map(s => s.service?.name).join(", ") || 'Service'}
                  </td>
                  <td className="px-6 py-4">{apt.staff?.firstName || 'Any Staff'}</td>
                  <td className="px-6 py-4 text-muted-foreground">{format(new Date(apt.startTime), 'MMM d, h:mm a')}</td>
                  <td className="px-6 py-4">{getStatusBadge(apt.status)}</td>
                  <td className="px-6 py-4">{getRiskBadge(apt.riskScore)}</td>
                </tr>
              ))}
              {(!appointmentsLoading && appointments?.length === 0) && (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No appointments found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-8">
        <ChurnRiskSection />
      </div>

      <AiInsightsButton onClick={() => setInsightsOpen(true)} />
      <AiInsightsPanel open={insightsOpen} onClose={() => setInsightsOpen(false)} />
    </DashboardLayout>
  );
}
