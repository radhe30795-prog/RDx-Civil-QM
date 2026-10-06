import { Route, Switch } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { trpc, getTrpcClient } from "./lib/trpc";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import ProjectsPage from "./pages/ProjectsPage";
import TestsPage from "./pages/TestsPage";
import EntryPage from "./pages/EntryPage";
import RegisterPage from "./pages/RegisterPage";
import ReportPage from "./pages/ReportPage";
import PlannerPage from "./pages/PlannerPage";
import CalculatorPage from "./pages/CalculatorPage";

export default function App() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
  }));
  const [trpcClient] = useState(() => getTrpcClient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Layout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/projects" component={ProjectsPage} />
            <Route path="/tests" component={TestsPage} />
            <Route path="/entry/:code">
              {(params) => <EntryPage code={params.code} />}
            </Route>
            <Route path="/register" component={RegisterPage} />
            <Route path="/planner" component={PlannerPage} />
            <Route path="/calculator" component={CalculatorPage} />
            <Route path="/report/:id">
              {(params) => <ReportPage id={params.id} />}
            </Route>
            <Route>
              <div className="text-center py-10 text-slate-500">Page not found</div>
            </Route>
          </Switch>
        </Layout>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
