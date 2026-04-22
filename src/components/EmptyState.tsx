import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

export function EmptyState({ title = "No analysis yet", description = "Upload a dataset and run analysis to see results here." }: { title?: string; description?: string }) {
  return (
    <div className="glass-card flex flex-col items-center justify-center gap-3 p-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/20">
        <Upload className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      <Button asChild className="mt-2">
        <Link to="/upload">Upload Dataset</Link>
      </Button>
    </div>
  );
}
