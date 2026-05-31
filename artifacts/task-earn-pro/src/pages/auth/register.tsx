import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(7, "Enter a valid phone number"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  referralCode: z.string().optional(),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const { setToken } = useAuth();
  const { toast } = useToast();
  const registerMutation = useRegister();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", email: "", phone: "", password: "", referralCode: "" },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    registerMutation.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          setToken(data.token);
          toast({ title: "Account created!", description: "Welcome to TaskEarn Pro." });
          if (!data.user.quizCompleted) {
            setLocation("/quiz");
          } else {
            setLocation("/dashboard");
          }
        },
        onError: (error: any) => {
          toast({
            title: "Registration failed",
            description: error?.data?.error ?? error.message ?? "An error occurred.",
            variant: "destructive",
          });
        },
      }
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background relative overflow-hidden">
      <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-success/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
              T
            </div>
            <span className="text-2xl font-bold tracking-tight">TaskEarn Pro</span>
          </Link>
          <h1 className="text-3xl font-bold mb-2">Create Account</h1>
          <p className="text-muted-foreground">Start your journey to daily earnings</p>
        </div>

        <div className="glassmorphism rounded-2xl p-8 shadow-2xl">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" className="bg-background/50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="you@example.com" className="bg-background/50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="+254 700 000 000" className="bg-background/50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" className="bg-background/50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="referralCode" render={({ field }) => (
                <FormItem>
                  <FormLabel>Referral Code <span className="text-muted-foreground text-xs">(Optional)</span></FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. JOIN2025" className="bg-background/50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <Button type="submit" className="w-full h-12 text-base mt-2" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Creating account...</>
                ) : "Create Account"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link href="/auth/login" className="font-medium text-primary hover:underline">Log in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
