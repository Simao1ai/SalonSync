import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import NotFound from "@/pages/not-found";
import { Landing } from "@/pages/Landing";

import { AdminDashboard } from "@/pages/admin/AdminDashboard";
import { AdminAppointments } from "@/pages/admin/AdminAppointments";
import { AdminCalendar } from "@/pages/admin/AdminCalendar";
import { AdminStaff } from "@/pages/admin/AdminStaff";
import { AdminServices } from "@/pages/admin/AdminServices";
import { AdminSettings } from "@/pages/admin/AdminSettings";
import { Analytics } from "@/pages/admin/Analytics";
import { AdminWaitlist } from "@/pages/admin/AdminWaitlist";
import { AdminSchedule } from "@/pages/admin/AdminSchedule";

import { Explore } from "@/pages/Explore";

import { StaffDashboard } from "@/pages/staff/StaffDashboard";
import { StaffClients } from "@/pages/staff/StaffClients";
import { StaffEarnings } from "@/pages/staff/StaffEarnings";
import { StaffMessages } from "@/pages/staff/StaffMessages";

import { ClientDashboard } from "@/pages/client/ClientDashboard";
import { BookingFlow } from "@/pages/client/BookingFlow";
import { ClientReviews } from "@/pages/client/ClientReviews";
import { ClientProfile } from "@/pages/client/ClientProfile";
import { ClientMessages } from "@/pages/client/ClientMessages";
import { ClientWaitlist } from "@/pages/client/ClientWaitlist";

import { PlatformDashboard } from "@/pages/platform/PlatformDashboard";
import { PlatformTenants } from "@/pages/platform/PlatformTenants";
import { PlatformUsers } from "@/pages/platform/PlatformUsers";
import { PlatformAnalytics } from "@/pages/platform/PlatformAnalytics";
import { PlatformSupport } from "@/pages/platform/PlatformSupport";

import { SetupAdmin } from "@/pages/SetupAdmin";
import { SetupPlatform } from "@/pages/SetupPlatform";
import { DevSwitcher } from "@/components/DevSwitcher";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/explore" component={Explore} />

      {/* Admin */}
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/appointments" component={AdminAppointments} />
      <Route path="/admin/calendar" component={AdminCalendar} />
      <Route path="/admin/staff" component={AdminStaff} />
      <Route path="/admin/services" component={AdminServices} />
      <Route path="/admin/analytics" component={Analytics} />
      <Route path="/admin/settings" component={AdminSettings} />
      <Route path="/admin/waitlist" component={AdminWaitlist} />
      <Route path="/admin/schedule" component={AdminSchedule} />

      {/* Staff */}
      <Route path="/staff/dashboard" component={StaffDashboard} />
      <Route path="/staff/clients" component={StaffClients} />
      <Route path="/staff/earnings" component={StaffEarnings} />
      <Route path="/staff/messages" component={StaffMessages} />

      {/* Client */}
      <Route path="/client/dashboard" component={ClientDashboard} />
      <Route path="/client/book" component={BookingFlow} />
      <Route path="/client/reviews" component={ClientReviews} />
      <Route path="/client/profile" component={ClientProfile} />
      <Route path="/client/messages" component={ClientMessages} />
      <Route path="/client/waitlist" component={ClientWaitlist} />

      {/* Platform Admin */}
      <Route path="/platform/dashboard" component={PlatformDashboard} />
      <Route path="/platform/tenants" component={PlatformTenants} />
      <Route path="/platform/users" component={PlatformUsers} />
      <Route path="/platform/analytics" component={PlatformAnalytics} />
      <Route path="/platform/support" component={PlatformSupport} />

      <Route path="/setup-admin" component={SetupAdmin} />
      <Route path="/setup-platform" component={SetupPlatform} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
        <DevSwitcher />
      </WouterRouter>
      <Toaster theme="dark" position="bottom-right" richColors />
    </QueryClientProvider>
  );
}

export default App;
