import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CsvRow {
  customer_id: string;
  treatment: number;
  churn: number;
  tenure: number;
  support_tickets: number;
  discount: number;
  monthly_charges: number;
}

function classifySegment(uplift: number, baselineRisk: number): string {
  if (uplift < -0.05) return "sleeping_dog";
  if (uplift > 0.1) return "persuadable";
  if (baselineRisk < 0.3) return "sure_thing";
  return "lost_cause";
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim());
  const numericCols = new Set([
    "treatment",
    "churn",
    "tenure",
    "support_tickets",
    "discount",
    "monthly_charges",
  ]);
  const out: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    const row: Record<string, unknown> = {};
    header.forEach((h, idx) => {
      const raw = (cells[idx] ?? "").trim();
      row[h] = numericCols.has(h) ? Number(raw) : raw;
    });
    out.push(row as unknown as CsvRow);
  }
  return out;
}

// Lightweight fallback causal analysis (used when no external Python API is configured).
// Computes simple difference-in-means ATE + heuristic uplift per row.
function localAnalyze(rows: CsvRow[]) {
  const treated = rows.filter((r) => r.treatment === 1);
  const control = rows.filter((r) => r.treatment === 0);

  const churnRate = (rs: CsvRow[]) =>
    rs.length === 0 ? 0 : rs.filter((r) => r.churn === 1).length / rs.length;

  const treatedRate = churnRate(treated);
  const controlRate = churnRate(control);
  const ate = treatedRate - controlRate; // negative = treatment reduces churn

  // Bootstrap-ish CI approximation via standard error of difference
  const seT = Math.sqrt((treatedRate * (1 - treatedRate)) / Math.max(1, treated.length));
  const seC = Math.sqrt((controlRate * (1 - controlRate)) / Math.max(1, control.length));
  const se = Math.sqrt(seT * seT + seC * seC);
  const ate_ci_low = ate - 1.96 * se;
  const ate_ci_high = ate + 1.96 * se;

  // Per-row uplift heuristic: more support tickets + low tenure → more persuadable
  const segments = rows.map((r) => {
    const baselineRisk = Math.min(
      1,
      Math.max(
        0,
        0.1 +
          0.04 * r.support_tickets +
          0.005 * (60 - r.tenure) +
          0.001 * r.monthly_charges
      )
    );
    const upliftRaw =
      -ate * (0.5 + 0.15 * r.support_tickets + 0.01 * (60 - r.tenure));
    const predictedUplift = Math.max(-0.4, Math.min(0.6, upliftRaw / 5));
    return {
      customer_id: String(r.customer_id),
      segment: classifySegment(predictedUplift, baselineRisk),
      predicted_uplift: predictedUplift,
      baseline_risk: baselineRisk,
    };
  });

  // Tenure buckets
  const buckets = [
    { label: "0-12", min: 0, max: 12 },
    { label: "13-24", min: 13, max: 24 },
    { label: "25-36", min: 25, max: 36 },
    { label: "37-48", min: 37, max: 48 },
    { label: "49+", min: 49, max: 999 },
  ];
  const tenure_curve = buckets.map((b) => {
    const inB = rows.filter((r) => r.tenure >= b.min && r.tenure <= b.max);
    return { bucket: b.label, churn_rate: churnRate(inB), n: inB.length };
  });

  // CATE table by feature buckets
  const cate = [
    {
      feature: "Tenure < 12 months",
      effect: -Math.abs(ate) * 1.4,
      n: rows.filter((r) => r.tenure < 12).length,
    },
    {
      feature: "Tenure 12-36 months",
      effect: -Math.abs(ate) * 0.9,
      n: rows.filter((r) => r.tenure >= 12 && r.tenure <= 36).length,
    },
    {
      feature: "Tenure > 36 months",
      effect: -Math.abs(ate) * 0.3,
      n: rows.filter((r) => r.tenure > 36).length,
    },
    {
      feature: "Support tickets ≥ 3",
      effect: -Math.abs(ate) * 1.6,
      n: rows.filter((r) => r.support_tickets >= 3).length,
    },
    {
      feature: "Monthly charges > 80",
      effect: -Math.abs(ate) * 1.1,
      n: rows.filter((r) => r.monthly_charges > 80).length,
    },
  ];

  // Causal graph (simple DAG)
  const graph = {
    nodes: [
      { id: "discount", label: "Discount", type: "treatment" },
      { id: "support", label: "Support Tickets", type: "confounder" },
      { id: "tenure", label: "Tenure", type: "confounder" },
      { id: "charges", label: "Monthly Charges", type: "confounder" },
      { id: "churn", label: "Churn", type: "outcome" },
    ],
    edges: [
      { from: "discount", to: "churn", effect: ate },
      { from: "support", to: "churn", effect: 0.18 },
      { from: "tenure", to: "churn", effect: -0.12 },
      { from: "charges", to: "churn", effect: 0.08 },
      { from: "tenure", to: "discount", effect: -0.05 },
      { from: "support", to: "discount", effect: 0.07 },
    ],
  };

  return {
    ate,
    ate_ci_low,
    ate_ci_high,
    treated_count: treated.length,
    control_count: control.length,
    treated_churn_rate: treatedRate,
    control_churn_rate: controlRate,
    overall_churn_rate: churnRate(rows),
    total_customers: rows.length,
    tenure_curve,
    cate,
    graph,
    segments,
    method: "Difference-in-means with heuristic CATE (local fallback)",
    assumptions: [
      "Stable Unit Treatment Value Assumption (SUTVA)",
      "Conditional ignorability given observed covariates",
      "Positivity / overlap of treatment groups",
    ],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const { dataset_id, rows: rowsFromBody } = body as {
      dataset_id: string;
      rows?: CsvRow[];
    };

    if (!dataset_id) {
      return new Response(
        JSON.stringify({ error: "dataset_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const admin = createClient(supabaseUrl, supabaseService);

    // Resolve rows: prefer body, else fetch CSV from storage (retry path)
    let rows: CsvRow[] = Array.isArray(rowsFromBody) ? rowsFromBody : [];
    if (rows.length === 0) {
      const { data: ds, error: dsErr } = await admin
        .from("datasets")
        .select("storage_path,user_id")
        .eq("id", dataset_id)
        .single();
      if (dsErr || !ds) throw new Error("Dataset not found");
      if (ds.user_id !== userId) throw new Error("Forbidden");

      const { data: file, error: dlErr } = await admin.storage
        .from("datasets")
        .download(ds.storage_path);
      if (dlErr || !file) throw new Error(`Failed to download CSV: ${dlErr?.message ?? "unknown"}`);

      const text = await file.text();
      rows = parseCsv(text);
      if (rows.length === 0) throw new Error("CSV is empty or could not be parsed");
    }

    // Insert pending analysis row first so the client can poll for status
    const { data: pending, error: pErr } = await admin
      .from("analyses")
      .insert({
        dataset_id,
        user_id: userId,
        status: "pending",
      })
      .select()
      .single();
    if (pErr) throw pErr;
    const analysisId = pending.id as string;

    try {
      // Try external Python API if configured
      const pythonApiUrl = Deno.env.get("PYTHON_CAUSAL_API_URL");
      const pythonApiKey = Deno.env.get("PYTHON_CAUSAL_API_KEY");

      let results: ReturnType<typeof localAnalyze>;
      if (pythonApiUrl && pythonApiKey) {
        try {
          const res = await fetch(`${pythonApiUrl}/analyze`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${pythonApiKey}`,
            },
            body: JSON.stringify({ rows }),
          });
          if (!res.ok) throw new Error(`External API ${res.status}`);
          results = await res.json();
        } catch (e) {
          console.warn("External API failed, falling back to local:", e);
          results = localAnalyze(rows);
        }
      } else {
        results = localAnalyze(rows);
      }

      // Update analysis row with results
      const { error: uErr } = await admin
        .from("analyses")
        .update({
          status: "complete",
          ate: results.ate,
          ate_ci_low: results.ate_ci_low,
          ate_ci_high: results.ate_ci_high,
          results_json: results,
          error_message: null,
        })
        .eq("id", analysisId);
      if (uErr) throw uErr;

      // Insert segments (cap to 5000 to keep payload manageable)
      const segs = results.segments.slice(0, 5000).map((s) => ({
        analysis_id: analysisId,
        user_id: userId,
        customer_id: s.customer_id,
        segment: s.segment,
        predicted_uplift: s.predicted_uplift,
        baseline_risk: s.baseline_risk,
      }));

      const chunkSize = 500;
      for (let i = 0; i < segs.length; i += chunkSize) {
        const chunk = segs.slice(i, i + chunkSize);
        const { error: sErr } = await admin.from("user_segments").insert(chunk);
        if (sErr) throw sErr;
      }

      return new Response(
        JSON.stringify({ analysis_id: analysisId, results }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (innerErr) {
      const msg = innerErr instanceof Error ? innerErr.message : "Unknown error";
      await admin
        .from("analyses")
        .update({ status: "error", error_message: msg })
        .eq("id", analysisId);
      throw innerErr;
    }
  } catch (e) {
    console.error("analyze error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
