import { useEffect, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import "../../lib/chartSetup";
import StatCard from "../../components/ui/StatCard";
import { analyticsService } from "../../services";
import { Loading, ErrorState } from "../../components/ui/AsyncState";

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    analyticsService
      .adminAnalytics()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <Loading label="Loading analytics..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const planMap = Object.fromEntries((data.planDistribution || []).map((p) => [p._id, p.count]));
  const planData = {
    labels: ["Free", "Premium", "Pro"],
    datasets: [
      {
        data: [planMap.Free || 0, planMap.Premium || 0, planMap.Pro || 0],
        backgroundColor: ["#cbd5e1", "#2563eb", "#f97316"],
        borderWidth: 0,
      },
    ],
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400">Live platform overview & analytics.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="Users" label="Total Users" value={data.totalUsers} accent="brand" />
        <StatCard icon="Activity" label="Active (24h)" value={data.activeUsers} accent="green" />
        <StatCard icon="FileStack" label="Total Tests" value={data.totalTests} accent="accent" />
        <StatCard icon="ListChecks" label="Total Attempts" value={data.totalAttempts} accent="violet" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <h3 className="mb-4 font-bold">Platform Summary</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-5 dark:bg-slate-800/60">
              <p className="text-sm text-slate-500">Average Score</p>
              <p className="mt-1 text-3xl font-extrabold text-brand-600 dark:text-brand-400">{data.avgScore}%</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-5 dark:bg-slate-800/60">
              <p className="text-sm text-slate-500">Total Quiz/Test Attempts</p>
              <p className="mt-1 text-3xl font-extrabold text-accent-500">{data.totalAttempts}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-5 dark:bg-slate-800/60">
              <p className="text-sm text-slate-500">Registered Students</p>
              <p className="mt-1 text-3xl font-extrabold text-emerald-600">{data.totalUsers}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-5 dark:bg-slate-800/60">
              <p className="text-sm text-slate-500">Published Tests</p>
              <p className="mt-1 text-3xl font-extrabold text-violet-600">{data.totalTests}</p>
            </div>
          </div>
        </div>
        <div className="card p-6">
          <h3 className="mb-4 font-bold">Subscription Mix</h3>
          <div className="mx-auto h-64 max-w-xs">
            <Doughnut data={planData} options={{ plugins: { legend: { position: "bottom" } } }} />
          </div>
        </div>
      </div>
    </div>
  );
}
