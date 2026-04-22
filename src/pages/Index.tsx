import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Activity, ArrowRight, GitBranch, Sparkles, TrendingUp, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const features = [
  { icon: TrendingUp, title: "Causal Effect Estimation", desc: "Quantify the true impact of retention treatments with ATE & confidence intervals." },
  { icon: Users, title: "Uplift Segmentation", desc: "Find your Persuadables. Avoid wasting spend on Sure Things and Sleeping Dogs." },
  { icon: GitBranch, title: "Causal Graph Visualization", desc: "Interactive DAGs showing how features causally drive churn." },
  { icon: Sparkles, title: "Action Recommendations", desc: "Auto-generated retention plays with projected revenue impact." },
];

export default function Index() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="container flex items-center justify-between py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
            <Activity className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold gradient-text">CausalChurn</span>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <Button asChild>
              <Link to="/dashboard">Open Dashboard <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild><Link to="/auth">Sign in</Link></Button>
              <Button asChild><Link to="/auth">Get started</Link></Button>
            </>
          )}
        </div>
      </header>

      <main className="container py-16 md:py-24">
        <section className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/40 px-3 py-1 text-xs text-muted-foreground backdrop-blur-xl">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            Causal AI for Retention
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            Don't predict churn.{" "}
            <span className="gradient-text">Cause retention.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Upload your customer data, run rigorous causal analysis, and get
            uplift-driven recommendations that actually move revenue.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to={user ? "/upload" : "/auth"}>
                Start free <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to={user ? "/dashboard" : "/auth"}>View demo</Link>
            </Button>
          </div>
        </section>

        <section className="mt-20 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="glass-card p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mb-1 font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="container border-t border-border/40 py-8 text-center text-xs text-muted-foreground">
        Built with causal inference & uplift modeling.
      </footer>
    </div>
  );
}
