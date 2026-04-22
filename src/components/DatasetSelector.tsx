import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDataset } from "@/hooks/useDataset";
import { Database } from "lucide-react";

export function DatasetSelector() {
  const { datasets, selectedDatasetId, setSelectedDatasetId } = useDataset();

  if (datasets.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Database className="h-4 w-4" />
        <span className="hidden sm:inline">No dataset yet</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Database className="h-4 w-4 text-primary" />
      <Select
        value={selectedDatasetId ?? undefined}
        onValueChange={(v) => setSelectedDatasetId(v)}
      >
        <SelectTrigger className="h-8 w-[180px] border-border/50 bg-card/40 text-xs sm:w-[260px]">
          <SelectValue placeholder="Select dataset" />
        </SelectTrigger>
        <SelectContent>
          {datasets.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              <span className="truncate">{d.name}</span>
              <span className="ml-2 text-[10px] text-muted-foreground">
                {d.row_count} rows
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
