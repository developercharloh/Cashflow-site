import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegister } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CircleDollarSign } from "lucide-react";

const COUNTRIES = [
  "Kenya", "Uganda", "Tanzania", "Rwanda", "Ethiopia", "Ghana", "Nigeria",
  "South Africa", "Egypt", "Morocco", "Algeria", "Tunisia", "Senegal",
  "Ivory Coast", "Cameroon", "Zimbabwe", "Zambia", "Mozambique", "Angola",
  "Botswana", "Namibia", "United States", "United Kingdom", "Canada",
  "Australia", "India", "Philippines", "Bangladesh", "Pakistan", "Other",
];

const formSchema = z.object({
  name: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  country: z.string().min(1, "Please select your country"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  referralCode: z.string().optional(),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const registerMutation = useRegister();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", email: "", country: "", password: "", referralCode: "" },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    registerMutation.mutate(
      { data: values } as any,
      {
        onSuccess: () => {
          toast({
            title: "Account created!",
            description: "Please log in with your new credentials.",
          });
          setLocation("/auth/login");
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
      <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-green-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-5">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg">
              <CircleDollarSign className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold tracking-tight">TaskEarn Pro</span>
          </div>
          <h1 className="text-3xl font-bold mb-1">Create Account</h1>
          <p className="text-muted-foreground text-sm">Start earning money from tasks today</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              {/* Full Name */}
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" className="bg-background/60" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Email */}
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="you@example.com" className="bg-background/60" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Country */}
              <FormField control={form.control} name="country" render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-background/60">
                        <SelectValue placeholder="Select your country" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Password */}
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="At least 6 characters" className="bg-background/60" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Referral Code */}
              <FormField control={form.control} name="referralCode" render={({ field }) => (
                <FormItem>
                  <FormLabel>Referral Code <span className="text-muted-foreground text-xs font-normal">(Optional)</span></FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. JOIN2025" className="bg-background/60" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <Button type="submit" className="w-full h-12 text-base mt-2" disabled={registerMutation.isPending}>
                {registerMutation.isPending
                  ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Creating account…</>
                  : "Create Account"}
              </Button>
            </form>
          </Form>

          <div className="mt-5 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link href="/auth/login" className="font-semibold text-primary hover:underline">Log in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
