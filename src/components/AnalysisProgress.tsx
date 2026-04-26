import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "upload", label: "Uploading dataset", weight: 10 },
  { key: "parse", label: "Parsing rows", weight: 15 },
  { key: "ate", label: "Estimating ATE & confidence intervals", weight: 25 },
  { key: "cate", label: "Computing conditional treatment effects", weight: 20 },
  { key: "segments", label: "Scoring uplift segments", weight: 20 },
  { key: "graph", label: "Building causal graph", weight: 10 },
];

interface Props {
  startedAt: Date | null;
}

/**
 * The edge function does not stream progress, so we approximate it with a
 * smoothed time-based curve that asymptotes at 95% until the analysis row
 * actually flips to "complete" (at which point this component is unmounted).
 * Typical local runs finish in 5–15s; the curve is tuned for that range.
 */
export function AnalysisProgress({ startedAt }: Props) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const start = startedAt?.getTime() ?? Date.now();
    const id = setInterval(() => setElapsedMs(Date.now() - start), 250);
    return () => clearInterval(id);
  }, [startedAt]);

  // Asymptotic curve: reaches ~63% at 10s, ~86% at 20s, capped at 95%
  const targetMs = 12000;
  const pct = Math.min(95, Math.round(95 * (1 - Math.exp(-elapsedMs / targetMs))));

  // Map percent to the active step using cumulative weights
  const totalWeight = STEPS.reduce((s, st) => s + st.weight, 0);
  let acc = 0;
  let activeIndex = 0;
  for (let i = 0; i < STEPS.length; i++) {
    acc += STEPS[i].weight;
    const cutoff = (acc / totalWeight) * 100;
    if (pct < cutoff) {
      activeIndex = i;
      break;
    }
    activeIndex = i;
  }

  const seconds = (elapsedMs / 1000).toFixed(1);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{STEPS[activeIndex].label}…</span>
        <span className="tabular-nums text-muted-foreground">
          {pct}% · {seconds}s elapsed
        </span>
      </div>
      <Progress value={pct} className="h-2" />
      <ol className="grid gap-1.5 sm:grid-cols-2">
        {STEPS.map((s, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <li
              key={s.key}
              className={cn(
                "flex items-center gap-2 text-[11px]",
                done && "text-success",
                active && "text-primary",
                !done && !active && "text-muted-foreground"
              )}
            >
              {done ? (
                <Check className="h-3 w-3" />
              ) : active ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
              )}
              <span className="truncate">{s.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
