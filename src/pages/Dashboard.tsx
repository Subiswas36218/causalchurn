import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useDataset } from "@/hooks/useDataset";
import { EmptyState } from "@/components/EmptyState";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Users, TrendingDown, TrendingUp, Activity, Target } from "lucide-react";

const COLORS = ["hsl(217 91% 60%)", "hsl(270 91% 65%)", "hsl(142 71% 45%)", "hsl(38 92% 50%)"];

function Kpi({ icon: Icon, label, value, hint, accent }: { icon: any; label: string; value: string; hint?: string; accent?: string }) {
  return (
    <Card className="glass-card border-border/50">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${accent ?? "from-primary/20 to-accent/20"}`}>
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
        <div className="mt-3 text-2xl font-bold">{value}</div>
        {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

const tooltipStyle = {
  backgroundColor: "hsl(230 30% 10%)",
  border: "1px solid hsl(230 25% 18%)",
  borderRadius: "8px",
  fontSize: "12px",
};

export default function Dashboard() {
  const { selectedAnalysis } = useDataset();

  if (!selectedAnalysis?.results_json) {
    return <EmptyState />;
  }

  const r = selectedAnalysis.results_json;
  const lift = r.control_churn_rate - r.treated_churn_rate;
  const liftPct = r.control_churn_rate > 0 ? (lift / r.control_churn_rate) * 100 : 0;

  const compareData = [
    { name: "Control", churn: +(r.control_churn_rate * 100).toFixed(2), n: r.control_count },
    { name: "Treated", churn: +(r.treated_churn_rate * 100).toFixed(2), n: r.treated_count },
  ];

  const tenureData = (r.tenure_curve ?? []).map((b: any) => ({
    bucket: b.bucket,
    churn: +(b.churn_rate * 100).toFixed(2),
  }));

  // segment mix from results_json.segments
  const segCounts: Record<string, number> = {};
  (r.segments ?? []).forEach((s: any) => {
    segCounts[s.segment] = (segCounts[s.segment] ?? 0) + 1;
  });
  const segData = Object.entries(segCounts).map(([name, value]) => ({
    name: name.replace("_", " "),
    value,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of churn metrics and treatment effectiveness.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi icon={Users} label="Total customers" value={r.total_customers.toLocaleString()} />
        <Kpi
          icon={Activity}
          label="Overall churn rate"
          value={`${(r.overall_churn_rate * 100).toFixed(1)}%`}
        />
        <Kpi
          icon={TrendingUp}
          label="Control churn"
          value={`${(r.control_churn_rate * 100).toFixed(1)}%`}
          hint={`n=${r.control_count}`}
          accent="from-warning/20 to-destructive/20"
        />
        <Kpi
          icon={TrendingDown}
          label="Treated churn"
          value={`${(r.treated_churn_rate * 100).toFixed(1)}%`}
          hint={`n=${r.treated_count}`}
          accent="from-success/20 to-primary/20"
        />
        <Kpi
          icon={Target}
          label="Treatment lift"
          value={`${liftPct >= 0 ? "↓" : "↑"} ${Math.abs(liftPct).toFixed(1)}%`}
          hint={`Δ = ${(lift * 100).toFixed(2)} pp`}
          accent="from-primary/20 to-accent/20"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Treatment vs Control churn</CardTitle>
            <CardDescription>Observed churn rate by group (%)</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compareData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(230 25% 18%)" />
                <XAxis dataKey="name" stroke="hsl(215 20% 65%)" fontSize={12} />
                <YAxis stroke="hsl(215 20% 65%)" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="churn" radius={[8, 8, 0, 0]}>
                  {compareData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "hsl(38 92% 50%)" : "hsl(217 91% 60%)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Churn rate by tenure</CardTitle>
            <CardDescription>How risk evolves with customer tenure</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tenureData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(230 25% 18%)" />
                <XAxis dataKey="bucket" stroke="hsl(215 20% 65%)" fontSize={12} />
                <YAxis stroke="hsl(215 20% 65%)" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="churn"
                  stroke="hsl(270 91% 65%)"
                  strokeWidth={2}
                  dot={{ fill: "hsl(270 91% 65%)", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Customer segment mix</CardTitle>
          <CardDescription>Distribution across uplift segments</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={segData}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
              >
                {segData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
