import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CircleDollarSign, TrendingUp, Shield, Zap, Eye, EyeOff } from "lucide-react";

const PERKS = [
  { icon: <TrendingUp className="w-4 h-4 text-emerald-400" />, text: "Earn up to $500/month from tasks" },
  { icon: <Zap className="w-4 h-4 text-yellow-400" />, text: "Instant M-Pesa & PayPal withdrawals" },
  { icon: <Shield className="w-4 h-4 text-blue-400" />, text: "Trusted by 284,000+ members worldwide" },
];

const TESTIMONIALS = [
  { name: "Grace K.", country: "🇰🇪 Kenya", earned: "$312", text: "I earned my first $50 in just 3 days!" },
  { name: "James O.", country: "🇳🇬 Nigeria", earned: "$480", text: "Best side hustle I've ever found." },
  { name: "Amara D.", country: "🇬🇭 Ghana", earned: "$198", text: "Withdrew to my M-Pesa within minutes." },
];

const formSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { setToken } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    loginMutation.mutate({ data: values }, {
      onSuccess: (data) => {
        setToken(data.token);
        setLocation("/dashboard");
      },
      onError: () => {
        toast({ title: "Login failed", description: "Invalid email or password.", variant: "destructive" });
      },
    });
  }

  return (
    <div className="min-h-screen flex bg-background">

      {/* ── Left panel (hidden mobile) ── */}
      <div className="hidden lg:flex flex-col justify-between w-[440px] shrink-0 p-10 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(160deg,#0f2027 0%,#1a3a4a 40%,#0d4a2f 100%)" }}>

        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-10 -left-10 w-48 h-48 rounded-full bg-blue-500/10 blur-3xl" />

        {/* Logo */}
        <div className="flex items-center gap-2 relative z-10">
          <div className="w-9 h-9 rounded-xl bg-emerald-400 flex items-center justify-center shadow-lg">
            <CircleDollarSign className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">TaskEarn Pro</span>
        </div>

        <div className="space-y-8 relative z-10">
          {/* Headline */}
          <div>
            <p className="text-5xl font-extrabold leading-tight mb-4">
              Your phone.<br />Your income. 💸
            </p>
            <p className="text-white/60 text-sm leading-relaxed">
              Log in and start completing tasks — surveys, videos, AI training, and more.
            </p>
          </div>

          {/* Perks */}
          <div className="space-y-3">
            {PERKS.map(p => (
              <div key={p.text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">{p.icon}</div>
                <span className="text-sm text-white/80">{p.text}</span>
              </div>
            ))}
          </div>

          {/* Testimonials */}
          <div className="space-y-3">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="bg-white/8 border border-white/10 rounded-xl p-3 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-white/40 text-[11px]">{t.country}</p>
                  </div>
                  <span className="text-emerald-400 font-bold text-sm">{t.earned}</span>
                </div>
                <p className="text-white/55 text-xs">"{t.text}"</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/25 text-xs relative z-10">© 2025 TaskEarn Pro · Payments in 48 hrs or less</p>
      </div>

      {/* ── Right panel – login form ── */}
      <div className="flex-1 flex items-center justify-center p-5">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
              <CircleDollarSign className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">TaskEarn Pro</span>
          </div>

          {/* Mobile stats strip */}
          <div className="lg:hidden flex gap-2 mb-7">
            {[["$4.2M+", "Paid out"], ["284K+", "Members"], ["180+", "Countries"]].map(([v, l]) => (
              <div key={l} className="flex-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-2 text-center">
                <p className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">{v}</p>
                <p className="text-muted-foreground text-[10px]">{l}</p>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-bold mb-1">Welcome back 👋</h2>
          <p className="text-muted-foreground text-sm mb-7">Log in to continue earning</p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="you@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Password</FormLabel>
                    <Link href="/auth/forgot-password" className="text-xs text-emerald-600 hover:underline font-medium">
                      Forgot password?
                    </Link>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Input type={showPassword ? "text" : "password"} placeholder="••••••••" className="pr-10" {...field} />
                      <button type="button" tabIndex={-1}
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <Button type="submit" className="w-full h-11 text-base font-semibold bg-emerald-600 hover:bg-emerald-700" disabled={loginMutation.isPending}>
                {loginMutation.isPending
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Logging in…</>
                  : "Log In & Start Earning →"}
              </Button>
            </form>
          </Form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            New here?{" "}
            <Link href="/auth/register" className="font-semibold text-emerald-600 hover:underline">
              Create a free account
            </Link>
          </p>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-4 mt-8 text-muted-foreground">
            <div className="flex items-center gap-1.5 text-xs">
              <Shield className="w-3.5 h-3.5 text-emerald-500" />
              Secure login
            </div>
            <div className="w-px h-3 bg-border" />
            <div className="flex items-center gap-1.5 text-xs">
              <Zap className="w-3.5 h-3.5 text-yellow-500" />
              Instant payouts
            </div>
            <div className="w-px h-3 bg-border" />
            <div className="flex items-center gap-1.5 text-xs">
              <CircleDollarSign className="w-3.5 h-3.5 text-emerald-500" />
              Free to join
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
