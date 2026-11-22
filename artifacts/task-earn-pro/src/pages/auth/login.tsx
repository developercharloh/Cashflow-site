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
import { Loader2, CircleDollarSign, Shield, Eye, EyeOff } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const formSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  agreedToTerms: z.boolean().refine(val => val === true, {
    message: "You must agree to the Terms and Conditions to continue",
  }),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { setToken } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "", agreedToTerms: false },
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
          <span className="text-xl font-bold tracking-tight">Lipwa Tasks</span>
        </div>

        <div className="space-y-8 relative z-10">
          {/* Headline */}
          <div>
            <p className="text-5xl font-extrabold leading-tight mb-4">
              Welcome back.<br />Pick up where you left off.
            </p>
            <p className="text-white/60 text-sm leading-relaxed">
              Sign in to explore academic writing, data entry, transcription, AI training, Simple Quiz, and your wallet.
            </p>
          </div>

          <div className="space-y-3">
            {["Four illustrative freelance work areas", "One separate platform-funded Simple Quiz", "Soft Loans and Forex are coming soon"].map((text) => (
              <div key={text} className="flex items-center gap-3"><span className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-emerald-300">•</span><span className="text-sm text-white/80">{text}</span></div>
            ))}
          </div>
        </div>

        <p className="text-white/25 text-xs relative z-10">© {new Date().getFullYear()} Lipwa Tasks</p>
      </div>

      {/* ── Right panel – login form ── */}
      <div className="flex-1 flex items-center justify-center p-5">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
              <CircleDollarSign className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">Lipwa Tasks</span>
          </div>

          <h2 className="text-2xl font-bold mb-1">Welcome back</h2>
          <p className="text-muted-foreground text-sm mb-7">Log in to open your Lipwa Tasks account.</p>

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

              <FormField control={form.control} name="agreedToTerms" render={({ field }) => (
                <FormItem>
                  <div className="flex items-start gap-3">
                    <FormControl>
                      <Checkbox
                        id="terms-login"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="mt-0.5"
                      />
                    </FormControl>
                    <label htmlFor="terms-login" className="text-sm text-muted-foreground leading-snug cursor-pointer select-none">
                      I agree to the{" "}
                      <Link href="/terms" className="text-emerald-600 hover:underline font-medium">
                        Terms and Conditions
                      </Link>
                    </label>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              <Button type="submit" className="w-full h-11 text-base font-semibold bg-emerald-600 hover:bg-emerald-700" disabled={loginMutation.isPending}>
                {loginMutation.isPending
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Logging in…</>
                  : "Log in"}
              </Button>
            </form>
          </Form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            New here?{" "}
              <Link href="/auth/register" className="font-semibold text-emerald-600 hover:underline">
              Create an account
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
              <CircleDollarSign className="w-3.5 h-3.5 text-emerald-500" />
              Wallet access
            </div>
            <div className="w-px h-3 bg-border" />
            <div className="flex items-center gap-1.5 text-xs">
              <Shield className="w-3.5 h-3.5 text-emerald-500" />
              Privacy minded
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
