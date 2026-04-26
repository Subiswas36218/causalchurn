import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface DatasetRow {
  id: string;
  name: string;
  storage_path: string;
  row_count: number;
  created_at: string;
}

export interface AnalysisRow {
  id: string;
  dataset_id: string;
  status: string;
  ate: number | null;
  ate_ci_low: number | null;
  ate_ci_high: number | null;
  results_json: any;
  error_message: string | null;
  created_at: string;
}

export type AnalysisStatus = "idle" | "uploading" | "analyzing" | "complete" | "error";

export interface DatasetWithAnalysis extends DatasetRow {
  latest_analysis: AnalysisRow | null;
}

interface DatasetCtx {
  datasets: DatasetRow[];
  datasetsWithAnalysis: DatasetWithAnalysis[];
  selectedDatasetId: string | null;
  setSelectedDatasetId: (id: string | null) => void;
  selectedAnalysis: AnalysisRow | null;
  loading: boolean;
  lastRefreshedAt: Date | null;
  refresh: () => Promise<void>;
  analysisStatus: AnalysisStatus;
  analysisError: string | null;
  setAnalysisStatus: (s: AnalysisStatus) => void;
  setAnalysisError: (e: string | null) => void;
}

const Ctx = createContext<DatasetCtx>({
  datasets: [],
  datasetsWithAnalysis: [],
  selectedDatasetId: null,
  setSelectedDatasetId: () => {},
  selectedAnalysis: null,
  loading: false,
  lastRefreshedAt: null,
  refresh: async () => {},
  analysisStatus: "idle",
  analysisError: null,
  setAnalysisStatus: () => {},
  setAnalysisError: () => {},
});

export function DatasetProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [datasets, setDatasets] = useState<DatasetRow[]>([]);
  const [datasetsWithAnalysis, setDatasetsWithAnalysis] = useState<DatasetWithAnalysis[]>([]);
  const [selectedDatasetId, _setSelectedDatasetId] = useState<string | null>(
    () => localStorage.getItem("selectedDatasetId")
  );
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>("idle");
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const setSelectedDatasetId = (id: string | null) => {
    _setSelectedDatasetId(id);
    if (id) localStorage.setItem("selectedDatasetId", id);
    else localStorage.removeItem("selectedDatasetId");
  };

  const refresh = useCallback(async () => {
    if (!user) {
      setDatasets([]);
      setDatasetsWithAnalysis([]);
      setSelectedAnalysis(null);
      return;
    }
    setLoading(true);
    const { data: ds } = await supabase
      .from("datasets")
      .select("*")
      .order("created_at", { ascending: false });
    const dsList = (ds as DatasetRow[]) ?? [];
    setDatasets(dsList);

    // Fetch latest analysis per dataset (one query, then group)
    let merged: DatasetWithAnalysis[] = dsList.map((d) => ({ ...d, latest_analysis: null }));
    if (dsList.length > 0) {
      const { data: ans } = await supabase
        .from("analyses")
        .select("*")
        .in(
          "dataset_id",
          dsList.map((d) => d.id)
        )
        .order("created_at", { ascending: false });
      const seen = new Set<string>();
      const latestByDs: Record<string, AnalysisRow> = {};
      ((ans as AnalysisRow[]) ?? []).forEach((a) => {
        if (seen.has(a.dataset_id)) return;
        seen.add(a.dataset_id);
        latestByDs[a.dataset_id] = a;
      });
      merged = dsList.map((d) => ({
        ...d,
        latest_analysis: latestByDs[d.id] ?? null,
      }));
    }
    setDatasetsWithAnalysis(merged);

    if (selectedDatasetId) {
      const found = merged.find((d) => d.id === selectedDatasetId);
      setSelectedAnalysis(found?.latest_analysis ?? null);
    } else {
      setSelectedAnalysis(null);
    }
    setLastRefreshedAt(new Date());
    setLoading(false);
  }, [user, selectedDatasetId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <Ctx.Provider
      value={{
        datasets,
        datasetsWithAnalysis,
        selectedDatasetId,
        setSelectedDatasetId,
        selectedAnalysis,
        loading,
        lastRefreshedAt,
        refresh,
        analysisStatus,
        analysisError,
        setAnalysisStatus,
        setAnalysisError,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useDataset = () => useContext(Ctx);
