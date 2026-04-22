import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDataset } from "@/hooks/useDataset";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { Download, CheckCircle2, AlertTriangle, XCircle, Sparkles, Heart, Phone } from "lucide-react";

interface Segment {
  customer_id: string;
  segment: string;
  predicted_uplift: number;
  baseline_risk: number;
}

export default function Recommendations() {
  const { selectedAnalysis } = useDataset();
  const [segments, setSegments] = useState<Segment[]>([]);

  useEffect(() => {
    if (!selectedAnalysis) return;
    supabase
      .from("user_segments")
      .select("customer_id, segment, predicted_uplift, baseline_risk")
      .eq("analysis_id", selectedAnalysis.id)
      .then(({ data }) => setSegments((data as Segment[]) ?? []));
  }, [selectedAnalysis]);

  if (!selectedAnalysis?.results_json) return <EmptyState />;

  const persuadables = segments.filter((s) => s.segment === "persuadable");
  const lostCauses = segments.filter((s) => s.segment === "lost_cause");
  const sleepingDogs = segments.filter((s) => s.segment === "sleeping_dog");
  const sureThings = segments.filter((s) => s.segment === "sure_thing");

  const avgUplift = (rs: Segment[]) =>
    rs.length === 0 ? 0 : rs.reduce((a, b) => a + Number(b.predicted_uplift), 0) / rs.length;

  // Estimated retained customers and revenue
  const persuadableLift = avgUplift(persuadables);
  const persuadableRetained = Math.round(persuadables.length * persuadableLift);
  const avgMonthly = 65; // assume average ARPU
  const annualRevenueSaved = Math.round(persuadableRetained * avgMonthly * 12);

  const exportCsv = (rows: Segment[], name: string) => {
    const header = "customer_id,segment,predicted_uplift,baseline_risk";
    const body = rows
      .map((r) => `${r.customer_id},${r.segment},${Number(r.predicted_uplift).toFixed(4)},${Number(r.baseline_risk).toFixed(4)}`)
      .join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const recommendations = [
    {
      icon: Sparkles,
      tone: "primary",
      title: "Offer 15% discount to Persuadables",
      target: persuadables,
      filename: "persuadables.csv",
      kpis: [
        { label: "Target customers", value: persuadables.length.toLocaleString() },
        { label: "Est. retained", value: persuadableRetained.toLocaleString() },
        { label: "Est. annual revenue saved", value: `$${annualRevenueSaved.toLocaleString()}` },
      ],
      body: "These customers are most causally responsive to discount treatment. Prioritize them in your next retention campaign.",
      action: "DO",
    },
    {
      icon: Phone,
      tone: "accent",
      title: "Increase support touchpoints for high-risk users",
      target: lostCauses,
      filename: "high_risk_outreach.csv",
      kpis: [
        { label: "Target customers", value: lostCauses.length.toLocaleString() },
        { label: "Avg baseline risk", value: `${(avgUplift(lostCauses) * 0 + (lostCauses.reduce((a, b) => a + Number(b.baseline_risk), 0) / Math.max(1, lostCauses.length)) * 100).toFixed(0)}%` },
      ],
      body: "High churn risk and low responsiveness to discounts. Try a different lever — proactive support outreach, account reviews, or loyalty perks.",
      action: "TRY",
    },
    {
      icon: AlertTriangle,
      tone: "destructive",
      title: "Do NOT discount Sleeping Dogs",
      target: sleepingDogs,
      filename: "sleeping_dogs_avoid.csv",
      kpis: [
        { label: "Customers to exclude", value: sleepingDogs.length.toLocaleString() },
        { label: "Estimated harm if treated", value: `${(Math.abs(avgUplift(sleepingDogs)) * 100).toFixed(1)}% added churn` },
      ],
      body: "Treatment hurts these customers — discounts may signal price changes or trigger churn. Exclude from retention campaigns.",
      action: "AVOID",
    },
    {
      icon: Heart,
      tone: "success",
      title: "Save budget on Sure Things",
      target: sureThings,
      filename: "sure_things.csv",
      kpis: [
        { label: "Customers", value: sureThings.length.toLocaleString() },
        { label: "Action", value: "No discount needed" },
      ],
      body: "These customers will stay regardless of treatment. Skip them in retention campaigns to save spend.",
      action: "SKIP",
    },
  ];

  const toneStyles: Record<string, string> = {
    primary: "from-primary/20 to-accent/20 text-primary border-primary/30",
    accent: "from-accent/20 to-primary/20 text-accent border-accent/30",
    destructive: "from-destructive/20 to-warning/20 text-destructive border-destructive/30",
    success: "from-success/20 to-primary/20 text-success border-success/30",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recommendations</h1>
        <p className="text-sm text-muted-foreground">
          Causally-grounded retention plays. Each card is built from your uplift segments.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {recommendations.map((rec) => {
          const Icon = rec.icon;
          return (
            <Card key={rec.title} className="glass-card border-border/50 overflow-hidden">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br border ${toneStyles[rec.tone]}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base leading-tight">{rec.title}</CardTitle>
                      <CardDescription className="mt-1 flex items-center gap-1">
                        {rec.action === "DO" && <CheckCircle2 className="h-3 w-3 text-success" />}
                        {rec.action === "AVOID" && <XCircle className="h-3 w-3 text-destructive" />}
                        {rec.action === "TRY" && <Sparkles className="h-3 w-3 text-accent" />}
                        {rec.action === "SKIP" && <Heart className="h-3 w-3 text-success" />}
                        Action: {rec.action}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{rec.body}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {rec.kpis.map((k) => (
                    <div key={k.label} className="rounded-lg border border-border/50 bg-card/40 p-3">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {k.label}
                      </div>
                      <div className="mt-1 text-sm font-semibold">{k.value}</div>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={rec.target.length === 0}
                  onClick={() => exportCsv(rec.target, rec.filename)}
                >
                  <Download className="mr-2 h-3.5 w-3.5" />
                  Export segment list ({rec.target.length})
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
