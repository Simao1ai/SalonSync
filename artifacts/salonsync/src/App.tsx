import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import NotFound from "@/pages/not-found";
import { Landing } from "@/pages/Landing";
import { AdminDashboard } from "@/pages/admin/AdminDashboard";
import { Analytics } from "@/pages/admin/Analytics";
import { StaffDashboard } from "@/pages/staff/StaffDashboard";
import { ClientDashboard } from "@/pages/client/ClientDashboard";
import { BookingFlow } from "@/pages/client/BookingFlow";
import { SetupAdmin } from "@/pages/SetupAdmin";
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
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/analytics" component={Analytics} />
      <Route path="/staff/dashboard" component={StaffDashboard} />
      <Route path="/client/dashboard" component={ClientDashboard} />
      <Route path="/client/book" component={BookingFlow} />
      <Route path="/setup-admin" component={SetupAdmin} />
      
      {/* Catch-all for unbuilt stub routes routes */}
      <Route path="/admin/:page" component={AdminDashboard} />
      <Route path="/staff/:page" component={StaffDashboard} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
      <DevSwitcher />
      <Toaster theme="dark" position="bottom-right" richColors />
    </QueryClientProvider>
  );
}

export default App;
