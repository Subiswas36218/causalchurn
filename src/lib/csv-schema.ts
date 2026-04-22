export const REQUIRED_COLUMNS = [
  "customer_id",
  "treatment",
  "churn",
  "tenure",
  "support_tickets",
  "discount",
  "monthly_charges",
] as const;

export type CsvRow = {
  customer_id: string;
  treatment: number;
  churn: number;
  tenure: number;
  support_tickets: number;
  discount: number;
  monthly_charges: number;
};

export interface ValidationResult {
  ok: boolean;
  rows: CsvRow[];
  errors: string[];
  missingColumns: string[];
  rowCount: number;
}

export function validateCsv(records: Record<string, unknown>[]): ValidationResult {
  const errors: string[] = [];
  const rows: CsvRow[] = [];

  if (records.length === 0) {
    return {
      ok: false,
      rows: [],
      errors: ["CSV is empty"],
      missingColumns: [],
      rowCount: 0,
    };
  }

  const cols = Object.keys(records[0]);
  const missing = REQUIRED_COLUMNS.filter((c) => !cols.includes(c));
  if (missing.length > 0) {
    return {
      ok: false,
      rows: [],
      errors: [`Missing required columns: ${missing.join(", ")}`],
      missingColumns: [...missing],
      rowCount: records.length,
    };
  }

  records.forEach((r, idx) => {
    const num = (k: string) => {
      const v = r[k];
      const n = typeof v === "number" ? v : Number(String(v).trim());
      return Number.isFinite(n) ? n : NaN;
    };
    const treatment = num("treatment");
    const churn = num("churn");
    const tenure = num("tenure");
    const support_tickets = num("support_tickets");
    const discount = num("discount");
    const monthly_charges = num("monthly_charges");
    const customer_id = String(r.customer_id ?? "").trim();

    if (!customer_id) errors.push(`Row ${idx + 2}: missing customer_id`);
    if (treatment !== 0 && treatment !== 1)
      errors.push(`Row ${idx + 2}: treatment must be 0 or 1`);
    if (churn !== 0 && churn !== 1)
      errors.push(`Row ${idx + 2}: churn must be 0 or 1`);
    [
      ["tenure", tenure],
      ["support_tickets", support_tickets],
      ["discount", discount],
      ["monthly_charges", monthly_charges],
    ].forEach(([k, v]) => {
      if (!Number.isFinite(v as number))
        errors.push(`Row ${idx + 2}: ${k} must be a number`);
    });

    if (errors.length > 50) return;
    rows.push({
      customer_id,
      treatment,
      churn,
      tenure,
      support_tickets,
      discount,
      monthly_charges,
    });
  });

  return {
    ok: errors.length === 0,
    rows,
    errors,
    missingColumns: [],
    rowCount: records.length,
  };
}

export function generateDemoCsv(n = 1000): string {
  const header = REQUIRED_COLUMNS.join(",");
  const lines = [header];
  for (let i = 0; i < n; i++) {
    const tenure = Math.floor(Math.random() * 60) + 1;
    const support_tickets = Math.floor(Math.random() * 8);
    const monthly_charges = +(20 + Math.random() * 100).toFixed(2);
    const discount = Math.random() < 0.3 ? +(Math.random() * 0.3).toFixed(2) : 0;
    const treatment = Math.random() < 0.5 ? 1 : 0;
    const baseRisk =
      0.15 +
      0.04 * support_tickets +
      0.004 * (60 - tenure) +
      0.001 * monthly_charges;
    const treatmentEffect = treatment === 1 ? -0.12 : 0;
    const p = Math.max(0.02, Math.min(0.95, baseRisk + treatmentEffect));
    const churn = Math.random() < p ? 1 : 0;
    lines.push(
      [
        `CUST_${1000 + i}`,
        treatment,
        churn,
        tenure,
        support_tickets,
        discount,
        monthly_charges,
      ].join(",")
    );
  }
  return lines.join("\n");
}
