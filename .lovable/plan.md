
# Causal Customer Churn Analysis — SaaS Dashboard

A dark-themed, multi-page analytics SaaS for uploading customer data, running causal analysis on churn, and turning insights into targeted retention actions.

## Stack & Backend
- **Lovable Cloud** (Supabase) for auth, Postgres, storage, edge functions
- **Auth**: Email/password + Google sign-in (login + signup pages, protected routes)
- **External Python causal API**: you'll provide the URL + API key; stored as secrets and called from a `analyze` edge function (so the key never hits the browser)
- **CSV uploads** stored in a `datasets` Supabase storage bucket; metadata + analysis results stored in tables

## Fixed CSV Schema
Required columns (validated on upload):
`customer_id, treatment (0/1), churn (0/1), tenure, support_tickets, discount, monthly_charges`

Rows failing schema → blocking error with row-level feedback.

## Pages

### 1. Auth (`/auth`)
Email/password + Google. Branded dark card layout.

### 2. Upload Dataset (`/upload`)
- Drag-and-drop CSV uploader + "Load demo dataset" button (ships a built-in telecom-churn sample)
- Schema validation, row count, missing-value summary
- Preview table (first 50 rows, sortable)
- "Run Analysis" button → uploads file, calls `/analyze` edge function, redirects to Dashboard when ready
- Sidebar list of past datasets (per user)

### 3. Dashboard (`/dashboard`)
- KPI cards: Total customers, Overall churn rate, Treated churn rate, Control churn rate, Lift
- Bar chart: Treatment vs No-Treatment churn comparison
- Line chart: Churn rate by tenure bucket
- Donut: Customer mix by segment

### 4. Causal Insights (`/insights`)
- Big metric card: **ATE (Average Treatment Effect)** with 95% CI
- Per-feature CATE table (effect of discount conditioned on tenure, support tickets, etc.)
- **Causal graph visualization**: interactive DAG (nodes: discount, support, tenure, charges → churn) using SVG with directed edges and effect-strength labels
- Method/assumptions panel (what the Python API used)

### 5. Uplift Segmentation (`/uplift`)
- Four-quadrant scatter (predicted uplift vs baseline churn risk)
- Segment cards with counts + avg uplift:
  - **Persuadable** (high uplift)
  - **Sure Things** (would stay anyway)
  - **Lost Causes** (won't stay either way)
  - **Sleeping Dogs** (treatment hurts)
- Table of top high-impact users with CSV export

### 6. Recommendations (`/recommendations`)
- Auto-generated action cards per segment:
  - "Offer 15% discount to 1,240 Persuadables → est. 312 retained, $X revenue saved"
  - "Increase support touchpoints for Segment B"
  - "Do NOT discount Sleeping Dogs"
- Each card: target count, projected impact, "Export segment list" button

## Layout & Design
- Persistent left sidebar nav with icons (Lucide), collapsible on mobile
- Top bar: dataset selector, user menu, theme indicator
- **Dark SaaS theme**: deep navy background (#0B1020-ish), elevated card surfaces, electric blue + violet accent gradient, subtle grid bg, glassy cards with soft borders, generous spacing
- Charts via Recharts, themed to match
- Loading skeletons everywhere; toast notifications for upload/analysis events

## Data Model (Supabase)
- `datasets` (id, user_id, name, storage_path, row_count, created_at)
- `analyses` (id, dataset_id, user_id, status, ate, ate_ci_low, ate_ci_high, results_json, created_at)
- `user_segments` (id, analysis_id, customer_id, segment, predicted_uplift, baseline_risk)
- RLS: users only see their own rows
- Storage bucket `datasets` (private, per-user folders)

## What I'll Need From You After Approval
- The Python causal API base URL
- An API key/token for that endpoint
- The expected request/response JSON shape (or I'll propose one and you confirm)

Once approved, I'll enable Lovable Cloud, set up auth + tables + storage, scaffold all pages with the dark theme, and wire the `/analyze` edge function to your Python service.
