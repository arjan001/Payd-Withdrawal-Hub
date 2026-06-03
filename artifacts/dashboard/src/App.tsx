import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Payin from "@/pages/payin";
import Payout from "@/pages/payout";
import Transactions from "@/pages/transactions";
import PayHero from "@/pages/payhero";
import Merchant from "@/pages/merchant";
import P2P from "@/pages/p2p";
import SettingsPage from "@/pages/settings";
import Panel from "@/pages/panel";
import AuthGate from "@/components/auth-gate";

const queryClient = new QueryClient();

function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);
  return <>{children}</>;
}

function ProtectedRouter() {
  return (
    <AuthGate>
      <Layout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/payin" component={Payin} />
          <Route path="/payout" component={Payout} />
          <Route path="/transactions" component={Transactions} />
          <Route path="/payhero" component={PayHero} />
          <Route path="/merchant" component={Merchant} />
          <Route path="/p2p" component={P2P} />
          <Route path="/settings" component={SettingsPage} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </AuthGate>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Switch>
              {/* Public route — no login required */}
              <Route path="/test" component={Panel} />
              {/* All other routes require authentication */}
              <Route component={ProtectedRouter} />
            </Switch>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
