import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useDataset } from "@/hooks/useDataset";
import { EmptyState } from "@/components/EmptyState";
import { GitBranch, Info } from "lucide-react";

function CausalGraph({ graph }: { graph: any }) {
  const nodePos: Record<string, { x: number; y: number }> = {
    discount: { x: 100, y: 80 },
    support: { x: 100, y: 180 },
    tenure: { x: 100, y: 280 },
    charges: { x: 100, y: 380 },
    churn: { x: 480, y: 230 },
  };

  const nodeColor = (type: string) => {
    if (type === "treatment") return "hsl(217 91% 60%)";
    if (type === "outcome") return "hsl(0 84% 60%)";
    return "hsl(270 91% 65%)";
  };

  return (
    <svg viewBox="0 0 600 460" className="h-[460px] w-full">
      <defs>
        <marker
          id="arrow"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="hsl(215 20% 65%)" />
        </marker>
      </defs>

      {graph.edges.map((e: any, i: number) => {
        const from = nodePos[e.from];
        const to = nodePos[e.to];
        if (!from || !to) return null;
        const strength = Math.min(1, Math.abs(e.effect) * 5);
        const stroke = e.effect < 0 ? "hsl(142 71% 45%)" : "hsl(38 92% 50%)";
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        return (
          <g key={i}>
            <line
              x1={from.x + 50}
              y1={from.y}
              x2={to.x - 50}
              y2={to.y}
              stroke={stroke}
              strokeWidth={1 + strength * 3}
              strokeOpacity={0.3 + strength * 0.7}
              markerEnd="url(#arrow)"
            />
            <text
              x={midX}
              y={midY - 4}
              fill="hsl(215 20% 65%)"
              fontSize="10"
              textAnchor="middle"
              className="pointer-events-none"
            >
              {e.effect > 0 ? "+" : ""}
              {(e.effect * 100).toFixed(1)}%
            </text>
          </g>
        );
      })}

      {graph.nodes.map((n: any) => {
        const pos = nodePos[n.id];
        if (!pos) return null;
        return (
          <g key={n.id}>
            <ellipse
              cx={pos.x}
              cy={pos.y}
              rx="55"
              ry="26"
              fill={nodeColor(n.type)}
              fillOpacity="0.15"
              stroke={nodeColor(n.type)}
              strokeWidth="2"
            />
            <text
              x={pos.x}
              y={pos.y + 4}
              textAnchor="middle"
              fill="hsl(210 40% 98%)"
              fontSize="12"
              fontWeight="500"
            >
              {n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Insights() {
  const { selectedAnalysis } = useDataset();
  if (!selectedAnalysis?.results_json) return <EmptyState />;

  const r = selectedAnalysis.results_json;
  const ate = r.ate;
  const sign = ate < 0 ? "reduces" : "increases";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Causal Insights</h1>
        <p className="text-sm text-muted-foreground">
          Estimated causal effect of the treatment (discount) on churn.
        </p>
      </div>

      <Card className="glass-card border-border/50 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 to-accent/10" />
        <CardHeader>
          <CardTitle className="text-base">Average Treatment Effect (ATE)</CardTitle>
          <CardDescription>
            Causal impact of treatment on the probability of churn
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <div className={`text-5xl font-bold ${ate < 0 ? "text-success" : "text-destructive"}`}>
                {ate >= 0 ? "+" : ""}
                {(ate * 100).toFixed(2)}<span className="text-2xl">pp</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Treatment {sign} churn by{" "}
                <span className="font-medium text-foreground">{Math.abs(ate * 100).toFixed(2)} percentage points</span>
              </p>
            </div>
            <div className="rounded-lg border border-border/50 bg-card/40 p-3 text-xs">
              <div className="text-muted-foreground">95% Confidence Interval</div>
              <div className="mt-1 font-mono text-sm">
                [{(r.ate_ci_low * 100).toFixed(2)}pp, {(r.ate_ci_high * 100).toFixed(2)}pp]
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GitBranch className="h-4 w-4" /> Causal graph (DAG)
            </CardTitle>
            <CardDescription>
              Directed edges show causal relationships; labels show estimated effect.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CausalGraph graph={r.graph} />

            {/* Legend */}
            <div className="mt-3 grid gap-3 rounded-lg border border-border/50 bg-card/40 p-3 text-[11px] sm:grid-cols-2">
              <div>
                <div className="mb-1.5 font-medium text-foreground">Node types</div>
                <div className="space-y-1 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full border-2" style={{ borderColor: "hsl(217 91% 60%)", backgroundColor: "hsl(217 91% 60% / 0.15)" }} />
                    Treatment — variable we intervene on
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full border-2" style={{ borderColor: "hsl(270 91% 65%)", backgroundColor: "hsl(270 91% 65% / 0.15)" }} />
                    Confounder — affects both treatment & outcome
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full border-2" style={{ borderColor: "hsl(0 84% 60%)", backgroundColor: "hsl(0 84% 60% / 0.15)" }} />
                    Outcome — what we're trying to explain
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-1.5 font-medium text-foreground">Edges</div>
                <div className="space-y-1 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-1 w-6 rounded bg-success" /> Reduces churn (negative effect)
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-1 w-6 rounded bg-warning" /> Increases churn (positive effect)
                  </div>
                  <div className="text-[10px]">Thicker line = stronger estimated effect.</div>
                </div>
              </div>
            </div>

            {/* Node explanations */}
            <div className="mt-3 space-y-2 rounded-lg border border-border/50 bg-card/40 p-3 text-xs">
              <div className="font-medium text-foreground">What each node means</div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <div className="flex items-center gap-1.5 font-medium" style={{ color: "hsl(217 91% 60%)" }}>
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "hsl(217 91% 60%)" }} />
                    Discount
                  </div>
                  <p className="mt-1 text-muted-foreground leading-snug">
                    The retention offer (treatment). We estimate how giving a discount changes the probability a customer churns.
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-medium" style={{ color: "hsl(270 91% 65%)" }}>
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "hsl(270 91% 65%)" }} />
                    Support tickets
                  </div>
                  <p className="mt-1 text-muted-foreground leading-snug">
                    A confounder: unhappy customers raise more tickets <em>and</em> are more likely to churn — and may also be targeted with discounts.
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-medium" style={{ color: "hsl(0 84% 60%)" }}>
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "hsl(0 84% 60%)" }} />
                    Churn
                  </div>
                  <p className="mt-1 text-muted-foreground leading-snug">
                    The outcome: whether the customer left. All effects in the graph are measured against this.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="text-base">CATE — Conditional effects</CardTitle>
            <CardDescription>
              Treatment effect within feature subgroups
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subgroup</TableHead>
                  <TableHead className="text-right">Effect</TableHead>
                  <TableHead className="text-right">n</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(r.cate ?? []).map((c: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{c.feature}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={c.effect < 0 ? "default" : "destructive"}
                        className={c.effect < 0 ? "bg-success/20 text-success hover:bg-success/30" : ""}
                      >
                        {c.effect >= 0 ? "+" : ""}
                        {(c.effect * 100).toFixed(2)}pp
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {c.n}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4" /> Method & assumptions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Method:</span> {r.method}
          </p>
          <div>
            <p className="mb-2 font-medium">Identification assumptions:</p>
            <ul className="space-y-1 text-muted-foreground">
              {(r.assumptions ?? []).map((a: string, i: number) => (
                <li key={i}>• {a}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
