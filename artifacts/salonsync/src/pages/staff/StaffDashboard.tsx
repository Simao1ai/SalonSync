import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@workspace/replit-auth-web";
import { useListAppointments } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Clock, Star, Users, AlertTriangle } from "lucide-react";
import { AnnouncementsBanner } from "@/components/AnnouncementsBanner";

export function StaffDashboard() {
  const { user } = useAuth();
  const { data: appointments, isLoading } = useListAppointments({ staffId: user?.id });

  return (
    <DashboardLayout>
      <AnnouncementsBanner />
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold">Hello, {user?.firstName}</h1>
        <p className="text-muted-foreground mt-1">Here is your schedule for today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Clock className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Hours Booked</p>
              <h3 className="text-2xl font-bold">6.5h</h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Star className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Average Rating</p>
              <h3 className="text-2xl font-bold">4.9</h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Repeat Clients</p>
              <h3 className="text-2xl font-bold">78%</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-xl font-display font-bold mb-4">Today's Appointments</h2>
      <div className="space-y-4">
        {isLoading ? (
          <p className="text-muted-foreground">Loading schedule...</p>
        ) : appointments?.filter(a => a.status !== 'CANCELLED').map(apt => (
          <Card key={apt.id} className={`transition-all hover:translate-x-1 ${apt.riskScore === 'HIGH' ? 'border-destructive/50 shadow-[0_0_15px_-5px_rgba(255,0,0,0.2)]' : ''}`}>
            <CardContent className="p-0 flex flex-col md:flex-row">
              <div className="bg-[#131D33] p-6 flex flex-col justify-center items-center md:w-48 border-r border-white/5">
                <span className="text-2xl font-display text-white">{format(new Date(apt.startTime), 'h:mm a')}</span>
                <span className="text-sm text-muted-foreground">{format(new Date(apt.endTime), 'h:mm a')}</span>
              </div>
              <div className="p-6 flex-1 flex flex-col justify-center">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-xl font-bold">{apt.client?.firstName} {apt.client?.lastName}</h4>
                  <Badge variant={apt.status === 'CONFIRMED' ? 'success' : 'warning'}>{apt.status}</Badge>
                </div>
                <p className="text-primary mb-1">
                  {apt.services?.map(s => s.service?.name).join(', ')}
                </p>
                {apt.notes && <p className="text-sm text-muted-foreground mt-2 italic">"{apt.notes}"</p>}
                
                {apt.riskScore === 'HIGH' && (
                  <div className="mt-4 flex items-center gap-2 text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg inline-flex w-fit">
                    <AlertTriangle className="w-4 h-4" />
                    High cancellation risk client. Needs confirmation.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {appointments?.length === 0 && (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No appointments booked for today.</CardContent></Card>
        )}
      </div>
    </DashboardLayout>
  );
}
