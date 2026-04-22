import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useDataset } from "@/hooks/useDataset";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, ReferenceLine,
} from "recharts";
import { Download, Sparkles, Heart, Skull, Moon } from "lucide-react";

interface Segment {
  customer_id: string;
  segment: string;
  predicted_uplift: number;
  baseline_risk: number;
}

const SEG_META: Record<string, { label: string; color: string; icon: any; desc: string }> = {
  persuadable: { label: "Persuadables", color: "hsl(217 91% 60%)", icon: Sparkles, desc: "Treatment causes them to stay" },
  sure_thing: { label: "Sure Things", color: "hsl(142 71% 45%)", icon: Heart, desc: "Will stay either way" },
  lost_cause: { label: "Lost Causes", color: "hsl(38 92% 50%)", icon: Skull, desc: "Will churn regardless" },
  sleeping_dog: { label: "Sleeping Dogs", color: "hsl(0 84% 60%)", icon: Moon, desc: "Treatment hurts — avoid!" },
};

const tooltipStyle = {
  backgroundColor: "hsl(230 30% 10%)",
  border: "1px solid hsl(230 25% 18%)",
  borderRadius: "8px",
  fontSize: "12px",
};

export default function Uplift() {
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

  const counts: Record<string, { count: number; sumUplift: number }> = {};
  segments.forEach((s) => {
    if (!counts[s.segment]) counts[s.segment] = { count: 0, sumUplift: 0 };
    counts[s.segment].count++;
    counts[s.segment].sumUplift += Number(s.predicted_uplift);
  });

  const scatterData = segments.slice(0, 1500).map((s) => ({
    x: Number(s.baseline_risk),
    y: Number(s.predicted_uplift),
    segment: s.segment,
    customer_id: s.customer_id,
  }));

  const top = [...segments]
    .filter((s) => s.segment === "persuadable")
    .sort((a, b) => Number(b.predicted_uplift) - Number(a.predicted_uplift))
    .slice(0, 25);

  const exportCsv = (rows: Segment[], name: string) => {
    const header = "customer_id,segment,predicted_uplift,baseline_risk";
    const body = rows
      .map(
        (r) =>
          `${r.customer_id},${r.segment},${Number(r.predicted_uplift).toFixed(4)},${Number(r.baseline_risk).toFixed(4)}`
      )
      .join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Uplift Segmentation</h1>
        <p className="text-sm text-muted-foreground">
          Per-customer treatment effects, segmented for action.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(SEG_META).map(([key, meta]) => {
          const c = counts[key]?.count ?? 0;
          const avg = c > 0 ? counts[key].sumUplift / c : 0;
          const Icon = meta.icon;
          return (
            <Card key={key} className="glass-card border-border/50">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">{meta.label}</div>
                    <div className="mt-2 text-2xl font-bold">{c.toLocaleString()}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      avg uplift: {(avg * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${meta.color}25` }}>
                    <Icon className="h-4 w-4" style={{ color: meta.color }} />
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">{meta.desc}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Uplift vs Baseline Risk</CardTitle>
          <CardDescription>
            Each dot = a customer. Top-right = high-risk + high-uplift = top retention targets.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(230 25% 18%)" />
              <XAxis
                type="number"
                dataKey="x"
                name="Baseline risk"
                stroke="hsl(215 20% 65%)"
                fontSize={12}
                domain={[0, 1]}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Predicted uplift"
                stroke="hsl(215 20% 65%)"
                fontSize={12}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              />
              <ZAxis range={[40, 40]} />
              <ReferenceLine y={0} stroke="hsl(230 25% 30%)" />
              <ReferenceLine x={0.5} stroke="hsl(230 25% 30%)" />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: any) => `${(v * 100).toFixed(1)}%`}
              />
              {Object.keys(SEG_META).map((key) => (
                <Scatter
                  key={key}
                  name={SEG_META[key].label}
                  data={scatterData.filter((d) => d.segment === key)}
                  fill={SEG_META[key].color}
                  fillOpacity={0.6}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="glass-card border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Top high-impact users</CardTitle>
            <CardDescription>Persuadables ranked by predicted uplift</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => exportCsv(top, "persuadables_top.csv")}>
            <Download className="mr-2 h-3.5 w-3.5" /> Export
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead className="text-right">Predicted uplift</TableHead>
                <TableHead className="text-right">Baseline risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top.map((r) => (
                <TableRow key={r.customer_id}>
                  <TableCell className="font-mono text-xs">{r.customer_id}</TableCell>
                  <TableCell>
                    <Badge style={{ backgroundColor: `${SEG_META[r.segment]?.color}25`, color: SEG_META[r.segment]?.color }}>
                      {SEG_META[r.segment]?.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-success">
                    +{(Number(r.predicted_uplift) * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {(Number(r.baseline_risk) * 100).toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
