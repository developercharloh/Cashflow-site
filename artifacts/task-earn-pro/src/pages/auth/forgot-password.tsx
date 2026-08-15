import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useForgotPassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Mail } from "lucide-react";
import { useState } from "react";

const formSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export default function ForgotPassword() {
  const { toast } = useToast();
  const [sent, setSent] = useState(false);
  const mutation = useForgotPassword();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "" },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    mutation.mutate({ data: values }, {
      onSuccess: () => {
        setSent(true);
        toast({ title: "Reset Link Sent", description: "Check your email for the reset link." });
      },
      onError: () => {
        toast({ title: "Error", description: "Something went wrong. Try again.", variant: "destructive" });
      }
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
            <Mail className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Forgot Password?</h1>
          <p className="text-muted-foreground text-sm">Enter your email and we'll send you a reset link</p>
        </div>

        <Card className="border-border">
          <CardContent className="pt-6">
            {sent ? (
              <div className="text-center space-y-4 py-4">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                  <Mail className="w-6 h-6 text-green-500" />
                </div>
                <p className="text-sm text-muted-foreground">We sent a reset link to your email address. Check your inbox.</p>
                <Link href="/auth/login">
                  <Button variant="outline" className="w-full">Back to Login</Button>
                </Link>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@example.com" data-testid="input-email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-send-reset">
                    {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Send Reset Link
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>

        <Link href="/auth/login">
          <Button variant="ghost" className="w-full gap-2 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />Back to Login
          </Button>
        </Link>
      </div>
    </div>
  );
}
