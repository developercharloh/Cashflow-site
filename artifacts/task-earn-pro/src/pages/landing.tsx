import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, Shield, Zap, Target } from "lucide-react";

export default function Landing() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="h-20 flex items-center justify-between px-6 lg:px-12 border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold">
            T
          </div>
          <span className="text-xl font-bold tracking-tight">TaskEarn Pro</span>
        </div>
        <nav className="hidden md:flex items-center gap-6">
          <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground">How it Works</a>
          <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground">Features</a>
          <a href="#faq" className="text-sm font-medium text-muted-foreground hover:text-foreground">FAQ</a>
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/auth/login" className="text-sm font-medium hover:text-primary">
            Log in
          </Link>
          <Button asChild>
            <Link href="/auth/register">Get Started</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="py-24 lg:py-32 px-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background"></div>
          <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground leading-[1.1]">
              Turn Your Skills Into <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-success">Daily Earnings</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              The premium platform for completing high-value tasks, growing your balance, and building your digital income portfolio.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button size="lg" className="w-full sm:w-auto gap-2 text-base h-14 px-8" asChild>
                <Link href="/auth/register">
                  Start Earning Now <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-base h-14 px-8" asChild>
                <Link href="/auth/login">View Dashboard</Link>
              </Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-16 border-t border-border/50 mt-16">
              {[
                { label: "Active Tasks", value: "2,500+" },
                { label: "Paid Out", value: "$1.2M+" },
                { label: "Avg. Daily Earn", value: "$45.50" },
                { label: "Pro Members", value: "15k+" }
              ].map((stat, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="text-3xl font-bold text-foreground mb-1">{stat.value}</div>
                  <div className="text-sm font-medium text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-24 px-6 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Engineered for Success</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">Everything you need to maximize your earning potential in one professional platform.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: Target, title: "Premium Tasks", desc: "Access high-paying surveys, data categorization, and AI training tasks." },
                { icon: Zap, title: "Instant Withdrawals", desc: "Get paid instantly to your crypto wallet or bank account when you reach the threshold." },
                { icon: Shield, title: "Verified Platform", desc: "Bank-grade security and transparent earnings history you can trust." },
                { icon: TrendingUp, title: "Level Up", desc: "Climb membership tiers to unlock higher multipliers and exclusive perks." }
              ].map((feature, i) => (
                <div key={i} className="glassmorphism p-8 rounded-2xl flex flex-col items-start text-left">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-6">
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-card border-t border-border py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">
              T
            </div>
            <span className="font-semibold">TaskEarn Pro</span>
          </div>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} TaskEarn Pro. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
