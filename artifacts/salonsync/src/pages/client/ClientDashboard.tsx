import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@workspace/replit-auth-web";
import { useListAppointments } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Calendar, CreditCard, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { PaymentHistory } from "@/components/payments/PaymentHistory";
import { TipPrompt } from "@/components/tips/TipPrompt";

export function ClientDashboard() {
  const { user } = useAuth();
  const { data: appointments, isLoading } = useListAppointments({ clientId: user?.id });

  const upcoming = appointments?.filter(a => new Date(a.startTime) > new Date() && a.status !== 'CANCELLED') || [];
  const past = appointments?.filter(a => new Date(a.startTime) <= new Date() || a.status === 'COMPLETED') || [];

  // Completed appointments in the last 30 days that are eligible for tipping
  const tipEligible = past.filter(a =>
    a.status === "COMPLETED" &&
    new Date(a.startTime) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );

  const serviceTotal = (apt: typeof past[0]) =>
    apt.services?.reduce((s, svc) => s + parseFloat(svc.service?.price ?? "0"), 0) ?? 0;

  return (
    <DashboardLayout>
      <div className="bg-gradient-to-r from-primary/20 to-transparent rounded-3xl p-8 mb-10 border border-primary/20 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-primary/20 blur-[100px] pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-4xl font-display font-bold mb-2">Welcome back, {user?.firstName}!</h1>
          <p className="text-lg text-muted-foreground">Ready for your next luxury treatment?</p>
        </div>
        <Link href="/client/book">
          <Button size="lg" className="w-full md:w-auto text-lg gap-2 shadow-xl shadow-primary/25">
            <Sparkles className="w-5 h-5" /> Book Appointment
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-2xl font-display font-bold">Upcoming Appointments</h2>
          {isLoading ? (
             <p className="text-muted-foreground">Loading...</p>
          ) : upcoming.length > 0 ? (
            upcoming.map(apt => (
              <Card key={apt.id} className="overflow-hidden border-primary/30 shadow-[0_0_30px_-10px_rgba(201,149,106,0.15)]">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-primary/20 flex flex-col items-center justify-center text-primary">
                        <span className="text-xs font-bold uppercase">{format(new Date(apt.startTime), 'MMM')}</span>
                        <span className="text-xl font-bold leading-none">{format(new Date(apt.startTime), 'd')}</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">{apt.services?.map(s => s.service?.name).join(', ')}</h3>
                        <p className="text-muted-foreground">{format(new Date(apt.startTime), 'EEEE, h:mm a')} with {apt.staff?.firstName}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="outline" className="text-primary border-primary/30">{apt.status}</Badge>
                      <Button variant="outline" size="sm">Manage</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-dashed border-white/10 bg-transparent">
              <CardContent className="p-10 flex flex-col items-center justify-center text-center">
                <Calendar className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-xl font-bold mb-2">No upcoming appointments</h3>
                <p className="text-muted-foreground mb-6">You don't have any luxury treatments scheduled yet.</p>
                <Link href="/client/book">
                  <Button variant="outline">Book Now</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          <h2 className="text-2xl font-display font-bold pt-6">Past Appointments</h2>
          <div className="space-y-4">
            {past.slice(0, 5).map(apt => {
              const isTipEligible = tipEligible.some(t => t.id === apt.id);
              return (
                <Card key={apt.id} className="opacity-80 hover:opacity-100 transition-opacity">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-bold">{apt.services?.map(s => s.service?.name).join(', ')}</h4>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(apt.startTime), 'MMMM d, yyyy')}
                          {apt.staff?.firstName && <> · with {apt.staff.firstName}</>}
                        </p>
                        {apt.status === "COMPLETED" && (
                          <Badge variant="outline" className="mt-1 text-xs text-green-400 border-green-400/30">Completed</Badge>
                        )}
                      </div>
                      <Button variant="secondary" size="sm">Rebook</Button>
                    </div>

                    {/* Tip prompt for completed appointments in last 30 days */}
                    {isTipEligible && (
                      <TipPrompt
                        appointmentId={apt.id}
                        staffName={apt.staff?.firstName ?? "your stylist"}
                        serviceTotal={serviceTotal(apt)}
                      />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-[#1A1F2E] to-[#0A0F1D] border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-full bg-white/5">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold">Gift Cards</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-2">Available Balance</p>
              <h2 className="text-4xl font-display font-bold text-primary mb-6">$0.00</h2>
              <Button variant="outline" className="w-full">Purchase Gift Card</Button>
            </CardContent>
          </Card>

          <PaymentHistory />
        </div>
      </div>
    </DashboardLayout>
  );
}
