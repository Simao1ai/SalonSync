import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useListUsers, useListReviews, useListAppointments } from "@workspace/api-client-react";
import { Star, UserPlus, Calendar, TrendingUp, Clock } from "lucide-react";

const LOCATION_ID = "da62c8fa-580b-44c9-bed8-e19938402d39";

export function AdminStaff() {
  const { data: users, isLoading } = useListUsers({ role: "STAFF" });
  const { data: appointments } = useListAppointments({ locationId: LOCATION_ID });
  const { data: reviews } = useListReviews({ locationId: LOCATION_ID });

  function getStaffStats(staffId: string) {
    const staffApts = appointments?.filter(a => a.staffId === staffId) ?? [];
    const staffReviews = reviews?.filter(r => r.staffId === staffId) ?? [];
    const avgRating = staffReviews.length > 0
      ? (staffReviews.reduce((s, r) => s + r.rating, 0) / staffReviews.length).toFixed(1)
      : null;
    const todayApts = staffApts.filter(a => {
      const d = new Date(a.startTime);
      const now = new Date();
      return d.toDateString() === now.toDateString() && a.status !== "CANCELLED";
    });
    return { totalApts: staffApts.length, avgRating, todayCount: todayApts.length, reviewCount: staffReviews.length };
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold">Staff</h1>
          <p className="text-muted-foreground mt-1">Manage your team and performance</p>
        </div>
        <Button className="gap-2"><UserPlus className="w-4 h-4" /> Add Staff Member</Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <Card key={i} className="h-48 animate-pulse bg-white/5" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(users ?? []).map(member => {
            const stats = getStaffStats(member.id);
            const initials = `${member.firstName?.charAt(0) ?? ""}${member.lastName?.charAt(0) ?? ""}`;
            return (
              <Card key={member.id} className="overflow-hidden hover:border-primary/30 transition-colors group">
                <CardContent className="p-0">
                  <div className="bg-gradient-to-br from-[#131D33] to-[#0A0F1D] p-6 border-b border-white/5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-xl">
                          {initials}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{member.firstName} {member.lastName}</h3>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                        Active
                      </span>
                    </div>

                    {stats.avgRating && (
                      <div className="flex items-center gap-1 mb-2">
                        {[1,2,3,4,5].map(i => (
                          <Star key={i} className={`w-4 h-4 ${i <= Math.round(parseFloat(stats.avgRating!)) ? "text-yellow-400 fill-yellow-400" : "text-white/20"}`} />
                        ))}
                        <span className="text-sm font-bold ml-1">{stats.avgRating}</span>
                        <span className="text-xs text-muted-foreground ml-1">({stats.reviewCount} reviews)</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 divide-x divide-white/5">
                    <div className="p-4 text-center">
                      <Calendar className="w-4 h-4 text-primary mx-auto mb-1" />
                      <p className="text-lg font-bold">{stats.todayCount}</p>
                      <p className="text-xs text-muted-foreground">Today</p>
                    </div>
                    <div className="p-4 text-center">
                      <TrendingUp className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                      <p className="text-lg font-bold">{stats.totalApts}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                    <div className="p-4 text-center">
                      <Clock className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                      <p className="text-lg font-bold">—</p>
                      <p className="text-xs text-muted-foreground">Hrs/wk</p>
                    </div>
                  </div>

                  <div className="px-6 py-4 border-t border-white/5 flex gap-2">
                    <Link href={`/admin/schedule?staffId=${member.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full text-xs">View Schedule</Button>
                    </Link>
                    <Button variant="ghost" size="sm" className="flex-1 text-xs">Edit</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!isLoading && (!users || users.length === 0) && (
        <Card className="border-dashed border-white/10 bg-transparent">
          <CardContent className="p-16 text-center">
            <UserPlus className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold mb-2">No staff members yet</h3>
            <p className="text-muted-foreground mb-6">Add your first team member to get started.</p>
            <Button>Add Staff Member</Button>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
