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
  created_at: string;
}

export type AnalysisStatus = "idle" | "uploading" | "analyzing" | "complete" | "error";

interface DatasetCtx {
  datasets: DatasetRow[];
  selectedDatasetId: string | null;
  setSelectedDatasetId: (id: string | null) => void;
  selectedAnalysis: AnalysisRow | null;
  loading: boolean;
  refresh: () => Promise<void>;
  analysisStatus: AnalysisStatus;
  analysisError: string | null;
  setAnalysisStatus: (s: AnalysisStatus) => void;
  setAnalysisError: (e: string | null) => void;
}

const Ctx = createContext<DatasetCtx>({
  datasets: [],
  selectedDatasetId: null,
  setSelectedDatasetId: () => {},
  selectedAnalysis: null,
  loading: false,
  refresh: async () => {},
  analysisStatus: "idle",
  analysisError: null,
  setAnalysisStatus: () => {},
  setAnalysisError: () => {},
});

export function DatasetProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [datasets, setDatasets] = useState<DatasetRow[]>([]);
  const [selectedDatasetId, _setSelectedDatasetId] = useState<string | null>(
    () => localStorage.getItem("selectedDatasetId")
  );
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisRow | null>(null);
  const [loading, setLoading] = useState(false);

  const setSelectedDatasetId = (id: string | null) => {
    _setSelectedDatasetId(id);
    if (id) localStorage.setItem("selectedDatasetId", id);
    else localStorage.removeItem("selectedDatasetId");
  };

  const refresh = useCallback(async () => {
    if (!user) {
      setDatasets([]);
      setSelectedAnalysis(null);
      return;
    }
    setLoading(true);
    const { data: ds } = await supabase
      .from("datasets")
      .select("*")
      .order("created_at", { ascending: false });
    setDatasets((ds as DatasetRow[]) ?? []);

    if (selectedDatasetId) {
      const { data: an } = await supabase
        .from("analyses")
        .select("*")
        .eq("dataset_id", selectedDatasetId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setSelectedAnalysis((an as AnalysisRow) ?? null);
    } else {
      setSelectedAnalysis(null);
    }
    setLoading(false);
  }, [user, selectedDatasetId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <Ctx.Provider
      value={{
        datasets,
        selectedDatasetId,
        setSelectedDatasetId,
        selectedAnalysis,
        loading,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useDataset = () => useContext(Ctx);
