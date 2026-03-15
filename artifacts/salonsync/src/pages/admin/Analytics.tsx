import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useGetAnalytics } from "@workspace/api-client-react";

const mockTrendData = [
  { name: 'Mon', revenue: 4000, appointments: 24 },
  { name: 'Tue', revenue: 3000, appointments: 18 },
  { name: 'Wed', revenue: 2000, appointments: 12 },
  { name: 'Thu', revenue: 2780, appointments: 19 },
  { name: 'Fri', revenue: 5890, appointments: 35 },
  { name: 'Sat', revenue: 8390, appointments: 48 },
  { name: 'Sun', revenue: 6490, appointments: 38 },
];

export function Analytics() {
  const { data: analytics, isLoading } = useGetAnalytics({ locationId: "1" });

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold">Business Analytics</h1>
        <p className="text-muted-foreground mt-1">Deep dive into your salon's performance.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mockTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                  <XAxis dataKey="name" stroke="#888" tick={{fill: '#888'}} />
                  <YAxis stroke="#888" tick={{fill: '#888'}} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#333', borderRadius: '8px' }}
                    itemStyle={{ color: '#C9956A' }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#C9956A" strokeWidth={3} dot={{r: 4, fill: '#C9956A'}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appointments Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                  <XAxis dataKey="name" stroke="#888" tick={{fill: '#888'}} />
                  <YAxis stroke="#888" tick={{fill: '#888'}} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#333', borderRadius: '8px' }}
                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                  />
                  <Bar dataKey="appointments" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
