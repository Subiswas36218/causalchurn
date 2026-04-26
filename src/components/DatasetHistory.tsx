import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDataset } from "@/hooks/useDataset";
import { CheckCircle2, AlertCircle, Loader2, Clock, FileText, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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

  if (datasetsWithAnalysis.length === 0) return null;

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Dataset history</CardTitle>
        <CardDescription>Switch between previous uploads</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-72">
          <ul className="divide-y divide-border/40">
            {datasetsWithAnalysis.map((d) => {
              const isActive = d.id === selectedDatasetId;
              return (
                <li key={d.id}>
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedDatasetId(d.id)}
                    className={cn(
                      "h-auto w-full justify-start rounded-none px-4 py-3 text-left",
                      isActive && "bg-primary/5"
                    )}
                  >
                    <div className="flex w-full items-center gap-3">
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          isActive ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground"
                        )}
                      >
                        {isActive ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{d.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {d.row_count.toLocaleString()} rows ·{" "}
                          {new Date(d.created_at).toLocaleString()}
                        </div>
                      </div>
                      {statusBadge(d.latest_analysis?.status)}
                    </div>
                  </Button>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
