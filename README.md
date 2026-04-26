# 🚀 Causal Customer Churn Analyzer

## 📌 Overview

**Causal Customer Churn Analyzer** is a full-stack Causal AI platform that goes beyond prediction to answer:

> ❓ *What actions actually reduce customer churn?*

Unlike traditional machine learning models, this system uses **causal inference + uplift modeling** to identify **true cause-effect relationships** between interventions (e.g., discounts) and churn outcomes.

## App Link: https://causalchurn.lovable.app

---

## 🧠 Key Features

* 📊 **Causal Inference (ATE Estimation)**
* 🎯 **Uplift Modeling (Target the right customers)**
* 🔍 **Counterfactual Analysis**
* 📁 **CSV Upload + Dataset Management**
* 📉 **Interactive Dashboard (Lovable UI)**
* ⚡ **Real-time API (FastAPI backend)**

---

## 🏗️ Tech Stack

| Layer     | Technology                   |
| --------- | ---------------------------- |
| Frontend  | Lovable                      |
| Backend   | FastAPI                      |
| Database  | Supabase (PostgreSQL + Auth) |
| Causal AI | DoWhy, EconML                |
| Pipeline  | Airflow (optional)           |
| Cloud     | AWS (optional)               |

---

## 📂 Project Structure

```bash
causal-churn-analyzer/
│
├── frontend/            # Lovable UI
├── backend/             # FastAPI + Causal models
├── database/            # Schema + seed data
├── pipelines/           # Airflow DAGs
├── docs/                # Architecture + paper
└── requirements.txt
```

---

## ⚙️ Setup & Installation

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/yourusername/causal-churn-analyzer.git
cd causal-churn-analyzer
```

### 2️⃣ Install Dependencies

```bash
pip install -r requirements.txt
```

### 3️⃣ Run Backend Server

```bash
uvicorn backend.main:app --reload
```

---

## 📊 Dataset Requirements

Upload a CSV with the following schema:

```text
customer_id, treatment, churn, tenure, support_tickets, discount, monthly_charges
```

### Column Description

* `treatment` → 1 = discount given, 0 = no discount
* `churn` → 1 = churned, 0 = retained
* `tenure` → months as customer
* `support_tickets` → number of complaints
* `discount` → discount percentage
* `monthly_charges` → revenue

---

## 📈 Example Output

```text
Causal Effect (ATE): -0.23

Insight:
Discount reduces churn by ~23%

Recommendation:
Target discounts to high-risk customers (high support tickets)
```

---

## 🔄 Workflow

1. Upload dataset
2. Store in Supabase
3. Run causal inference (DoWhy)
4. Compute uplift scores (EconML)
5. Visualize insights (Lovable dashboard)

---

## 🧠 Causal Model

* **Treatment:** Discount
* **Outcome:** Churn
* **Confounders:** Tenure, support tickets, monthly charges

### DAG (Conceptual)

```
support_tickets ─┐
                 ├──> churn
discount ────────┘
monthly_charges ─┘
```

---

## 🎯 Business Value

* Reduce unnecessary discounts
* Identify high-impact customer segments
* Optimize retention strategies
* Move from prediction → decision intelligence

---

## ☁️ Deployment (Optional)

* Supabase → Database + Auth
* AWS S3 → Dataset storage
* AWS Lambda → Trigger analysis
* Airflow → Batch pipelines

---

## 🧪 Future Enhancements

* Real-time causal inference
* Multi-treatment optimization
* Reinforcement learning for retention
* A/B testing integration

---

## ❓ FAQ

**Q: Why causal AI instead of ML?**
A: ML predicts churn. Causal AI explains *what reduces churn*.

**Q: What is ATE?**
A: Average Treatment Effect — impact of an intervention.

**Q: What is uplift modeling?**
A: Identifies users whose behavior changes due to treatment.

---

## 👨‍💻 Author

**Subhankar Biswas**
M.Sc Data Engineering

---

## ⭐ Acknowledgements

* DoWhy (Microsoft)
* EconML
* Supabase
* Lovable

---

