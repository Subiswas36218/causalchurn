import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDataset, type DatasetWithAnalysis } from "@/hooks/useDataset";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  diffOfProportions,
  ateZAndP,
  diffOfAtes,
  formatP,
  sigStars,
  proportionCI,
} from "@/lib/stats";
import { downloadNodeAsPng, downloadString, toCsv } from "@/lib/export";
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
  Download,
  FileImage,
  FileSpreadsheet,
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

interface MetricStat {
  /** Standard error of the value itself (proportion or ATE). */
  se: number | null;
  /** 95% CI for the value. */
  ci: { low: number; high: number } | null;
  /** Sample size used to derive SE/CI (proportions only). */
  n: number | null;
}

interface MetricRow {
  key: string;
  label: string;
  av: number | null;
  bv: number | null;
  lowerIsBetter: boolean;
  fmt: (n: number | null | undefined) => string;
  deltaFmt: (n: number | null | undefined) => string;
  /** Per-run statistics for displaying CIs / sample sizes. */
  aStat: MetricStat;
  bStat: MetricStat;
  /** Significance test for B − A (two-prop z-test, or diff-of-ATEs). */
  diffTest:
    | {
        diff: number;
        se: number;
        ciLow: number;
        ciHigh: number;
        z: number;
        p: number;
      }
    | null;
  /** True when the metric is expressed in percentage points (ATE). */
  isPp: boolean;
}

/** Format a CI tuple as either pp or % depending on metric. */
function fmtCI(ci: { low: number; high: number } | null, isPp: boolean): string {
  if (!ci) return "—";
  const f = (x: number) =>
    isPp
      ? `${x > 0 ? "+" : ""}${(x * 100).toFixed(2)}pp`
      : `${(x * 100).toFixed(2)}%`;
  return `[${f(ci.low)}, ${f(ci.high)}]`;
}

function CompareTooltip({ active, payload, label, metricsByLabel }: any) {
  if (!active || !payload?.length) return null;
  const m: MetricRow | undefined = metricsByLabel?.[label];
  const isPp = m?.isPp ?? label === "ATE";
  const fmtVal = (v: number) =>
    isPp ? `${v > 0 ? "+" : ""}${v.toFixed(2)}pp` : `${v.toFixed(2)}%`;
  const t = m?.diffTest ?? null;
  const stars = t ? sigStars(t.p) : "";
  const sigClass =
    !t || stars === "ns" ? "text-muted-foreground" : "text-success";
  return (
    <div
      role="tooltip"
      className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
      style={{ borderColor: "hsl(var(--border))" }}
    >
      <div className="mb-1 font-medium">{label}</div>
      {payload.map((p: any) => {
        const stat = p.dataKey === "a" ? m?.aStat : m?.bStat;
        return (
          <div key={p.dataKey} className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-sm"
                style={{ background: p.color }}
                aria-hidden="true"
              />
              <span className="text-muted-foreground">
                {p.dataKey === "a" ? "Run A" : "Run B"}:
              </span>
              <span className="tabular-nums">{fmtVal(p.value)}</span>
            </div>
            {stat?.ci && (
              <div className="pl-4 text-[10px] text-muted-foreground">
                95% CI {fmtCI(stat.ci, isPp)}
                {stat.n != null ? ` · n=${stat.n.toLocaleString()}` : ""}
              </div>
            )}
          </div>
        );
      })}
      {t && (
        <div className="mt-1 space-y-0.5 border-t border-border/50 pt-1">
          <div className="text-muted-foreground">
            Δ (B − A):{" "}
            <span className="tabular-nums text-foreground">
              {t.diff > 0 ? "+" : ""}
              {(t.diff * 100).toFixed(2)}pp
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            95% CI of Δ: [{(t.ciLow * 100).toFixed(2)}pp,{" "}
            {(t.ciHigh * 100).toFixed(2)}pp]
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-muted-foreground">p =</span>
            <span className="tabular-nums">{formatP(t.p)}</span>
            <span className={cn("font-semibold", sigClass)}>{stars}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Stable accent colors for run A and run B. */
const A_COLOR = "hsl(217 91% 60%)";
const B_COLOR = "hsl(270 91% 65%)";

/**
 * A11y-friendly text summary of a metric (used as aria-label/sr-only desc).
 * Includes values, CIs, and significance for screen readers.
 */
function metricA11ySummary(m: MetricRow): string {
  const av = m.av != null ? m.fmt(m.av) : "n/a";
  const bv = m.bv != null ? m.fmt(m.bv) : "n/a";
  const aCi = m.aStat.ci ? `, 95% CI ${fmtCI(m.aStat.ci, m.isPp)}` : "";
  const bCi = m.bStat.ci ? `, 95% CI ${fmtCI(m.bStat.ci, m.isPp)}` : "";
  let sig = "";
  if (m.diffTest) {
    const stars = sigStars(m.diffTest.p);
    sig = `. Difference B minus A is ${m.deltaFmt(m.diffTest.diff)}, 95% CI [${(m.diffTest.ciLow * 100).toFixed(2)}pp, ${(m.diffTest.ciHigh * 100).toFixed(2)}pp], p ${formatP(m.diffTest.p)}${stars && stars !== "ns" ? ` (${stars})` : ""}`;
  }
  return `${m.label}: Run A ${av}${aCi}; Run B ${bv}${bCi}${sig}.`;
}

/** Compact significance pill rendered above each chart. */
function SigPill({ p, label }: { p: number | null | undefined; label: string }) {
  if (p === null || p === undefined || !Number.isFinite(p)) {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
        {label}: insufficient data
      </span>
    );
  }
  const stars = sigStars(p);
  const cls =
    stars === "ns"
      ? "bg-muted text-muted-foreground"
      : "bg-success/15 text-success";
  return (
    <span
      className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums", cls)}
      title={`Two-sided p-value for B − A`}
    >
      {label}: p {formatP(p)} {stars}
    </span>
  );
}

const CompareCharts = React.forwardRef<
  HTMLDivElement,
  {
    a: DatasetWithAnalysis;
    b: DatasetWithAnalysis;
    metrics: MetricRow[];
  }
>(function CompareCharts({ a, b, metrics }, ref) {
  // Churn-rate chart: percent values (overall/control/treated)
  const churnMetrics = metrics.filter(
    (m) => m.key !== "ate" && m.av !== null && m.bv !== null
  );
  const churnData = churnMetrics.map((m) => ({
    metric:
      m.key === "overall" ? "Overall" : m.key === "control" ? "Control" : "Treated",
    a: +((m.av as number) * 100).toFixed(2),
    b: +((m.bv as number) * 100).toFixed(2),
  }));

  // ATE chart: percentage points (negative ATE = treatment reduces churn)
  const ateMetric = metrics.find((m) => m.key === "ate");
  const aAte = ateMetric?.av ?? null;
  const bAte = ateMetric?.bv ?? null;
  const ateData =
    aAte !== null && bAte !== null
      ? [{ metric: "ATE", a: +(aAte * 100).toFixed(2), b: +(bAte * 100).toFixed(2) }]
      : [];

  const aName = `A · ${a.name}`;
  const bName = `B · ${b.name}`;

  // Map label → MetricRow so the tooltip can pull CIs/p-values
  const metricsByLabel = useMemo(() => {
    const out: Record<string, MetricRow> = {};
    for (const m of metrics) {
      const lbl =
        m.key === "ate"
          ? "ATE"
          : m.key === "overall"
            ? "Overall"
            : m.key === "control"
              ? "Control"
              : "Treated";
      out[lbl] = m;
    }
    return out;
  }, [metrics]);

  // Worst (smallest) p-value per chart used for the headline pill
  const churnHeadlineP = churnMetrics
    .map((m) => m.diffTest?.p)
    .filter((p): p is number => Number.isFinite(p as number))
    .sort((x, y) => x - y)[0];
  const ateHeadlineP = ateMetric?.diffTest?.p;

  // Sortable, screen-reader-friendly description of the entire chart block
  const churnSummary = churnMetrics.map(metricA11ySummary).join(" ");
  const ateSummary = ateMetric ? metricA11ySummary(ateMetric) : "";

  return (
    <div
      ref={ref}
      className="grid gap-4 px-4 pt-2 lg:grid-cols-[2fr_1fr]"
      role="group"
      aria-label="Side-by-side comparison charts for the two selected runs"
    >
      <figure
        className="rounded-lg border border-border/40 bg-card/40 p-3"
        aria-labelledby="compare-churn-title"
        aria-describedby="compare-churn-desc"
      >
        <figcaption className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div id="compare-churn-title" className="text-xs font-medium">
            Churn rate by group (%)
          </div>
          <div className="flex items-center gap-2">
            <SigPill p={churnHeadlineP} label="Δ churn" />
            <span className="text-[10px] text-muted-foreground">Lower is better</span>
          </div>
        </figcaption>
        <p id="compare-churn-desc" className="sr-only">
          Bar chart comparing churn rates between {aName} and {bName}. {churnSummary}
        </p>
        <div
          className="h-[220px]"
          tabIndex={0}
          role="img"
          aria-label={`Churn rate comparison between Run A "${a.name}" and Run B "${b.name}". ${churnSummary}`}
        >
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
                <RTooltip
                  content={<CompareTooltip metricsByLabel={metricsByLabel} />}
                  cursor={{ fill: "hsl(var(--muted)/0.3)" }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  iconType="square"
                  formatter={(value) => (
                    <span
                      tabIndex={0}
                      className="inline-block focus:outline-none focus:underline"
                    >
                      {value}
                    </span>
                  )}
                />
                <Bar dataKey="a" name={aName} fill={A_COLOR} radius={[6, 6, 0, 0]} />
                <Bar dataKey="b" name={bName} fill={B_COLOR} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </figure>

      <figure
        className="rounded-lg border border-border/40 bg-card/40 p-3"
        aria-labelledby="compare-ate-title"
        aria-describedby="compare-ate-desc"
      >
        <figcaption className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div id="compare-ate-title" className="text-xs font-medium">
            ATE (pp)
          </div>
          <div className="flex items-center gap-2">
            <SigPill p={ateHeadlineP} label="Δ ATE" />
            <span className="text-[10px] text-muted-foreground">
              Negative = reduces churn
            </span>
          </div>
        </figcaption>
        <p id="compare-ate-desc" className="sr-only">
          Bar chart comparing the average treatment effect between {aName} and {bName}. {ateSummary}
        </p>
        <div
          className="h-[220px]"
          tabIndex={0}
          role="img"
          aria-label={`ATE comparison between Run A "${a.name}" and Run B "${b.name}". ${ateSummary}`}
        >
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
                <RTooltip
                  content={<CompareTooltip metricsByLabel={metricsByLabel} />}
                  cursor={{ fill: "hsl(var(--muted)/0.3)" }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  iconType="square"
                  formatter={(value) => (
                    <span
                      tabIndex={0}
                      className="inline-block focus:outline-none focus:underline"
                    >
                      {value}
                    </span>
                  )}
                />
                <Bar dataKey="a" name={aName} fill={A_COLOR} radius={[6, 6, 0, 0]} />
                <Bar dataKey="b" name={bName} fill={B_COLOR} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </figure>
    </div>
  );
});

/**
 * Build the metric rows for the compare view, including SE/CI/p-values
 * for each proportion (Wald) and the ATE (recovered from the stored CI).
 */
function buildMetrics(a: DatasetWithAnalysis, b: DatasetWithAnalysis): MetricRow[] {
  const ar = (a.latest_analysis?.results_json ?? {}) as any;
  const br = (b.latest_analysis?.results_json ?? {}) as any;

  const aTotal = (ar.treated_count ?? 0) + (ar.control_count ?? 0);
  const bTotal = (br.treated_count ?? 0) + (br.control_count ?? 0);

  const propRow = (
    key: "overall" | "control" | "treated",
    label: string,
    av: number | null,
    bv: number | null,
    an: number | null,
    bn: number | null
  ): MetricRow => {
    const aCi = av !== null && an && an > 0 ? proportionCI(av, an) : null;
    const bCi = bv !== null && bn && bn > 0 ? proportionCI(bv, bn) : null;
    const diffTest =
      av !== null && bv !== null && an && bn && an > 0 && bn > 0
        ? diffOfProportions(bv, bn, av, an)
        : null;
    return {
      key,
      label,
      av,
      bv,
      lowerIsBetter: true,
      fmt: pct,
      deltaFmt: pp,
      isPp: false,
      aStat: { se: null, ci: aCi, n: an ?? null },
      bStat: { se: null, ci: bCi, n: bn ?? null },
      diffTest,
    };
  };

  const aAte = a.latest_analysis?.ate ?? ar?.ate ?? null;
  const bAte = b.latest_analysis?.ate ?? br?.ate ?? null;
  const aAteCiLow = a.latest_analysis?.ate_ci_low ?? ar?.ate_ci_low ?? null;
  const aAteCiHigh = a.latest_analysis?.ate_ci_high ?? ar?.ate_ci_high ?? null;
  const bAteCiLow = b.latest_analysis?.ate_ci_low ?? br?.ate_ci_low ?? null;
  const bAteCiHigh = b.latest_analysis?.ate_ci_high ?? br?.ate_ci_high ?? null;
  const aAteStats =
    aAte !== null ? ateZAndP(aAte, aAteCiLow, aAteCiHigh) : null;
  const bAteStats =
    bAte !== null ? ateZAndP(bAte, bAteCiLow, bAteCiHigh) : null;
  const ateDiffTest =
    aAte !== null && bAte !== null && aAteStats && bAteStats
      ? diffOfAtes(
          { ate: aAte, se: aAteStats.se },
          { ate: bAte, se: bAteStats.se }
        )
      : null;

  return [
    propRow(
      "overall",
      "Overall churn",
      ar?.overall_churn_rate ?? null,
      br?.overall_churn_rate ?? null,
      aTotal || null,
      bTotal || null
    ),
    propRow(
      "control",
      "Control churn",
      ar?.control_churn_rate ?? null,
      br?.control_churn_rate ?? null,
      ar?.control_count ?? null,
      br?.control_count ?? null
    ),
    propRow(
      "treated",
      "Treated churn",
      ar?.treated_churn_rate ?? null,
      br?.treated_churn_rate ?? null,
      ar?.treated_count ?? null,
      br?.treated_count ?? null
    ),
    {
      key: "ate",
      label: "ATE (treatment effect)",
      av: aAte,
      bv: bAte,
      lowerIsBetter: true, // negative ATE = treatment reduces churn = better
      fmt: pp,
      deltaFmt: pp,
      isPp: true,
      aStat: {
        se: aAteStats?.se ?? null,
        ci:
          aAteCiLow !== null && aAteCiHigh !== null
            ? { low: aAteCiLow, high: aAteCiHigh }
            : null,
        n: null,
      },
      bStat: {
        se: bAteStats?.se ?? null,
        ci:
          bAteCiLow !== null && bAteCiHigh !== null
            ? { low: bAteCiLow, high: bAteCiHigh }
            : null,
        n: null,
      },
      diffTest: ateDiffTest,
    },
  ];
}

/** Build the CSV content for the comparison export. */
function buildCompareCsv(
  a: DatasetWithAnalysis,
  b: DatasetWithAnalysis,
  metrics: MetricRow[]
): string {
  const header = [
    "metric",
    "unit",
    "run_a_name",
    "run_a_value",
    "run_a_ci_low",
    "run_a_ci_high",
    "run_a_n",
    "run_b_name",
    "run_b_value",
    "run_b_ci_low",
    "run_b_ci_high",
    "run_b_n",
    "delta_b_minus_a",
    "delta_ci_low",
    "delta_ci_high",
    "delta_se",
    "delta_z",
    "delta_p_value",
    "significance",
  ];
  const rows = metrics.map((m) => {
    const unit = m.isPp ? "pp" : "proportion";
    return [
      m.label,
      unit,
      a.name,
      m.av,
      m.aStat.ci?.low ?? "",
      m.aStat.ci?.high ?? "",
      m.aStat.n ?? "",
      b.name,
      m.bv,
      m.bStat.ci?.low ?? "",
      m.bStat.ci?.high ?? "",
      m.bStat.n ?? "",
      m.diffTest?.diff ?? "",
      m.diffTest?.ciLow ?? "",
      m.diffTest?.ciHigh ?? "",
      m.diffTest?.se ?? "",
      m.diffTest?.z ?? "",
      m.diffTest?.p ?? "",
      m.diffTest ? sigStars(m.diffTest.p) : "",
    ];
  });
  return toCsv([header, ...rows]);
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
  const metrics = useMemo(() => buildMetrics(a, b), [a, b]);
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [exporting, setExporting] = useState<"csv" | "png" | null>(null);

  const handleCsv = () => {
    setExporting("csv");
    try {
      const csv = buildCompareCsv(a, b, metrics);
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      downloadString(`compare_${a.name}_vs_${b.name}_${ts}.csv`, csv);
      toast({ title: "CSV exported", description: "Saved to your downloads." });
    } catch (e: any) {
      toast({
        title: "Export failed",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  };

  const handlePng = async () => {
    if (!exportRef.current) return;
    setExporting("png");
    try {
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      await downloadNodeAsPng(
        exportRef.current,
        `compare_${a.name}_vs_${b.name}_${ts}.png`
      );
      toast({ title: "PNG exported", description: "Saved to your downloads." });
    } catch (e: any) {
      toast({
        title: "Export failed",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  };

  return (
    <Card
      className="glass-card border-primary/30 bg-primary/[0.03]"
      role="region"
      aria-label={`Comparison of run A "${a.name}" and run B "${b.name}"`}
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <GitCompareArrows className="h-4 w-4 text-primary" aria-hidden="true" />
              Comparing two runs
            </CardTitle>
            <CardDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span
                className="inline-flex items-center gap-1.5 font-medium text-foreground"
                aria-label={`Run A: ${a.name}`}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ background: A_COLOR }}
                  aria-hidden="true"
                />
                A: {a.name}
              </span>
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
              <span
                className="inline-flex items-center gap-1.5 font-medium text-foreground"
                aria-label={`Run B: ${b.name}`}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ background: B_COLOR }}
                  aria-hidden="true"
                />
                B: {b.name}
              </span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  aria-label="Export comparison"
                  disabled={exporting !== null}
                >
                  {exporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Download</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleCsv} className="gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Metric table (.csv)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePng} className="gap-2">
                  <FileImage className="h-4 w-4" />
                  Charts &amp; table (.png)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="sm" onClick={onClear}>
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-0">
        <div ref={exportRef} className="space-y-4 bg-background/0 pb-2">
          <CompareCharts a={a} b={b} metrics={metrics} />
          <div className="overflow-x-auto">
            <table
              className="w-full text-sm"
              aria-label={`Metric comparison table for run A "${a.name}" and run B "${b.name}"`}
            >
              <caption className="sr-only">
                Side-by-side metrics with 95% confidence intervals and two-sided
                p-values for the difference B − A.
              </caption>
              <thead>
                <tr className="border-b border-border/40 text-xs text-muted-foreground">
                  <th scope="col" className="px-4 py-2 text-left font-medium">
                    Metric
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    A (95% CI)
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    B (95% CI)
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Δ (B − A)
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    p-value
                  </th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => {
                  const delta = m.diffTest?.diff ?? null;
                  const stars = m.diffTest ? sigStars(m.diffTest.p) : "";
                  const pCls =
                    !m.diffTest || stars === "ns"
                      ? "text-muted-foreground"
                      : "text-success";
                  return (
                    <tr
                      key={m.key}
                      className="border-b border-border/30 last:border-0"
                    >
                      <th
                        scope="row"
                        className="px-4 py-2.5 text-left font-normal text-muted-foreground"
                      >
                        {m.label}
                      </th>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        <div>{m.fmt(m.av)}</div>
                        {m.aStat.ci && (
                          <div className="text-[10px] text-muted-foreground">
                            {fmtCI(m.aStat.ci, m.isPp)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        <div>{m.fmt(m.bv)}</div>
                        {m.bStat.ci && (
                          <div className="text-[10px] text-muted-foreground">
                            {fmtCI(m.bStat.ci, m.isPp)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        <span className="inline-flex items-center justify-end gap-1">
                          <DiffArrow delta={delta} lowerIsBetter={m.lowerIsBetter} />
                          <span>{m.deltaFmt(delta)}</span>
                        </span>
                        {m.diffTest && (
                          <div className="text-[10px] text-muted-foreground">
                            95% CI [{(m.diffTest.ciLow * 100).toFixed(2)}pp,{" "}
                            {(m.diffTest.ciHigh * 100).toFixed(2)}pp]
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {m.diffTest ? (
                          <span className={cn("inline-flex items-center gap-1", pCls)}>
                            {formatP(m.diffTest.p)}
                            <span className="text-[10px] font-semibold">{stars}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="px-4 pb-3 text-[10px] leading-relaxed text-muted-foreground">
          Significance: <span className="font-semibold">***</span> p &lt; 0.001,{" "}
          <span className="font-semibold">**</span> p &lt; 0.01,{" "}
          <span className="font-semibold">*</span> p &lt; 0.05,{" "}
          <span className="font-semibold">ns</span> not significant. Proportion
          CIs use the Wald approximation; ATE p-values are derived from the stored
          95% CI assuming normality.
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
