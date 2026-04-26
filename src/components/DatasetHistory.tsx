import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDataset } from "@/hooks/useDataset";
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

export function DatasetHistory() {
  const { datasetsWithAnalysis, selectedDatasetId, setSelectedDatasetId } = useDataset();
  const navigate = useNavigate();

  if (datasetsWithAnalysis.length === 0) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Dataset history</CardTitle>
          <CardDescription>Switch between previous uploads and compare freshness</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-96">
            <ul className="divide-y divide-border/40">
              {datasetsWithAnalysis.map((d) => {
                const isActive = d.id === selectedDatasetId;
                const uploaded = new Date(d.created_at);
                const startedAt = d.latest_analysis?.created_at
                  ? new Date(d.latest_analysis.created_at)
                  : null;
                return (
                  <li key={d.id} className={cn("px-4 py-3", isActive && "bg-primary/5")}>
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
                          {statusBadge(d.latest_analysis?.status)}
                          {isActive && (
                            <Badge variant="outline" className="gap-1 border-primary/40 text-primary">
                              Active
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
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1.5">
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
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
