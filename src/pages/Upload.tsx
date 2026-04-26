import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useDataset } from "@/hooks/useDataset";
import { toast } from "@/hooks/use-toast";
import { validateCsv, generateDemoCsv, REQUIRED_COLUMNS, type CsvRow } from "@/lib/csv-schema";
import { Upload, FileText, Sparkles, Loader2, AlertCircle, CheckCircle2, Trash2 } from "lucide-react";

export default function UploadPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { datasets, setSelectedDatasetId, refresh, selectedDatasetId, setAnalysisStatus, setAnalysisError } = useDataset();
  const [parsing, setParsing] = useState(false);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const handleFile = (file: File) => {
    setParsing(true);
    setErrors([]);
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const v = validateCsv(res.data as Record<string, unknown>[]);
        if (!v.ok) {
          setErrors(v.errors.slice(0, 20));
          setRows([]);
          toast({ title: "CSV validation failed", description: v.errors[0], variant: "destructive" });
        } else {
          setRows(v.rows);
          toast({ title: "CSV parsed", description: `${v.rows.length} valid rows` });
        }
        setParsing(false);
      },
      error: (err) => {
        setErrors([err.message]);
        setParsing(false);
      },
    });
  };

  const onDrop = useCallback((files: File[]) => {
    if (files[0]) handleFile(files[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxFiles: 1,
  });

  const loadDemo = () => {
    const csv = generateDemoCsv(1000);
    const blob = new Blob([csv], { type: "text/csv" });
    const file = new File([blob], "demo_telecom_churn.csv", { type: "text/csv" });
    handleFile(file);
  };

  const runAnalysis = async () => {
    if (!user || rows.length === 0) return;
    setRunning(true);
    try {
      // Upload CSV file
      const path = `${user.id}/${Date.now()}_${fileName || "dataset.csv"}`;
      const csvText = Papa.unparse(rows);
      const { error: upErr } = await supabase.storage
        .from("datasets")
        .upload(path, new Blob([csvText], { type: "text/csv" }));
      if (upErr) throw upErr;

      // Insert dataset row
      const { data: ds, error: dsErr } = await supabase
        .from("datasets")
        .insert({
          user_id: user.id,
          name: fileName || "Untitled dataset",
          storage_path: path,
          row_count: rows.length,
        })
        .select()
        .single();
      if (dsErr) throw dsErr;

      // Call edge function
      const { data, error } = await supabase.functions.invoke("analyze", {
        body: { dataset_id: ds.id, rows },
      });
      if (error) throw error;

      toast({ title: "Analysis complete", description: `ATE: ${(data.results.ate * 100).toFixed(2)}%` });
      setSelectedDatasetId(ds.id);
      await refresh();
      navigate("/dashboard");
    } catch (e: any) {
      toast({ title: "Analysis failed", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const deleteDataset = async (id: string) => {
    await supabase.from("datasets").delete().eq("id", id);
    if (selectedDatasetId === id) setSelectedDatasetId(null);
    await refresh();
    toast({ title: "Dataset deleted" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload Dataset</h1>
        <p className="text-sm text-muted-foreground">
          Upload a CSV with the required schema, or load a demo dataset.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle>1. Upload your CSV</CardTitle>
            <CardDescription>
              Required columns: {REQUIRED_COLUMNS.join(", ")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              {...getRootProps()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-border/60 hover:border-primary/50 hover:bg-muted/20"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium">
                {isDragActive ? "Drop the CSV here" : "Drag & drop a CSV, or click to browse"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">.csv up to ~50MB</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <Button variant="outline" onClick={loadDemo} className="w-full">
              <Sparkles className="mr-2 h-4 w-4" />
              Load demo dataset (1000 rows)
            </Button>

            {parsing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Parsing CSV…
              </div>
            )}

            {errors.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertCircle className="h-4 w-4" /> Validation errors
                </div>
                <ul className="space-y-1 text-xs text-destructive/90">
                  {errors.map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                </ul>
              </div>
            )}

            {rows.length > 0 && (
              <>
                <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="font-medium">{rows.length} rows valid</span>
                  <span className="ml-auto text-xs text-muted-foreground">{fileName}</span>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Preview (first 50 rows)</h4>
                  <div className="max-h-[400px] overflow-auto rounded-lg border border-border/50">
                    <Table>
                      <TableHeader className="sticky top-0 bg-card">
                        <TableRow>
                          {REQUIRED_COLUMNS.map((c) => (
                            <TableHead key={c} className="text-xs">{c}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.slice(0, 50).map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{r.customer_id}</TableCell>
                            <TableCell>{r.treatment}</TableCell>
                            <TableCell>{r.churn}</TableCell>
                            <TableCell>{r.tenure}</TableCell>
                            <TableCell>{r.support_tickets}</TableCell>
                            <TableCell>{r.discount}</TableCell>
                            <TableCell>{r.monthly_charges}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
                  onClick={runAnalysis}
                  disabled={running}
                >
                  {running ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running causal analysis…</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" /> Run Causal Analysis</>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card border-border/50 self-start">
          <CardHeader>
            <CardTitle className="text-base">Past datasets</CardTitle>
            <CardDescription>Your uploaded analyses</CardDescription>
          </CardHeader>
          <CardContent>
            {datasets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No datasets yet.</p>
            ) : (
              <ul className="space-y-2">
                {datasets.map((d) => (
                  <li
                    key={d.id}
                    className={`group flex items-center gap-2 rounded-lg border p-2 text-sm transition-colors ${
                      selectedDatasetId === d.id
                        ? "border-primary/50 bg-primary/5"
                        : "border-border/50 hover:bg-muted/20"
                    }`}
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <button
                      className="flex-1 truncate text-left"
                      onClick={() => setSelectedDatasetId(d.id)}
                    >
                      <div className="truncate text-xs font-medium">{d.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {d.row_count} rows · {new Date(d.created_at).toLocaleDateString()}
                      </div>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      onClick={() => deleteDataset(d.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
