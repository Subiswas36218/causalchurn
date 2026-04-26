import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDataset, type DatasetWithAnalysis } from "@/hooks/useDataset";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  FileText,
  Check,
  PlayCircle,
  RefreshCw,
  Eye,
  MousePointerClick,
  RotateCw,
  GitCompareArrows,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  Minus,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

function formatFull(d: Date) {
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatRelative(d: Date) {
  const diff = Date.now() - d.getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function formatDuration(ms: number): string {
  if (!isFinite(ms) || ms < 0) return "—";
  const s = ms / 1000;
  if (s < 1) return `${Math.round(ms)}ms`;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rs = Math.round(s - m * 60);
  return `${m}m ${rs}s`;
}

/**
 * Runtime = time between when the analysis row was created (started)
 * and when it finished. We don't have a finished_at column, so for completed
 * runs we approximate "finished" as the most recent results_json timestamp
 * if present, otherwise the analysis created_at + a 0 baseline. For
 * pending rows we tick against now().
 */
function getRuntimeMs(d: DatasetWithAnalysis, nowMs: number): number | null {
  const a = d.latest_analysis;
  if (!a) return null;
  const startedMs = new Date(a.created_at).getTime();
  if (a.status === "pending") return Math.max(0, nowMs - startedMs);
  // Prefer results_json.finished_at if the edge function ever sets it; fall back to a derived value
  const finishedIso =
    (a.results_json && (a.results_json as any).finished_at) || null;
  if (finishedIso) {
    return Math.max(0, new Date(finishedIso).getTime() - startedMs);
  }
  // No explicit finish time: best-effort using created_at as both start and finish (≈ instant).
  // Returning null tells the UI to render "—" rather than a misleading 0s.
  return null;
}

function TimeStamp({ label, date, icon: Icon }: { label: string; date: Date; icon: any }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 cursor-help">
          <Icon className="h-3 w-3" />
          <span className="text-muted-foreground/80">{label}:</span>
          <span className="tabular-nums">{formatFull(date)}</span>
          <span className="text-muted-foreground/60">({formatRelative(date)})</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <div>{date.toISOString()}</div>
        <div className="text-muted-foreground">Timezone: {tz}</div>
      </TooltipContent>
    </Tooltip>
  );
}

function statusBadge(status: string | undefined) {
  switch (status) {
    case "complete":
      return (
        <Badge variant="outline" className="gap-1 border-success/40 bg-success/10 text-success">
          <CheckCircle2 className="h-3 w-3" /> Complete
        </Badge>
      );
    case "error":
      return (
        <Badge variant="outline" className="gap-1 border-destructive/40 bg-destructive/10 text-destructive">
          <AlertCircle className="h-3 w-3" /> Error
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="outline" className="gap-1 border-primary/40 bg-primary/10 text-primary">
          <Loader2 className="h-3 w-3 animate-spin" /> Analyzing
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" /> No analysis
        </Badge>
      );
  }
}

function pct(n: number | null | undefined, digits = 2) {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

function pp(n: number | null | undefined, digits = 2) {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(digits)}pp`;
}

function DiffArrow({ delta, lowerIsBetter }: { delta: number | null; lowerIsBetter: boolean }) {
  if (delta === null || !isFinite(delta) || Math.abs(delta) < 1e-6) {
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  }
  const better = lowerIsBetter ? delta < 0 : delta > 0;
  const cls = better ? "text-success" : "text-destructive";
  return delta < 0 ? (
    <ArrowDown className={cn("h-3 w-3", cls)} />
  ) : (
    <ArrowUp className={cn("h-3 w-3", cls)} />
  );
}

interface MetricRow {
  key: string;
  label: string;
  av: number | null;
  bv: number | null;
  lowerIsBetter: boolean;
  fmt: (n: number | null | undefined) => string;
  deltaFmt: (n: number | null | undefined) => string;
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(var(--popover-foreground))",
};

function CompareTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const isPp = label === "ATE";
  const fmt = (v: number) =>
    isPp ? `${v > 0 ? "+" : ""}${v.toFixed(2)}pp` : `${v.toFixed(2)}%`;
  const a = payload.find((p: any) => p.dataKey === "a")?.value;
  const b = payload.find((p: any) => p.dataKey === "b")?.value;
  const delta = a !== undefined && b !== undefined ? b - a : null;
  return (
    <div
      className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
      style={{ borderColor: "hsl(var(--border))" }}
    >
      <div className="mb-1 font-medium">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-sm"
            style={{ background: p.color }}
          />
          <span className="text-muted-foreground">
            {p.dataKey === "a" ? "Run A" : "Run B"}:
          </span>
          <span className="tabular-nums">{fmt(p.value)}</span>
        </div>
      ))}
      {delta !== null && (
        <div className="mt-1 border-t border-border/50 pt-1 text-muted-foreground">
          Δ (B − A):{" "}
          <span className="tabular-nums text-foreground">
            {delta > 0 ? "+" : ""}
            {isPp ? delta.toFixed(2) + "pp" : delta.toFixed(2) + "%"}
          </span>
        </div>
      )}
    </div>
  );
}

function CompareCharts({
  a,
  b,
  metrics,
}: {
  a: DatasetWithAnalysis;
  b: DatasetWithAnalysis;
  metrics: MetricRow[];
}) {
  // Churn-rate chart: percent values (overall/control/treated)
  const churnData = metrics
    .filter((m) => m.key !== "ate" && m.av !== null && m.bv !== null)
    .map((m) => ({
      metric:
        m.key === "overall" ? "Overall" : m.key === "control" ? "Control" : "Treated",
      a: +((m.av as number) * 100).toFixed(2),
      b: +((m.bv as number) * 100).toFixed(2),
    }));

  // ATE chart: percentage points (can be negative — negative = treatment reduces churn)
  const aAte = metrics.find((m) => m.key === "ate")?.av ?? null;
  const bAte = metrics.find((m) => m.key === "ate")?.bv ?? null;
  const ateData =
    aAte !== null && bAte !== null
      ? [{ metric: "ATE", a: +(aAte * 100).toFixed(2), b: +(bAte * 100).toFixed(2) }]
      : [];

  const aColor = "hsl(217 91% 60%)";
  const bColor = "hsl(270 91% 65%)";
  const aName = `A · ${a.name}`;
  const bName = `B · ${b.name}`;

  return (
    <div className="grid gap-4 px-4 pt-2 lg:grid-cols-[2fr_1fr]">
      <div className="rounded-lg border border-border/40 bg-card/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-medium">Churn rate by group (%)</div>
          <div className="text-[10px] text-muted-foreground">Lower is better</div>
        </div>
        <div className="h-[220px]">
          {churnData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No churn data available for one of the runs.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={churnData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="metric"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickFormatter={(v) => `${v}%`}
                />
                <RTooltip content={<CompareTooltip />} cursor={{ fill: "hsl(var(--muted)/0.3)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" />
                <Bar dataKey="a" name={aName} fill={aColor} radius={[6, 6, 0, 0]} />
                <Bar dataKey="b" name={bName} fill={bColor} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border/40 bg-card/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-medium">ATE (pp)</div>
          <div className="text-[10px] text-muted-foreground">Negative = reduces churn</div>
        </div>
        <div className="h-[220px]">
          {ateData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No ATE available for one of the runs.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ateData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="metric"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickFormatter={(v) => `${v}pp`}
                />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <RTooltip content={<CompareTooltip />} cursor={{ fill: "hsl(var(--muted)/0.3)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" />
                <Bar dataKey="a" name={aName} fill={aColor} radius={[6, 6, 0, 0]} />
                <Bar dataKey="b" name={bName} fill={bColor} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

function CompareView({
  a,
  b,
  onClear,
}: {
  a: DatasetWithAnalysis;
  b: DatasetWithAnalysis;
  onClear: () => void;
}) {
  const ar = a.latest_analysis?.results_json as any;
  const br = b.latest_analysis?.results_json as any;
  const aAte = a.latest_analysis?.ate ?? ar?.ate ?? null;
  const bAte = b.latest_analysis?.ate ?? br?.ate ?? null;

  const metrics = [
    {
      key: "overall",
      label: "Overall churn",
      av: ar?.overall_churn_rate ?? null,
      bv: br?.overall_churn_rate ?? null,
      lowerIsBetter: true,
      fmt: pct,
      deltaFmt: pp,
    },
    {
      key: "control",
      label: "Control churn",
      av: ar?.control_churn_rate ?? null,
      bv: br?.control_churn_rate ?? null,
      lowerIsBetter: true,
      fmt: pct,
      deltaFmt: pp,
    },
    {
      key: "treated",
      label: "Treated churn",
      av: ar?.treated_churn_rate ?? null,
      bv: br?.treated_churn_rate ?? null,
      lowerIsBetter: true,
      fmt: pct,
      deltaFmt: pp,
    },
    {
      key: "ate",
      label: "ATE (treatment effect)",
      av: aAte,
      bv: bAte,
      lowerIsBetter: true, // negative ATE = treatment reduces churn = better
      fmt: pp,
      deltaFmt: pp,
    },
  ];

  return (
    <Card className="glass-card border-primary/30 bg-primary/[0.03]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <GitCompareArrows className="h-4 w-4 text-primary" />
              Comparing two runs
            </CardTitle>
            <CardDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium text-foreground">A: {a.name}</span>
              <ArrowRight className="h-3 w-3" />
              <span className="font-medium text-foreground">B: {b.name}</span>
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-0">
        <CompareCharts a={a} b={b} metrics={metrics} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 text-xs text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Metric</th>
                <th className="px-4 py-2 text-right font-medium">A</th>
                <th className="px-4 py-2 text-right font-medium">B</th>
                <th className="px-4 py-2 text-right font-medium">Δ (B − A)</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => {
                const delta =
                  m.av !== null && m.bv !== null && isFinite(m.av) && isFinite(m.bv)
                    ? m.bv - m.av
                    : null;
                return (
                  <tr key={m.key} className="border-b border-border/30 last:border-0">
                    <td className="px-4 py-2.5 text-muted-foreground">{m.label}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{m.fmt(m.av)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{m.fmt(m.bv)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <span className="inline-flex items-center justify-end gap-1">
                        <DiffArrow delta={delta} lowerIsBetter={m.lowerIsBetter} />
                        <span>{m.deltaFmt(delta)}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function DatasetHistory() {
  const { datasetsWithAnalysis, selectedDatasetId, setSelectedDatasetId, refresh } = useDataset();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Tick once a second so "Analyzing" runtime stays live
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const compareA = datasetsWithAnalysis.find((d) => d.id === selectedForCompare[0]) ?? null;
  const compareB = datasetsWithAnalysis.find((d) => d.id === selectedForCompare[1]) ?? null;

  const toggleForCompare = (id: string) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      const next = [...prev, id];
      // Keep only the two most recent picks
      return next.slice(-2);
    });
  };

  const handleRetry = async (datasetId: string) => {
    if (!user) return;
    setRetryingId(datasetId);
    try {
      const { error } = await supabase.functions.invoke("analyze", {
        body: { dataset_id: datasetId },
      });
      if (error) throw error;
      toast({ title: "Analysis re-queued", description: "Polling for fresh results…" });
      await refresh();
    } catch (e: any) {
      toast({
        title: "Retry failed",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    } finally {
      setRetryingId(null);
    }
  };

  if (datasetsWithAnalysis.length === 0) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        {compareMode && compareA && compareB && (
          <CompareView a={compareA} b={compareB} onClear={() => setSelectedForCompare([])} />
        )}

        <Card className="glass-card border-border/50">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Dataset history</CardTitle>
                <CardDescription>
                  Switch between previous uploads, retry failed runs, or compare two runs
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="compare-mode" className="text-xs text-muted-foreground">
                  Compare mode
                </Label>
                <Switch
                  id="compare-mode"
                  checked={compareMode}
                  onCheckedChange={(v) => {
                    setCompareMode(v);
                    if (!v) setSelectedForCompare([]);
                  }}
                />
              </div>
            </div>
            {compareMode && (
              <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                Pick <span className="font-medium text-foreground">two completed runs</span> to
                see ATE & churn-rate differences.{" "}
                {selectedForCompare.length}/2 selected.
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[28rem]">
              <ul className="divide-y divide-border/40">
                {datasetsWithAnalysis.map((d) => {
                  const isActive = d.id === selectedDatasetId;
                  const uploaded = new Date(d.created_at);
                  const startedAt = d.latest_analysis?.created_at
                    ? new Date(d.latest_analysis.created_at)
                    : null;
                  const status = d.latest_analysis?.status;
                  const isError = status === "error";
                  const isPending = status === "pending";
                  const isRetrying = retryingId === d.id;
                  const runtimeMs = getRuntimeMs(d, now);
                  const isPicked = selectedForCompare.includes(d.id);
                  const canCompare = status === "complete";

                  return (
                    <li
                      key={d.id}
                      className={cn(
                        "px-4 py-3",
                        isActive && "bg-primary/5",
                        compareMode && isPicked && "bg-primary/10 ring-1 ring-inset ring-primary/30"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                            isActive
                              ? "bg-primary/15 text-primary"
                              : "bg-muted/50 text-muted-foreground"
                          )}
                        >
                          {isActive ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium">{d.name}</span>
                            {statusBadge(status)}
                            {isActive && (
                              <Badge variant="outline" className="gap-1 border-primary/40 text-primary">
                                Active
                              </Badge>
                            )}
                            {compareMode && isPicked && (
                              <Badge className="gap-1 bg-primary text-primary-foreground">
                                {selectedForCompare[0] === d.id ? "A" : "B"}
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {d.row_count.toLocaleString()} rows
                          </div>
                          <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                            <TimeStamp label="Uploaded" date={uploaded} icon={FileText} />
                            {startedAt ? (
                              <TimeStamp
                                label="Analysis started"
                                date={startedAt}
                                icon={PlayCircle}
                              />
                            ) : (
                              <span className="inline-flex items-center gap-1 text-muted-foreground/70">
                                <PlayCircle className="h-3 w-3" /> No analysis run yet
                              </span>
                            )}
                            <TimeStamp
                              label="Last updated"
                              date={startedAt ?? uploaded}
                              icon={RefreshCw}
                            />
                            {startedAt && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center gap-1 cursor-help">
                                    <Timer className="h-3 w-3" />
                                    <span className="text-muted-foreground/80">Runtime:</span>
                                    <span className="tabular-nums">
                                      {runtimeMs === null
                                        ? "—"
                                        : formatDuration(runtimeMs)}
                                    </span>
                                    {isPending && (
                                      <span className="text-primary">(running)</span>
                                    )}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  Time from analysis start to last update.
                                  {runtimeMs === null && (
                                    <div className="mt-1 text-muted-foreground">
                                      No finish timestamp recorded for older runs.
                                    </div>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {isError && d.latest_analysis?.error_message && (
                              <span className="mt-0.5 break-words font-mono text-[10px] text-destructive/90">
                                {d.latest_analysis.error_message}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col gap-1.5">
                          {compareMode ? (
                            <Button
                              size="sm"
                              variant={isPicked ? "default" : "outline"}
                              className="h-7 gap-1 px-2 text-[11px]"
                              onClick={() => toggleForCompare(d.id)}
                              disabled={!canCompare}
                              title={
                                canCompare
                                  ? "Pick this run for comparison"
                                  : "Only completed runs can be compared"
                              }
                            >
                              <GitCompareArrows className="h-3 w-3" />
                              {isPicked
                                ? `Picked (${selectedForCompare[0] === d.id ? "A" : "B"})`
                                : "Pick"}
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant={isActive ? "secondary" : "default"}
                                className="h-7 gap-1 px-2 text-[11px]"
                                onClick={() => setSelectedDatasetId(d.id)}
                                disabled={isActive}
                              >
                                <MousePointerClick className="h-3 w-3" />
                                {isActive ? "Active" : "Set as active"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 px-2 text-[11px]"
                                onClick={() => {
                                  setSelectedDatasetId(d.id);
                                  navigate("/insights");
                                }}
                                disabled={!d.latest_analysis?.results_json}
                              >
                                <Eye className="h-3 w-3" />
                                View details
                              </Button>
                              {isError && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 gap-1 border-destructive/40 px-2 text-[11px] text-destructive hover:bg-destructive/10"
                                  onClick={() => handleRetry(d.id)}
                                  disabled={isRetrying}
                                >
                                  {isRetrying ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <RotateCw className="h-3 w-3" />
                                  )}
                                  Retry analysis
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
