import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useVerifyEmail, getGetMeQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";

const formSchema = z.object({
  code: z.string().min(6, "Enter the 6-digit code"),
});

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useVerifyEmail();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { code: "" },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    mutation.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "Email Verified!", description: "Your email has been verified successfully." });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        if (!user?.quizCompleted) {
          setLocation("/quiz");
        } else {
          setLocation("/dashboard");
        }
      },
      onError: () => {
        toast({ title: "Invalid Code", description: "The code you entered is incorrect.", variant: "destructive" });
      }
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Verify Your Email</h1>
          <p className="text-muted-foreground text-sm">
            Enter the 6-digit code sent to <span className="text-foreground font-medium">{user?.email}</span>
          </p>
          <p className="text-xs text-muted-foreground">For demo purposes, use code: <strong>123456</strong></p>
        </div>

        <Card className="border-border">
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="code" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification Code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="000000"
                        maxLength={6}
                        className="text-center text-2xl tracking-widest font-mono"
                        data-testid="input-code"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-verify">
                  {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Verify Email
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
